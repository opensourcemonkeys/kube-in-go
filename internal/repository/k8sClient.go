package repository_k8sclient

import (
	"log"
	"os"
	"path/filepath"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

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

	clientset, err := kubernetes.NewForConfig(config)
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
	clientset, err := kubernetes.NewForConfig(config)
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
	return metricsclient.NewForConfig(config)
}

func NewK8sClientForCluster(clusterName string) (*kubernetes.Clientset, error) {
	if clusterName == "" {
		return NewK8sClient()
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(home, ".kube-ins", clusterName+".yaml")
	config, err := clientcmd.BuildConfigFromFlags("", path)
	if err != nil {
		log.Printf("Failed to load kubeconfig for cluster %s: %v", clusterName, err)
		return nil, err
	}
	return kubernetes.NewForConfig(config)
}

func NewK8sClientAndConfigForCluster(clusterName string) (*kubernetes.Clientset, *rest.Config, error) {
	if clusterName == "" {
		return NewK8sClientAndConfig()
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, nil, err
	}
	path := filepath.Join(home, ".kube-ins", clusterName+".yaml")
	config, err := clientcmd.BuildConfigFromFlags("", path)
	if err != nil {
		return nil, nil, err
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, nil, err
	}
	return clientset, config, nil
}

func NewMetricsClientForCluster(clusterName string) (*metricsclient.Clientset, error) {
	if clusterName == "" {
		return NewMetricsClient()
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(home, ".kube-ins", clusterName+".yaml")
	config, err := clientcmd.BuildConfigFromFlags("", path)
	if err != nil {
		return nil, err
	}
	return metricsclient.NewForConfig(config)
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
