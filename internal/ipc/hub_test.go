package ipc

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"kube-ins/internal/models"
)

// isolateHome points os.UserHomeDir at a temp directory so the token file never
// touches the developer's real ~/.kube-ins.
func isolateHome(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("HOME", dir)
	t.Setenv("USERPROFILE", dir) // windows
	return dir
}

// freePort reserves and releases a port so the hub can bind it. Tests must never
// use the real 34200: a developer running the app would break the run, and two
// test binaries would collide.
func freePort(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserve port: %v", err)
	}
	addr := ln.Addr().String()
	if err := ln.Close(); err != nil {
		t.Fatalf("release port: %v", err)
	}
	return addr
}

// isolateHub gives the test its own HOME and its own port, so hubs started here
// never touch the real ~/.kube-ins or an app already running on 34200.
func isolateHub(t *testing.T) {
	t.Helper()
	isolateHome(t)

	orig := hubAddr
	hubAddr = freePort(t)
	t.Cleanup(func() { hubAddr = orig })
}

// newHub starts a hub bound to the current test's isolated environment.
func newHub(t *testing.T) (*InstanceHub, <-chan models.SerializedPanel) {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	received := make(chan models.SerializedPanel, 4)
	h := NewInstanceHub(ctx, func(p models.SerializedPanel) { received <- p })
	if h.token == "" {
		t.Fatal("hub has no token; ensureHubToken failed")
	}
	return h, received
}

// waitServing blocks until the hub holds the listener and answers on it. A test
// that starts a second hub must call this on the first one, or the second can
// win net.Listen and the server/client roles come out reversed.
func waitServing(t *testing.T, h *InstanceHub) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !h.isServer.Load() {
		if time.Now().After(deadline) {
			t.Fatal("hub did not become server")
		}
		time.Sleep(5 * time.Millisecond)
	}
	// isServer flips just before Serve; wait for the listener to actually answer.
	for time.Now().Before(deadline) {
		c, err := net.DialTimeout("tcp", hubAddr, 200*time.Millisecond)
		if err == nil {
			_ = c.Close()
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("hub never accepted a connection")
}

// startTestHub brings up a hub in server mode on an ephemeral port and returns
// it once it is accepting connections.
func startTestHub(t *testing.T) (*InstanceHub, <-chan models.SerializedPanel) {
	t.Helper()
	isolateHub(t)
	h, received := newHub(t)
	waitServing(t, h)
	return h, received
}

// waitForInstances blocks until the hub sees n instances.
func waitForInstances(t *testing.T, h *InstanceHub, n int) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if len(h.GetInstances()) == n {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("hub %s sees %d instances, want %d", shortID(h.InstanceID), len(h.GetInstances()), n)
}

func dialHub(t *testing.T, query string, header http.Header) (*websocket.Conn, *http.Response, error) {
	t.Helper()
	d := websocket.Dialer{HandshakeTimeout: 3 * time.Second}
	return d.Dial("ws://"+hubAddr+"/ws"+query, header)
}

func register(t *testing.T, conn *websocket.Conn, id string) {
	t.Helper()
	payload, err := json.Marshal(RegisterPayload{ID: id})
	if err != nil {
		t.Fatalf("marshal register: %v", err)
	}
	raw, err := json.Marshal(Message{Type: MsgRegister, Payload: payload})
	if err != nil {
		t.Fatalf("marshal message: %v", err)
	}
	if err := conn.WriteMessage(websocket.TextMessage, raw); err != nil {
		t.Fatalf("write register: %v", err)
	}
}

func clientCount(h *InstanceHub) int {
	h.clientsMu.Lock()
	defer h.clientsMu.Unlock()
	return len(h.clients)
}

// expectClosed asserts the server hung up rather than keeping a half-registered
// connection alive.
func expectClosed(t *testing.T, conn *websocket.Conn) {
	t.Helper()
	if err := conn.SetReadDeadline(time.Now().Add(3 * time.Second)); err != nil {
		t.Fatalf("set deadline: %v", err)
	}
	if _, _, err := conn.ReadMessage(); err == nil {
		t.Fatal("expected the server to close the connection, but it stayed open")
	}
}

// TestHubRejectsBrowserOrigin is the whole point of the Origin check: any page
// the user visits can reach the fixed loopback port, and browsers always stamp
// an Origin on the handshake.
func TestHubRejectsBrowserOrigin(t *testing.T) {
	h, _ := startTestHub(t)

	conn, _, err := dialHub(t, "?token="+h.token, http.Header{"Origin": {"https://evil.example"}})
	if err == nil {
		_ = conn.Close()
		t.Fatal("a browser-origin handshake was accepted")
	}
	if got := clientCount(h); got != 0 {
		t.Fatalf("clients = %d, want 0", got)
	}
}

func TestHubRejectsBadToken(t *testing.T) {
	h, _ := startTestHub(t)

	for name, query := range map[string]string{
		"missing": "",
		"empty":   "?token=",
		"wrong":   "?token=" + uuid.New().String(),
	} {
		t.Run(name, func(t *testing.T) {
			conn, resp, err := dialHub(t, query, nil)
			if err == nil {
				_ = conn.Close()
				t.Fatal("handshake accepted without a valid token")
			}
			if resp == nil {
				t.Fatal("no HTTP response; expected 403")
			}
			if resp.StatusCode != http.StatusForbidden {
				t.Fatalf("status = %d, want 403", resp.StatusCode)
			}
		})
	}

	if got := clientCount(h); got != 0 {
		t.Fatalf("clients = %d, want 0", got)
	}
}

// TestHubRejectsMalformedRegisterID covers the crash that used to leave a ghost:
// the id was sliced for a log line only after it had been stored in the map, so
// the panic left a registered client with no writePump behind it.
func TestHubRejectsMalformedRegisterID(t *testing.T) {
	h, _ := startTestHub(t)

	for _, id := range []string{"x", "", "not-a-uuid", h.InstanceID} {
		conn, _, err := dialHub(t, "?token="+h.token, nil)
		if err != nil {
			t.Fatalf("dial with valid token: %v", err)
		}
		register(t, conn, id)
		expectClosed(t, conn)
		_ = conn.Close()

		if got := clientCount(h); got != 0 {
			t.Fatalf("id %q: clients = %d, want 0", id, got)
		}
	}

	// The hub must still be serving — a panic in the handler would have taken
	// the whole process down before this point, but check it can still register.
	conn, _, err := dialHub(t, "?token="+h.token, nil)
	if err != nil {
		t.Fatalf("hub stopped serving after malformed registers: %v", err)
	}
	defer conn.Close()
	register(t, conn, uuid.New().String())
	if _, _, err := conn.ReadMessage(); err != nil {
		t.Fatalf("valid register after malformed ones failed: %v", err)
	}
}

func TestHubRegistersValidClient(t *testing.T) {
	h, _ := startTestHub(t)

	conn, _, err := dialHub(t, "?token="+h.token, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	id := uuid.New().String()
	register(t, conn, id)

	// The instance-list broadcast is the server's acknowledgement, so reading it
	// synchronises the test with the registration.
	instances := readInstanceList(t, conn)
	if len(instances) != 2 {
		t.Fatalf("instances = %d, want 2 (hub + client)", len(instances))
	}

	found := false
	for _, inst := range h.GetInstances() {
		if inst.ID == id {
			found = true
		}
	}
	if !found {
		t.Fatalf("registered client %s missing from GetInstances(): %+v", shortID(id), h.GetInstances())
	}
}

// TestHubRejectsDuplicateID: overwriting the map entry stranded the first
// connection and let its cleanup delete the second one's entry, after which
// TransferTab could reach neither.
func TestHubRejectsDuplicateID(t *testing.T) {
	h, _ := startTestHub(t)

	id := uuid.New().String()

	first, _, err := dialHub(t, "?token="+h.token, nil)
	if err != nil {
		t.Fatalf("dial first: %v", err)
	}
	defer first.Close()
	register(t, first, id)
	readInstanceList(t, first)

	second, _, err := dialHub(t, "?token="+h.token, nil)
	if err != nil {
		t.Fatalf("dial second: %v", err)
	}
	register(t, second, id)
	expectClosed(t, second)
	_ = second.Close()

	if got := clientCount(h); got != 1 {
		t.Fatalf("clients = %d, want 1", got)
	}

	h.clientsMu.Lock()
	kept, ok := h.clients[id]
	h.clientsMu.Unlock()
	if !ok {
		t.Fatal("the original client was evicted by the duplicate")
	}
	select {
	case <-kept.done:
		t.Fatal("the original client's connection was closed by the duplicate")
	default:
	}
}

func readInstanceList(t *testing.T, conn *websocket.Conn) []models.InstanceInfo {
	t.Helper()
	if err := conn.SetReadDeadline(time.Now().Add(3 * time.Second)); err != nil {
		t.Fatalf("set deadline: %v", err)
	}
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("read instance list: %v", err)
		}
		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			t.Fatalf("unmarshal message: %v", err)
		}
		if msg.Type != MsgInstanceList {
			continue
		}
		var payload InstanceListPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			t.Fatalf("unmarshal instance list: %v", err)
		}
		if err := conn.SetReadDeadline(time.Time{}); err != nil {
			t.Fatalf("clear deadline: %v", err)
		}
		return payload.Instances
	}
}

// TestTwoInstancesTransferPanel is the regression guard for the feature the
// hardening could silently break: the client half now has to present the token
// on dial, and a wrong URL there would leave every instance alone in its own
// list with no error anywhere. Exercises both directions through the real
// server/client split rather than a hand-rolled socket.
func TestTwoInstancesTransferPanel(t *testing.T) {
	isolateHub(t)

	server, serverGot := newHub(t)
	waitServing(t, server)

	client, clientGot := newHub(t)
	waitForInstances(t, server, 2)
	waitForInstances(t, client, 2)

	if a, b := server.GetSelfInfo().Name, client.GetSelfInfo().Name; a != "Instance 1" || b != "Instance 2" {
		t.Fatalf("names = %q / %q, want Instance 1 / Instance 2", a, b)
	}

	toServer := models.SerializedPanel{ComponentType: "view", Title: "Pods • prod"}
	if err := client.TransferTab(server.InstanceID, toServer); err != nil {
		t.Fatalf("client → server transfer: %v", err)
	}
	select {
	case got := <-serverGot:
		if got.Title != toServer.Title {
			t.Fatalf("server received %q, want %q", got.Title, toServer.Title)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("server never received the panel")
	}

	toClient := models.SerializedPanel{ComponentType: "yamlEditor", Title: "pod.yaml"}
	if err := server.TransferTab(client.InstanceID, toClient); err != nil {
		t.Fatalf("server → client transfer: %v", err)
	}
	select {
	case got := <-clientGot:
		if got.Title != toClient.Title {
			t.Fatalf("client received %q, want %q", got.Title, toClient.Title)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("client never received the panel")
	}
}

func TestEnsureHubToken(t *testing.T) {
	home := isolateHome(t)

	first, err := ensureHubToken()
	if err != nil {
		t.Fatalf("ensureHubToken: %v", err)
	}
	if len(first) != 64 {
		t.Fatalf("token length = %d, want 64 hex chars", len(first))
	}

	// A second process must read the same secret, not mint a rival one.
	second, err := ensureHubToken()
	if err != nil {
		t.Fatalf("ensureHubToken (second call): %v", err)
	}
	if second != first {
		t.Fatal("second call produced a different token")
	}

	path := filepath.Join(home, ".kube-ins", hubTokenFile)
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat token file: %v", err)
	}
	// Windows reports a synthesised mode that says nothing about the real ACL.
	if runtime.GOOS != "windows" {
		if perm := info.Mode().Perm(); perm != 0600 {
			t.Fatalf("token file mode = %04o, want 0600", perm)
		}
	}

	// A truncated or hand-edited file must fail loudly rather than silently
	// leaving the hub unauthenticated.
	if err := os.WriteFile(path, []byte("short"), 0600); err != nil {
		t.Fatalf("truncate token: %v", err)
	}
	if _, err := ensureHubToken(); err == nil {
		t.Fatal("a corrupt token file was accepted")
	}
}
