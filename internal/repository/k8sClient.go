package repository_k8sclient

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"kube-ins/internal/logging"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

// k8sRequestTimeout bounds every one-shot API call. Without it a panel polling a
// dead API server hangs forever and stacks a new request every couple of seconds.
// Long-lived streams (log follow, exec) must NOT use it — see the *Streaming
// constructors below.
const k8sRequestTimeout = 20 * time.Second

// maxClusterNameLen leaves room for the ".yaml" suffix inside the 255-byte
// filename limit of every filesystem we ship on.
const maxClusterNameLen = 200

// windowsReservedNames resolve to devices rather than files on Windows, with or
// without an extension, so "nul.yaml" would silently discard the kubeconfig.
var windowsReservedNames = map[string]bool{
	"con": true, "prn": true, "aux": true, "nul": true,
	"com1": true, "com2": true, "com3": true, "com4": true, "com5": true,
	"com6": true, "com7": true, "com8": true, "com9": true,
	"lpt1": true, "lpt2": true, "lpt3": true, "lpt4": true, "lpt5": true,
	"lpt6": true, "lpt7": true, "lpt8": true, "lpt9": true,
}

// ValidateClusterName rejects any name that is not a single safe path segment.
// Cluster names arrive straight from the frontend bindings, so an unchecked name
// lets a caller escape ~/.kube-ins entirely (e.g. "../../.ssh/authorized_keys").
//
// This is deliberately a structural check, not a character allowlist: users name
// clusters freely in the UI, so spaces, parentheses and non-ASCII are ordinary
// and must keep working. What must not get through is anything that makes the
// joined path resolve somewhere other than ~/.kube-ins/<name>.yaml.
func ValidateClusterName(clusterName string) error {
	invalid := func() error { return fmt.Errorf("invalid cluster name %q", clusterName) }

	if clusterName == "" || len(clusterName) > maxClusterNameLen {
		return invalid()
	}
	// Path separators on either platform, NUL, and the Windows drive/stream
	// separator would all split the name into more than one segment.
	if strings.ContainsAny(clusterName, `/\:`+"\x00") {
		return invalid()
	}
	for _, r := range clusterName {
		if r < 0x20 || r == 0x7f {
			return invalid()
		}
	}
	// "." and ".." reference the directory itself or its parent; any leading dot
	// would also let a caller aim at the hidden state files (.active, .hubtoken)
	// that live beside the kubeconfigs.
	if strings.HasPrefix(clusterName, ".") {
		return invalid()
	}
	// Windows silently strips trailing dots and spaces, and the .active file is
	// read back with TrimSpace — either way the name we validated would not be
	// the name that gets resolved.
	if strings.TrimSpace(clusterName) != clusterName || strings.HasSuffix(clusterName, ".") {
		return invalid()
	}
	stem, _, _ := strings.Cut(clusterName, ".")
	if windowsReservedNames[strings.ToLower(stem)] {
		return invalid()
	}
	// Belt and braces: after all of the above the name must still be its own
	// basename, so filepath.Join cannot rewrite it.
	if filepath.Base(clusterName) != clusterName {
		return invalid()
	}
	return nil
}

// ClusterConfigPath resolves ~/.kube-ins/<clusterName>.yaml after validating the
// name. Every read/write of a per-cluster kubeconfig must go through here.
func ClusterConfigPath(clusterName string) (string, error) {
	if err := ValidateClusterName(clusterName); err != nil {
		return "", err
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".kube-ins", clusterName+".yaml"), nil
}

// tune applies the shared request timeout. Applied by every non-streaming
// constructor.
func tune(c *rest.Config) *rest.Config {
	c.Timeout = k8sRequestTimeout
	return c
}

var activeKubeconfigPath string

func SetActiveKubeconfig(path string) {
	activeKubeconfigPath = path
}

func GetActiveKubeconfigPath() string {
	return activeKubeconfigPath
}

func NewK8sClient() (*kubernetes.Clientset, error) {
	config, err := getK8sConfig()
	if err != nil {
		return nil, err
	}

	clientset, err := kubernetes.NewForConfig(tune(config))
	if err != nil {
		return nil, err
	}
	return clientset, err
}

func NewK8sClientAndConfig() (*kubernetes.Clientset, *rest.Config, error) {
	config, err := getK8sConfig()
	if err != nil {
		return nil, nil, err
	}
	clientset, err := kubernetes.NewForConfig(tune(config))
	if err != nil {
		return nil, nil, err
	}
	return clientset, config, nil
}

func NewMetricsClient() (*metricsclient.Clientset, error) {
	config, err := getK8sConfig()
	if err != nil {
		return nil, err
	}
	return metricsclient.NewForConfig(tune(config))
}

func NewK8sClientForCluster(clusterName string) (*kubernetes.Clientset, error) {
	if clusterName == "" {
		return NewK8sClient()
	}
	config, err := clusterConfig(clusterName)
	if err != nil {
		return nil, err
	}
	return kubernetes.NewForConfig(tune(config))
}

func NewK8sClientAndConfigForCluster(clusterName string) (*kubernetes.Clientset, *rest.Config, error) {
	if clusterName == "" {
		return NewK8sClientAndConfig()
	}
	config, err := clusterConfig(clusterName)
	if err != nil {
		return nil, nil, err
	}
	clientset, err := kubernetes.NewForConfig(tune(config))
	if err != nil {
		return nil, nil, err
	}
	return clientset, config, nil
}

func NewMetricsClientForCluster(clusterName string) (*metricsclient.Clientset, error) {
	if clusterName == "" {
		return NewMetricsClient()
	}
	config, err := clusterConfig(clusterName)
	if err != nil {
		return nil, err
	}
	return metricsclient.NewForConfig(tune(config))
}

// NewK8sClientForClusterStreaming is NewK8sClientForCluster without the request
// timeout, for long-lived reads such as a followed log stream. Callers own
// cancellation via their context.
func NewK8sClientForClusterStreaming(clusterName string) (*kubernetes.Clientset, error) {
	config, err := streamingConfig(clusterName)
	if err != nil {
		return nil, err
	}
	return kubernetes.NewForConfig(config)
}

// NewK8sClientAndConfigForClusterStreaming is the *AndConfig* variant without the
// request timeout — the SPDY exec executor is built from the returned config and
// would otherwise be torn down mid-session.
func NewK8sClientAndConfigForClusterStreaming(clusterName string) (*kubernetes.Clientset, *rest.Config, error) {
	config, err := streamingConfig(clusterName)
	if err != nil {
		return nil, nil, err
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, nil, err
	}
	return clientset, config, nil
}

// clusterConfig loads ~/.kube-ins/<clusterName>.yaml directly, bypassing the
// global active path so each panel stays pinned to its own cluster.
func clusterConfig(clusterName string) (*rest.Config, error) {
	path, err := ClusterConfigPath(clusterName)
	if err != nil {
		return nil, err
	}
	config, err := clientcmd.BuildConfigFromFlags("", path)
	if err != nil {
		logging.With("repository.k8sclient").Warn("load kubeconfig failed", "cluster", clusterName, "err", err)
		return nil, err
	}
	return config, nil
}

// streamingConfig builds a config with the request timeout explicitly cleared.
func streamingConfig(clusterName string) (*rest.Config, error) {
	var (
		config *rest.Config
		err    error
	)
	if clusterName == "" {
		config, err = getK8sConfig()
	} else {
		config, err = clusterConfig(clusterName)
	}
	if err != nil {
		return nil, err
	}
	streaming := rest.CopyConfig(config)
	streaming.Timeout = 0
	return streaming, nil
}

func getK8sConfig() (*rest.Config, error) {
	// Use explicitly selected cluster config first
	if activeKubeconfigPath != "" {
		config, err := clientcmd.BuildConfigFromFlags("", activeKubeconfigPath)
		if err != nil {
			logging.With("repository.k8sclient").Warn("load active kubeconfig failed", "path", activeKubeconfigPath, "err", err)
			return nil, err
		}
		return config, nil
	}

	config, err := rest.InClusterConfig()
	if err == nil {
		return config, nil
	}

	kubeconfig := os.Getenv("KUBECONFIG")
	// if kubeconfig == "" {
	// 	home, err := os.UserHomeDir()
	// 	if err != nil {
	// 		return nil, err
	// 	}
	// 	kubeconfig = filepath.Join(home, ".kube", "config")
	// }

	config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		logging.With("repository.k8sclient").Warn("load kubeconfig failed", "path", kubeconfig, "err", err)
		return nil, err
	}

	return config, nil
}
