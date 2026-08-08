package services_k8sclient

import (
	"runtime"
	"testing"
	"time"
)

func skipWithoutPty(t *testing.T) {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("creack/pty cannot start a shell on Windows")
	}
	t.Setenv("SHELL", "/bin/sh")
}

// The reported bug: opening a terminal immediately printed "[shell exited]" and
// swallowed every keystroke. React StrictMode mounts an effect twice, so the
// panel ran create → close → create under one id; the *closed* session's reader
// goroutine then emitted terminal:exit, which is keyed by id alone and so hit
// the live replacement.
func TestTerminalExitIsSilentForAReplacedSession(t *testing.T) {
	skipWithoutPty(t)

	const id = "strictmode"
	exits := make(chan struct{}, 4)
	onExit := func() { exits <- struct{}{} }

	if err := CreateTerminalSession(id, "", func(string) {}, onExit); err != nil {
		t.Fatalf("first session: %v", err)
	}
	if err := CloseTerminalSession(id); err != nil {
		t.Fatalf("close: %v", err)
	}
	if err := CreateTerminalSession(id, "", func(string) {}, onExit); err != nil {
		t.Fatalf("second session: %v", err)
	}
	t.Cleanup(func() { _ = CloseTerminalSession(id) })

	select {
	case <-exits:
		t.Fatal("a closed session reported an exit against the id its replacement now owns")
	case <-time.After(500 * time.Millisecond):
	}

	// The replacement must still be usable — it is the session the panel talks to.
	if err := WriteToTerminalSession(id, "\n"); err != nil {
		t.Fatalf("replacement session is not writable: %v", err)
	}
}

// A shell that exits by itself has to report it: this is the signal that tells
// the panel a dead terminal from a quiet one.
func TestTerminalExitFiresWhenTheShellExits(t *testing.T) {
	skipWithoutPty(t)

	const id = "self-exit"
	exits := make(chan struct{}, 1)

	if err := CreateTerminalSession(id, "", func(string) {}, func() { exits <- struct{}{} }); err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() { _ = CloseTerminalSession(id) })

	if err := WriteToTerminalSession(id, "exit\n"); err != nil {
		t.Fatalf("write: %v", err)
	}

	select {
	case <-exits:
	case <-time.After(5 * time.Second):
		t.Fatal("shell exited but onExit never fired")
	}

	// Reaped and deregistered, so the id is free for a new session.
	termMu.Lock()
	_, still := termSessions[id]
	termMu.Unlock()
	if still {
		t.Fatal("exited shell left its registry entry behind")
	}
}
