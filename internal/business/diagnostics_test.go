package business

import (
	"archive/zip"
	"context"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"kube-ins/internal/models"
)

// seedLogDir points logging at a temp directory holding one day file whose
// contents carry exactly the things redaction must remove.
func seedLogDir(t *testing.T, home, cluster string) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("KUBE_INS_LOG_DIR", dir)

	name := "kube-inspector-" + time.Now().Format("2006-01-02") + ".log"
	line := `{"@timestamp":"2026-08-08T19:12:11.549Z","@version":"1","level":"ERROR",` +
		`"message":"list pods failed","logger":"business.pod",` +
		`"fields":{"service":"kube-inspector","role":"backend","pid":1,"cluster":"` + cluster + `",` +
		`"path":"` + home + `/.kube-ins/` + cluster + `.yaml",` +
		`"err":"Get \"https://10.0.0.1:6443/api/v1/pods\": forbidden"}}` + "\n"
	if err := os.WriteFile(filepath.Join(dir, name), []byte(line), 0600); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestExportDiagnosticsZipIsRedacted(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	// ListClusters reads ~/.kube-ins, so seeding a kubeconfig there is what
	// makes the cluster name known to the redactor.
	kubeIns := filepath.Join(home, ".kube-ins")
	if err := os.MkdirAll(kubeIns, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(kubeIns, "acme-prod.yaml"), []byte("{}\n"), 0600); err != nil {
		t.Fatal(err)
	}
	seedLogDir(t, home, "acme-prod")

	out := filepath.Join(t.TempDir(), "diag.zip")
	// ollamaHost empty so the assistant check is skipped rather than dialling.
	if err := ExportDiagnosticsZip(out, "", `{"electron":"38.0.0","userData":"`+home+`/.config"}`,
		models.HubDiagnostics{Role: "server", InstanceName: "Instance 1", InstanceCount: 1},
		"electron"); err != nil {
		t.Fatal(err)
	}

	zr, err := zip.OpenReader(out)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = zr.Close() }()

	var names []string
	for _, f := range zr.File {
		names = append(names, f.Name)

		rc, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		b, err := io.ReadAll(rc)
		_ = rc.Close()
		if err != nil {
			t.Fatal(err)
		}
		body := string(b)

		for _, bad := range []string{home, "acme-prod", "10.0.0.1"} {
			if strings.Contains(body, bad) {
				t.Errorf("%s leaks %q:\n%s", f.Name, bad, body)
			}
		}
	}

	for _, want := range []string{"diagnostics.txt", "report.json"} {
		if !slices.Contains(names, want) {
			t.Errorf("zip is missing %s (has %v)", want, names)
		}
	}
	var hasLog bool
	for _, n := range names {
		if strings.HasPrefix(n, "logs/") {
			hasLog = true
		}
	}
	if !hasLog {
		t.Errorf("zip carries no log files: %v", names)
	}
}

func TestExportDiagnosticsZipKeepsTheEvidence(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	seedLogDir(t, home, "acme-prod")

	out := filepath.Join(t.TempDir(), "diag.zip")
	if err := ExportDiagnosticsZip(out, "", "", models.HubDiagnostics{}, "cli"); err != nil {
		t.Fatal(err)
	}

	zr, err := zip.OpenReader(out)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = zr.Close() }()

	var logBody string
	for _, f := range zr.File {
		if !strings.HasPrefix(f.Name, "logs/") {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		b, _ := io.ReadAll(rc)
		_ = rc.Close()
		logBody += string(b)
	}
	// Redaction that removed the error itself would defeat the whole feature.
	for _, keep := range []string{"list pods failed", "business.pod", "forbidden"} {
		if !strings.Contains(logBody, keep) {
			t.Errorf("redaction destroyed %q:\n%s", keep, logBody)
		}
	}
}

func TestRunHealthChecksBoundedAndStable(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	seedLogDir(t, home, "none")
	// No manifest server: point the update check at a closed port so it fails
	// fast instead of reaching the real site from a test.
	t.Setenv("KUBE_INS_UPDATE_MANIFEST", "http://127.0.0.1:1/version.json")

	start := time.Now()
	first := RunHealthChecks("")
	elapsed := time.Since(start)

	if elapsed > overallTimeout+2*time.Second {
		t.Errorf("checks took %s, past the overall timeout", elapsed)
	}
	if len(first) == 0 {
		t.Fatal("no checks ran")
	}
	for _, c := range first {
		if c.Status == "" || c.Label == "" {
			t.Errorf("incomplete row: %+v", c)
		}
		if c.Detail == "did not complete" {
			t.Errorf("check %q never reported", c.Name)
		}
	}

	second := RunHealthChecks("")
	if len(first) != len(second) {
		t.Fatalf("check count changed between runs: %d vs %d", len(first), len(second))
	}
	for i := range first {
		if first[i].Name != second[i].Name {
			t.Errorf("row %d moved: %q -> %q", i, first[i].Name, second[i].Name)
		}
	}
}

func TestRunHealthChecksSurvivesAPanickingCheck(t *testing.T) {
	// The runner is what must not hang; exercise its contract directly rather
	// than waiting for a real check to misbehave.
	checks := []check{
		{"boom", "panics", func(context.Context) (string, string) { panic("boom") }},
		{"fine", "works", func(context.Context) (string, string) { return models.HealthOK, "ok" }},
	}
	done := make(chan []models.HealthCheck, 1)
	go func() { done <- runChecks(checks) }()

	select {
	case out := <-done:
		if len(out) != 2 {
			t.Fatalf("got %d rows", len(out))
		}
		if out[0].Status != models.HealthFail {
			t.Errorf("panicking check reported %q, want fail", out[0].Status)
		}
		if out[1].Status != models.HealthOK {
			t.Errorf("healthy sibling reported %q", out[1].Status)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("a panicking check hung the runner")
	}
}

func TestRenderDiagnosticsTextHasNoClusterNames(t *testing.T) {
	rep := models.DiagnosticsReport{
		AppVersion: "0.16.0", GoVersion: "go1.26.3", GOOS: "linux", GOARCH: "amd64",
		LogLevel: "INFO", ClusterCount: 3, ActiveCluster: "deadbeef",
	}
	text := RenderDiagnosticsText(rep, []models.HealthCheck{
		{Name: "log-dir-writable", Label: "Log directory writable", Status: models.HealthOK, Detail: "~/.kube-ins/logs"},
	})
	for _, want := range []string{"0.16.0", "3 configured", "deadbeef", "Log directory writable"} {
		if !strings.Contains(text, want) {
			t.Errorf("report is missing %q:\n%s", want, text)
		}
	}
}
