package logging

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"strings"
)

// tailWindow bounds how far back Tail reads. There is no size cap on the log
// file by design, so an unbounded tail would be a memory bomb.
const tailWindow = 4 << 20

// Record is one parsed json_event line. Raw is set only for a line that failed
// to parse — a torn write on a network home, say — which is surfaced rather
// than dropped, because an invisible corruption is worse than a visible one.
type Record struct {
	Timestamp string         `json:"@timestamp"`
	Version   string         `json:"@version"`
	Level     string         `json:"level"`
	Message   string         `json:"message"`
	Logger    string         `json:"logger"`
	Fields    map[string]any `json:"fields"`
	Raw       string         `json:"-"`
}

// Tail reads the current day file backwards and returns up to n records
// oldest-first, ready to render.
//
// minLevel "" means no floor; query "" means no filter. Filtering happens here
// rather than in the UI so a search covers the whole window instead of just the
// rows already loaded.
func Tail(n int, minLevel, query string) ([]Record, error) {
	if n <= 0 {
		n = 200
	}

	path, err := CurrentFile()
	if err != nil {
		return nil, err
	}
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	defer func() { _ = f.Close() }()

	fi, err := f.Stat()
	if err != nil {
		return nil, err
	}
	var start int64
	if fi.Size() > tailWindow {
		start = fi.Size() - tailWindow
	}
	if _, err := f.Seek(start, io.SeekStart); err != nil {
		return nil, err
	}
	data, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}

	lines := bytes.Split(data, []byte{'\n'})
	if start > 0 && len(lines) > 0 {
		// The seek almost certainly landed mid-record.
		lines = lines[1:]
	}

	floor := levelRank(minLevel)
	q := strings.ToLower(query)

	out := make([]Record, 0, n)
	for i := len(lines) - 1; i >= 0 && len(out) < n; i-- {
		line := bytes.TrimSpace(lines[i])
		if len(line) == 0 {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(string(line)), q) {
			continue
		}
		var r Record
		if err := json.Unmarshal(line, &r); err != nil || r.Timestamp == "" {
			r = Record{Level: "INFO", Message: string(line), Raw: string(line)}
		}
		if levelRank(r.Level) < floor {
			continue
		}
		out = append(out, r)
	}

	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out, nil
}
