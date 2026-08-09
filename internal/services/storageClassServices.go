package services_k8sclient

import (
	"context"
	"fmt"
	"time"

	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"kube-ins/internal/models"
	"sigs.k8s.io/yaml"
)

func GetStorageClasses(client *kubernetes.Clientset) ([]models.StorageClassInfo, error) {
	list, err := client.StorageV1().StorageClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.StorageClassInfo, 0, len(list.Items))
	for _, sc := range list.Items {
		infos = append(infos, storageClassToInfo(sc))
	}
	return infos, nil
}

func GetStorageClassYaml(name string, client *kubernetes.Clientset) (string, error) {
	if name == "" {
		return "", errNamespaceNameRequired
	}
	sc, err := client.StorageV1().StorageClasses().Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(sc)
}

func UpdateStorageClassYaml(name, yamlContent string, client *kubernetes.Clientset) error {
	if name == "" {
		return errNamespaceNameRequired
	}
	var sc storagev1.StorageClass
	if err := yaml.Unmarshal([]byte(yamlContent), &sc); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}
	sc.Name = name
	_, err := client.StorageV1().StorageClasses().Update(context.Background(), &sc, metav1.UpdateOptions{})
	return err
}

func storageClassToInfo(sc storagev1.StorageClass) models.StorageClassInfo {
	reclaimPolicy := "Delete"
	if sc.ReclaimPolicy != nil {
		reclaimPolicy = string(*sc.ReclaimPolicy)
	}

	bindingMode := "Immediate"
	if sc.VolumeBindingMode != nil {
		bindingMode = string(*sc.VolumeBindingMode)
	}

	isDefault := sc.Annotations["storageclass.kubernetes.io/is-default-class"] == "true"

	return models.StorageClassInfo{
		Name:              sc.Name,
		Provisioner:       sc.Provisioner,
		ReclaimPolicy:     reclaimPolicy,
		VolumeBindingMode: bindingMode,
		IsDefault:         isDefault,
		CreatedAt:         sc.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
