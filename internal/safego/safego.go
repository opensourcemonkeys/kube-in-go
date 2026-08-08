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
	"log"
	"runtime/debug"
)

// Go runs fn in a goroutine, recovering and logging any panic along with the
// stack that produced it. name identifies the goroutine in that log line, so
// prefer something greppable like "services.terminal.reader".
//
// Logging goes through the standard log package, which main.go points at
// stderr. Do not switch this to slog.Default(): importing Trivy replaces the
// default slog handler with one that buffers records into a slice, so anything
// written through it before Trivy initialises its own logger is silently lost.
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
		log.Printf("[panic] goroutine %s: %v\n%s", name, r, debug.Stack())
	}
}
