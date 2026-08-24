package business

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// isNewer decides whether every installed copy of the app prompts its user to
// upgrade, so its ordering rules are worth pinning down explicitly — especially
// the prerelease cases, which is the whole reason the alpha → beta → stable
// progression works at all.
func TestIsNewer(t *testing.T) {
	tests := []struct {
		name            string
		latest, current string
		want            bool
	}{
		// Ordinary progression.
		{"patch bump", "0.15.1-alpha", "0.15.0-alpha", true},
		{"minor bump", "0.16.0", "0.15.0", true},
		{"major bump", "1.0.0", "0.15.0-alpha", true},
		{"same version is not newer", "1.0.0", "1.0.0", false},
		{"older is not newer", "0.14.0-alpha", "0.15.0-alpha", false},

		// Prerelease precedence — the beta transition depends on all of these.
		{"beta beats alpha", "0.16.0-beta.1", "0.16.0-alpha.3", true},
		{"alpha does not beat beta", "0.16.0-alpha.3", "0.16.0-beta.1", false},
		{"stable beats its own beta", "0.16.0", "0.16.0-beta.1", true},
		{"beta does not beat its own stable", "0.16.0-beta.1", "0.16.0", false},
		{"prerelease of a higher minor still wins", "0.16.0-alpha", "0.15.0", true},

		// Dot-numeric identifiers compare numerically; this is why the tag
		// format must be -beta.10 and never -beta10 (which would sort as a
		// string, putting beta10 before beta2).
		{"beta.10 beats beta.2", "0.16.0-beta.10", "0.16.0-beta.2", true},
		{"beta.2 does not beat beta.10", "0.16.0-beta.2", "0.16.0-beta.10", false},

		// A leading "v" is normalized away on both sides.
		{"v prefix on latest only", "v0.16.0", "0.15.0", true},
		{"v prefix on current only", "0.16.0", "v0.15.0", true},
		{"v prefix on both", "v0.16.0", "v0.15.0", true},

		// Malformed input must never trigger the prompt: a dev build reports an
		// unparseable version, and a corrupt manifest must not push an install.
		{"empty latest", "", "0.15.0", false},
		{"empty current", "0.16.0", "", false},
		{"garbage latest", "not-a-version", "0.15.0", false},
		{"garbage current", "0.16.0", "not-a-version", false},

		// `make dev` stamps <version>-dev, e.g. 0.15.0-alpha-dev. A hyphen is a
		// legal character inside a prerelease identifier, so this parses and
		// orders below the release it was built from — a dev build does get
		// offered the newer release, which is the behaviour we want.
		{"dev build orders below a later release", "0.16.0", "0.15.0-alpha-dev", true},
		{"dev build orders above its own base version", "0.15.0-alpha-dev", "0.15.0-alpha", true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := isNewer(tc.latest, tc.current); got != tc.want {
				t.Errorf("isNewer(%q, %q) = %v, want %v", tc.latest, tc.current, got, tc.want)
			}
		})
	}
}

func TestDefaultChannel(t *testing.T) {
	// Below 1.0 every release this project publishes is a prerelease, so a
	// stable-only default would pin every user to an empty channel.
	cases := []struct {
		version string
		want    string
	}{
		{"0.15.0-alpha", ChannelBeta},
		{"0.16.0-beta.1", ChannelBeta},
		{"0.16.0", ChannelBeta},
		{"v0.9.0-alpha", ChannelBeta},
		{"0.15.0-alpha-dev", ChannelBeta},
		{"1.0.0", ChannelStable},
		{"1.0.0-beta.1", ChannelStable},
		{"2.4.1", ChannelStable},
		// A build with no ldflags, or a malformed one, must not land on a
		// channel that silently offers nothing.
		{"", ChannelBeta},
		{"not-a-version", ChannelBeta},
	}
	orig := appVersion
	t.Cleanup(func() { appVersion = orig })
	for _, c := range cases {
		appVersion = c.version
		if got := defaultChannel(); got != c.want {
			t.Errorf("defaultChannel() with appVersion %q = %q, want %q", c.version, got, c.want)
		}
	}
}

func TestUpdateChannelRoundTrip(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("kubeInsDir uses os.UserHomeDir, which reads the registry on Windows")
	}
	t.Setenv("HOME", t.TempDir())

	// No file yet: the default, not an error.
	if got := UpdateChannel(); got != defaultChannel() {
		t.Fatalf("with no .channel file, UpdateChannel() = %q, want the default %q", got, defaultChannel())
	}

	for _, want := range []string{ChannelStable, ChannelBeta} {
		if err := SetUpdateChannel(want); err != nil {
			t.Fatalf("SetUpdateChannel(%q): %v", want, err)
		}
		if got := UpdateChannel(); got != want {
			t.Fatalf("UpdateChannel() = %q, want %q", got, want)
		}
	}

	if err := SetUpdateChannel("nightly"); err == nil {
		t.Fatal("SetUpdateChannel accepted an unknown channel")
	}
	// The rejected write must not have disturbed the persisted value.
	if got := UpdateChannel(); got != ChannelBeta {
		t.Fatalf("after a rejected write, UpdateChannel() = %q, want %q", got, ChannelBeta)
	}

	// Garbage in the file falls back rather than surfacing.
	dir, err := kubeInsDir()
	if err != nil {
		t.Fatalf("kubeInsDir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, channelFile), []byte("rc\n"), 0600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if got := UpdateChannel(); got != defaultChannel() {
		t.Fatalf("with unrecognised content, UpdateChannel() = %q, want the default %q", got, defaultChannel())
	}
}

func TestManifestURLFollowsChannel(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("kubeInsDir uses os.UserHomeDir, which reads the registry on Windows")
	}
	t.Setenv("HOME", t.TempDir())

	if err := SetUpdateChannel(ChannelBeta); err != nil {
		t.Fatalf("SetUpdateChannel: %v", err)
	}
	if got := manifestURL(); got != betaManifestURL {
		t.Fatalf("beta channel resolved to %q, want %q", got, betaManifestURL)
	}
	if err := SetUpdateChannel(ChannelStable); err != nil {
		t.Fatalf("SetUpdateChannel: %v", err)
	}
	if got := manifestURL(); got != stableManifestURL {
		t.Fatalf("stable channel resolved to %q, want %q", got, stableManifestURL)
	}

	// The env override exists to test the mechanism and must beat the channel.
	t.Setenv("KUBE_INS_UPDATE_MANIFEST", "http://127.0.0.1:9/version.json")
	if got := manifestURL(); got != "http://127.0.0.1:9/version.json" {
		t.Fatalf("KUBE_INS_UPDATE_MANIFEST did not win over the channel: %q", got)
	}
}
