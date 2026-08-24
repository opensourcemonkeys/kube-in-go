package services_k8sclient

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// The swap script only ever runs on a machine where the app has already quit,
// so a syntax error in it is invisible: the update simply does nothing and the
// user is left on the old version with no error anywhere. Parse it on every
// run, on every platform.
func TestSwapHelperScriptParses(t *testing.T) {
	sh, err := exec.LookPath("sh")
	if err != nil {
		t.Skip("no /bin/sh available")
	}

	// Paths with a space and a quote: the real target is "Kube Inspector.app".
	body := swapHelperScript(
		"/home/u/.kube-ins/logs/update-helper.log",
		4321, 1234,
		"/tmp/kube-ins-update-9/stage/Kube Inspector.app",
		"/Applications/Kube Inspector.app",
		"/tmp/kube-ins-update-9",
	)

	script := filepath.Join(t.TempDir(), "apply-update.sh")
	if err := os.WriteFile(script, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	out, err := exec.Command(sh, "-n", script).CombinedOutput()
	if err != nil {
		t.Fatalf("the swap script is not valid sh: %v\n%s\n---\n%s", err, out, body)
	}
}

func TestSwapHelperScriptContent(t *testing.T) {
	body := swapHelperScript("/logs/h.log", 4321, 1234, "/stage/New.app", "/Applications/App.app", "/tmp/dl")

	// It must move, not copy. `ditto` merges, so files deleted between two
	// releases would live in the installed app forever — the bug this replaced.
	if strings.Contains(body, "ditto") {
		t.Error("the swap script still uses ditto, which merges instead of replacing")
	}
	for _, want := range []string{
		"wait_pid 4321",                   // this sidecar
		"wait_pid 1234",                   // the shell's main process
		"exec >>'/logs/h.log' 2>&1",       // the helper's only channel back
		"OLD='/Applications/App.app'.old", // the aside-move target
		"rm -rf '/tmp/dl'",                // the download temp dir, passed explicitly
		`[ "$1" -gt 1 ]`,                  // never wait on a reparented pid
	} {
		if !strings.Contains(body, want) {
			t.Errorf("the swap script is missing %q", want)
		}
	}

	// The rollback must come after the failed forward move, or a failure leaves
	// no app at all.
	restore := strings.Index(body, "restoring the old one")
	forward := strings.Index(body, "if ! mv '/stage/New.app'")
	if restore < 0 || forward < 0 || restore < forward {
		t.Error("the restore branch is missing or does not follow the move it undoes")
	}

	// The last line must remove the download directory, never the bundle's
	// parent: passing filepath.Dir(work) instead would make this rm -rf
	// /Applications the moment staging moved next to the target.
	if strings.Contains(body, "rm -rf '/Applications'") {
		t.Fatal("the script would remove the Applications directory")
	}
}
