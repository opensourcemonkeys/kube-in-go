package services_k8sclient

import (
	"context"
	"io"
	"testing"

	"k8s.io/client-go/tools/remotecommand"
)

func newTestExecSession() *podExecSession {
	_, w := io.Pipe()
	_, cancel := context.WithCancel(context.Background())
	return &podExecSession{
		stdinWriter: w,
		sizeQueue:   &execSizeQueue{ch: make(chan remotecommand.TerminalSize, 4)},
		cancel:      cancel,
	}
}

// Both the panel closing the session and the stream goroutine noticing the
// remote shell exited call release. Only one may run the teardown: closing
// sizeQueue.ch twice panics and takes the process down.
func TestReleaseExecSessionTearsDownOnce(t *testing.T) {
	sess := newTestExecSession()
	execSessions["once"] = sess
	t.Cleanup(func() { delete(execSessions, "once") })

	if !releaseExecSession("once", sess) {
		t.Fatal("first release did not take ownership")
	}
	if releaseExecSession("once", sess) {
		t.Fatal("second release took ownership of an already-released session")
	}
	if releaseExecSession("once", nil) {
		t.Fatal("keyed release took ownership of an already-released session")
	}

	if _, ok := <-sess.sizeQueue.ch; ok {
		t.Fatal("size queue was not closed, so the Next() goroutine still leaks")
	}
}

// A session started under an id that is already in use must not be torn down by
// the previous session's late cleanup.
func TestReleaseExecSessionSpareNewerSession(t *testing.T) {
	old := newTestExecSession()
	fresh := newTestExecSession()

	execSessions["reused"] = fresh
	t.Cleanup(func() { delete(execSessions, "reused") })

	if releaseExecSession("reused", old) {
		t.Fatal("stale cleanup claimed the newer session")
	}
	if execSessions["reused"] != fresh {
		t.Fatal("stale cleanup evicted the newer session from the registry")
	}

	select {
	case fresh.sizeQueue.ch <- remotecommand.TerminalSize{Width: 80, Height: 24}:
	default:
		t.Fatal("newer session's size queue is unusable")
	}
}
