package business

import (
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func CreatePodExecSession(clusterName string, id, namespace, podName, container string, onOutput func(string)) error {
	// Streaming client: the SPDY exec session must outlive the shared request timeout.
	client, config, err := repository.NewK8sClientAndConfigForClusterStreaming(clusterName)
	if err != nil {
		return err
	}
	return services.CreatePodExecSession(id, namespace, podName, container, onOutput, client, config)
}

func WriteToPodExecSession(id, data string) error {
	return services.WriteToPodExecSession(id, data)
}

func ResizePodExecSession(id string, cols, rows int) error {
	return services.ResizePodExecSession(id, uint16(cols), uint16(rows))
}

func ClosePodExecSession(id string) error {
	return services.ClosePodExecSession(id)
}
