package controller_app

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"

	"github.com/gorilla/websocket"

	"kube-ins/internal/safego"
)

// Server exposes the App over loopback HTTP + WebSocket so that shells which
// are not Wails (a plain Chromium tab, the Energy/CEF shell) can drive the
// exact same controller. It implements Transport, so App.emit flows out over
// the WebSocket.
//
// The wire contract deliberately mirrors Wails so the generated bindings in
// frontend/wailsjs keep working unmodified:
//
//	POST /rpc/{method}  body: [arg1, arg2, ...]  -> {"ok":true,"result":...}
//	GET  /events        WebSocket, frames: {"event":"name","data":[...]}
type Server struct {
	app   *App
	token string
	ln    net.Listener
	srv   *http.Server

	methods map[string]reflect.Value

	mu      sync.RWMutex
	clients map[*wsClient]struct{}

	// shell is the native shell's main process, if one attached to /shell.
	// See shellchannel.go.
	shell *shellChannel

	// NativeDialog lets a shell with real windowing (Energy/CEF) supply a
	// native save dialog. When nil the server falls back to the user's
	// download directory, which keeps plain-browser mode fully functional.
	NativeDialog func(SaveFileOptions) (string, error)
}

type wsClient struct {
	conn *websocket.Conn
	send chan []byte
}

type rpcResponse struct {
	OK     bool   `json:"ok"`
	Result any    `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

// NewServer builds the RPC server and binds an ephemeral loopback port. assets
// is the built frontend (the same embed.FS Wails uses); it is served at /.
//
// Nothing is served until Start is called.
func NewServer(assets fs.FS) (*Server, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, fmt.Errorf("generate token: %w", err)
	}

	// Ephemeral loopback port in release builds; a fixed one under the
	// kubeinsdev tag so Vite can proxy to it. See dev_off.go / dev_on.go.
	ln, err := net.Listen("tcp", devListenAddr())
	if err != nil {
		return nil, fmt.Errorf("bind loopback: %w", err)
	}

	s := &Server{
		token:   hex.EncodeToString(tokenBytes),
		ln:      ln,
		clients: make(map[*wsClient]struct{}),
		shell:   newShellChannel(),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/rpc/", s.handleRPC)
	mux.HandleFunc("/events", s.handleEvents)
	mux.HandleFunc("/shell", s.handleShell)
	mux.Handle("/", s.assetHandler(assets))
	s.srv = &http.Server{Handler: mux}

	return s, nil
}

// Bootstrap creates the App, wires it to this server as its Transport and
// starts serving. Call once, before opening the shell window.
func (s *Server) Bootstrap(ctx context.Context) *App {
	s.app = Bootstrap(ctx, s)
	s.registerMethods(s.app)

	safego.Go("controller.rpc.serve", func() {
		if err := s.srv.Serve(s.ln); err != nil && err != http.ErrServerClosed {
			fmt.Fprintln(os.Stderr, "kube-ins rpc:", err)
		}
	})

	return s.app
}

// URL is the address the shell should load.
func (s *Server) URL() string { return "http://" + s.ln.Addr().String() + "/" }

// Token is the per-process shared secret. It is injected into index.html rather
// than put in the URL, so a hostile page cannot read it (cross-origin reads are
// blocked by the browser) even though it can guess the port.
func (s *Server) Token() string { return s.token }

func (s *Server) Close() error { return s.srv.Close() }

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

func (s *Server) Emit(event string, data ...any) {
	if data == nil {
		data = []any{}
	}
	payload, err := json.Marshal(map[string]any{"event": event, "data": data})
	if err != nil {
		return
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	for c := range s.clients {
		select {
		case c.send <- payload:
		default:
			// Slow client. Drop rather than block: emit is called from log
			// and exec stream goroutines that must never stall.
		}
	}
}

func (s *Server) SaveFile(opts SaveFileOptions) (string, error) {
	// In-process shell supplied its own dialog.
	if s.NativeDialog != nil {
		return s.NativeDialog(opts)
	}

	// A native shell's main process is attached: ask it. Errors (including a
	// timeout) propagate rather than falling through to the download directory
	// — under a real shell a file appearing somewhere the user never chose is
	// worse than an error.
	if s.shell.connected() {
		return s.shellSaveFile(opts)
	}

	// Browser mode has no native dialog. Fall back to the download directory so
	// the feature still works end-to-end while testing.
	dir := os.Getenv("XDG_DOWNLOAD_DIR")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		dir = filepath.Join(home, "Downloads")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, opts.DefaultName), nil
}

// ---------------------------------------------------------------------------
// Reflection dispatcher
// ---------------------------------------------------------------------------

var errorType = reflect.TypeOf((*error)(nil)).Elem()

// registerMethods indexes every exported App method whose parameters can be
// expressed as JSON. That skips Startup (it takes a context.Context) without
// needing a hand-maintained deny list.
func (s *Server) registerMethods(app *App) {
	s.methods = make(map[string]reflect.Value)
	v := reflect.ValueOf(app)
	t := v.Type()

	for i := 0; i < t.NumMethod(); i++ {
		m := t.Method(i)
		callable := true
		for j := 1; j < m.Type.NumIn(); j++ {
			if !jsonRepresentable(m.Type.In(j)) {
				callable = false
				break
			}
		}
		if callable {
			s.methods[m.Name] = v.Method(i)
		}
	}
}

func jsonRepresentable(t reflect.Type) bool {
	switch t.Kind() {
	case reflect.Chan, reflect.Func, reflect.UnsafePointer:
		return false
	case reflect.Interface:
		// context.Context and friends cannot be built from JSON. A plain
		// `any` parameter can.
		return t.NumMethod() == 0
	}
	return true
}

func (s *Server) handleRPC(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !s.authorized(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	name := strings.TrimPrefix(r.URL.Path, "/rpc/")
	fn, ok := s.methods[name]
	if !ok {
		writeJSON(w, rpcResponse{Error: "unknown method: " + name})
		return
	}

	var rawArgs []json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&rawArgs); err != nil {
		writeJSON(w, rpcResponse{Error: "bad arguments: " + err.Error()})
		return
	}

	ft := fn.Type()
	if len(rawArgs) != ft.NumIn() {
		writeJSON(w, rpcResponse{Error: fmt.Sprintf(
			"%s expects %d arguments, got %d", name, ft.NumIn(), len(rawArgs))})
		return
	}

	in := make([]reflect.Value, ft.NumIn())
	for i := range rawArgs {
		argPtr := reflect.New(ft.In(i))
		if err := json.Unmarshal(rawArgs[i], argPtr.Interface()); err != nil {
			writeJSON(w, rpcResponse{Error: fmt.Sprintf(
				"%s argument %d: %v", name, i+1, err)})
			return
		}
		in[i] = argPtr.Elem()
	}

	writeJSON(w, s.invoke(name, fn, in))
}

// invoke calls the method, converting a panic into a normal error response.
// Without this, a panicking business function (several ignore a client-
// construction error and then dereference a nil client) would abort the
// connection and leave the frontend hanging on a promise that never settles.
func (s *Server) invoke(name string, fn reflect.Value, in []reflect.Value) (resp rpcResponse) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "kube-ins rpc: %s panicked: %v\n", name, r)
			resp = rpcResponse{Error: fmt.Sprintf("%s failed: %v", name, r)}
		}
	}()
	return buildResponse(fn.Call(in))
}

// buildResponse mirrors Wails' JS-side semantics: a trailing error return is
// stripped and turned into a rejection; what remains resolves the promise
// (nothing -> undefined, one value -> that value).
func buildResponse(out []reflect.Value) rpcResponse {
	if n := len(out); n > 0 && out[n-1].Type() == errorType {
		if e := out[n-1].Interface(); e != nil {
			return rpcResponse{Error: e.(error).Error()}
		}
		out = out[:n-1]
	}

	switch len(out) {
	case 0:
		return rpcResponse{OK: true}
	case 1:
		return rpcResponse{OK: true, Result: out[0].Interface()}
	default:
		vals := make([]any, len(out))
		for i, v := range out {
			vals[i] = v.Interface()
		}
		return rpcResponse{OK: true, Result: vals}
	}
}

func writeJSON(w http.ResponseWriter, resp rpcResponse) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// ---------------------------------------------------------------------------
// Events (WebSocket)
// ---------------------------------------------------------------------------

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return s.originAllowed(r) },
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	c := &wsClient{conn: conn, send: make(chan []byte, 256)}
	s.mu.Lock()
	s.clients[c] = struct{}{}
	s.mu.Unlock()

	safego.Go("controller.rpc.eventsWriter", func() {
		defer func() {
			s.mu.Lock()
			delete(s.clients, c)
			s.mu.Unlock()
			conn.Close()
		}()
		for msg := range c.send {
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		}
	})

	// Drain reads so close frames are noticed; the frontend never sends.
	safego.Go("controller.rpc.eventsReader", func() {
		defer close(c.send)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	})
}

// ---------------------------------------------------------------------------
// Auth & assets
// ---------------------------------------------------------------------------

func (s *Server) authorized(r *http.Request) bool {
	// Dev builds only: Vite serves index.html, so the token never reaches the
	// page and cannot be echoed back. The listener is still loopback-only and
	// the Origin check below still runs. See dev_on.go.
	if !devShell {
		tok := r.Header.Get("X-Kube-Ins-Token")
		if tok == "" {
			// WebSocket handshakes cannot carry custom headers from the browser.
			tok = r.URL.Query().Get("token")
		}
		if subtle.ConstantTimeCompare([]byte(tok), []byte(s.token)) != 1 {
			return false
		}
	}
	return s.originAllowed(r)
}

// shellOrigin is the fixed origin a native shell serves the page from. Electron
// loads the app over its own app:// scheme rather than the loopback URL, because
// storage (localStorage, IndexedDB, cookies) is keyed by origin and our port is
// ephemeral — serving the port URL directly wiped all persisted UI state on
// every restart. See electron/main.cjs.
const shellOrigin = "app://kube-inspector"

// originAllowed rejects cross-site requests. A page on the public internet
// cannot read our token, but blocking by Origin too means it cannot even
// attempt a state-changing call against the guessed port.
//
// Allowing shellOrigin is safe: browsers set Origin themselves, so a hostile
// page cannot claim it, and any non-browser caller still needs the token.
func (s *Server) originAllowed(r *http.Request) bool {
	origin := strings.TrimSuffix(r.Header.Get("Origin"), "/")
	if origin == "" {
		return true // non-browser client (native shell's main process)
	}
	if origin == "http://"+s.ln.Addr().String() || origin == shellOrigin {
		return true
	}
	return devOriginAllowed(origin)
}

// assetHandler serves the built frontend, injecting the RPC token into
// index.html. Injecting (rather than putting it in the URL) keeps the token out
// of history and unreadable by any cross-origin page.
func (s *Server) assetHandler(assets fs.FS) http.Handler {
	files := http.FileServer(http.FS(assets))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if p := r.URL.Path; p != "/" && p != "/index.html" {
			files.ServeHTTP(w, r)
			return
		}

		raw, err := fs.ReadFile(assets, "index.html")
		if err != nil {
			http.Error(w, "index.html not found", http.StatusInternalServerError)
			return
		}

		inject := fmt.Sprintf(
			"<script>window.__KUBE_INS_RPC__=%q;</script>", s.token)
		html := strings.Replace(string(raw), "<head>", "<head>"+inject, 1)

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte(html))
	})
}
