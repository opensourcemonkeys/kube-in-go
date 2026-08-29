package logging

import (
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"
)

const (
	retainDays = 7

	sweepMarker  = ".retention"
	sweepLock    = ".retention.lock"
	sweepMinGap  = 6 * time.Hour
	sweepLockTTL = 5 * time.Minute
)

// dayFileRe is deliberately strict. It is the safety property of the whole
// sweep: .level, .retention, an editor's stray notes.txt, and anything else a
// user drops in the directory are structurally undeletable.
var dayFileRe = regexp.MustCompile(`^kube-inspector-(\d{4}-\d{2}-\d{2})\.log$`)

func parseDayFileName(name string) (time.Time, bool) {
	m := dayFileRe.FindStringSubmatch(name)
	if m == nil {
		return time.Time{}, false
	}
	// Parsed in Local because the names are written from the local date.
	d, err := time.ParseInLocation(dayLayout, m[1], time.Local)
	if err != nil {
		return time.Time{}, false
	}
	return d, true
}

// sweepWG tracks in-flight sweeps so Close can wait for them. The sweep is
// fire-and-forget by design — Init must not pay for a directory scan — but
// "detached" and "still running after the caller thinks it is done" are
// different things, and only the second one is a bug.
var sweepWG sync.WaitGroup

func sweepAsync(dir string) {
	sweepWG.Add(1)
	go func() {
		defer sweepWG.Done()
		// logging cannot import safego — safego logs through this package — so
		// the panic guard is inline.
		defer func() { _ = recover() }()
		_ = sweep(dir, time.Now())
	}()
}

// sweep deletes day files older than retainDays.
//
// Several processes may call this within seconds of each other (each instance
// at startup, each again at midnight), so it is coordinated by a marker file
// for the common case and an O_EXCL lock for the race — the same create-once
// idiom ipc/hubtoken.go uses, and the only cross-process primitive needed.
func sweep(dir string, now time.Time) error {
	if fi, err := os.Stat(filepath.Join(dir, sweepMarker)); err == nil &&
		now.Sub(fi.ModTime()) < sweepMinGap {
		return nil
	}

	lock := filepath.Join(dir, sweepLock)
	f, err := os.OpenFile(lock, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		// Someone else is sweeping, or a process was killed mid-sweep and left
		// the claim behind.
		if fi, serr := os.Stat(lock); serr == nil && now.Sub(fi.ModTime()) > sweepLockTTL {
			_ = os.Remove(lock)
		}
		return nil
	}
	_ = f.Close()
	defer func() { _ = os.Remove(lock) }()

	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	// Age comes from the date in the filename, never from mtime: mtime lies
	// while a process holds a file open across a day boundary, and lies again
	// after a clock change or a restore from backup.
	cutoff := startOfDay(now).AddDate(0, 0, -retainDays)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		d, ok := parseDayFileName(e.Name())
		if !ok || !d.Before(cutoff) {
			continue
		}
		if rerr := os.Remove(filepath.Join(dir, e.Name())); rerr != nil {
			// Windows refuses to unlink a file another process still has open
			// (Go does not pass FILE_SHARE_DELETE). Harmless: the file is at
			// least eight days old, so the next sweep gets it.
			With("logging").Debug("retention: could not remove log file",
				"file", e.Name(), "err", rerr)
		}
	}

	return touch(filepath.Join(dir, sweepMarker), now)
}

func touch(path string, now time.Time) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Chtimes(path, now, now)
}
