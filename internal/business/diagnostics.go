package business

import (
	"archive/zip"
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"kube-ins/internal/ai"
	"kube-ins/internal/logging"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	"kube-ins/internal/safego"
	services "kube-ins/internal/services"
)

// Diagnostics: everything the Diagnostics panel needs, and the redacted zip a
// user attaches to a bug report. Nothing here leaves the machine on its own —
// there is no telemetry; the user chooses what to send and to whom.

// GetDiagnostics collects the environment half of the report.
//
// Shell and Hub are left empty on purpose: only the controller knows which
// Transport is installed, and business must not import internal/ipc.
func GetDiagnostics() models.DiagnosticsReport {
	app := GetAppInfo()

	rep := models.DiagnosticsReport{
		AppVersion:   app.AppVersion,
		Commit:       app.Commit,
		BuildDate:    app.BuildDate,
		GoVersion:    app.GoVersion,
		GOOS:         runtime.GOOS,
		GOARCH:       runtime.GOARCH,
		OSRelease:    osRelease(),
		Pid:          os.Getpid(),
		LogLevel:     logging.Level(),
		Dependencies: app.Dependencies,
		GeneratedAt:  time.Now().UTC().Format(time.RFC3339),
	}

	if dir, err := logging.Dir(); err == nil {
		rep.LogDir = dir
	}
	rep.LogFiles = logFileInfos()

	clusters, _ := ListClusters()
	rep.ClusterCount = len(clusters)
	if active := GetActiveCluster(); active != "" {
		// A hash, never the name: enough to tell two reports apart or to spot
		// "it is always the same cluster", without publishing anything.
		sum := sha256.Sum256([]byte(active))
		rep.ActiveCluster = hex.EncodeToString(sum[:])[:8]
	}
	return rep
}

func logFileInfos() []models.LogFileInfo {
	paths, err := logging.Files()
	if err != nil {
		return nil
	}
	out := make([]models.LogFileInfo, 0, len(paths))
	for _, p := range paths {
		fi, err := os.Stat(p)
		if err != nil {
			continue
		}
		out = append(out, models.LogFileInfo{
			Name:       filepath.Base(p),
			SizeBytes:  fi.Size(),
			ModifiedAt: fi.ModTime().UTC().Format(time.RFC3339),
		})
	}
	return out
}

// osRelease is a short human description of the OS. On Linux it comes from
// /etc/os-release, which is the one thing that distinguishes "works on Fedora,
// fails on Ubuntu 22.04" reports from each other.
func osRelease() string {
	if runtime.GOOS != "linux" {
		return runtime.GOOS
	}
	b, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return runtime.GOOS
	}
	for _, line := range strings.Split(string(b), "\n") {
		if name, ok := strings.CutPrefix(line, "PRETTY_NAME="); ok {
			return strings.Trim(strings.TrimSpace(name), `"`)
		}
	}
	return runtime.GOOS
}

// ─── Log access ──────────────────────────────────────────────────────────────

// TailLogs returns the tail of today's log rendered for the Logs tab.
//
// Filtering happens here rather than in the UI so a search covers the whole
// window on disk instead of only the rows already loaded.
func TailLogs(n int, minLevel, query string) ([]models.LogEntry, error) {
	recs, err := logging.Tail(n, minLevel, query)
	if err != nil {
		return nil, err
	}
	out := make([]models.LogEntry, 0, len(recs))
	for _, r := range recs {
		out = append(out, toLogEntry(r))
	}
	return out, nil
}

// reservedFields are rendered as their own columns, so they are dropped from
// the free-form tail to keep each row readable.
var reservedFields = map[string]bool{
	"service": true, "version": true, "role": true, "pid": true,
}

func toLogEntry(r logging.Record) models.LogEntry {
	e := models.LogEntry{
		Timestamp: r.Timestamp,
		Level:     r.Level,
		Logger:    r.Logger,
		Message:   r.Message,
	}
	if role, ok := r.Fields["role"].(string); ok {
		e.Role = role
	}
	if pid, ok := r.Fields["pid"].(float64); ok {
		e.Pid = int(pid)
	}

	keys := make([]string, 0, len(r.Fields))
	for k := range r.Fields {
		if !reservedFields[k] {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys) // stable order, so a polling UI does not reshuffle rows
	var b strings.Builder
	for _, k := range keys {
		if b.Len() > 0 {
			b.WriteByte(' ')
		}
		fmt.Fprintf(&b, "%s=%v", k, r.Fields[k])
	}
	e.Fields = b.String()
	return e
}

func SetLogLevel(level string) error { return logging.SetLevel(level) }
func GetLogLevel() string            { return logging.Level() }
func LogDir() (string, error)        { return logging.Dir() }

// ─── Health checks ───────────────────────────────────────────────────────────

const (
	perCheckTimeout = 6 * time.Second
	overallTimeout  = 20 * time.Second

	// logSizeWarn is the compensating control for having no size cap on the
	// log directory: nothing deletes on size, so the panel says something
	// before the disk does.
	logSizeWarn = 200 << 20
)

type check struct {
	name  string
	label string
	fn    func(ctx context.Context) (status, detail string)
}

// RunHealthChecks runs every preflight concurrently and returns them in a
// stable order, so the panel's rows never reshuffle between runs.
//
// ollamaHost may be empty, in which case the assistant check is skipped: the
// host lives in the frontend's chat store and an unconfigured user has no
// Ollama to reach.
func RunHealthChecks(ollamaHost string) []models.HealthCheck {
	return runChecks(buildChecks(ollamaHost))
}

func runChecks(checks []check) []models.HealthCheck {
	out := make([]models.HealthCheck, len(checks))

	ctx, cancel := context.WithTimeout(context.Background(), overallTimeout)
	defer cancel()

	var wg sync.WaitGroup
	for i, c := range checks {
		// Pre-seed the row so a check that panics or overruns still reports
		// something rather than leaving a blank line.
		out[i] = models.HealthCheck{
			Name: c.name, Label: c.label,
			Status: models.HealthFail, Detail: "did not complete",
		}
		wg.Add(1)
		// safego per the project rule. fn's own defer runs before safego's
		// deferred Recover, so a panicking check still releases the WaitGroup.
		safego.Go("business.diagnostics."+c.name, func() {
			defer wg.Done()
			cctx, ccancel := context.WithTimeout(ctx, perCheckTimeout)
			defer ccancel()
			start := time.Now()
			status, detail := c.fn(cctx)
			out[i] = models.HealthCheck{
				Name: c.name, Label: c.label,
				Status: status, Detail: detail,
				DurationMs: time.Since(start).Milliseconds(),
			}
		})
	}
	wg.Wait()
	return out
}

func buildChecks(ollamaHost string) []check {
	checks := []check{
		{"log-dir-writable", "Log directory writable", checkLogDir},
		{"log-size", "Log directory size", checkLogSize},
		{"update-manifest", "Update manifest reachable", checkUpdateManifest},
		{"trivy-db", "Trivy vulnerability database", checkTrivyDB},
		{"ollama", "AI assistant (Ollama)", func(ctx context.Context) (string, string) {
			return checkOllama(ctx, ollamaHost)
		}},
	}

	clusters, _ := ListClusters()
	sort.Strings(clusters)
	for _, name := range clusters {
		checks = append(checks,
			check{"cluster:" + name, "Cluster " + name + " — API reachable",
				func(ctx context.Context) (string, string) { return checkClusterAPI(ctx, name) }},
			check{"rbac:" + name, "Cluster " + name + " — can list pods",
				func(ctx context.Context) (string, string) { return checkClusterRBAC(ctx, name) }},
			check{"metrics:" + name, "Cluster " + name + " — metrics-server",
				func(ctx context.Context) (string, string) { return checkClusterMetrics(ctx, name) }},
		)
	}
	return checks
}

func checkLogDir(context.Context) (string, string) {
	dir, err := logging.Dir()
	if err != nil {
		return models.HealthFail, err.Error()
	}
	probe := filepath.Join(dir, fmt.Sprintf(".probe-%d", os.Getpid()))
	f, err := os.OpenFile(probe, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return models.HealthFail, "cannot write to the log directory: " + err.Error()
	}
	_ = f.Close()
	_ = os.Remove(probe)
	return models.HealthOK, dir
}

func checkLogSize(context.Context) (string, string) {
	paths, err := logging.Files()
	if err != nil {
		return models.HealthFail, err.Error()
	}
	var total int64
	for _, p := range paths {
		if fi, err := os.Stat(p); err == nil {
			total += fi.Size()
		}
	}
	detail := fmt.Sprintf("%d file(s), %s", len(paths), humanBytes(total))
	if total > logSizeWarn {
		return models.HealthWarn, detail + " — logs are only pruned by age (7 days); consider lowering the log level"
	}
	return models.HealthOK, detail
}

func checkUpdateManifest(ctx context.Context) (string, string) {
	url := manifestURL()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return models.HealthFail, err.Error()
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		// Being offline is a normal state, not a broken install.
		return models.HealthWarn, "not reachable: " + err.Error()
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return models.HealthWarn, fmt.Sprintf("HTTP %d from %s", resp.StatusCode, url)
	}
	var manifest map[string]any
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&manifest); err != nil {
		return models.HealthWarn, "manifest did not parse: " + err.Error()
	}
	return models.HealthOK, url
}

func checkTrivyDB(context.Context) (string, string) {
	home, err := os.UserHomeDir()
	if err != nil {
		return models.HealthSkip, err.Error()
	}
	db := filepath.Join(home, ".kube-ins", "trivy-cache", "image", "db", "trivy.db")
	fi, err := os.Stat(db)
	if err != nil {
		return models.HealthWarn, "not downloaded yet; the first scan fetches it (~40 MB)"
	}
	return models.HealthOK, fmt.Sprintf("%s, updated %s",
		humanBytes(fi.Size()), fi.ModTime().Format(time.RFC3339))
}

func checkOllama(ctx context.Context, host string) (string, string) {
	if host == "" {
		return models.HealthSkip, "no host configured"
	}
	if !ai.IsAvailable(ctx, host) {
		return models.HealthWarn, "no Ollama server at " + host + " — the AI assistant is unavailable"
	}
	return models.HealthOK, host
}

func checkClusterAPI(ctx context.Context, name string) (string, string) {
	client, err := repository.NewK8sClientForCluster(name)
	if err != nil {
		return models.HealthFail, err.Error()
	}
	version, elapsed, err := services.PingCluster(ctx, client)
	if err != nil {
		return models.HealthFail, err.Error()
	}
	return models.HealthOK, fmt.Sprintf("%s in %dms", version, elapsed.Milliseconds())
}

func checkClusterRBAC(ctx context.Context, name string) (string, string) {
	client, err := repository.NewK8sClientForCluster(name)
	if err != nil {
		return models.HealthFail, err.Error()
	}
	allowed, reason, err := services.CanListPods(ctx, client)
	if err != nil {
		return models.HealthFail, err.Error()
	}
	if !allowed {
		// Denied is information, not breakage: it is the answer to "why is
		// this panel empty".
		detail := "this credential cannot list pods"
		if reason != "" {
			detail += ": " + reason
		}
		return models.HealthWarn, detail
	}
	return models.HealthOK, "allowed"
}

func checkClusterMetrics(ctx context.Context, name string) (string, string) {
	mc, err := repository.NewMetricsClientForCluster(name)
	if err != nil {
		return models.HealthFail, err.Error()
	}
	if _, err := services.HasMetricsServer(ctx, mc); err != nil {
		// metrics-server is genuinely optional; the app degrades rather than
		// breaks without it.
		return models.HealthWarn, "not installed — Monitoring and pod usage columns stay empty"
	}
	return models.HealthOK, "responding"
}

func humanBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for v := n / unit; v >= unit; v /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(n)/float64(div), "KMGTPE"[exp])
}

// ─── Report rendering and export ─────────────────────────────────────────────

// RenderDiagnosticsText produces the plain-text report shown in the panel and
// stored in the zip. Callers must redact the result before it leaves the
// machine; ExportDiagnosticsZip does.
func RenderDiagnosticsText(rep models.DiagnosticsReport, checks []models.HealthCheck) string {
	var b strings.Builder
	w := func(format string, args ...any) { fmt.Fprintf(&b, format+"\n", args...) }

	w("Kube Inspector diagnostics")
	w("generated       %s", rep.GeneratedAt)
	w("")
	w("version         %s", rep.AppVersion)
	if rep.Commit != "" {
		w("commit          %s", rep.Commit)
	}
	if rep.BuildDate != "" {
		w("built           %s", rep.BuildDate)
	}
	w("go              %s", rep.GoVersion)
	w("platform        %s/%s", rep.GOOS, rep.GOARCH)
	w("os              %s", rep.OSRelease)
	w("shell           %s", orDash(rep.Shell))
	w("")
	w("log directory   %s", orDash(rep.LogDir))
	w("log level       %s", rep.LogLevel)
	for _, f := range rep.LogFiles {
		w("  %-34s %10s  %s", f.Name, humanBytes(f.SizeBytes), f.ModifiedAt)
	}
	w("")
	w("clusters        %d configured (names redacted)", rep.ClusterCount)
	w("active cluster  %s", orDash(rep.ActiveCluster))
	w("instance hub    %s", orDash(rep.Hub.Role))
	if rep.Hub.InstanceName != "" {
		w("  this instance %s (%d total)", rep.Hub.InstanceName, rep.Hub.InstanceCount)
	}

	if len(rep.Dependencies) > 0 {
		w("")
		w("dependencies")
		for _, d := range rep.Dependencies {
			w("  %-44s %s", d.Name, d.Version)
		}
	}

	if len(checks) > 0 {
		w("")
		w("health checks")
		for _, c := range checks {
			w("  [%-4s] %-44s %s", c.Status, c.Label, c.Detail)
		}
	}
	return b.String()
}

func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

// ExportDiagnosticsZip writes a redacted diagnostics bundle to path.
//
// shellJSON is whatever the native shell contributed (Electron/Chromium
// versions, its own log tail); it is empty under Wails and in a browser tab.
// hub is supplied by the controller, which owns the InstanceHub.
func ExportDiagnosticsZip(path, ollamaHost, shellJSON string, hub models.HubDiagnostics, shell string) (err error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := f.Close(); err == nil {
			err = cerr
		}
	}()

	zw := zip.NewWriter(f)

	clusters, _ := ListClusters()
	red := redactorFor(clusters)

	rep := GetDiagnostics()
	rep.Hub = hub
	rep.Shell = shell
	checks := RunHealthChecks(ollamaHost)

	if err := addZipText(zw, "diagnostics.txt", red(RenderDiagnosticsText(rep, checks))); err != nil {
		return err
	}

	// Marshal first, then redact the result as text: one redactor covers both
	// artefacts, so a field can never be scrubbed in the report and left in the
	// JSON.
	payload, merr := json.MarshalIndent(struct {
		Report models.DiagnosticsReport `json:"report"`
		Checks []models.HealthCheck     `json:"checks"`
	}{rep, checks}, "", "  ")
	if merr == nil {
		if err := addZipText(zw, "report.json", red(string(payload))); err != nil {
			return err
		}
	}

	if shellJSON != "" {
		if err := addZipText(zw, "shell.json", red(shellJSON)); err != nil {
			return err
		}
	}

	files, _ := logging.Files()
	for _, p := range files {
		if err := addZipLogFile(zw, "logs/"+filepath.Base(p), p, red); err != nil {
			logging.With("business.diagnostics").Warn("could not add log file to the export",
				"file", filepath.Base(p), "err", err)
		}
	}

	return zw.Close()
}

func addZipText(zw *zip.Writer, name, content string) error {
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = io.WriteString(w, content)
	return err
}

// addZipLogFile copies a log file through the redactor line by line.
//
// bufio.Reader, not bufio.Scanner: a truncated 32 KiB panic record blows
// Scanner's 64 KiB token limit, and Scanner reports that by stopping — which
// would silently drop the rest of the file, in an artefact whose entire purpose
// is completeness.
func addZipLogFile(zw *zip.Writer, name, path string, red func(string) string) error {
	src, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = src.Close() }()

	dst, err := zw.Create(name)
	if err != nil {
		return err
	}

	r := bufio.NewReader(src)
	for {
		line, rerr := r.ReadString('\n')
		if line != "" {
			if _, werr := io.WriteString(dst, red(line)); werr != nil {
				return werr
			}
		}
		if rerr != nil {
			if rerr == io.EOF {
				return nil
			}
			return rerr
		}
	}
}
