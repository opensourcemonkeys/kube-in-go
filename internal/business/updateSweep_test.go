package business

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSweepStaleUpdateTemps(t *testing.T) {
	root := t.TempDir()
	now := time.Now()
	old := now.Add(-48 * time.Hour)

	mkdir := func(name string, mtime time.Time) string {
		p := filepath.Join(root, name)
		if err := os.MkdirAll(filepath.Join(p, "inner"), 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", name, err)
		}
		if err := os.WriteFile(filepath.Join(p, "pkg.deb"), []byte("x"), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
		if err := os.Chtimes(p, mtime, mtime); err != nil {
			t.Fatalf("chtimes %s: %v", name, err)
		}
		return p
	}

	stale := mkdir("kube-ins-update-111", old)
	fresh := mkdir("kube-ins-update-222", now)
	// A directory that merely starts with something similar must survive: the
	// prefix match is what keeps this from being a delete-anything primitive in
	// a directory shared with the whole system.
	other := mkdir("kube-ins-updates-and-things", old)
	notOurs := mkdir("systemd-private-abc", old)

	// A *file* with the right name is not a directory we created.
	staleFile := filepath.Join(root, "kube-ins-update-333")
	if err := os.WriteFile(staleFile, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(staleFile, old, old); err != nil {
		t.Fatal(err)
	}

	sweepStaleUpdateTemps(root, now)

	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Errorf("the stale download directory survived the sweep: %v", err)
	}
	for _, keep := range []string{fresh, other, notOurs, staleFile} {
		if _, err := os.Stat(keep); err != nil {
			t.Errorf("the sweep removed %s, which it must not touch: %v", keep, err)
		}
	}
}

func TestSweepStaleUpdateTempsMissingRoot(t *testing.T) {
	// A root that does not exist is not an error worth logging on every launch.
	sweepStaleUpdateTemps(filepath.Join(t.TempDir(), "nope"), time.Now())
}
