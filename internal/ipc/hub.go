package ipc

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"kube-ins/internal/models"
)

const (
	hubAddr  = "localhost:34200"
	hubWSURL = "ws://localhost:34200/ws"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
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
		c.conn.Close()
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
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ─── InstanceHub ─────────────────────────────────���───────────────────────────

type InstanceHub struct {
	InstanceID   string
	InstanceName string

	wailsCtx      context.Context
	onTabReceived func(panel models.SerializedPanel)

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
		InstanceName:  "Instance",
		clients:       make(map[string]*wsClient),
		wailsCtx:      wailsCtx,
		onTabReceived: onTabReceived,
	}
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
	h.InstanceName = "Instance 1"
	h.instancesMu.Lock()
	h.knownInstances = []models.InstanceInfo{{ID: h.InstanceID, Name: h.InstanceName}}
	h.instancesMu.Unlock()

	fmt.Printf("[IPC] Hub started: %s (%s)\n", h.InstanceName, h.InstanceID[:8])

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", h.handleWS)
	srv := &http.Server{Handler: mux}

	go func() {
		<-ctx.Done()
		srv.Close()
	}()

	srv.Serve(ln) // blocks until srv.Close()

	h.isServer.Store(false)
	h.clientsMu.Lock()
	for _, c := range h.clients {
		c.close()
	}
	h.clients = make(map[string]*wsClient)
	h.clientsMu.Unlock()

	fmt.Println("[IPC] Hub stopped")
	return true
}

func (h *InstanceHub) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	// Expect a REGISTER message within 5 seconds.
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, data, err := conn.ReadMessage()
	conn.SetReadDeadline(time.Time{})
	if err != nil {
		conn.Close()
		return
	}

	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil || msg.Type != MsgRegister {
		conn.Close()
		return
	}

	var reg RegisterPayload
	if err := json.Unmarshal(msg.Payload, &reg); err != nil {
		conn.Close()
		return
	}

	h.clientsMu.Lock()
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

	fmt.Printf("[IPC] Client connected: %s (%s)\n", clientName, reg.ID[:8])
	h.broadcastInstanceList()

	go client.writePump()
	h.serverReadPump(client)

	h.clientsMu.Lock()
	delete(h.clients, client.id)
	h.clientsMu.Unlock()
	client.close()

	fmt.Printf("[IPC] Client disconnected: %s\n", client.name)
	h.broadcastInstanceList()
}

func (h *InstanceHub) serverReadPump(c *wsClient) {
	defer func() { recover() }()
	c.conn.SetReadLimit(1 << 20)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))

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
	h.clientsMu.Lock()
	instances := []models.InstanceInfo{{ID: h.InstanceID, Name: h.InstanceName}}
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
	conn, _, err := dialer.DialContext(ctx, hubWSURL, nil)
	if err != nil {
		return
	}

	regPayload, _ := json.Marshal(RegisterPayload{ID: h.InstanceID})
	raw, _ := json.Marshal(Message{Type: MsgRegister, Payload: regPayload})
	if err := conn.WriteMessage(websocket.TextMessage, raw); err != nil {
		conn.Close()
		return
	}

	h.serverMu.Lock()
	h.serverConn = conn
	h.serverMu.Unlock()

	fmt.Printf("[IPC] Connected to hub: %s\n", h.InstanceID[:8])

	go func() {
		<-ctx.Done()
		conn.Close()
	}()

	conn.SetReadLimit(1 << 20)
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			break
		}
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

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
					h.InstanceName = inst.Name
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
	conn.Close()

	fmt.Println("[IPC] Disconnected from hub")
}

// ─── Public API ──────────────────────────────────────────────────────────────

// GetInstances returns all connected instances including self.
func (h *InstanceHub) GetInstances() []models.InstanceInfo {
	h.instancesMu.RLock()
	defer h.instancesMu.RUnlock()
	if len(h.knownInstances) == 0 {
		return []models.InstanceInfo{{ID: h.InstanceID, Name: h.InstanceName}}
	}
	result := make([]models.InstanceInfo, len(h.knownInstances))
	copy(result, h.knownInstances)
	return result
}

// GetSelfInfo returns the identity of this instance.
func (h *InstanceHub) GetSelfInfo() models.InstanceInfo {
	return models.InstanceInfo{ID: h.InstanceID, Name: h.InstanceName}
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
	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return conn.WriteMessage(websocket.TextMessage, raw)
}
