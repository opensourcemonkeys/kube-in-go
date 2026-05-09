package services_k8sclient

import (
	"fmt"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
)

type terminalSession struct {
	ptmx *os.File
	cmd  *exec.Cmd
}

var (
	termMu       sync.Mutex
	termSessions = make(map[string]*terminalSession)
)

func CreateTerminalSession(id string, onOutput func(data string)) error {
	termMu.Lock()
	defer termMu.Unlock()

	if existing, exists := termSessions[id]; exists {
		delete(termSessions, id)
		_ = existing.cmd.Process.Kill()
		_ = existing.ptmx.Close()
	}

	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}

	cmd := exec.Command(shell)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("failed to start pty: %w", err)
	}

	termSessions[id] = &terminalSession{ptmx: ptmx, cmd: cmd}

	go func() {
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
	}()

	return nil
}

func WriteToTerminalSession(id string, data string) error {
	termMu.Lock()
	session, ok := termSessions[id]
	termMu.Unlock()

	if !ok {
		return fmt.Errorf("terminal session %s not found", id)
	}

	_, err := session.ptmx.WriteString(data)
	return err
}

func ResizeTerminalSession(id string, cols uint16, rows uint16) error {
	termMu.Lock()
	session, ok := termSessions[id]
	termMu.Unlock()

	if !ok {
		return fmt.Errorf("terminal session %s not found", id)
	}

	return pty.Setsize(session.ptmx, &pty.Winsize{Cols: cols, Rows: rows})
}

func CloseTerminalSession(id string) error {
	termMu.Lock()
	session, ok := termSessions[id]
	if ok {
		delete(termSessions, id)
	}
	termMu.Unlock()

	if !ok {
		return nil
	}

	_ = session.cmd.Process.Kill()
	_ = session.ptmx.Close()
	return nil
}
