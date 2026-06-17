package business

import (
	services "kube-ins/internal/services"
)

// SaveSnapshotPNG writes a PNG (data URL or base64) to the chosen path.
func SaveSnapshotPNG(path, dataURL string) (string, error) {
	return services.SaveSnapshotPNG(path, dataURL)
}
