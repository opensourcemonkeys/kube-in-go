package services_k8sclient

import (
	"context"
	"fmt"
	"strings"

	"kube-ins/internal/models"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func GetClusterGraph(client *kubernetes.Clientset) (*models.ClusterGraph, error) {
	graph := &models.ClusterGraph{Nodes: []models.ResourceNode{}, Edges: []models.ResourceEdge{}}
	nodeSet := make(map[string]bool)
	var pendingEdges []models.ResourceEdge

	addNode := func(n models.ResourceNode) {
		if !nodeSet[n.ID] {
			nodeSet[n.ID] = true
			graph.Nodes = append(graph.Nodes, n)
		}
	}

	pods, podEdges, err := collectPods(client, addNode)
	if err != nil {
		return nil, err
	}
	pendingEdges = append(pendingEdges, podEdges...)

	if err = collectDeployments(client, addNode); err != nil {
		return nil, err
	}

	rsEdges, err := collectReplicaSets(client, addNode)
	if err != nil {
		return nil, err
	}
	pendingEdges = append(pendingEdges, rsEdges...)

	if err = collectStatefulSets(client, addNode); err != nil {
		return nil, err
	}
	if err = collectDaemonSets(client, addNode); err != nil {
		return nil, err
	}

	svcEdges, err := collectServices(client, pods, addNode)
	if err != nil {
		return nil, err
	}
	pendingEdges = append(pendingEdges, svcEdges...)

	ingEdges, err := collectIngresses(client, addNode)
	if err != nil {
		return nil, err
	}
	pendingEdges = append(pendingEdges, ingEdges...)

	graph.Edges = filterEdges(pendingEdges, nodeSet)
	return graph, nil
}

func collectPods(client *kubernetes.Clientset, addNode func(models.ResourceNode)) ([]corev1.Pod, []models.ResourceEdge, error) {
	list, err := client.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, nil, fmt.Errorf("listing pods: %w", err)
	}
	var edges []models.ResourceEdge
	for _, p := range list.Items {
		status := string(p.Status.Phase)
		if p.DeletionTimestamp != nil {
			status = "Terminating"
		}
		addNode(models.ResourceNode{
			ID: resourceID("Pod", p.Namespace, p.Name), Kind: "Pod",
			Name: p.Name, Namespace: p.Namespace, Labels: p.Labels, Status: status,
		})
		for _, ref := range p.OwnerReferences {
			edges = append(edges, ownerEdge(ref.Kind, p.Namespace, ref.Name, "Pod", p.Namespace, p.Name))
		}
	}
	return list.Items, edges, nil
}

func collectDeployments(client *kubernetes.Clientset, addNode func(models.ResourceNode)) error {
	list, err := client.AppsV1().Deployments("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("listing deployments: %w", err)
	}
	for _, d := range list.Items {
		addNode(models.ResourceNode{
			ID: resourceID("Deployment", d.Namespace, d.Name), Kind: "Deployment",
			Name: d.Name, Namespace: d.Namespace, Labels: d.Labels,
			Selector: matchLabels(d.Spec.Selector),
			Status:   fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, d.Status.Replicas),
		})
	}
	return nil
}

func collectReplicaSets(client *kubernetes.Clientset, addNode func(models.ResourceNode)) ([]models.ResourceEdge, error) {
	list, err := client.AppsV1().ReplicaSets("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing replicasets: %w", err)
	}
	var edges []models.ResourceEdge
	for _, rs := range list.Items {
		addNode(models.ResourceNode{
			ID: resourceID("ReplicaSet", rs.Namespace, rs.Name), Kind: "ReplicaSet",
			Name: rs.Name, Namespace: rs.Namespace, Labels: rs.Labels,
			Selector: matchLabels(rs.Spec.Selector),
			Status:   fmt.Sprintf("%d/%d", rs.Status.ReadyReplicas, rs.Status.Replicas),
		})
		for _, ref := range rs.OwnerReferences {
			edges = append(edges, ownerEdge(ref.Kind, rs.Namespace, ref.Name, "ReplicaSet", rs.Namespace, rs.Name))
		}
	}
	return edges, nil
}

func collectStatefulSets(client *kubernetes.Clientset, addNode func(models.ResourceNode)) error {
	list, err := client.AppsV1().StatefulSets("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("listing statefulsets: %w", err)
	}
	for _, ss := range list.Items {
		addNode(models.ResourceNode{
			ID: resourceID("StatefulSet", ss.Namespace, ss.Name), Kind: "StatefulSet",
			Name: ss.Name, Namespace: ss.Namespace, Labels: ss.Labels,
			Selector: matchLabels(ss.Spec.Selector),
			Status:   fmt.Sprintf("%d/%d", ss.Status.ReadyReplicas, ss.Status.Replicas),
		})
	}
	return nil
}

func collectDaemonSets(client *kubernetes.Clientset, addNode func(models.ResourceNode)) error {
	list, err := client.AppsV1().DaemonSets("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("listing daemonsets: %w", err)
	}
	for _, ds := range list.Items {
		addNode(models.ResourceNode{
			ID: resourceID("DaemonSet", ds.Namespace, ds.Name), Kind: "DaemonSet",
			Name: ds.Name, Namespace: ds.Namespace, Labels: ds.Labels,
			Selector: matchLabels(ds.Spec.Selector),
			Status:   fmt.Sprintf("%d ready", ds.Status.NumberReady),
		})
	}
	return nil
}

func collectServices(client *kubernetes.Clientset, pods []corev1.Pod, addNode func(models.ResourceNode)) ([]models.ResourceEdge, error) {
	list, err := client.CoreV1().Services("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing services: %w", err)
	}
	var edges []models.ResourceEdge
	for _, svc := range list.Items {
		addNode(models.ResourceNode{
			ID: resourceID("Service", svc.Namespace, svc.Name), Kind: "Service",
			Name: svc.Name, Namespace: svc.Namespace, Labels: svc.Labels,
			Selector: svc.Spec.Selector, Status: string(svc.Spec.Type),
		})
		edges = append(edges, selectorEdges(svc.Namespace, svc.Name, svc.Spec.Selector, pods)...)
	}
	return edges, nil
}

func selectorEdges(namespace, svcName string, selector map[string]string, pods []corev1.Pod) []models.ResourceEdge {
	if len(selector) == 0 {
		return nil
	}
	src := resourceID("Service", namespace, svcName)
	var edges []models.ResourceEdge
	for _, p := range pods {
		if p.Namespace == namespace && labelsContain(p.Labels, selector) {
			tgt := resourceID("Pod", p.Namespace, p.Name)
			edges = append(edges, models.ResourceEdge{ID: src + "->" + tgt, Source: src, Target: tgt, Kind: "selector"})
		}
	}
	return edges
}

func collectIngresses(client *kubernetes.Clientset, addNode func(models.ResourceNode)) ([]models.ResourceEdge, error) {
	list, err := client.NetworkingV1().Ingresses("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing ingresses: %w", err)
	}
	var edges []models.ResourceEdge
	for _, ing := range list.Items {
		addNode(models.ResourceNode{
			ID: resourceID("Ingress", ing.Namespace, ing.Name), Kind: "Ingress",
			Name: ing.Name, Namespace: ing.Namespace, Labels: ing.Labels,
		})
		edges = append(edges, ingressEdges(ing.Namespace, ing.Name, ing.Spec.Rules)...)
	}
	return edges, nil
}

func ingressEdges(namespace, ingName string, rules []networkingv1.IngressRule) []models.ResourceEdge {
	src := resourceID("Ingress", namespace, ingName)
	var edges []models.ResourceEdge
	for _, rule := range rules {
		if rule.HTTP == nil {
			continue
		}
		for _, path := range rule.HTTP.Paths {
			if path.Backend.Service != nil {
				tgt := resourceID("Service", namespace, path.Backend.Service.Name)
				edges = append(edges, models.ResourceEdge{ID: src + "->" + tgt, Source: src, Target: tgt, Kind: "ingress"})
			}
		}
	}
	return edges
}

func filterEdges(pending []models.ResourceEdge, nodeSet map[string]bool) []models.ResourceEdge {
	seen := make(map[string]bool)
	var result []models.ResourceEdge
	for _, e := range pending {
		if nodeSet[e.Source] && nodeSet[e.Target] && !seen[e.ID] {
			seen[e.ID] = true
			result = append(result, e)
		}
	}
	return result
}

func ownerEdge(srcKind, srcNS, srcName, tgtKind, tgtNS, tgtName string) models.ResourceEdge {
	src := resourceID(srcKind, srcNS, srcName)
	tgt := resourceID(tgtKind, tgtNS, tgtName)
	return models.ResourceEdge{ID: src + "->" + tgt, Source: src, Target: tgt, Kind: "owner"}
}

func resourceID(kind, namespace, name string) string {
	return strings.ToLower(kind) + "/" + namespace + "/" + name
}

func matchLabels(selector *metav1.LabelSelector) map[string]string {
	if selector == nil {
		return nil
	}
	return selector.MatchLabels
}

func labelsContain(labels, selector map[string]string) bool {
	for k, v := range selector {
		if labels[k] != v {
			return false
		}
	}
	return true
}
