package business

import (
	"fmt"
	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

func GetCronJobs() []models.CronJobInfo {
	client, err := repository.NewK8sClient()
	if err != nil {
		fmt.Println(err)
		return nil
	}
	items, err := services.GetCronJobs("", client)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return items
}

func DeleteCronJob(name, namespace string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.DeleteCronJob(namespace, name, client)
}

func GetCronJobYaml(name, namespace string) (string, error) {
	client, err := repository.NewK8sClient()
	if err != nil {
		return "", err
	}
	return services.GetCronJobYaml(namespace, name, client)
}

func UpdateCronJobYaml(name, namespace, yamlContent string) error {
	client, err := repository.NewK8sClient()
	if err != nil {
		return err
	}
	return services.UpdateCronJobYaml(namespace, name, yamlContent, client)
}
