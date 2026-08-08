package services_k8sclient

import (
	"fmt"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"

	"kube-ins/internal/safego"
)

// cliModeServices spawns the kube-ins binary in --tui mode inside a pty so the
// GUI can host the terminal UI in a fullscreen xterm. It mirrors
// terminalServices but runs the self-binary instead of $SHELL and reports pty
// close via an onExit callback so the frontend can restore the GUI.

type cliModeSession struct {
	ptmx *os.File
	cmd  *exec.Cmd
}

var (
	cliMu       sync.Mutex
	cliSessions = make(map[string]*cliModeSession)
)

// selfExe resolves the running executable so CLI mode launches the same binary.
func selfExe() string {
	if exe, err := os.Executable(); err == nil {
		return exe
	}
	return os.Args[0]
}

func CreateCliModeSession(id string, onOutput func(data string), onExit func()) error {
	cliMu.Lock()
	if existing, exists := cliSessions[id]; exists {
		delete(cliSessions, id)
		_ = existing.cmd.Process.Kill()
		_ = existing.ptmx.Close()
	}
	cliMu.Unlock()

	cmd := exec.Command(selfExe(), "--tui")
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("failed to start cli-mode pty: %w", err)
	}

	cliMu.Lock()
	cliSessions[id] = &cliModeSession{ptmx: ptmx, cmd: cmd}
	cliMu.Unlock()

	safego.Go("services.climode.reader", func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				onOutput(string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
		// pty closed: the TUI exited (user quit). Clean up and notify.
		cliMu.Lock()
		if s, ok := cliSessions[id]; ok && s.ptmx == ptmx {
			delete(cliSessions, id)
		}
		cliMu.Unlock()
		_ = cmd.Wait()
		if onExit != nil {
			onExit()
		}
	})

	return nil
}

func WriteToCliModeSession(id string, data string) error {
	cliMu.Lock()
	session, ok := cliSessions[id]
	cliMu.Unlock()
	if !ok {
		return fmt.Errorf("cli-mode session %s not found", id)
	}
	_, err := session.ptmx.WriteString(data)
	return err
}

func ResizeCliModeSession(id string, cols uint16, rows uint16) error {
	cliMu.Lock()
	session, ok := cliSessions[id]
	cliMu.Unlock()
	if !ok {
		return fmt.Errorf("cli-mode session %s not found", id)
	}
	return pty.Setsize(session.ptmx, &pty.Winsize{Cols: cols, Rows: rows})
}

func CloseCliModeSession(id string) error {
	cliMu.Lock()
	session, ok := cliSessions[id]
	if ok {
		delete(cliSessions, id)
	}
	cliMu.Unlock()

	if !ok {
		return nil
	}
	_ = session.cmd.Process.Kill()
	_ = session.ptmx.Close()
	return nil
}
