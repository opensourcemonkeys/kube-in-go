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
		{"plain", "prod", false},
		{"dots and digits", "my-cluster.1", false},
		{"underscore", "kind_ci", false},
		{"single char", "a", false},
		{"parent traversal", "../etc/passwd", true},
		{"bare traversal", "..", true},
		{"embedded traversal", "a..b", true},
		{"hidden file", ".active", true},
		{"separator", "a/b", true},
		{"backslash", `a\b`, true},
		{"empty", "", true},
		{"absolute", "/etc/shadow", true},
		{"null byte", "prod\x00", true},
		{"space", "my cluster", true},
		{"too long", strings.Repeat("a", 64), true},
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
			// Belt and braces: the result must never escape ~/.kube-ins.
			if filepath.Dir(got) != base {
				t.Fatalf("ClusterConfigPath(%q) escaped %q: %q", tt.clusterName, base, got)
			}
		})
	}
}

// TestValidateClusterNameAcceptsListClustersOutput guards the invariant the regex
// is written against: anything ListClusters can produce must validate.
func TestValidateClusterNameAcceptsListClustersOutput(t *testing.T) {
	for _, name := range []string{"prod", "staging-eu", "kind.ci", "c1_2", "A"} {
		if err := ValidateClusterName(name); err != nil {
			t.Errorf("ValidateClusterName(%q) = %v, want nil", name, err)
		}
	}
}
