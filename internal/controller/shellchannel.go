package controller_app

import (
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// The shell channel is a second WebSocket, opened by a native shell's *main*
// process (Electron), over which Go asks the shell to do things only it can do
// — currently just showing a native save dialog.
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

type shellRequest struct {
	ID   string          `json:"id"`
	Type string          `json:"type"`
	Opts SaveFileOptions `json:"opts"`
}

type shellReply struct {
	ID    string `json:"id"`
	Path  string `json:"path"`
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

// shellSaveFile asks the shell for a path and blocks until it answers. An empty
// path means the user cancelled, matching Wails' SaveFileDialog contract.
func (s *Server) shellSaveFile(opts SaveFileOptions) (string, error) {
	sc := s.shell

	req := shellRequest{ID: uuid.NewString(), Type: "saveFile", Opts: opts}
	ch := make(chan shellReply, 1)

	sc.mu.Lock()
	conn := sc.conn
	if conn == nil {
		sc.mu.Unlock()
		return "", errors.New("shell not connected")
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
		return "", err
	}

	select {
	case rep := <-ch:
		if rep.Error != "" {
			return "", errors.New(rep.Error)
		}
		return rep.Path, nil
	case <-time.After(dialogTimeout):
		sc.mu.Lock()
		delete(sc.pending, req.ID)
		sc.mu.Unlock()
		return "", errors.New("save dialog timed out")
	}
}
