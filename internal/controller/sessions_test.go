package controller_app

import (
	"context"
	"sync"
	"testing"

	"kube-ins/internal/safego"
)

// The bug this guards against: the first job's deferred cleanup deleting the
// map entry by key, which after a restart belongs to the second job. The second
// job then runs unregistered — nothing can cancel it and nothing can find it,
// which is what left the AI chat's tool-approval dialog hanging forever.
func TestCancelRegistryDoneKeepsNewerSession(t *testing.T) {
	r := newCancelRegistry()

	ctx1, cancel1 := context.WithCancel(context.Background())
	tok1 := r.begin("session-1", cancel1)

	ctx2, cancel2 := context.WithCancel(context.Background())
	tok2 := r.begin("session-1", cancel2)

	// Restarting the key cancels the job it replaced.
	if ctx1.Err() == nil {
		t.Fatal("begin did not cancel the previous job")
	}

	// The first job notices the cancellation and runs its deferred cleanup.
	r.done("session-1", tok1)

	if !r.has("session-1") {
		t.Fatal("first job's cleanup deleted the second job's registry entry")
	}
	if ctx2.Err() != nil {
		t.Fatalf("second job's context was cancelled: %v", ctx2.Err())
	}

	// Still addressable, so a Stop from the frontend reaches it.
	r.cancel("session-1")
	if ctx2.Err() == nil {
		t.Fatal("cancel did not reach the current job")
	}

	r.done("session-1", tok2)
	if r.has("session-1") {
		t.Fatal("second job's cleanup left its entry behind")
	}
}

func TestCancelRegistryCancelUnknownKeyIsNoop(t *testing.T) {
	r := newCancelRegistry()
	r.cancel("never-started") // must not panic
}

// Racing restarts of one key must leave nothing behind once every job has
// finished — the last token installed is the one that removes itself.
func TestCancelRegistryConcurrentRestarts(t *testing.T) {
	r := newCancelRegistry()

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		safego.Go("test.restart", func() {
			defer wg.Done()
			_, cancel := context.WithCancel(context.Background())
			tok := r.begin("chat", cancel)
			r.done("chat", tok)
		})
	}
	wg.Wait()

	if r.has("chat") {
		t.Fatal("registry leaked an entry after every job finished")
	}
}
