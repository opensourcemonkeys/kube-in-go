package business

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"kube-ins/internal/logging"
)

const (
	// updateStateFile records an update that was handed to an installer but
	// whose outcome this process cannot observe: on Windows NSIS runs detached,
	// on macOS the swap helper runs after the app has quit, and on Linux dpkg
	// can succeed while the relaunch fails. The next launch compares the
	// running version against the attempted one and reports the difference.
	updateStateFile = ".update-state"

	// updateHelperLog is written by the detached macOS swap helper. It runs
	// after the app is gone, so a file is its only channel back.
	updateHelperLog = "update-helper.log"

	// Enough of the helper log to show what failed without turning a modal into
	// a log viewer. The file is removed once reported, so it cannot grow.
	helperLogTailBytes = 2048
)

// updateState is the on-disk record, one line of JSON in ~/.kube-ins.
type updateState struct {
	From      string `json:"from"`
	To        string `json:"to"`
	Asset     string `json:"asset"`
	Channel   string `json:"channel"`
	StartedAt string `json:"startedAt"`
}

// writeUpdateState records an update attempt immediately before the package is
// handed to the installer. Errors are logged and swallowed: failing to write a
// diagnostic breadcrumb must never abort an update the user asked for.
func writeUpdateState(st updateState) {
	dir, err := kubeInsDir()
	if err != nil {
		logging.With("business.update").Warn("could not record the update attempt", "err", err)
		return
	}
	st.StartedAt = time.Now().UTC().Format(time.RFC3339)
	data, err := json.Marshal(st)
	if err != nil {
		return
	}
	if err := os.WriteFile(filepath.Join(dir, updateStateFile), data, 0600); err != nil {
		logging.With("business.update").Warn("could not record the update attempt", "err", err)
	}
}

// clearUpdateState removes the record. It must be called on every path where
// the app is still running and the user already saw what happened — above all
// an installer error, which on Linux is usually just "cancelled at the password
// prompt". Left behind, that record would fire a spurious "your update failed"
// warning on the next launch.
func clearUpdateState() {
	dir, err := kubeInsDir()
	if err != nil {
		return
	}
	_ = os.Remove(filepath.Join(dir, updateStateFile))
}

// consumeUpdateState reads and removes the record, so a failed update is
// reported exactly once. A *successful* update lands here too — the running
// version then matches or exceeds the attempted one, nothing is reported, and
// the file is gone either way.
func consumeUpdateState() (updateState, bool) {
	dir, err := kubeInsDir()
	if err != nil {
		return updateState{}, false
	}
	path := filepath.Join(dir, updateStateFile)
	data, err := os.ReadFile(path)
	_ = os.Remove(path)
	if err != nil {
		return updateState{}, false
	}
	var st updateState
	if err := json.Unmarshal(data, &st); err != nil || st.To == "" {
		return updateState{}, false
	}
	return st, true
}

// consumeHelperLog returns the tail of the macOS swap helper's log and removes
// it. Empty on every other platform, and on macOS whenever the swap worked
// without printing a warning.
func consumeHelperLog() string {
	dir, err := logging.Dir()
	if err != nil {
		return ""
	}
	path := filepath.Join(dir, updateHelperLog)
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()

	if fi, err := f.Stat(); err == nil && fi.Size() > helperLogTailBytes {
		if _, err := f.Seek(fi.Size()-helperLogTailBytes, io.SeekStart); err != nil {
			return ""
		}
	}
	data, err := io.ReadAll(f)
	f.Close()
	_ = os.Remove(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}
