package business

import (
	"os"
	"strings"
	"testing"
)

func TestRedactorRules(t *testing.T) {
	// A home directory whose last segment is also a cluster name — the ordering
	// hazard that makes $HOME have to run first.
	home := t.TempDir() + "/mfx"
	if err := os.MkdirAll(home, 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	red := redactorFor([]string{"prod", "prod-eu", "mfx"})

	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "home path collapses even when a cluster shares its name",
			in:   "failed to read " + home + "/.kube-ins/prod.yaml",
			want: "failed to read ~/.kube-ins/<cluster-2>.yaml",
		},
		{
			name: "longest cluster name wins",
			in:   "cluster prod-eu is down, prod is fine",
			want: "cluster <cluster-3> is down, <cluster-2> is fine",
		},
		{
			name: "adjacent occurrences are both replaced",
			in:   "prod prod prod",
			want: "<cluster-2> <cluster-2> <cluster-2>",
		},
		{
			name: "cluster name inside a longer identifier is left alone",
			in:   "my-prod-cluster stays",
			want: "my-prod-cluster stays",
		},
		{
			name: "RBAC prose survives intact",
			in:   `secrets is forbidden: User "dev" cannot list resource "secrets" in API group ""`,
			want: `secrets is forbidden: User "dev" cannot list resource "secrets" in API group ""`,
		},
		{
			name: "bearer token is dropped",
			in:   "Authorization: Bearer abcdefghijklmnop",
			want: "Authorization: Bearer " + redactedMarker,
		},
		{
			name: "password assignment is dropped",
			in:   "password=hunter2hunter2",
			want: "password=" + redactedMarker,
		},
		{
			name: "jwt is dropped",
			in:   "tok eyJhbGciOiJSUzI1NiIsImtpZCI6Ilg0N2FiY2RlZmdoaWprbG1ub3AifQ rest",
			want: "tok " + redactedMarker + " rest",
		},
		{
			name: "git commit survives",
			in:   "commit a0708a1f2c3d4e5b6a7980c1d2e3f405162738a9",
			want: "commit a0708a1f2c3d4e5b6a7980c1d2e3f405162738a9",
		},
		{
			// 64-char hex is the shape of this app's RPC and hub tokens, so it
			// goes even though that costs us checksums and image digests.
			name: "64-char hex is dropped because tokens share its shape",
			in:   "verified e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			want: "verified " + redactedMarker,
		},
		{
			name: "long asar path survives",
			in:   "/usr/lib/kube-inspector/resources/app.asar/dist/assets/index-a1b2c3d4.js",
			want: "/usr/lib/kube-inspector/resources/app.asar/dist/assets/index-a1b2c3d4.js",
		},
		{
			name: "api server address collapses to its scheme",
			in:   "Get https://10.42.0.1:6443/api/v1/namespaces/x/pods: timeout",
			want: "Get https://<host>: timeout",
		},
		{
			name: "our own endpoints survive",
			in:   "fetching https://kubeinspector.com/version.json",
			want: "fetching https://kubeinspector.com/version.json",
		},
		{
			name: "loopback survives",
			in:   "ollama at http://localhost:11434/api/tags",
			want: "ollama at http://localhost:11434/api/tags",
		},
		{
			name: "embedded credentials are dropped with the host",
			in:   "https://admin:s3cr3t@cluster.example.com/api",
			want: "https://<host>",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := red(tc.in)
			if got != tc.want {
				t.Errorf("redact(%q)\n got %q\nwant %q", tc.in, got, tc.want)
			}
			// Every rule must be stable under a second pass, or a report that
			// is redacted twice (report.json is rendered then redacted as text)
			// would keep degrading.
			if again := red(got); again != got {
				t.Errorf("not idempotent:\n first %q\nsecond %q", got, again)
			}
		})
	}
}

func TestRedactorNoClusters(t *testing.T) {
	red := redactorFor(nil)
	in := "nothing to see in cluster prod"
	if got := red(in); got != in {
		t.Errorf("got %q, want %q", got, in)
	}
}

func TestRedactorClusterNumberingIsStable(t *testing.T) {
	// Directory order must not change the labels: two exports have to diff.
	a := redactorFor([]string{"zulu", "alpha", "mike"})
	b := redactorFor([]string{"mike", "zulu", "alpha"})
	in := "alpha mike zulu"
	if a(in) != b(in) {
		t.Errorf("labels depend on input order: %q vs %q", a(in), b(in))
	}
	if got, want := a(in), "<cluster-1> <cluster-2> <cluster-3>"; got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestRedactorHandlesLogLines(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("no home directory")
	}
	red := redactorFor([]string{"prod"})
	line := `{"@timestamp":"2026-08-08T19:12:11.549Z","level":"ERROR","message":"list pods failed",` +
		`"logger":"business.pod","fields":{"cluster":"prod","path":"` + home + `/.kube-ins/prod.yaml",` +
		`"err":"Get \"https://10.0.0.1:6443/api/v1/pods\": forbidden"}}`

	got := red(line)
	for _, bad := range []string{home, `"prod"`, "10.0.0.1"} {
		if strings.Contains(got, bad) {
			t.Errorf("redacted line still contains %q:\n%s", bad, got)
		}
	}
	for _, keep := range []string{"list pods failed", "business.pod", "forbidden"} {
		if !strings.Contains(got, keep) {
			t.Errorf("redaction destroyed %q:\n%s", keep, got)
		}
	}
}
