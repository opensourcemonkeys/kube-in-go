package logging

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	filePrefix = "kube-inspector-"
	fileSuffix = ".log"
	dayLayout  = "2006-01-02"

	// maxRecord caps a single record so it is always written by one write(2).
	//
	// Atomicity across processes rests on O_APPEND, which the kernel honours
	// per write call on a regular file. os.File.Write loops internally on a
	// short write, which would split one record into two calls and let another
	// process interleave in the middle of it. 32 KiB is far below any
	// plausible short-write threshold and far above every legitimate record;
	// the only realistic overflow source is a debug.Stack() dump, which the
	// call sites already truncate to 8 KiB.
	maxRecord = 32 << 10
)

// dayWriter appends whole records to ~/.kube-ins/logs/kube-inspector-<date>.log
// and switches file at local midnight.
//
// The file is shared with every other kube-ins process — other instances, the
// CLI, and the Electron shell — so two properties are mandatory: the fd is
// opened O_APPEND, and each Write issues exactly one os.File.Write. There is
// deliberately no advisory lock: flock would serialise three processes on
// every log line to buy what O_APPEND already gives us.
type dayWriter struct {
	mu     sync.Mutex
	dir    string
	f      *os.File
	path   string
	expiry time.Time
	closed bool
	now    func() time.Time // injectable for tests
}

func newDayWriter(dir string, now func() time.Time) (*dayWriter, error) {
	w := &dayWriter{dir: dir, now: now}
	if err := w.open(now()); err != nil {
		return nil, err
	}
	return w, nil
}

// dayFileName uses the LOCAL date on purpose: "today's log" has to mean the
// user's today. The @timestamp inside each record is UTC, so the three
// processes sharing the file remain unambiguously ordered.
func dayFileName(t time.Time) string {
	return filePrefix + t.Format(dayLayout) + fileSuffix
}

func startOfDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

func (w *dayWriter) open(t time.Time) error {
	path := filepath.Join(w.dir, dayFileName(t))
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0600)
	if err != nil {
		return err
	}
	w.f = f
	w.path = path
	w.expiry = startOfDay(t).AddDate(0, 0, 1)
	return nil
}

func (w *dayWriter) Path() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.path
}

func (w *dayWriter) Write(p []byte) (int, error) {
	n := len(p)
	if n > maxRecord {
		p = truncateRecord(p)
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	if w.closed {
		return n, nil
	}

	// Day rollover is a deadline compare rather than a ticker. A ticker would
	// need a goroutine per process purely to swap a file (and logging cannot
	// use safego without a cycle), would race the write path, and — the real
	// reason — does not survive suspend: a machine asleep from 23:50 to 08:00
	// wakes up still appending to yesterday's file. This compare costs
	// nanoseconds under a mutex we already hold and self-corrects after
	// suspend, a manual clock change, or DST.
	now := w.now()
	if !now.Before(w.expiry) {
		w.roll(now)
	}

	if _, err := w.f.Write(p); err != nil {
		return 0, err
	}
	// Report the caller's length even when the record was truncated, so slog
	// never sees a short write.
	return n, nil
}

// roll switches to today's file. Note this is not a rename: each day gets its
// own file from the start, which is what makes cross-process appending safe —
// nobody ever renames a file another process holds open.
//
// A failure keeps the current handle. Logging to yesterday's file beats losing
// the log, and the hour-long retry keeps a broken directory from being probed
// on every single record.
func (w *dayWriter) roll(now time.Time) {
	old, oldPath := w.f, w.path
	if err := w.open(now); err != nil {
		w.f, w.path = old, oldPath
		w.expiry = now.Add(time.Hour)
		return
	}
	_ = old.Close()
	sweepAsync(w.dir, now)
}

func (w *dayWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.closed {
		return nil
	}
	w.closed = true
	return w.f.Close()
}

// truncateRecord replaces an oversized record with a valid json_event line that
// carries as much of the original as fits.
//
// Cutting the original mid-object would land inside a string, an escape
// sequence, or a key, so the head is embedded as a JSON string value instead —
// escaping can only expand it, hence the shrink loop.
func truncateRecord(p []byte) []byte {
	const envelope = 256
	budget := maxRecord - envelope

	head := bytes.TrimRight(p, "\n")
	var quoted []byte
	for range 8 {
		if len(head) > budget {
			head = head[:budget]
		}
		head = bytes.ToValidUTF8(head, nil)
		quoted, _ = json.Marshal(string(head))
		if len(quoted) <= budget {
			break
		}
		// Shrink in proportion to the overshoot; converges in one or two
		// passes for any realistic payload.
		next := len(head) * budget / len(quoted)
		if next >= len(head) {
			next = len(head) / 2
		}
		head = head[:next]
	}
	if len(quoted) > budget {
		quoted = []byte(`""`)
	}

	out := make([]byte, 0, len(quoted)+envelope)
	out = append(out, `{"@version":"1","level":"ERROR","message":"log record exceeded the size cap and was truncated","logger":"logging","fields":{"service":"`...)
	out = append(out, serviceName...)
	out = append(out, `","truncated":true,"original":`...)
	out = append(out, quoted...)
	out = append(out, "}}\n"...)
	return out
}
