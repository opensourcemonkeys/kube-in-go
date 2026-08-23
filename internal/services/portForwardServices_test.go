package services_k8sclient

import (
	"context"
	"fmt"
	"net"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"kube-ins/internal/models"
)

func resetPortForwardRegistry(t *testing.T) {
	t.Helper()
	pfMu.Lock()
	pfSessions = make(map[string]*pfSession)
	pfMu.Unlock()
}

// newTestSession registers a session without touching a cluster. StartPortForward
// cannot be used here — it dials — but everything the registry rules are about
// (identity removal, idempotent stop, snapshot ordering) lives below that.
func newTestSession(t *testing.T, id string, startedAt string) *pfSession {
	t.Helper()
	s := &pfSession{
		id:        id,
		req:       PortForwardRequest{ClusterName: "c", Kind: pfKindPod, Name: "p", Namespace: "ns", RemotePort: 80},
		startedAt: startedAt,
		stop:      make(chan struct{}),
	}
	s.st = pfState{status: PFStatusReady, localPort: 8080, targetPort: 80, everReady: true}
	pfMu.Lock()
	pfSessions[id] = s
	pfMu.Unlock()
	return s
}

func TestPortForwardRemoveUsesIdentityNotKey(t *testing.T) {
	resetPortForwardRegistry(t)

	old := newTestSession(t, "same-id", "2024-01-01T00:00:00Z")
	// A replacement registers under the same id, as it would if the frontend
	// restarted a forward before the old goroutine had finished unwinding.
	replacement := newTestSession(t, "same-id", "2024-01-01T00:01:00Z")

	// The old session's cleanup must not evict the live replacement.
	pfRemove("same-id", old)

	pfMu.Lock()
	cur, ok := pfSessions["same-id"]
	pfMu.Unlock()
	if !ok {
		t.Fatal("replacement was evicted by the old session's cleanup")
	}
	if cur != replacement {
		t.Fatal("registry holds the wrong session")
	}

	// The replacement's own cleanup does remove it.
	pfRemove("same-id", replacement)
	pfMu.Lock()
	_, ok = pfSessions["same-id"]
	pfMu.Unlock()
	if ok {
		t.Fatal("replacement was not removed by its own cleanup")
	}
}

func TestStopPortForwardIsIdempotent(t *testing.T) {
	resetPortForwardRegistry(t)
	newTestSession(t, "a", "2024-01-01T00:00:00Z")

	if err := StopPortForward("a"); err != nil {
		t.Fatalf("first stop: %v", err)
	}
	// Still registered (run() is what removes a live session), so a second stop
	// must not panic on the already-closed channel.
	if err := StopPortForward("a"); err != nil {
		t.Fatalf("second stop: %v", err)
	}
	if err := StopPortForward("missing"); err == nil {
		t.Fatal("stopping an unknown id should report an error")
	}
}

func TestStopAllPortForwardsClosesEverySession(t *testing.T) {
	resetPortForwardRegistry(t)
	a := newTestSession(t, "a", "2024-01-01T00:00:00Z")
	b := newTestSession(t, "b", "2024-01-01T00:00:01Z")

	StopAllPortForwards()
	StopAllPortForwards() // idempotent

	for name, s := range map[string]*pfSession{"a": a, "b": b} {
		select {
		case <-s.stop:
		default:
			t.Fatalf("session %s was not stopped", name)
		}
	}
}

func TestListPortForwardsIsOrderedByStartTime(t *testing.T) {
	resetPortForwardRegistry(t)
	newTestSession(t, "second", "2024-01-01T00:00:02Z")
	newTestSession(t, "first", "2024-01-01T00:00:01Z")
	newTestSession(t, "third", "2024-01-01T00:00:03Z")

	got := ListPortForwards()
	want := []string{"first", "second", "third"}
	if len(got) != len(want) {
		t.Fatalf("got %d rows, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i].ID != want[i] {
			t.Fatalf("row %d is %q, want %q", i, got[i].ID, want[i])
		}
	}
	if got[0].Address != pfLoopbackAddress {
		t.Fatalf("address is %q, want %q", got[0].Address, pfLoopbackAddress)
	}
}

func TestReconnectRuleFollowsTargetKind(t *testing.T) {
	// The rule the lifecycle rests on: re-resolving a workload is what makes a
	// tunnel survive a rolling restart, while silently moving a pinned pod's
	// tunnel to a different pod would answer a question nobody asked.
	for _, tc := range []struct {
		kind string
		want bool
	}{
		{pfKindPod, false},
		{"Pod", false},
		{pfKindDeployment, true},
		{pfKindStatefulSet, true},
		{pfKindReplicaSet, true},
		{pfKindService, true},
	} {
		got := reconnectForKind(tc.kind)
		if got != tc.want {
			t.Fatalf("kind %q: reconnect=%v, want %v", tc.kind, got, tc.want)
		}
	}
}

func TestSuggestLocalPortSkipsPortsInUse(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("cannot bind loopback: %v", err)
	}
	defer ln.Close()
	busy := ln.Addr().(*net.TCPAddr).Port

	if got := SuggestLocalPort(busy); got == busy {
		t.Fatalf("suggested the port that is in use (%d)", busy)
	}
	if got := SuggestLocalPort(busy); got == 0 {
		t.Fatal("expected a free port near the busy one, got the auto-assign sentinel")
	}
	if got := SuggestLocalPort(0); got != 0 {
		t.Fatalf("SuggestLocalPort(0) = %d, want 0 (auto)", got)
	}
	if got := SuggestLocalPort(70000); got != 0 {
		t.Fatalf("SuggestLocalPort(70000) = %d, want 0 (auto)", got)
	}
}

func TestSuggestLocalPortPrefersTheRemotePort(t *testing.T) {
	// Find a port that is definitely free, then ask for it back.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("cannot bind loopback: %v", err)
	}
	free := ln.Addr().(*net.TCPAddr).Port
	ln.Close()
	// Give the kernel a moment; a listener has no TIME_WAIT, so this is only
	// belt and braces on slower CI machines.
	time.Sleep(10 * time.Millisecond)

	if got := SuggestLocalPort(free); got != free {
		t.Fatalf("SuggestLocalPort(%d) = %d, want the same port back", free, got)
	}
}

func TestResolveServiceTargetPort(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "api-0"},
		Spec: corev1.PodSpec{Containers: []corev1.Container{{
			Name: "api",
			Ports: []corev1.ContainerPort{
				{Name: "http", ContainerPort: 8080},
				{Name: "metrics", ContainerPort: 9090},
			},
		}}},
	}

	for _, tc := range []struct {
		name    string
		sp      corev1.ServicePort
		want    int
		wantErr bool
	}{
		{"numeric targetPort", corev1.ServicePort{Port: 80, TargetPort: intstr.FromInt32(8080)}, 8080, false},
		{"unset targetPort defaults to the service port", corev1.ServicePort{Port: 8080}, 8080, false},
		{"named targetPort", corev1.ServicePort{Port: 80, TargetPort: intstr.FromString("http")}, 8080, false},
		{"second named targetPort", corev1.ServicePort{Port: 9090, TargetPort: intstr.FromString("metrics")}, 9090, false},
		{"unknown name", corev1.ServicePort{Port: 80, TargetPort: intstr.FromString("grpc")}, 0, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := resolveServiceTargetPort(&tc.sp, pod)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected an error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

func TestServicePortByNumber(t *testing.T) {
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "api", Namespace: "ns"},
		Spec: corev1.ServiceSpec{Ports: []corev1.ServicePort{
			{Name: "http", Port: 80},
			{Name: "metrics", Port: 9090},
		}},
	}
	sp, err := servicePortByNumber(svc, 9090)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sp.Name != "metrics" {
		t.Fatalf("got port %q, want metrics", sp.Name)
	}
	if _, err := servicePortByNumber(svc, 443); err == nil {
		t.Fatal("expected an error for a port the service does not expose")
	}
}

func TestPodIsReady(t *testing.T) {
	ready := func(p *corev1.Pod) bool { return podIsReady(p) }

	running := &corev1.Pod{
		Status: corev1.PodStatus{
			Phase:             corev1.PodRunning,
			ContainerStatuses: []corev1.ContainerStatus{{Ready: true}, {Ready: true}},
		},
	}
	if !ready(running) {
		t.Fatal("a running pod with all containers ready should be selectable")
	}

	oneNotReady := running.DeepCopy()
	oneNotReady.Status.ContainerStatuses[1].Ready = false
	if ready(oneNotReady) {
		t.Fatal("a pod with a not-ready container would accept the connection and refuse every request")
	}

	pending := running.DeepCopy()
	pending.Status.Phase = corev1.PodPending
	if ready(pending) {
		t.Fatal("a pending pod should not be selectable")
	}

	terminating := running.DeepCopy()
	now := metav1.Now()
	terminating.DeletionTimestamp = &now
	if ready(terminating) {
		t.Fatal("a terminating pod should not be selectable")
	}

	noStatuses := &corev1.Pod{Status: corev1.PodStatus{Phase: corev1.PodRunning}}
	if ready(noStatuses) {
		t.Fatal("a pod with no container statuses is not known to be ready")
	}
}

func TestContainerPortOptions(t *testing.T) {
	spec := &corev1.PodSpec{Containers: []corev1.Container{
		{Name: "api", Ports: []corev1.ContainerPort{{Name: "http", ContainerPort: 8080}}},
		{Name: "sidecar", Ports: []corev1.ContainerPort{{Name: "dns", ContainerPort: 53, Protocol: corev1.ProtocolUDP}}},
	}}
	got := containerPortOptions(spec)
	want := []models.PortOption{
		{Name: "http", Port: 8080, Protocol: "TCP", ContainerName: "api", Hint: "http"},
		{Name: "dns", Port: 53, Protocol: "UDP", ContainerName: "sidecar", Hint: ""},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d options, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("option %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestPortHint(t *testing.T) {
	for _, tc := range []struct {
		name string
		port int
		want string
	}{
		{"http", 8080, "http"},
		{"https", 8443, "https"},
		{"", 80, "http"},
		{"", 443, "https"},
		{"web", 4200, "http"},
		{"metrics", 9091, "http"},
		{"", 5432, ""}, // postgres: no browser button
		{"psql", 5432, ""},
		{"", 6379, ""}, // redis
		{"grpc", 50051, ""},
	} {
		t.Run(fmt.Sprintf("%s/%d", tc.name, tc.port), func(t *testing.T) {
			if got := portHint(tc.name, tc.port); got != tc.want {
				t.Fatalf("portHint(%q,%d) = %q, want %q", tc.name, tc.port, got, tc.want)
			}
		})
	}
}

// TestStartReturnsWhenReadyNotWhenTunnelEnds pins the contract StartPortForward
// depends on: run() must report the first outcome as soon as the tunnel is
// *ready*, not when it finally closes.
//
// Getting this wrong does not look like a bug in the tunnel — the forward comes
// up and works. It looks like a frozen app: the RPC never returns, so the
// promise behind the Start button never settles and the dialog can neither
// close nor be cancelled, for as long as the tunnel lives.
func TestStartReturnsWhenReadyNotWhenTunnelEnds(t *testing.T) {
	resetPortForwardRegistry(t)

	s := newPFSession("ready-test", PortForwardRequest{
		ClusterName: "c", Kind: pfKindService, Name: "api", Namespace: "ns", RemotePort: 80,
	}, nil, nil, nil)

	// Stand in for the real dial: come up immediately, then serve until stopped
	// — exactly what a healthy tunnel does.
	serving := make(chan struct{})
	s.resolve = func(context.Context) (forwardTarget, error) {
		return forwardTarget{podName: "api-0", targetPort: 8080}, nil
	}
	s.attempt = func(_ forwardTarget, _ int, onReady func()) error {
		s.update(func(st *pfState) {
			st.status = PFStatusReady
			st.localPort = 8080
			st.everReady = true
		})
		onReady()
		<-serving
		return nil
	}

	first := make(chan error, 1)
	go s.run(first)

	select {
	case err := <-first:
		if err != nil {
			t.Fatalf("a tunnel that came up reported an error: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("StartPortForward would still be blocked: run() did not report once the tunnel was ready")
	}

	if got := s.snapshot().Status; got != PFStatusReady {
		t.Fatalf("status is %q, want %q", got, PFStatusReady)
	}

	// Winding down must not double-report onto the (buffered, size 1) channel.
	close(serving)
	s.close()
}

// TestStartTimesOutRatherThanBlockingForever covers the backstop. Whatever goes
// wrong inside a session, StartPortForward has to hand its caller *something*:
// it is an RPC, and a call that never returns is a dialog the user cannot even
// cancel.
func TestStartTimesOutRatherThanBlockingForever(t *testing.T) {
	resetPortForwardRegistry(t)

	s := newPFSession("stuck", PortForwardRequest{Kind: pfKindPod, Name: "p", Namespace: "ns", RemotePort: 80}, nil, nil, nil)

	first := make(chan error, 1) // nothing ever reports on it
	done := make(chan struct{})
	go func() {
		defer close(done)
		select {
		case <-first:
		case <-time.After(50 * time.Millisecond):
			// Stand-in for the real select in StartPortForward, scaled down.
			s.close()
		}
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("the start path blocked with no way out")
	}
	if !s.stopped() {
		t.Fatal("the timeout path must stop the session, or its tunnel outlives the caller that gave up on it")
	}
}
