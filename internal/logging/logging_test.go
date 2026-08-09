package logging

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"
)

// resetForTest undoes Init so each test starts from the pre-Init state. The
// package keeps process-wide state on purpose, so these tests must not run in
// parallel with each other.
func resetForTest(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv(envLogDir, dir)
	t.Setenv(envLogLevel, "")
	t.Setenv(envLogStderr, "")

	initOnce = sync.Once{}
	initErr = nil
	st.Store(nil)
	root.Store(slog.New(slog.DiscardHandler))
	named = sync.Map{}
	writer.Store(nil)
	lvl.Set(slog.LevelInfo)

	t.Cleanup(func() { _ = Close() })
	return dir
}

func readLines(t *testing.T, dir string) []string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, dayFileName(time.Now())))
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		t.Fatalf("read log: %v", err)
	}
	var out []string
	for _, l := range strings.Split(string(b), "\n") {
		if strings.TrimSpace(l) != "" {
			out = append(out, l)
		}
	}
	return out
}

// decodeTop returns the line's top-level object without interpreting it, so a
// test can assert on the exact key set.
func decodeTop(t *testing.T, line string) map[string]json.RawMessage {
	t.Helper()
	var m map[string]json.RawMessage
	if err := json.Unmarshal([]byte(line), &m); err != nil {
		t.Fatalf("line is not JSON: %v\n%s", err, line)
	}
	return m
}

func decodeRecord(t *testing.T, line string) Record {
	t.Helper()
	var r Record
	if err := json.Unmarshal([]byte(line), &r); err != nil {
		t.Fatalf("line is not a Record: %v\n%s", err, line)
	}
	return r
}

// lineWithLogger finds the single record emitted by the named logger, skipping
// the "logger started" line Init writes.
func lineWithLogger(t *testing.T, dir, logger string) string {
	t.Helper()
	for _, l := range readLines(t, dir) {
		if decodeRecord(t, l).Logger == logger {
			return l
		}
	}
	t.Fatalf("no record from logger %q in %s", logger, dir)
	return ""
}

func TestJSONEventShape(t *testing.T) {
	dir := resetForTest(t)
	if err := Init(RoleBackend, "0.16.0-beta.1"); err != nil {
		t.Fatal(err)
	}

	With("business.pod").Error("list pods failed", "cluster", "prod", "err", "forbidden")

	line := lineWithLogger(t, dir, "business.pod")
	top := decodeTop(t, line)

	want := []string{"@timestamp", "@version", "fields", "level", "logger", "message"}
	got := make([]string, 0, len(top))
	for k := range top {
		got = append(got, k)
	}
	slices.Sort(got)
	if !slices.Equal(got, want) {
		t.Fatalf("top-level keys = %v, want %v\n%s", got, want, line)
	}

	r := decodeRecord(t, line)
	if r.Version != "1" {
		t.Errorf("@version = %q, want \"1\"", r.Version)
	}
	if r.Level != "ERROR" {
		t.Errorf("level = %q, want ERROR", r.Level)
	}
	if r.Message != "list pods failed" {
		t.Errorf("message = %q", r.Message)
	}
	if _, err := time.Parse(timeLayout, r.Timestamp); err != nil {
		t.Errorf("@timestamp %q does not parse: %v", r.Timestamp, err)
	}
	if !strings.HasSuffix(r.Timestamp, "Z") {
		t.Errorf("@timestamp %q is not UTC", r.Timestamp)
	}

	for k, want := range map[string]any{
		"service": serviceName,
		"version": "0.16.0-beta.1",
		"role":    RoleBackend,
		"cluster": "prod",
		"err":     "forbidden",
	} {
		if got := r.Fields[k]; got != want {
			t.Errorf("fields.%s = %v, want %v", k, got, want)
		}
	}
	if _, ok := r.Fields["pid"]; !ok {
		t.Error("fields.pid missing")
	}
}

// TestCallerAttrsCannotEscape is the regression test for the ReplaceAttr group
// guard: a caller attribute named like a reserved key must land under fields
// and must not touch the top level.
func TestCallerAttrsCannotEscape(t *testing.T) {
	dir := resetForTest(t)
	if err := Init(RoleBackend, "v"); err != nil {
		t.Fatal(err)
	}

	With("evil").Warn("real message",
		"level", "HACKED",
		"message", "HACKED",
		"@timestamp", "HACKED",
		"@version", "HACKED",
	)

	line := lineWithLogger(t, dir, "evil")
	r := decodeRecord(t, line)

	if r.Level != "WARN" {
		t.Errorf("top-level level = %q, want WARN", r.Level)
	}
	if r.Message != "real message" {
		t.Errorf("top-level message = %q", r.Message)
	}
	if r.Version != "1" {
		t.Errorf("top-level @version = %q", r.Version)
	}
	if _, err := time.Parse(timeLayout, r.Timestamp); err != nil {
		t.Errorf("top-level @timestamp clobbered: %q", r.Timestamp)
	}
	for _, k := range []string{"level", "message", "@timestamp", "@version"} {
		if r.Fields[k] != "HACKED" {
			t.Errorf("fields.%s = %v, want HACKED", k, r.Fields[k])
		}
	}
}

// TestWithBindsTopLevelLogger documents the one trap in the API: the fields
// group is already open on L(), so binding "logger" there nests it.
func TestWithBindsTopLevelLogger(t *testing.T) {
	dir := resetForTest(t)
	if err := Init(RoleBackend, "v"); err != nil {
		t.Fatal(err)
	}

	With("business.pod").Info("named")
	L().With("logger", "wrong").Info("nested")

	var namedLine, nestedLine string
	for _, l := range readLines(t, dir) {
		switch decodeRecord(t, l).Message {
		case "named":
			namedLine = l
		case "nested":
			nestedLine = l
		}
	}
	if r := decodeRecord(t, namedLine); r.Logger != "business.pod" {
		t.Errorf("With(name) logger = %q, want business.pod", r.Logger)
	}
	r := decodeRecord(t, nestedLine)
	if r.Logger != "" {
		t.Errorf("L().With(\"logger\") set top-level logger = %q; expected it to nest", r.Logger)
	}
	if r.Fields["logger"] != "wrong" {
		t.Errorf("fields.logger = %v, want \"wrong\"", r.Fields["logger"])
	}
}

func TestLevelFilteringAndSetLevel(t *testing.T) {
	dir := resetForTest(t)
	if err := Init(RoleBackend, "v"); err != nil {
		t.Fatal(err)
	}

	bound := With("lvl") // bound before the change: must still see it
	bound.Debug("suppressed")
	if n := len(readLines(t, dir)); n != 1 { // only "logger started"
		t.Fatalf("debug leaked at INFO: %d lines", n)
	}

	if err := SetLevel("debug"); err != nil {
		t.Fatal(err)
	}
	if Level() != "DEBUG" {
		t.Fatalf("Level() = %q", Level())
	}
	bound.Debug("visible")

	var found bool
	for _, l := range readLines(t, dir) {
		if decodeRecord(t, l).Message == "visible" {
			found = true
		}
	}
	if !found {
		t.Error("already-bound logger did not pick up the level change")
	}

	b, err := os.ReadFile(filepath.Join(dir, levelFile))
	if err != nil || strings.TrimSpace(string(b)) != "DEBUG" {
		t.Errorf(".level file = %q, %v", b, err)
	}

	if err := SetLevel("nonsense"); err == nil {
		t.Error("SetLevel accepted a bogus level")
	}
}

func TestRollover(t *testing.T) {
	dir := resetForTest(t)

	now := time.Date(2026, 8, 8, 23, 59, 59, 900e6, time.Local)
	clock := func() time.Time { return now }
	w, err := newDayWriter(dir, clock)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = w.Close() }()

	if _, err := w.Write([]byte("before\n")); err != nil {
		t.Fatal(err)
	}
	first := w.Path()

	now = now.Add(200 * time.Millisecond) // 00:00:00.100 the next day
	if _, err := w.Write([]byte("after\n")); err != nil {
		t.Fatal(err)
	}
	second := w.Path()

	if first == second {
		t.Fatal("writer did not roll over at midnight")
	}
	if filepath.Base(first) != "kube-inspector-2026-08-08.log" {
		t.Errorf("first file = %s", filepath.Base(first))
	}
	if filepath.Base(second) != "kube-inspector-2026-08-09.log" {
		t.Errorf("second file = %s", filepath.Base(second))
	}
	for path, want := range map[string]string{first: "before\n", second: "after\n"} {
		b, err := os.ReadFile(path)
		if err != nil || string(b) != want {
			t.Errorf("%s = %q, %v; want %q", filepath.Base(path), b, err, want)
		}
	}
}

func TestRetention(t *testing.T) {
	dir := resetForTest(t)
	now := time.Now()

	var expected []string
	for d := range 11 {
		name := dayFileName(now.AddDate(0, 0, -d))
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x\n"), 0600); err != nil {
			t.Fatal(err)
		}
		if d <= retainDays {
			expected = append(expected, name)
		}
	}
	// Files the sweep must never touch.
	keep := []string{"notes.txt", ".level", "shell.log", "kube-inspector-2026-8-8.log"}
	for _, n := range keep {
		if err := os.WriteFile(filepath.Join(dir, n), []byte("keep\n"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	expected = append(expected, keep...)

	if err := sweep(dir, now); err != nil {
		t.Fatal(err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, e := range entries {
		if e.Name() == sweepMarker {
			continue
		}
		got = append(got, e.Name())
	}
	slices.Sort(got)
	slices.Sort(expected)
	if !slices.Equal(got, expected) {
		t.Errorf("after sweep:\n got %v\nwant %v", got, expected)
	}
}

func TestRetentionMarkerAndLock(t *testing.T) {
	dir := resetForTest(t)
	now := time.Now()
	old := dayFileName(now.AddDate(0, 0, -30))
	write := func() {
		if err := os.WriteFile(filepath.Join(dir, old), []byte("x\n"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	exists := func() bool {
		_, err := os.Stat(filepath.Join(dir, old))
		return err == nil
	}

	write()
	if err := sweep(dir, now); err != nil {
		t.Fatal(err)
	}
	if exists() {
		t.Fatal("first sweep did not delete the old file")
	}

	// Marker is fresh: the next sweep must be a no-op.
	write()
	if err := sweep(dir, now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if !exists() {
		t.Error("sweep ran again inside sweepMinGap")
	}

	// Past the gap, but another process holds a fresh lock. The lock's mtime
	// has to track the simulated clock, since that is what staleness is
	// measured against.
	lock := filepath.Join(dir, sweepLock)
	later := now.Add(sweepMinGap + time.Minute)
	if err := os.WriteFile(lock, nil, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(lock, later, later); err != nil {
		t.Fatal(err)
	}
	if err := sweep(dir, later); err != nil {
		t.Fatal(err)
	}
	if !exists() {
		t.Error("sweep ignored a live lock")
	}
	if _, err := os.Stat(lock); err != nil {
		t.Error("sweep removed a lock that was still fresh")
	}

	// A stale lock is cleared so the following sweep can proceed.
	stale := later.Add(sweepLockTTL + time.Minute)
	if err := sweep(dir, stale); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(lock); err == nil {
		t.Error("stale lock was not removed")
	}
	if err := sweep(dir, stale.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	if exists() {
		t.Error("sweep did not resume after the stale lock was cleared")
	}
}

func TestConcurrentAppendSameProcess(t *testing.T) {
	dir := resetForTest(t)
	if err := Init(RoleBackend, "v"); err != nil {
		t.Fatal(err)
	}

	const workers, perWorker = 8, 500
	var wg sync.WaitGroup
	for w := range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			log := With("concurrent")
			for i := range perWorker {
				log.Info("record", "worker", w, "i", i, "pad", strings.Repeat("x", 300))
			}
		}()
	}
	wg.Wait()

	counts := make(map[float64]int)
	for _, l := range readLines(t, dir) {
		r := decodeRecord(t, l)
		if r.Logger != "concurrent" {
			continue
		}
		w, ok := r.Fields["worker"].(float64)
		if !ok {
			t.Fatalf("missing worker field: %s", l)
		}
		counts[w]++
	}
	if len(counts) != workers {
		t.Fatalf("saw %d workers, want %d", len(counts), workers)
	}
	for w, n := range counts {
		if n != perWorker {
			t.Errorf("worker %v wrote %d records, want %d", w, n, perWorker)
		}
	}
}

// TestConcurrentAppendMultiProcess is the test that actually exercises
// O_APPEND rather than the in-process mutex: four separate processes append to
// one file and no line may be torn.
func TestConcurrentAppendMultiProcess(t *testing.T) {
	if testing.Short() {
		t.Skip("re-execs the test binary")
	}
	dir := resetForTest(t)

	const procs, perProc = 4, 500
	var wg sync.WaitGroup
	errs := make([]error, procs)
	for p := range procs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cmd := exec.Command(os.Args[0], "-test.run=^TestAppendChild$")
			cmd.Env = append(os.Environ(),
				envLogDir+"="+dir,
				"KUBE_INS_LOG_TEST_CHILD="+fmt.Sprint(p),
			)
			out, err := cmd.CombinedOutput()
			if err != nil {
				errs[p] = fmt.Errorf("child %d: %v\n%s", p, err, out)
			}
		}()
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}

	var children int
	for _, l := range readLines(t, dir) {
		var r Record
		if err := json.Unmarshal([]byte(l), &r); err != nil {
			t.Fatalf("torn line: %v\n%s", err, l)
		}
		if r.Logger == "child" {
			children++
		}
	}
	if children != procs*perProc {
		t.Errorf("got %d child records, want %d", children, procs*perProc)
	}
}

// TestAppendChild is the helper process for TestConcurrentAppendMultiProcess.
func TestAppendChild(t *testing.T) {
	tag := os.Getenv("KUBE_INS_LOG_TEST_CHILD")
	if tag == "" {
		t.Skip("helper for TestConcurrentAppendMultiProcess")
	}
	if err := Init(RoleBackend, "child"); err != nil {
		t.Fatal(err)
	}
	log := With("child")
	for i := range 500 {
		log.Info("record", "tag", tag, "i", i, "pad", strings.Repeat("y", 300))
	}
	if err := Close(); err != nil {
		t.Fatal(err)
	}
}

func TestRecordCap(t *testing.T) {
	dir := resetForTest(t)
	if err := Init(RoleBackend, "v"); err != nil {
		t.Fatal(err)
	}

	With("huge").Error("boom", "stack", strings.Repeat("A\n\"", 400_000))

	var line string
	for _, l := range readLines(t, dir) {
		if strings.Contains(l, "truncated") {
			line = l
		}
	}
	if line == "" {
		t.Fatal("oversized record was not replaced")
	}
	if len(line)+1 > maxRecord {
		t.Errorf("truncated line is %d bytes, cap is %d", len(line)+1, maxRecord)
	}
	r := decodeRecord(t, line)
	if r.Fields["truncated"] != true {
		t.Errorf("fields.truncated = %v", r.Fields["truncated"])
	}
	if s, ok := r.Fields["original"].(string); !ok || s == "" {
		t.Error("truncated record kept none of the original")
	}
}

func TestNoOpBeforeInit(t *testing.T) {
	dir := resetForTest(t)

	L().Error("nothing", "k", "v")
	With("early").Info("nothing")
	if Level() != "INFO" {
		t.Errorf("Level() before Init = %q", Level())
	}
	if files, err := Files(); err != nil || len(files) != 0 {
		t.Errorf("Files() before Init = %v, %v", files, err)
	}
	if recs, err := Tail(10, "", ""); err != nil || len(recs) != 0 {
		t.Errorf("Tail() before Init = %v, %v", recs, err)
	}
	if err := Close(); err != nil {
		t.Errorf("Close() before Init = %v", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Errorf("pre-Init logging touched the disk: %v", entries)
	}

	// A name requested before Init must bind for real afterwards, not stay
	// stuck on the discard handler.
	if err := Init(RoleBackend, "v"); err != nil {
		t.Fatal(err)
	}
	With("early").Info("now recorded")
	if lineWithLogger(t, dir, "early") == "" {
		t.Error("logger requested before Init never started recording")
	}
}

func TestTailFilters(t *testing.T) {
	resetForTest(t)
	if err := Init(RoleBackend, "v"); err != nil {
		t.Fatal(err)
	}

	With("business.pod").Info("listing pods")
	With("business.pod").Warn("pods degraded")
	With("ipc.hub").Error("hub died")
	With("business.pod").Error("pods forbidden")

	recs, err := Tail(10, "WARN", "pod")
	if err != nil {
		t.Fatal(err)
	}
	if len(recs) != 2 {
		t.Fatalf("got %d records, want 2: %+v", len(recs), recs)
	}
	if recs[0].Message != "pods degraded" || recs[1].Message != "pods forbidden" {
		t.Errorf("wrong records or wrong order: %q, %q", recs[0].Message, recs[1].Message)
	}

	// A corrupt line is surfaced, not dropped and not fatal.
	path, err := CurrentFile()
	if err != nil {
		t.Fatal(err)
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.WriteString("{\"@timestamp\": tor\n"); err != nil {
		t.Fatal(err)
	}
	_ = f.Close()

	recs, err = Tail(50, "", "")
	if err != nil {
		t.Fatal(err)
	}
	last := recs[len(recs)-1]
	if last.Raw == "" {
		t.Errorf("corrupt line was not surfaced as Raw: %+v", last)
	}
}
