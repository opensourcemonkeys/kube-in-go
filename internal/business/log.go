package business

import (
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetPodContainers(clusterName string, name, namespace string) ([]string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetPodContainers(namespace, name, client)
}

func GetDeploymentPods(clusterName string, name, namespace string) ([]string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetDeploymentPods(namespace, name, client)
}

func GetStatefulSetPods(clusterName string, name, namespace string) ([]string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetStatefulSetPods(namespace, name, client)
}

func GetReplicaSetPods(clusterName string, name, namespace string) ([]string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetReplicaSetPods(namespace, name, client)
}

func GetDaemonSetPods(clusterName string, name, namespace string) ([]string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetDaemonSetPods(namespace, name, client)
}

func GetJobPods(clusterName string, name, namespace string) ([]string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetJobPods(namespace, name, client)
}

func GetCronJobPods(clusterName string, name, namespace string) ([]string, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, err
	}
	return services.GetCronJobPods(namespace, name, client)
}

func StartLogStream(clusterName string, sessionId, podName, namespace, container string, onData func(string)) error {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return err
	}
	return services.StartLogStream(sessionId, namespace, podName, container, client, onData)
}

func StopLogStream(sessionId string) {
	services.StopLogStream(sessionId)
}
