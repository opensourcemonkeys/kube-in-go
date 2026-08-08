package business

import (
	"os"
	"path/filepath"
	"strings"

	repository "kube-ins/internal/repository"
)

const activeClusterFile = ".active"

var activeCluster string

// init reads the persisted cluster selection so the k8s client is ready before
// the first frontend call arrives.
func init() {
	dir, err := kubeInsDir()
	if err != nil {
		return
	}
	data, err := os.ReadFile(filepath.Join(dir, activeClusterFile))
	if err != nil {
		return
	}
	name := strings.TrimSpace(string(data))
	if name != "" {
		_ = SetActiveCluster(name)
	}
}

func kubeInsDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".kube-ins")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

func ListClusters() ([]string, error) {
	dir, err := kubeInsDir()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".yaml") {
			names = append(names, strings.TrimSuffix(e.Name(), ".yaml"))
		}
	}
	return names, nil
}

// clusterFile resolves the kubeconfig path for a cluster, creating ~/.kube-ins
// if needed. The path itself comes from repository.ClusterConfigPath so the name
// is validated in exactly one place.
func clusterFile(name string) (string, error) {
	if _, err := kubeInsDir(); err != nil {
		return "", err
	}
	return repository.ClusterConfigPath(name)
}

func SaveCluster(name, content string) error {
	path, err := clusterFile(name)
	if err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0600)
}

func GetClusterContent(name string) (string, error) {
	path, err := clusterFile(name)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func DeleteCluster(name string) error {
	path, err := clusterFile(name)
	if err != nil {
		return err
	}
	return os.Remove(path)
}

func SetActiveCluster(name string) error {
	dir, err := kubeInsDir()
	if err != nil {
		return err
	}
	if name == "" {
		activeCluster = ""
		repository.SetActiveKubeconfig("")
		_ = os.Remove(filepath.Join(dir, activeClusterFile))
		return nil
	}
	path, err := repository.ClusterConfigPath(name)
	if err != nil {
		return err
	}
	activeCluster = name
	repository.SetActiveKubeconfig(path)
	return os.WriteFile(filepath.Join(dir, activeClusterFile), []byte(name), 0600)
}

func GetActiveCluster() string {
	return activeCluster
}

func CheckClusterConnection() error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	_, err = client.Discovery().ServerVersion()
	return err
}
