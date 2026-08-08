package repository_k8sclient

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestClusterConfigPath(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skipf("no home directory: %v", err)
	}
	base := filepath.Join(home, ".kube-ins")

	tests := []struct {
		name        string
		clusterName string
		wantErr     bool
	}{
		// Accepted: anything that is a plain, single filesystem path segment.
		// Users name clusters freely from the UI, so spaces and unicode are
		// ordinary — see the real names this test was written against.
		{"plain", "prod", false},
		{"dots and digits", "my-cluster.1", false},
		{"underscore", "kind_ci", false},
		{"single char", "a", false},
		{"spaces", "cluster 2", false},
		{"many spaces", "cluster 1 loop test main cluster long text", false},
		{"leading digit and space", "default 3", false},
		{"unicode", "üretim-küme", false},
		{"inner double dot", "a..b", false},

		// Rejected: escapes the directory, or resolves to a different file than
		// the one validated.
		{"parent traversal", "../etc/passwd", true},
		{"bare traversal", "..", true},
		{"self", ".", true},
		{"windows traversal", `..\etc`, true},
		{"hidden file", ".active", true},
		{"separator", "a/b", true},
		{"backslash", `a\b`, true},
		{"absolute", "/etc/shadow", true},
		{"drive letter", "C:tmp", true},
		{"null byte", "prod\x00", true},
		{"control char", "prod\nrm", true},
		{"leading space", " prod", true},
		{"trailing space", "prod ", true},
		{"trailing dot", "prod.", true},
		{"empty", "", true},
		{"too long", strings.Repeat("a", maxClusterNameLen+1), true},
		{"windows device", "nul", true},
		{"windows device mixed case", "CoM1", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ClusterConfigPath(tt.clusterName)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("ClusterConfigPath(%q) = %q, want error", tt.clusterName, got)
				}
				if got != "" {
					t.Fatalf("ClusterConfigPath(%q) returned path %q alongside error", tt.clusterName, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("ClusterConfigPath(%q) unexpected error: %v", tt.clusterName, err)
			}
			want := filepath.Join(base, tt.clusterName+".yaml")
			if got != want {
				t.Fatalf("ClusterConfigPath(%q) = %q, want %q", tt.clusterName, got, want)
			}
			// The property that actually matters: the result never escapes
			// ~/.kube-ins, and Clean() cannot rewrite it into something else.
			if filepath.Dir(got) != base {
				t.Fatalf("ClusterConfigPath(%q) escaped %q: %q", tt.clusterName, base, got)
			}
			if filepath.Clean(got) != got {
				t.Fatalf("ClusterConfigPath(%q) is not already clean: %q", tt.clusterName, got)
			}
		})
	}
}

// TestValidateClusterNameAcceptsListClustersOutput guards the invariant the
// validator is written against: every name ListClusters can hand back — i.e.
// every *.yaml basename a user may have created — must validate, or the app
// cannot select its own existing clusters.
func TestValidateClusterNameAcceptsListClustersOutput(t *testing.T) {
	for _, name := range []string{
		"prod", "staging-eu", "kind.ci", "c1_2", "A",
		"cluster 2", "default 3", "my cluster (eu-west)", "küme-1",
	} {
		if err := ValidateClusterName(name); err != nil {
			t.Errorf("ValidateClusterName(%q) = %v, want nil", name, err)
		}
	}
}
