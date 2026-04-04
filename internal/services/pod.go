package services

import (
	"context"
	"errors"
	"kube-ins/internal/models"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (k *K8sClient) GetPods(namespace string) ([]models.PodInfo, error) {
	pods, err := k.clientset.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	podInfos := make([]models.PodInfo, 0, len(pods.Items))
	for _, pod := range pods.Items {
		podInfos = append(podInfos, podToInfo(pod))
	}

	return podInfos, nil
}

func (k *K8sClient) GetPod(namespace, name string) (*models.PodInfo, error) {
	if namespace == "" {
		return nil, errors.New("namespace is required")
	}
	if name == "" {
		return nil, errors.New("pod name is required")
	}

	pod, err := k.clientset.CoreV1().Pods(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	podInfo := podToInfo(*pod)
	return &podInfo, nil
}

func (k *K8sClient) CreatePod(namespace string, pod *corev1.Pod) (*models.PodInfo, error) {
	if pod == nil {
		return nil, errors.New("pod cannot be nil")
	}

	if namespace == "" {
		namespace = pod.Namespace
	}
	if namespace == "" {
		return nil, errors.New("namespace is required")
	}

	createdPod, err := k.clientset.CoreV1().Pods(namespace).Create(context.TODO(), pod, metav1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	podInfo := podToInfo(*createdPod)
	return &podInfo, nil
}

func (k *K8sClient) UpdatePod(namespace string, pod *corev1.Pod) (*models.PodInfo, error) {
	if pod == nil {
		return nil, errors.New("pod cannot be nil")
	}

	if namespace == "" {
		namespace = pod.Namespace
	}
	if namespace == "" {
		return nil, errors.New("namespace is required")
	}

	updatedPod, err := k.clientset.CoreV1().Pods(namespace).Update(context.TODO(), pod, metav1.UpdateOptions{})
	if err != nil {
		return nil, err
	}

	podInfo := podToInfo(*updatedPod)
	return &podInfo, nil
}

func (k *K8sClient) DeletePod(namespace, name string) error {
	if namespace == "" {
		return errors.New("namespace is required")
	}
	if name == "" {
		return errors.New("pod name is required")
	}

	return k.clientset.CoreV1().Pods(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
}

func podToInfo(pod corev1.Pod) models.PodInfo {
	return models.PodInfo{
		Name:      pod.Name,
		Namespace: pod.Namespace,
		Status:    string(pod.Status.Phase),
		CreatedAt: pod.CreationTimestamp.Time,
	}
}
