package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetCronJobs(namespace string, client *kubernetes.Clientset) ([]models.CronJobInfo, error) {
	list, err := client.BatchV1().CronJobs(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	infos := make([]models.CronJobInfo, 0, len(list.Items))
	for _, cj := range list.Items {
		infos = append(infos, cronJobToInfo(cj))
	}
	return infos, nil
}

func DeleteCronJob(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}
	propagation := metav1.DeletePropagationBackground
	return client.BatchV1().CronJobs(namespace).Delete(context.Background(), name, metav1.DeleteOptions{
		PropagationPolicy: &propagation,
	})
}

func GetCronJobYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceNameRequired
	}
	cj, err := client.BatchV1().CronJobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(cj)
}

func UpdateCronJobYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}

	var cj batchv1.CronJob
	if err := yaml.Unmarshal([]byte(yamlContent), &cj); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}

	cj.Namespace = namespace
	cj.Name = name

	_, err := client.BatchV1().CronJobs(namespace).Update(context.Background(), &cj, metav1.UpdateOptions{})
	return err
}

func cronJobToInfo(cj batchv1.CronJob) models.CronJobInfo {
	info := models.CronJobInfo{
		Name:        cj.Name,
		Namespace:   cj.Namespace,
		Schedule:    cj.Spec.Schedule,
		Suspend:     cj.Spec.Suspend != nil && *cj.Spec.Suspend,
		ActiveCount: len(cj.Status.Active),
		CreatedAt:   cj.CreationTimestamp.Time.Format(time.RFC3339),
	}
	if cj.Status.LastScheduleTime != nil {
		info.LastScheduleTime = cj.Status.LastScheduleTime.Time.Format(time.RFC3339)
	}
	return info
}
