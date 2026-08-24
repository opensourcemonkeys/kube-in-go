package business

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"kube-ins/internal/logging"
)

const (
	// updateTempPrefix is the os.MkdirTemp prefix RunSelfUpdate uses. Matching
	// on it is the whole safety property of the sweep: this runs in a directory
	// that is not ours, so nothing outside our own naming can be touched.
	updateTempPrefix = "kube-ins-update-"

	// Long enough that an installer still working through a leftover directory
	// is never disturbed, short enough that ~190 MB does not sit there for a
	// week. Windows always leaks one (NSIS is detached); macOS leaks one only if
	// the swap helper died before its final rm -rf.
	updateTempMaxAge = 24 * time.Hour
)

// SweepStaleUpdateTemps removes kube-ins-update-* directories in the OS temp
// directory that are older than updateTempMaxAge. It is best-effort throughout:
// a temp directory we cannot read or remove is not a reason to log an error on
// every launch.
func SweepStaleUpdateTemps() {
	sweepStaleUpdateTemps(os.TempDir(), time.Now())
}

// sweepStaleUpdateTemps is the testable core: the root and the clock are
// parameters so a test never touches the real os.TempDir().
func sweepStaleUpdateTemps(root string, now time.Time) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return
	}
	removed := 0
	for _, e := range entries {
		if !e.IsDir() || !strings.HasPrefix(e.Name(), updateTempPrefix) {
			continue
		}
		info, err := e.Info()
		if err != nil || now.Sub(info.ModTime()) < updateTempMaxAge {
			continue
		}
		if err := os.RemoveAll(filepath.Join(root, e.Name())); err == nil {
			removed++
		}
	}
	if removed > 0 {
		logging.With("business.update").Info("removed stale update downloads", "count", removed, "dir", root)
	}
}
