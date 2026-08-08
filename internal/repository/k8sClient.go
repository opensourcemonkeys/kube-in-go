package repository_k8sclient

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

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

// clusterNameRe matches what ListClusters can produce: one path segment of
// [A-Za-z0-9._-], no leading dot, no separators, no traversal.
var clusterNameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$`)

// ValidateClusterName rejects any name that is not a single safe path segment.
// Cluster names arrive straight from the frontend bindings, so an unchecked name
// lets a caller escape ~/.kube-ins entirely (e.g. "../../.ssh/authorized_keys").
func ValidateClusterName(clusterName string) error {
	if !clusterNameRe.MatchString(clusterName) || strings.Contains(clusterName, "..") {
		return fmt.Errorf("invalid cluster name %q", clusterName)
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
		log.Printf("Failed to load kubeconfig for cluster %s: %v", clusterName, err)
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
			log.Printf("Failed to load active kubeconfig from %s: %v", activeKubeconfigPath, err)
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
		log.Printf("Failed to load kubeconfig from %s: %v", kubeconfig, err)
		return nil, err
	}

	return config, nil
}
