package services_k8sclient

import (
	"context"
	"kube-ins/internal/models"

	repository_k8sclient "kube-ins/internal/repository"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func GetPods(namespace string, repoK8sClient *repository_k8sclient.K8sClient) ([]models.PodInfo, error) {
	if repoK8sClient != nil {

	}
	pods, err := repoK8sClient.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	podInfos := make([]models.PodInfo, 0, len(pods.Items))
	for _, pod := range pods.Items {
		podInfos = append(podInfos, podToInfo(pod))
	}

	return podInfos, nil
}

func podToInfo(pod corev1.Pod) models.PodInfo {
	return models.PodInfo{
		Name:      pod.Name,
		Namespace: pod.Namespace,
		Status:    getPodStatus(pod),
		CreatedAt: pod.CreationTimestamp.Time,
	}
}

func getPodStatus(pod corev1.Pod) models.PodStatus {
	if pod.DeletionTimestamp != nil {
		return models.PodStatusTerminating
	}

	switch pod.Status.Phase {
	case corev1.PodRunning:
		return models.PodStatusRunning
	case corev1.PodPending:
		return models.PodStatusPending
	default:
		return models.PodStatus(pod.Status.Phase)
	}
}
