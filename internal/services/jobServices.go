package services_k8sclient

import (
	"context"
	"kube-ins/internal/models"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetJobs(namespace string, client *kubernetes.Clientset) ([]models.JobInfo, error) {
	list, err := client.BatchV1().Jobs(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	infos := make([]models.JobInfo, 0, len(list.Items))
	for _, j := range list.Items {
		infos = append(infos, jobToInfo(j))
	}
	return infos, nil
}

func DeleteJob(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}
	propagation := metav1.DeletePropagationBackground
	return client.BatchV1().Jobs(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{
		PropagationPolicy: &propagation,
	})
}

func GetJobYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceNameRequired
	}
	j, err := client.BatchV1().Jobs(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	yamlBytes, err := yaml.Marshal(j)
	if err != nil {
		return "", err
	}
	return string(yamlBytes), nil
}

func jobToInfo(j batchv1.Job) models.JobInfo {
	completions := int32(1)
	if j.Spec.Completions != nil {
		completions = *j.Spec.Completions
	}

	status := jobStatus(j, completions)

	return models.JobInfo{
		Name:        j.Name,
		Namespace:   j.Namespace,
		Completions: completions,
		Succeeded:   j.Status.Succeeded,
		Failed:      j.Status.Failed,
		Active:      j.Status.Active,
		Status:      status,
		CreatedAt:   j.CreationTimestamp.Time,
	}
}

func jobStatus(j batchv1.Job, completions int32) string {
	if j.Status.Succeeded >= completions {
		return "Succeeded"
	}
	if j.Status.Failed > 0 {
		return "Failed"
	}
	if j.Status.Active > 0 {
		return "Running"
	}
	return "Pending"
}
