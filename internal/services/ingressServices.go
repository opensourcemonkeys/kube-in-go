package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"
	"time"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetIngresses(namespace string, client *kubernetes.Clientset) ([]models.IngressInfo, error) {
	list, err := client.NetworkingV1().Ingresses(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.IngressInfo, 0, len(list.Items))
	for _, ing := range list.Items {
		infos = append(infos, ingressToInfo(ing))
	}
	return infos, nil
}

func DeleteIngress(namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}
	return client.NetworkingV1().Ingresses(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
}

func GetIngressYaml(namespace, name string, client *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", errNamespaceNameRequired
	}
	ing, err := client.NetworkingV1().Ingresses(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(ing)
}

func UpdateIngressYaml(namespace, name, yamlContent string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}

	var ing networkingv1.Ingress
	if err := yaml.Unmarshal([]byte(yamlContent), &ing); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}

	ing.Namespace = namespace
	ing.Name = name

	_, err := client.NetworkingV1().Ingresses(namespace).Update(context.Background(), &ing, metav1.UpdateOptions{})
	return err
}

func ingressToInfo(ing networkingv1.Ingress) models.IngressInfo {
	className := ""
	if ing.Spec.IngressClassName != nil {
		className = *ing.Spec.IngressClassName
	}

	tls := len(ing.Spec.TLS) > 0

	rules := make([]models.IngressRuleInfo, 0, len(ing.Spec.Rules))
	for _, r := range ing.Spec.Rules {
		paths := make([]string, 0)
		if r.HTTP != nil {
			for _, p := range r.HTTP.Paths {
				paths = append(paths, p.Path)
			}
		}
		rules = append(rules, models.IngressRuleInfo{
			Host:  r.Host,
			Paths: paths,
		})
	}

	address := ""
	for _, lb := range ing.Status.LoadBalancer.Ingress {
		if lb.IP != "" {
			address = lb.IP
			break
		} else if lb.Hostname != "" {
			address = lb.Hostname
			break
		}
	}

	return models.IngressInfo{
		Name:      ing.Name,
		Namespace: ing.Namespace,
		ClassName: className,
		Rules:     rules,
		TLS:       tls,
		Address:   address,
		CreatedAt: ing.CreationTimestamp.Time.Format(time.RFC3339),
	}
}
