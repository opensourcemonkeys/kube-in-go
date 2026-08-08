package services_k8sclient

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/creack/pty"
)

type terminalSession struct {
	ptmx *os.File
	cmd  *exec.Cmd
	// kubeconfigPath is this session's private kubeconfig. The shell's env
	// cannot be changed once it is running, so retargeting a terminal to
	// another cluster rewrites the *contents* of this file instead.
	kubeconfigPath string
}

var (
	termMu       sync.Mutex
	termSessions = make(map[string]*terminalSession)
)

var (
	termDirOnce sync.Once
	termDir     string
	termDirErr  error
)

// terminalKubeconfigDir is a 0700 directory created once per process. Keeping
// the session kubeconfigs out of ~/.kube-ins matters twice: that directory is
// scanned by ListClusters, and a second kube-ins instance must not be able to
// clobber this process' session files.
func terminalKubeconfigDir() (string, error) {
	termDirOnce.Do(func() {
		termDir, termDirErr = os.MkdirTemp("", "kube-ins-term-")
	})
	return termDir, termDirErr
}

// sessionKubeconfigPath resolves the session file for id. The id comes from the
// frontend, so it must not be able to escape the directory.
func sessionKubeconfigPath(id string) (string, error) {
	if id == "" || id != filepath.Base(id) || strings.ContainsAny(id, `/\`) || strings.HasPrefix(id, ".") {
		return "", fmt.Errorf("invalid terminal session id %q", id)
	}
	dir, err := terminalKubeconfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, id+".yaml"), nil
}

// writeSessionKubeconfig replaces path atomically, so a kubectl run in the
// terminal can never read a half-written config.
func writeSessionKubeconfig(path string, content string) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".tmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer func() {
		if tmpName != "" {
			_ = os.Remove(tmpName)
		}
	}()

	if err := tmp.Chmod(0600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.WriteString(content); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	tmpName = ""
	return nil
}

// terminalKubeconfigEnv builds the KUBECONFIG value for a session: the private
// file first, the user's own kubeconfig second. kubectl merges the list and the
// first file wins on conflicts, so the selected cluster's current-context takes
// over — and when the session file is empty (no cluster selected) the terminal
// silently falls back to the user's own config, which is what it did before
// this feature existed.
func terminalKubeconfigEnv(sessionPath string) string {
	paths := []string{sessionPath}

	if inherited := os.Getenv("KUBECONFIG"); inherited != "" {
		paths = append(paths, inherited)
	} else if home, err := os.UserHomeDir(); err == nil {
		def := filepath.Join(home, ".kube", "config")
		if _, err := os.Stat(def); err == nil {
			paths = append(paths, def)
		}
	}

	return "KUBECONFIG=" + strings.Join(paths, string(os.PathListSeparator))
}

func CreateTerminalSession(id string, kubeconfigContent string, onOutput func(data string)) error {
	termMu.Lock()
	defer termMu.Unlock()

	kubeconfigPath, err := sessionKubeconfigPath(id)
	if err != nil {
		return err
	}

	if existing, exists := termSessions[id]; exists {
		delete(termSessions, id)
		_ = existing.cmd.Process.Kill()
		_ = existing.ptmx.Close()
		_ = os.Remove(existing.kubeconfigPath)
	}

	if err := writeSessionKubeconfig(kubeconfigPath, kubeconfigContent); err != nil {
		return fmt.Errorf("failed to write terminal kubeconfig: %w", err)
	}

	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}

	cmd := exec.Command(shell)
	// os/exec keeps the last occurrence of a duplicated key, so this overrides
	// any KUBECONFIG inherited from the environment.
	cmd.Env = append(os.Environ(), "TERM=xterm-256color", terminalKubeconfigEnv(kubeconfigPath))

	ptmx, err := pty.Start(cmd)
	if err != nil {
		_ = os.Remove(kubeconfigPath)
		return fmt.Errorf("failed to start pty: %w", err)
	}

	termSessions[id] = &terminalSession{ptmx: ptmx, cmd: cmd, kubeconfigPath: kubeconfigPath}

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

// SetTerminalSessionKubeconfig retargets a running session at another cluster
// by rewriting its private kubeconfig. The shell is left alone, so scrollback
// and running commands survive; the next kubectl invocation picks up the new
// config.
func SetTerminalSessionKubeconfig(id string, kubeconfigContent string) error {
	termMu.Lock()
	session, ok := termSessions[id]
	termMu.Unlock()

	if !ok {
		return fmt.Errorf("terminal session %s not found", id)
	}

	return writeSessionKubeconfig(session.kubeconfigPath, kubeconfigContent)
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
	_ = os.Remove(session.kubeconfigPath)
	return nil
}
