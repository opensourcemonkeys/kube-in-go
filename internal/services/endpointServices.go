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

func GetEndpoints(namespace string, client *kubernetes.Clientset) ([]models.EndpointInfo, error) {
	list, err := client.CoreV1().Endpoints(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.EndpointInfo, 0, len(list.Items))
	for _, ep := range list.Items {
		infos = append(infos, endpointToInfo(ep))
	}
	return infos, nil
}

func GetEndpointYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceNameRequired
	}
	ep, err := client.CoreV1().Endpoints(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(ep)
}

func UpdateEndpointYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}
	var ep corev1.Endpoints
	if err := yaml.Unmarshal([]byte(yamlContent), &ep); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}
	ep.Namespace = namespace
	ep.Name = name
	_, err := client.CoreV1().Endpoints(namespace).Update(context.Background(), &ep, metav1.UpdateOptions{})
	return err
}

func DeleteEndpoint(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}
	return client.CoreV1().Endpoints(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
}

func endpointToInfo(ep corev1.Endpoints) models.EndpointInfo {
	subsets := make([]models.EndpointSubsetInfo, 0, len(ep.Subsets))
	ready := 0
	notReady := 0

	for _, s := range ep.Subsets {
		addresses := make([]models.EndpointAddressInfo, 0, len(s.Addresses))
		for _, a := range s.Addresses {
			nodeName := ""
			if a.NodeName != nil {
				nodeName = *a.NodeName
			}
			addresses = append(addresses, models.EndpointAddressInfo{IP: a.IP, NodeName: nodeName})
		}

		notReadyAddresses := make([]models.EndpointAddressInfo, 0, len(s.NotReadyAddresses))
		for _, a := range s.NotReadyAddresses {
			nodeName := ""
			if a.NodeName != nil {
				nodeName = *a.NodeName
			}
			notReadyAddresses = append(notReadyAddresses, models.EndpointAddressInfo{IP: a.IP, NodeName: nodeName})
		}

		ports := make([]models.EndpointPortInfo, 0, len(s.Ports))
		for _, p := range s.Ports {
			ports = append(ports, models.EndpointPortInfo{
				Name:     p.Name,
				Port:     p.Port,
				Protocol: string(p.Protocol),
			})
		}

		ready += len(s.Addresses)
		notReady += len(s.NotReadyAddresses)

		subsets = append(subsets, models.EndpointSubsetInfo{
			Addresses:         addresses,
			NotReadyAddresses: notReadyAddresses,
			Ports:             ports,
		})
	}

	return models.EndpointInfo{
		Name:      ep.Name,
		Namespace: ep.Namespace,
		Subsets:   subsets,
		Ready:     ready,
		NotReady:  notReady,
		CreatedAt: ep.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
