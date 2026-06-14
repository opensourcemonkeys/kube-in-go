package business

import (
	"context"
	"os"
	"path/filepath"

	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

// trivyCacheDir is where Trivy stores its vulnerability DB and layer cache,
// kept alongside the app's other state under ~/.kube-ins.
func trivyCacheDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".kube-ins", "trivy-cache")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// TrivyScanImage scans a single container image for vulnerabilities. The first
// scan downloads the vulnerability DB into the cache, so it can take a while.
func TrivyScanImage(clusterName, imageRef string) (*models.TrivyScanResult, error) {
	cacheDir, err := trivyCacheDir()
	if err != nil {
		return nil, err
	}
	return services.ScanImage(context.Background(), imageRef, cacheDir)
}

// TrivyListPodImages returns the distinct images used by pods in the given
// namespace (empty namespace = all namespaces) of the given cluster. The
// frontend feeds these into TrivyScanImage one by one for cluster/namespace
// scans.
func TrivyListPodImages(clusterName, namespace string) ([]string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.ListPodImages(client, namespace)
}
