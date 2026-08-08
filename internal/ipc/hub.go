package ipc

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"runtime/debug"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"kube-ins/internal/models"
)

// hubAddr is a var rather than a const so hub_test.go can point it at an
// ephemeral port and never collide with an app already running on 34200.
var hubAddr = "localhost:34200"

func hubWSURL() string { return "ws://" + hubAddr + "/ws" }

var upgrader = websocket.Upgrader{
	// Browsers always send Origin on a WebSocket handshake and no legitimate hub
	// client is a browser, so an empty Origin is the only acceptable value. This
	// alone closes the hole where any page the user visits could dial
	// ws://localhost:34200/ws, enumerate instances and inject a panel. The token
	// checked in handleWS additionally keeps out another local account.
	CheckOrigin: func(r *http.Request) bool { return r.Header.Get("Origin") == "" },
}

// shortID trims an identifier for display. Never slice an ID directly: the
// register payload arrives unvalidated off the wire, and a short one used to
// panic the connection handler mid-registration.
func shortID(s string) string {
	if len(s) > 8 {
		return s[:8]
	}
	return s
}

// ─── wsClient ────────────────────────────────────────────────────────────────

type wsClient struct {
	id     string
	name   string
	conn   *websocket.Conn
	sendCh chan []byte
	once   sync.Once
	done   chan struct{}
}

func (c *wsClient) send(msg []byte) {
	select {
	case c.sendCh <- msg:
	default:
	}
}

func (c *wsClient) close() {
	c.once.Do(func() {
		close(c.done)
		_ = c.conn.Close()
	})
}

func (c *wsClient) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.close()
	}()
	for {
		select {
		case <-c.done:
			return
		case msg := <-c.sendCh:
			// A deadline that cannot be set means the connection is already gone;
			// the WriteMessage below reports it properly.
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ─── InstanceHub ─────────────────────────────────���───────────────────────────

type InstanceHub struct {
	InstanceID string

	// instanceName is unexported and guarded by instancesMu: it is assigned by
	// whichever process is currently the hub server and reassigned when that
	// role moves, while the frontend polls GetInstances/GetSelfInfo from another
	// goroutine. Reading a string field being reassigned concurrently is a torn
	// read, not just a stale one.
	instanceName string

	wailsCtx      context.Context
	onTabReceived func(panel models.SerializedPanel)

	// token is the shared secret from ~/.kube-ins/.hubtoken. Empty means it could
	// not be established, in which case the hub never starts — see run().
	token string

	isServer atomic.Bool

	// Server state
	clients     map[string]*wsClient
	clientsMu   sync.Mutex
	nameCounter int

	// Client state
	serverConn *websocket.Conn
	serverMu   sync.Mutex

	// Shared: list of all known instances (updated on instance list broadcasts)
	knownInstances []models.InstanceInfo
	instancesMu    sync.RWMutex
}

// NewInstanceHub creates and starts the hub in a background goroutine.
// onTabReceived is called when this instance receives a panel transfer.
func NewInstanceHub(wailsCtx context.Context, onTabReceived func(panel models.SerializedPanel)) *InstanceHub {
	h := &InstanceHub{
		InstanceID:    uuid.New().String(),
		instanceName:  "Instance",
		clients:       make(map[string]*wsClient),
		wailsCtx:      wailsCtx,
		onTabReceived: onTabReceived,
	}

	token, err := ensureHubToken()
	if err != nil {
		// Deliberately not a fallback to an unauthenticated hub: without the
		// token any page the user visits could dial the fixed port, list every
		// running instance and inject a panel. Discovery stays off; the app is
		// otherwise unaffected, GetInstances just reports this process alone.
		log.Printf("[IPC] instance discovery disabled: %v", err)
		return h
	}
	h.token = token

	go h.run(wailsCtx)
	return h
}

func (h *InstanceHub) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		if h.tryBecomeServer(ctx) {
			// ran as server until it stopped; loop to retry
		} else {
			h.connectAsClient(ctx)
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(300 * time.Millisecond):
		}
	}
}

// ─── Server Mode ─────────────────────────────────────────────────────────────

func (h *InstanceHub) tryBecomeServer(ctx context.Context) bool {
	ln, err := net.Listen("tcp", hubAddr)
	if err != nil {
		return false
	}

	h.isServer.Store(true)
	h.clientsMu.Lock()
	h.nameCounter = 1
	h.clientsMu.Unlock()
	h.instancesMu.Lock()
	h.instanceName = "Instance 1"
	h.knownInstances = []models.InstanceInfo{{ID: h.InstanceID, Name: h.instanceName}}
	h.instancesMu.Unlock()

	log.Printf("[IPC] Hub started: Instance 1 (%s)", shortID(h.InstanceID))

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", h.handleWS)
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}

	go func() {
		<-ctx.Done()
		_ = srv.Close()
	}()

	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		log.Printf("[IPC] Hub server stopped: %v", err)
	}

	h.isServer.Store(false)
	h.clientsMu.Lock()
	for _, c := range h.clients {
		c.close()
	}
	h.clients = make(map[string]*wsClient)
	h.clientsMu.Unlock()

	log.Println("[IPC] Hub stopped")
	return true
}

func (h *InstanceHub) handleWS(w http.ResponseWriter, r *http.Request) {
	// Authenticate before upgrading, and answer with a plain 403 rather than a
	// silently dropped socket so a rejection is visible in the log on both ends.
	tok := r.Header.Get("X-Kube-Ins-Hub-Token")
	if tok == "" {
		// A WebSocket handshake cannot always carry a custom header, so the
		// query parameter is the form clients actually use. Same split as
		// rpcserver.go's authorized().
		tok = r.URL.Query().Get("token")
	}
	// The empty check is not redundant: ConstantTimeCompare reports two empty
	// slices as equal, so a hub that somehow ran without a token would accept
	// everyone. run() already refuses to start in that state — this keeps the
	// invariant local to the check that depends on it.
	if h.token == "" || subtle.ConstantTimeCompare([]byte(tok), []byte(h.token)) != 1 {
		log.Printf("[IPC] rejected unauthenticated connection from %s", r.RemoteAddr)
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		// Almost always CheckOrigin rejecting a browser. Worth a line: it is the
		// exact attack this handshake exists to stop, and gorilla answers 403
		// without telling anyone.
		log.Printf("[IPC] handshake refused for %s (origin %q): %v",
			r.RemoteAddr, r.Header.Get("Origin"), err)
		return
	}

	// Expect a REGISTER message within 5 seconds.
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, data, err := conn.ReadMessage()
	_ = conn.SetReadDeadline(time.Time{})
	if err != nil {
		_ = conn.Close()
		return
	}

	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil || msg.Type != MsgRegister {
		_ = conn.Close()
		return
	}

	var reg RegisterPayload
	if err := json.Unmarshal(msg.Payload, &reg); err != nil {
		_ = conn.Close()
		return
	}

	// Validate the wire payload BEFORE it reaches the client map. Registering
	// first and validating after used to leave a permanently registered client
	// with no writePump behind: its 64-slot sendCh filled up, every later send()
	// hit the default: branch, and the ghost stayed in the instance list forever.
	if _, err := uuid.Parse(reg.ID); err != nil {
		log.Printf("[IPC] rejected register with malformed id %q", shortID(reg.ID))
		_ = conn.Close()
		return
	}
	if reg.ID == h.InstanceID {
		log.Print("[IPC] rejected register claiming this hub's own id")
		_ = conn.Close()
		return
	}

	h.clientsMu.Lock()
	if _, exists := h.clients[reg.ID]; exists {
		h.clientsMu.Unlock()
		// Overwriting would strand the first connection (never closed) and let
		// its cleanup delete the second one's entry. Neither instance would then
		// be reachable by TransferTab.
		log.Printf("[IPC] rejected duplicate register for %s", shortID(reg.ID))
		_ = conn.Close()
		return
	}
	h.nameCounter++
	clientName := fmt.Sprintf("Instance %d", h.nameCounter)
	client := &wsClient{
		id:     reg.ID,
		name:   clientName,
		conn:   conn,
		sendCh: make(chan []byte, 64),
		done:   make(chan struct{}),
	}
	h.clients[reg.ID] = client
	h.clientsMu.Unlock()

	// One exit path from here on. Deleting by pointer identity means a late
	// cleanup can never remove a newer client that reused the id.
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[IPC] panic serving client %s: %v\n%s", shortID(client.id), r, debug.Stack())
		}
		h.clientsMu.Lock()
		if cur, ok := h.clients[client.id]; ok && cur == client {
			delete(h.clients, client.id)
		}
		h.clientsMu.Unlock()
		client.close()

		log.Printf("[IPC] Client disconnected: %s", client.name)
		h.broadcastInstanceList()
	}()

	log.Printf("[IPC] Client connected: %s (%s)", clientName, shortID(reg.ID))
	h.broadcastInstanceList()

	go client.writePump()
	h.serverReadPump(client)
}

func (h *InstanceHub) serverReadPump(c *wsClient) {
	c.conn.SetReadLimit(1 << 20)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		if msg.Type != MsgTransferTab {
			continue
		}

		var payload TransferPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			continue
		}

		if payload.TargetInstanceID == h.InstanceID {
			h.onTabReceived(payload.Panel)
			continue
		}

		// Route to target client.
		h.clientsMu.Lock()
		target, ok := h.clients[payload.TargetInstanceID]
		h.clientsMu.Unlock()
		if ok {
			raw, _ := json.Marshal(msg)
			target.send(raw)
		}
	}
}

func (h *InstanceHub) broadcastInstanceList() {
	// Read self before taking clientsMu: instancesMu is otherwise never held
	// while clientsMu is, and nesting them here would invent a lock order.
	self := h.GetSelfInfo()

	h.clientsMu.Lock()
	instances := []models.InstanceInfo{self}
	for _, c := range h.clients {
		instances = append(instances, models.InstanceInfo{ID: c.id, Name: c.name})
	}
	h.clientsMu.Unlock()

	h.instancesMu.Lock()
	h.knownInstances = instances
	h.instancesMu.Unlock()

	listPayload, _ := json.Marshal(InstanceListPayload{Instances: instances})
	raw, _ := json.Marshal(Message{Type: MsgInstanceList, Payload: listPayload})

	h.clientsMu.Lock()
	for _, c := range h.clients {
		c.send(raw)
	}
	h.clientsMu.Unlock()
}

// ─── Client Mode ─────────────────────────────────────────────────────────────

func (h *InstanceHub) connectAsClient(ctx context.Context) {
	dialer := websocket.Dialer{HandshakeTimeout: 3 * time.Second}
	// The token goes in the query string, not a header: this is the one form a
	// WebSocket handshake can always carry, and it keeps the server on a single
	// code path. The listener is loopback-only, so the URL never leaves the host.
	dialURL := hubWSURL() + "?token=" + url.QueryEscape(h.token)
	conn, _, err := dialer.DialContext(ctx, dialURL, nil)
	if err != nil {
		return
	}

	regPayload, _ := json.Marshal(RegisterPayload{ID: h.InstanceID})
	raw, _ := json.Marshal(Message{Type: MsgRegister, Payload: regPayload})
	if err := conn.WriteMessage(websocket.TextMessage, raw); err != nil {
		_ = conn.Close()
		return
	}

	h.serverMu.Lock()
	h.serverConn = conn
	h.serverMu.Unlock()

	log.Printf("[IPC] Connected to hub: %s", shortID(h.InstanceID))

	go func() {
		<-ctx.Done()
		_ = conn.Close()
	}()

	conn.SetReadLimit(1 << 20)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			break
		}
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case MsgInstanceList:
			var payload InstanceListPayload
			if err := json.Unmarshal(msg.Payload, &payload); err != nil {
				continue
			}
			h.instancesMu.Lock()
			h.knownInstances = payload.Instances
			for _, inst := range payload.Instances {
				if inst.ID == h.InstanceID {
					h.instanceName = inst.Name
					break
				}
			}
			h.instancesMu.Unlock()

		case MsgTransferTab:
			var payload TransferPayload
			if err := json.Unmarshal(msg.Payload, &payload); err != nil {
				continue
			}
			if payload.TargetInstanceID == h.InstanceID {
				h.onTabReceived(payload.Panel)
			}
		}
	}

	h.serverMu.Lock()
	h.serverConn = nil
	h.serverMu.Unlock()
	_ = conn.Close()

	log.Println("[IPC] Disconnected from hub")
}

// ─── Public API ──────────────────────────────────────────────────────────────

// GetInstances returns all connected instances including self.
func (h *InstanceHub) GetInstances() []models.InstanceInfo {
	h.instancesMu.RLock()
	defer h.instancesMu.RUnlock()
	if len(h.knownInstances) == 0 {
		return []models.InstanceInfo{{ID: h.InstanceID, Name: h.instanceName}}
	}
	result := make([]models.InstanceInfo, len(h.knownInstances))
	copy(result, h.knownInstances)
	return result
}

// GetSelfInfo returns the identity of this instance.
func (h *InstanceHub) GetSelfInfo() models.InstanceInfo {
	h.instancesMu.RLock()
	defer h.instancesMu.RUnlock()
	return models.InstanceInfo{ID: h.InstanceID, Name: h.instanceName}
}

// TransferTab sends a panel to the given target instance.
func (h *InstanceHub) TransferTab(targetInstanceID string, panel models.SerializedPanel) error {
	if targetInstanceID == h.InstanceID {
		h.onTabReceived(panel)
		return nil
	}

	payload, _ := json.Marshal(TransferPayload{
		TargetInstanceID: targetInstanceID,
		Panel:            panel,
	})
	raw, _ := json.Marshal(Message{Type: MsgTransferTab, Payload: payload})

	if h.isServer.Load() {
		h.clientsMu.Lock()
		target, ok := h.clients[targetInstanceID]
		h.clientsMu.Unlock()
		if !ok {
			return fmt.Errorf("instance %s not connected", targetInstanceID)
		}
		target.send(raw)
		return nil
	}

	h.serverMu.Lock()
	conn := h.serverConn
	h.serverMu.Unlock()
	if conn == nil {
		return fmt.Errorf("not connected to hub")
	}
	if err := conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, raw)
}
