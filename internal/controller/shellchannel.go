package controller_app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// The shell channel is a second WebSocket, opened by a native shell's *main*
// process (Electron), over which Go asks the shell to do things only it can do:
// show a native save dialog, reveal a folder in the file manager, and describe
// itself for the diagnostics report.
//
// Why the main process and not the renderer: App.saveFile is called
// synchronously from an RPC handler, and the renderer may be reloading,
// crashed, or mid-HMR at exactly that moment. The main process socket lives for
// the whole app lifetime, so "is it connected?" is a reliable answer to "is a
// native dialog available?". It also means no new exported App method is
// needed, so the reflection dispatcher and Wails' binding generation are
// untouched.
//
// Node's ws client sends no Origin header, and originAllowed treats an absent
// Origin as a non-browser client, so this needs no security relaxation.

// dialogTimeout bounds how long a business call waits for the user. Generous:
// picking a folder is a human action. On expiry the RPC rejects rather than
// silently writing somewhere unexpected.
const dialogTimeout = 2 * time.Minute

// callTimeout bounds the request types that need no human. A shell that is
// attached but wedged must not stall an RPC handler for two minutes.
const callTimeout = 10 * time.Second

// Request types. The shell replies to an unknown type with an error rather
// than dropping it, so a mismatched Go/Electron pair fails fast instead of
// waiting out the timeout.
const (
	shellReqSaveFile      = "saveFile"
	shellReqOpenLogFolder = "openLogFolder"
	shellReqDiagnostics   = "diagnostics"
)

type shellRequest struct {
	ID   string          `json:"id"`
	Type string          `json:"type"`
	Opts SaveFileOptions `json:"opts,omitempty"`
}

type shellReply struct {
	ID   string `json:"id"`
	Path string `json:"path,omitempty"`
	// Data carries a JSON blob for request types that return structured
	// information rather than a path.
	Data  string `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

type shellChannel struct {
	mu      sync.Mutex
	conn    *websocket.Conn
	pending map[string]chan shellReply
}

func newShellChannel() *shellChannel {
	return &shellChannel{pending: make(map[string]chan shellReply)}
}

func (sc *shellChannel) connected() bool {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	return sc.conn != nil
}

// handleShell upgrades the connection and reads replies until it drops. At most
// one shell is attached; a reconnect replaces the previous socket.
func (s *Server) handleShell(w http.ResponseWriter, r *http.Request) {
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

	sc := s.shell
	sc.mu.Lock()
	if old := sc.conn; old != nil {
		old.Close()
	}
	sc.conn = conn
	sc.mu.Unlock()

	defer func() {
		sc.mu.Lock()
		if sc.conn == conn {
			sc.conn = nil
		}
		// Don't make callers wait out the timeout for a shell that is gone.
		for id, ch := range sc.pending {
			ch <- shellReply{ID: id, Error: "shell disconnected"}
			delete(sc.pending, id)
		}
		sc.mu.Unlock()
		conn.Close()
	}()

	for {
		var rep shellReply
		if err := conn.ReadJSON(&rep); err != nil {
			return
		}
		sc.mu.Lock()
		ch, ok := sc.pending[rep.ID]
		if ok {
			delete(sc.pending, rep.ID)
		}
		sc.mu.Unlock()
		if ok {
			ch <- rep // buffered, never blocks
		}
	}
}

// shellCall sends one request and blocks until the shell answers, the wait
// expires, or the shell disconnects. Every request type shares this so the
// pending map, the timeout and the disconnect drain are written once.
func (s *Server) shellCall(req shellRequest, wait time.Duration) (shellReply, error) {
	sc := s.shell
	req.ID = uuid.NewString()
	ch := make(chan shellReply, 1)

	sc.mu.Lock()
	conn := sc.conn
	if conn == nil {
		sc.mu.Unlock()
		return shellReply{}, errors.New("shell not connected")
	}
	sc.pending[req.ID] = ch
	sc.mu.Unlock()

	payload, err := json.Marshal(req)
	if err == nil {
		sc.mu.Lock()
		err = conn.WriteMessage(websocket.TextMessage, payload)
		sc.mu.Unlock()
	}
	if err != nil {
		sc.mu.Lock()
		delete(sc.pending, req.ID)
		sc.mu.Unlock()
		return shellReply{}, err
	}

	select {
	case rep := <-ch:
		if rep.Error != "" {
			return rep, errors.New(rep.Error)
		}
		return rep, nil
	case <-time.After(wait):
		sc.mu.Lock()
		delete(sc.pending, req.ID)
		sc.mu.Unlock()
		return shellReply{}, fmt.Errorf("the shell did not answer %q in time", req.Type)
	}
}

// shellSaveFile asks the shell for a path and blocks until it answers. An empty
// path means the user cancelled, matching Wails' SaveFileDialog contract.
func (s *Server) shellSaveFile(opts SaveFileOptions) (string, error) {
	rep, err := s.shellCall(shellRequest{Type: shellReqSaveFile, Opts: opts}, dialogTimeout)
	return rep.Path, err
}

// shellOpenLogFolder asks the shell to reveal the log directory. It carries no
// path: the shell computes the directory itself, so no renderer-supplied string
// ever reaches the OS.
func (s *Server) shellOpenLogFolder() error {
	_, err := s.shellCall(shellRequest{Type: shellReqOpenLogFolder}, callTimeout)
	return err
}

// shellDiagnostics asks the shell to describe itself (runtime versions, GPU
// status, its own log tail) for the diagnostics report.
func (s *Server) shellDiagnostics() (string, error) {
	rep, err := s.shellCall(shellRequest{Type: shellReqDiagnostics}, callTimeout)
	return rep.Data, err
}
