package services_k8sclient

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"kube-ins/internal/models"
	"sigs.k8s.io/yaml"
)

func GetPersistentVolumeClaims(namespace string, client *kubernetes.Clientset) ([]models.PersistentVolumeClaimInfo, error) {
	list, err := client.CoreV1().PersistentVolumeClaims(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.PersistentVolumeClaimInfo, 0, len(list.Items))
	for _, pvc := range list.Items {
		infos = append(infos, pvcToInfo(pvc))
	}
	return infos, nil
}

func DeletePersistentVolumeClaim(name string, namespace string, client *kubernetes.Clientset) error {
	return client.CoreV1().PersistentVolumeClaims(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
}

func GetPersistentVolumeClaimYaml(name string, namespace string, client *kubernetes.Clientset) (string, error) {
	if name == "" || namespace == "" {
		return "", errNamespaceNameRequired
	}
	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(pvc)
}

func UpdatePersistentVolumeClaimYaml(name, namespace, yamlContent string, client *kubernetes.Clientset) error {
	if name == "" || namespace == "" {
		return errNamespaceNameRequired
	}
	var pvc corev1.PersistentVolumeClaim
	if err := yaml.Unmarshal([]byte(yamlContent), &pvc); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}
	pvc.Name = name
	pvc.Namespace = namespace
	_, err := client.CoreV1().PersistentVolumeClaims(namespace).Update(context.Background(), &pvc, metav1.UpdateOptions{})
	return err
}

func pvcToInfo(pvc corev1.PersistentVolumeClaim) models.PersistentVolumeClaimInfo {
	modes := make([]string, 0, len(pvc.Spec.AccessModes))
	for _, m := range pvc.Spec.AccessModes {
		modes = append(modes, string(m))
	}

	request := "-"
	if q, ok := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
		request = q.String()
	}

	limit := "-"
	if q, ok := pvc.Spec.Resources.Limits[corev1.ResourceStorage]; ok {
		limit = q.String()
	}

	scName := "-"
	if pvc.Spec.StorageClassName != nil && *pvc.Spec.StorageClassName != "" {
		scName = *pvc.Spec.StorageClassName
	}

	return models.PersistentVolumeClaimInfo{
		Name:             pvc.Name,
		Namespace:        pvc.Namespace,
		Status:           string(pvc.Status.Phase),
		VolumeName:       pvc.Spec.VolumeName,
		StorageClassName: scName,
		AccessModes:      modes,
		Request:          request,
		Limit:            limit,
		CreatedAt:        pvc.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
