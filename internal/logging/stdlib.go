package logging

import (
	"io"
	"strings"
)

// StdlibWriter adapts the standard log package to this logger. Install it as:
//
//	log.SetOutput(logging.StdlibWriter())
//	log.SetFlags(0) // our handler owns the timestamp
//
// Each Write becomes one json_event record with logger "stdlib".
//
// This is deliberately not slog.SetDefault plus slog.NewLogLogger. SetDefault
// reroutes the standard log package through the default slog handler, which is
// exactly the process-global Trivy's package init() takes over — the bug that
// silently swallowed every log.Print in this binary. Handing log an explicit
// io.Writer keeps third-party output flowing into our file without joining a
// fight over a global nobody owns.
func StdlibWriter() io.Writer { return stdlibWriter{} }

type stdlibWriter struct{}

func (stdlibWriter) Write(p []byte) (int, error) {
	if msg := strings.TrimRight(string(p), "\n"); msg != "" {
		With("stdlib").Info(msg)
	}
	return len(p), nil
}
