package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetServices(namespace string, client *kubernetes.Clientset) ([]models.ServiceInfo, error) {
	services, err := client.CoreV1().Services(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	infos := make([]models.ServiceInfo, 0, len(services.Items))
	for _, svc := range services.Items {
		infos = append(infos, serviceToInfo(svc))
	}
	return infos, nil
}

func DeleteService(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceServiceRequired
	}
	return client.CoreV1().Services(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
}

func GetServiceYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceServiceRequired
	}
	svc, err := client.CoreV1().Services(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(svc)
}

func UpdateServiceYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceServiceRequired
	}

	var svc corev1.Service
	if err := yaml.Unmarshal([]byte(yamlContent), &svc); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}

	svc.Namespace = namespace
	svc.Name = name

	_, err := client.CoreV1().Services(namespace).Update(context.TODO(), &svc, metav1.UpdateOptions{})
	return err
}

func serviceToInfo(svc corev1.Service) models.ServiceInfo {
	svcType := string(svc.Spec.Type)

	ports := make([]models.ServicePortInfo, 0, len(svc.Spec.Ports))
	for _, p := range svc.Spec.Ports {
		ports = append(ports, models.ServicePortInfo{
			Port:       p.Port,
			TargetPort: p.TargetPort.String(),
			Protocol:   string(p.Protocol),
			NodePort:   p.NodePort,
		})
	}

	externalIPs := make([]string, 0)
	externalIPs = append(externalIPs, svc.Spec.ExternalIPs...)
	for _, ingress := range svc.Status.LoadBalancer.Ingress {
		if ingress.IP != "" {
			externalIPs = append(externalIPs, ingress.IP)
		} else if ingress.Hostname != "" {
			externalIPs = append(externalIPs, ingress.Hostname)
		}
	}

	status := "Active"
	if svcType == "LoadBalancer" && len(externalIPs) == 0 {
		status = "Pending"
	}

	return models.ServiceInfo{
		Name:        svc.Name,
		Namespace:   svc.Namespace,
		Type:        svcType,
		Status:      status,
		ClusterIP:   svc.Spec.ClusterIP,
		ExternalIPs: externalIPs,
		Ports:       ports,
		CreatedAt:   svc.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
