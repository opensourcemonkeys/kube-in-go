package services_k8sclient

import (
	"encoding/base64"
	"os"
	"strings"
)

// SaveSnapshotPNG decodes a PNG given as a data URL ("data:image/png;base64,…")
// or a bare base64 string and writes it to path, ensuring a .png extension.
// Returns the final path written.
func SaveSnapshotPNG(path, dataURL string) (string, error) {
	b64 := dataURL
	if i := strings.Index(b64, ","); i >= 0 {
		b64 = b64[i+1:]
	}
	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", err
	}
	if !strings.HasSuffix(strings.ToLower(path), ".png") {
		path += ".png"
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	return path, nil
}

// SaveTextFile writes text content (e.g. an HTML report) to path and returns it.
func SaveTextFile(path, content string) (string, error) {
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return "", err
	}
	return path, nil
}
