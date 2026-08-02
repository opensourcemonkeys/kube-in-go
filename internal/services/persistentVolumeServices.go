package services_k8sclient

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"kube-ins/internal/models"
)

func GetPersistentVolumes(client *kubernetes.Clientset) ([]models.PersistentVolumeInfo, error) {
	list, err := client.CoreV1().PersistentVolumes().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.PersistentVolumeInfo, 0, len(list.Items))
	for _, pv := range list.Items {
		infos = append(infos, pvToInfo(pv))
	}
	return infos, nil
}

func GetPersistentVolumeYaml(name string, client *kubernetes.Clientset) (string, error) {
	if name == "" {
		return "", errNamespaceNameRequired
	}
	pv, err := client.CoreV1().PersistentVolumes().Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(pv)
}

func pvToInfo(pv corev1.PersistentVolume) models.PersistentVolumeInfo {
	modes := make([]string, 0, len(pv.Spec.AccessModes))
	for _, m := range pv.Spec.AccessModes {
		modes = append(modes, string(m))
	}

	reclaimPolicy := string(pv.Spec.PersistentVolumeReclaimPolicy)

	volumeMode := "Filesystem"
	if pv.Spec.VolumeMode != nil {
		volumeMode = string(*pv.Spec.VolumeMode)
	}

	capacity := "-"
	if q, ok := pv.Spec.Capacity[corev1.ResourceStorage]; ok {
		capacity = q.String()
	}

	claimRef := ""
	if pv.Spec.ClaimRef != nil {
		claimRef = fmt.Sprintf("%s/%s", pv.Spec.ClaimRef.Namespace, pv.Spec.ClaimRef.Name)
	}

	scName := pv.Spec.StorageClassName
	if scName == "" {
		scName = "-"
	}

	return models.PersistentVolumeInfo{
		Name:             pv.Name,
		Status:           string(pv.Status.Phase),
		Capacity:         capacity,
		AccessModes:      modes,
		ReclaimPolicy:    reclaimPolicy,
		StorageClassName: scName,
		VolumeMode:       volumeMode,
		ClaimRef:         claimRef,
		CreatedAt:        pv.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
