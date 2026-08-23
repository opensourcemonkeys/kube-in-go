package services_k8sclient

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/util/httpstream"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"

	"kube-ins/internal/logging"
	"kube-ins/internal/models"
	"kube-ins/internal/safego"
)

// Port forwarding lives in a process-wide registry, not in a panel.
//
// Log and exec sessions are owned by the panel that opened them and die with
// it. A forward is the opposite: the user starts one, closes the tab and goes
// to work in their browser. Tearing the tunnel down on panel dispose would be
// indistinguishable from a fault, so nothing but an explicit stop or process
// exit closes one — and the "Port Forwards" view is a window onto this map
// rather than its owner.
const (
	PFStatusStarting     = "starting"
	PFStatusReady        = "ready"
	PFStatusReconnecting = "reconnecting"
	PFStatusError        = "error"
	PFStatusClosed       = "closed"
)

const (
	// pfLoopbackAddress is not configurable, and there is no frontend parameter
	// that can change it. A forwarded port is unauthenticated access to a
	// cluster workload; binding it anywhere reachable would hand that access to
	// the local network.
	pfLoopbackAddress = "127.0.0.1"

	pfReadyTimeout         = 15 * time.Second
	pfResolveTimeout       = 20 * time.Second
	pfMaxReconnectAttempts = 5

	// pfStartTimeout is a backstop, not a budget: resolve (20s) plus ready
	// (15s) already bound the worst case, so reaching it means the session
	// goroutine failed to report at all.
	//
	// It exists because of how that failure presents. StartPortForward is
	// called over RPC, so a session that never reports leaves the promise
	// behind the dialog's Start button unsettled — the tunnel comes up and
	// works, while the UI sits on a spinner that cannot even be cancelled. A
	// hang here is invisible in the backend and looks like a frozen app.
	pfStartTimeout = 45 * time.Second
)

var pfBackoff = []time.Duration{time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 15 * time.Second}

// PortForwardRequest is what the user asked for, before any resolution.
type PortForwardRequest struct {
	ClusterName string
	Kind        string
	Name        string
	Namespace   string
	LocalPort   int // 0 = let the kernel choose
	RemotePort  int
}

type pfState struct {
	podName    string
	localPort  int
	targetPort int
	status     string
	errText    string
	attempts   int
	everReady  bool
	// finished marks that run() has returned. A session that failed is kept in
	// the registry after that point so the user can still read the error and
	// restart it; this flag is how Stop knows it has a corpse to bury rather
	// than a tunnel to close.
	finished bool
}

type pfSession struct {
	// Immutable for the life of the session, so they need no lock.
	id        string
	req       PortForwardRequest
	reconnect bool
	startedAt string
	onEvent   func(models.PortForwardInfo)

	// The client and config are held rather than passed in, because a reconnect
	// happens long after the call that started the forward and has to build a
	// fresh dialer of its own.
	client *kubernetes.Clientset
	cfg    *rest.Config

	mu sync.Mutex
	st pfState

	stop     chan struct{}
	stopOnce sync.Once

	// resolve and attempt are the two steps run() drives. They are fields, not
	// direct calls, so a test can stand in for the dial: the contract that
	// matters here — report *when ready*, not when the tunnel ends — is
	// otherwise only observable against a live API server.
	resolve func(ctx context.Context) (forwardTarget, error)
	attempt func(t forwardTarget, localPort int, onReady func()) error
}

// newPFSession builds a session with the real resolve/attempt wired in.
func newPFSession(id string, req PortForwardRequest, client *kubernetes.Clientset, cfg *rest.Config, onEvent func(models.PortForwardInfo)) *pfSession {
	s := &pfSession{
		id:        id,
		req:       req,
		startedAt: time.Now().Format(time.RFC3339),
		onEvent:   onEvent,
		client:    client,
		cfg:       cfg,
		stop:      make(chan struct{}),
		// A pinned Pod is not reconnected to; a workload or service target is.
		reconnect: reconnectForKind(req.Kind),
	}
	s.st = pfState{status: PFStatusStarting, localPort: req.LocalPort}
	s.resolve = func(ctx context.Context) (forwardTarget, error) {
		return resolveForwardTarget(ctx, s.req.Kind, s.req.Namespace, s.req.Name, s.req.RemotePort, s.client)
	}
	s.attempt = s.runOnce
	return s
}

var (
	pfMu       sync.Mutex
	pfSessions = make(map[string]*pfSession)
)

func (s *pfSession) snapshot() models.PortForwardInfo {
	s.mu.Lock()
	st := s.st
	s.mu.Unlock()
	return models.PortForwardInfo{
		ID:           s.id,
		ClusterName:  s.req.ClusterName,
		Namespace:    s.req.Namespace,
		ResourceKind: s.req.Kind,
		ResourceName: s.req.Name,
		PodName:      st.podName,
		LocalPort:    st.localPort,
		RemotePort:   s.req.RemotePort,
		TargetPort:   st.targetPort,
		Address:      pfLoopbackAddress,
		Status:       st.status,
		Error:        st.errText,
		StartedAt:    s.startedAt,
		Attempts:     st.attempts,
		Hint:         portHint("", s.req.RemotePort),
		Reconnect:    s.reconnect,
	}
}

// update mutates the state under the lock and publishes the result outside it.
// Emitting while holding the lock would run frontend-facing transport code
// inside the critical section every status change passes through.
func (s *pfSession) update(fn func(*pfState)) {
	s.mu.Lock()
	fn(&s.st)
	s.mu.Unlock()
	if s.onEvent != nil {
		s.onEvent(s.snapshot())
	}
}

func (s *pfSession) setStatus(status string, err error) {
	s.update(func(st *pfState) {
		st.status = status
		st.errText = errText(err)
	})
}

func (s *pfSession) wasReady() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.st.everReady
}

func (s *pfSession) isFinished() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.st.finished
}

func (s *pfSession) emit() {
	if s.onEvent != nil {
		s.onEvent(s.snapshot())
	}
}

func (s *pfSession) boundPort() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.st.everReady {
		return s.st.localPort
	}
	return s.req.LocalPort
}

func (s *pfSession) stopped() bool {
	select {
	case <-s.stop:
		return true
	default:
		return false
	}
}

func (s *pfSession) close() { s.stopOnce.Do(func() { close(s.stop) }) }

// sleep waits for d, or returns false as soon as the session is stopped.
func (s *pfSession) sleep(d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return true
	case <-s.stop:
		return false
	}
}

// StartPortForward opens a tunnel and registers it. It returns only once the
// tunnel is ready (or has failed), so the caller can report the port that was
// actually bound — which matters when the user asked for an automatic one.
func StartPortForward(id string, req PortForwardRequest, client *kubernetes.Clientset, cfg *rest.Config, onEvent func(models.PortForwardInfo)) (models.PortForwardInfo, error) {
	if req.Namespace == "" || req.Name == "" {
		return models.PortForwardInfo{}, errNamespaceNameRequired
	}
	if req.RemotePort < 1 || req.RemotePort > 65535 {
		return models.PortForwardInfo{}, fmt.Errorf("remote port %d is out of range", req.RemotePort)
	}
	if req.LocalPort < 0 || req.LocalPort > 65535 {
		return models.PortForwardInfo{}, fmt.Errorf("local port %d is out of range", req.LocalPort)
	}
	if client == nil || cfg == nil {
		return models.PortForwardInfo{}, errors.New("no connection to the cluster")
	}
	if req.LocalPort > 0 && !localPortFree(req.LocalPort) {
		return models.PortForwardInfo{}, fmt.Errorf("local port %d is already in use", req.LocalPort)
	}

	s := newPFSession(id, req, client, cfg, onEvent)

	pfMu.Lock()
	if _, exists := pfSessions[id]; exists {
		pfMu.Unlock()
		return models.PortForwardInfo{}, fmt.Errorf("port forward %s is already registered", id)
	}
	pfSessions[id] = s
	pfMu.Unlock()

	s.emit()

	first := make(chan error, 1)
	safego.Go("services.portForward.session", func() { s.run(first) })

	select {
	case err := <-first:
		if err != nil {
			return models.PortForwardInfo{}, err
		}
	case <-time.After(pfStartTimeout):
		s.close()
		logging.With("portforward").Error("session did not report within the start timeout",
			"id", id, "target", req.Kind+"/"+req.Name, "timeout", pfStartTimeout.String())
		return models.PortForwardInfo{}, fmt.Errorf("port forward did not report a result within %s", pfStartTimeout)
	}
	return s.snapshot(), nil
}

// run owns the session for its whole life: connect, serve, and — for targets
// where it is the right answer — reconnect. It reports the outcome of the first
// attempt on first so StartPortForward can return synchronously.
func (s *pfSession) run(first chan<- error) {
	reported := false
	report := func(err error) {
		if !reported {
			reported = true
			first <- err
		}
	}
	// Nothing may leave StartPortForward blocked. safego recovers panics in this
	// goroutine, which would otherwise skip every report below.
	defer func() {
		report(errors.New("port forward ended unexpectedly"))
		s.mu.Lock()
		s.st.finished = true
		// Keep the row only for a tunnel that worked and then died: that is
		// the failure the user needs to see and act on, and dropping it would
		// make it vanish from the panel within one poll, unexplained. A forward
		// that never came up reports through StartPortForward's error instead,
		// straight into the dialog the user is still looking at.
		keep := s.st.status == PFStatusError && s.st.everReady
		s.mu.Unlock()
		if keep {
			s.emit()
			return
		}
		pfRemove(s.id, s)
		s.setStatus(PFStatusClosed, nil)
	}()

	log := logging.With("portforward")

	for attempt := 0; ; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), pfResolveTimeout)
		target, err := s.resolve(ctx)
		cancel()

		if err == nil {
			s.update(func(st *pfState) {
				st.podName = target.podName
				st.targetPort = target.targetPort
			})
			// report fires the moment the tunnel is serving. It cannot wait for
			// attempt to return: on the happy path that is when the tunnel
			// *ends*, which would leave StartPortForward — and the RPC, and the
			// dialog's Start button — blocked for the life of the forward.
			err = s.attempt(target, s.boundPort(), func() { report(nil) })
		}

		switch {
		case s.stopped():
			s.setStatus(PFStatusClosed, nil)
			report(errors.New("port forward was stopped"))
			return

		case !s.wasReady():
			// It never came up, so the caller is still waiting on Start and this
			// is its error. Retrying would only repeat a bad port or a missing
			// pod behind the user's back.
			s.setStatus(PFStatusError, orErr(err, "the tunnel could not be established"))
			report(orErr(err, "the tunnel could not be established"))
			return

		case !s.reconnect || attempt >= pfMaxReconnectAttempts-1:
			log.Info("port forward ended", "id", s.id, "reconnect", s.reconnect, "attempts", attempt, "err", errText(err))
			s.setStatus(PFStatusError, orErr(err, "the tunnel closed"))
			return
		}

		log.Info("port forward lost, reconnecting",
			"id", s.id, "attempt", attempt+1, "target", s.req.Kind+"/"+s.req.Name, "err", errText(err))
		s.update(func(st *pfState) {
			st.status = PFStatusReconnecting
			st.attempts = attempt + 1
			st.errText = errText(err)
		})
		if !s.sleep(pfBackoff[min(attempt, len(pfBackoff)-1)]) {
			s.setStatus(PFStatusClosed, nil)
			return
		}
	}
}

// runOnce establishes one tunnel and blocks until it ends. localPort is the
// port already bound by an earlier attempt, or the requested one on the first
// attempt: a reconnect must keep the same local address, or the browser tab the
// user left open is pointing at nothing.
func (s *pfSession) runOnce(t forwardTarget, localPort int, onReady func()) error {
	reqURL := s.client.CoreV1().RESTClient().Post().
		Resource("pods").
		Namespace(s.req.Namespace).
		Name(t.podName).
		SubResource("portforward").
		URL()

	dialer, err := newPortForwardDialer(s.cfg, reqURL)
	if err != nil {
		return err
	}

	// The forwarder gets its own stop channel so abandoning one attempt does not
	// end the session, while a session stop still ends the attempt.
	attemptStop := make(chan struct{})
	var attemptOnce sync.Once
	closeAttempt := func() { attemptOnce.Do(func() { close(attemptStop) }) }
	defer closeAttempt()

	done := make(chan struct{})
	defer close(done)
	safego.Go("services.portForward.stopWatch", func() {
		select {
		case <-s.stop:
			closeAttempt()
		case <-done:
		}
	})

	readyCh := make(chan struct{})
	out := pfLogWriter{id: s.id}

	fw, err := portforward.NewOnAddresses(
		dialer,
		[]string{pfLoopbackAddress},
		[]string{fmt.Sprintf("%d:%d", localPort, t.targetPort)},
		attemptStop, readyCh, out, out,
	)
	if err != nil {
		return err
	}

	errCh := make(chan error, 1)
	safego.Go("services.portForward.forward", func() {
		defer close(errCh)
		errCh <- fw.ForwardPorts()
	})

	select {
	case <-readyCh:
		bound := localPort
		if ports, perr := fw.GetPorts(); perr == nil && len(ports) > 0 {
			bound = int(ports[0].Local)
		}
		s.update(func(st *pfState) {
			st.status = PFStatusReady
			st.localPort = bound
			st.errText = ""
			st.everReady = true
		})
		onReady()
	case err := <-errCh:
		return orErr(err, "the tunnel closed before it was ready")
	case <-time.After(pfReadyTimeout):
		return fmt.Errorf("timed out after %s waiting for the tunnel to become ready", pfReadyTimeout)
	case <-s.stop:
		return nil
	}

	select {
	case err := <-errCh:
		return err
	case <-s.stop:
		return nil
	}
}

// newPortForwardDialer builds the dialer kubectl 1.30+ uses: SPDY tunnelled
// over WebSocket first, raw SPDY as the fallback. The plain SPDY upgrade is on
// its way out and some proxies already refuse it, while older API servers do
// not speak the WebSocket variant at all — only trying both works everywhere.
func newPortForwardDialer(cfg *rest.Config, u *url.URL) (httpstream.Dialer, error) {
	transport, upgrader, err := spdy.RoundTripperFor(cfg)
	if err != nil {
		return nil, err
	}
	spdyDialer := spdy.NewDialer(upgrader, &http.Client{Transport: transport}, "POST", u)

	wsDialer, err := portforward.NewSPDYOverWebsocketDialer(u, cfg)
	if err != nil {
		// Losing the preferred transport is not worth failing the forward over.
		logging.With("portforward").Debug("websocket dialer unavailable, using SPDY", "err", err.Error())
		return spdyDialer, nil
	}
	return portforward.NewFallbackDialer(wsDialer, spdyDialer, func(err error) bool {
		return httpstream.IsUpgradeFailure(err) || httpstream.IsHTTPSProxyError(err)
	}), nil
}

// StopPortForward closes a tunnel. It is idempotent: the frontend can send it
// twice, and the session goroutine calls the same close on its way out.
func StopPortForward(id string) error {
	pfMu.Lock()
	s, ok := pfSessions[id]
	pfMu.Unlock()
	if !ok {
		return fmt.Errorf("no port forward with id %s", id)
	}
	s.close()
	if s.isFinished() {
		// Already dead and only being kept so its error stayed on screen.
		// Stopping it is the user dismissing that row.
		pfRemove(id, s)
		s.setStatus(PFStatusClosed, nil)
	}
	return nil
}

// ListPortForwards snapshots the registry, oldest first.
func ListPortForwards() []models.PortForwardInfo {
	pfMu.Lock()
	out := make([]models.PortForwardInfo, 0, len(pfSessions))
	sessions := make([]*pfSession, 0, len(pfSessions))
	for _, s := range pfSessions {
		sessions = append(sessions, s)
	}
	pfMu.Unlock()

	for _, s := range sessions {
		out = append(out, s.snapshot())
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].StartedAt == out[j].StartedAt {
			return out[i].ID < out[j].ID
		}
		return out[i].StartedAt < out[j].StartedAt
	})
	return out
}

// StopAllPortForwards is called from the shutdown path so the process does not
// leave listeners behind.
func StopAllPortForwards() {
	pfMu.Lock()
	sessions := make([]*pfSession, 0, len(pfSessions))
	for _, s := range pfSessions {
		sessions = append(sessions, s)
	}
	pfMu.Unlock()

	for _, s := range sessions {
		s.close()
	}
}

// pfRemove removes a session by *identity*. Deleting by key would drop whatever
// is under that id at the time, which after a restart under the same id is the
// replacement's entry — stranding a live tunnel that nothing can then find or
// stop. Same rule as the exec and AI session registries.
func pfRemove(id string, s *pfSession) {
	pfMu.Lock()
	if cur, ok := pfSessions[id]; ok && cur == s {
		delete(pfSessions, id)
	}
	pfMu.Unlock()
	s.close()
}

// pfLogWriter turns the forwarder's chatter into debug log lines. client-go
// writes connection errors here and nowhere else, so discarding it would throw
// away the only explanation of a tunnel that keeps dropping.
type pfLogWriter struct{ id string }

func (w pfLogWriter) Write(p []byte) (int, error) {
	msg := strings.TrimRight(string(p), "\n")
	if msg != "" {
		logging.With("portforward").Debug("forwarder", "id", w.id, "msg", msg)
	}
	return len(p), nil
}

// reconnectForKind decides whether a dead tunnel should be re-established.
//
// A pinned Pod is not reconnected to: if that exact pod is gone, quietly moving
// the tunnel to a different one would answer a question the user did not ask.
// Workload and service targets are the opposite — resolving the target again is
// exactly what makes a tunnel survive a rolling restart, which is the case
// kubectl cannot handle.
func reconnectForKind(kind string) bool {
	return !strings.EqualFold(kind, pfKindPod)
}

func errText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func orErr(err error, fallback string) error {
	if err != nil {
		return err
	}
	return errors.New(fallback)
}
