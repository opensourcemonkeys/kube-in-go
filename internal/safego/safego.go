// Package safego runs background work in goroutines that cannot take the
// process down with them.
//
// Neither shell recovers panics on our behalf: Wails' generated dispatcher has
// no recover at all, and the RPC dispatcher's recover only covers the call
// stack of the request being served. A panic in a goroutine started by that
// call — a log stream, an exec pump, an AI turn — unwinds to the top of its own
// stack and kills the whole binary, taking every open panel and every live
// session with it. Recovering here trades one dead feature for one dead app.
package safego

import (
	"fmt"
	"runtime/debug"

	"kube-ins/internal/logging"
)

// maxStack caps the stack in a panic record. internal/logging replaces any
// record over 32 KiB with a truncation notice, and losing the top frames —
// the ones that name the bug — to a runaway goroutine dump would be the worst
// possible trade.
const maxStack = 8 << 10

// Go runs fn in a goroutine, recovering and logging any panic along with the
// stack that produced it. name identifies the goroutine in that log line, so
// prefer something greppable like "services.terminal.reader".
//
// Logging goes through internal/logging, which is the only intra-project
// import this package may take: logging depends on nothing, so the edge is
// acyclic — and it must stay that way, i.e. logging must never import safego.
//
// Do not switch this to slog.Default(): importing Trivy replaces the default
// slog handler with one that buffers records into a slice, so anything written
// through it before Trivy initialises its own logger is silently lost.
// internal/logging is immune because it owns its own *slog.Logger.
func Go(name string, fn func()) {
	go func() {
		defer Recover(name)
		fn()
	}()
}

// Recover is the deferred half of Go, exported for the few goroutines that
// cannot be started through it — one already owning a defer chain whose order
// matters, for instance. Use it as `defer safego.Recover("name")`.
func Recover(name string) {
	if r := recover(); r != nil {
		logging.With("safego").Error("goroutine panic",
			"goroutine", name,
			"panic", fmt.Sprint(r),
			"stack", Stack(maxStack))
	}
}

// Stack returns the current goroutine's stack, truncated to limit bytes at a
// line boundary. Exported because every other place that records a stack — the
// RPC dispatcher's recover, the IPC hub's — needs the same cap for the same
// reason.
func Stack(limit int) string {
	s := debug.Stack()
	if len(s) <= limit {
		return string(s)
	}
	s = s[:limit]
	if i := lastNewline(s); i > 0 {
		s = s[:i]
	}
	return string(s) + "\n[stack truncated]"
}

func lastNewline(b []byte) int {
	for i := len(b) - 1; i >= 0; i-- {
		if b[i] == '\n' {
			return i
		}
	}
	return -1
}
