package services_k8sclient

import (
	"context"
	"fmt"
	"strings"

	"kube-ins/internal/models"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func GetClusterGraph(client *kubernetes.Clientset) (*models.ClusterGraph, error) {
	graph := &models.ClusterGraph{
		Nodes: []models.ResourceNode{},
		Edges: []models.ResourceEdge{},
	}

	nodeSet := make(map[string]bool)
	var pendingEdges []models.ResourceEdge

	addNode := func(n models.ResourceNode) {
		if !nodeSet[n.ID] {
			nodeSet[n.ID] = true
			graph.Nodes = append(graph.Nodes, n)
		}
	}

	// ── Pods ─────────────────────────────────────────────────────────────────
	pods, err := client.CoreV1().Pods("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing pods: %w", err)
	}
	for _, p := range pods.Items {
		status := string(p.Status.Phase)
		if p.DeletionTimestamp != nil {
			status = "Terminating"
		}
		addNode(models.ResourceNode{
			ID:        resourceID("Pod", p.Namespace, p.Name),
			Kind:      "Pod",
			Name:      p.Name,
			Namespace: p.Namespace,
			Labels:    p.Labels,
			Status:    status,
		})
		for _, ref := range p.OwnerReferences {
			src := resourceID(ref.Kind, p.Namespace, ref.Name)
			tgt := resourceID("Pod", p.Namespace, p.Name)
			pendingEdges = append(pendingEdges, models.ResourceEdge{
				ID:     src + "->" + tgt,
				Source: src,
				Target: tgt,
				Kind:   "owner",
			})
		}
	}

	// ── Deployments ───────────────────────────────────────────────────────────
	deployments, err := client.AppsV1().Deployments("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing deployments: %w", err)
	}
	for _, d := range deployments.Items {
		selector := matchLabels(d.Spec.Selector)
		addNode(models.ResourceNode{
			ID:        resourceID("Deployment", d.Namespace, d.Name),
			Kind:      "Deployment",
			Name:      d.Name,
			Namespace: d.Namespace,
			Labels:    d.Labels,
			Selector:  selector,
			Status:    fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, d.Status.Replicas),
		})
	}

	// ── ReplicaSets ───────────────────────────────────────────────────────────
	replicaSets, err := client.AppsV1().ReplicaSets("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing replicasets: %w", err)
	}
	for _, rs := range replicaSets.Items {
		selector := matchLabels(rs.Spec.Selector)
		addNode(models.ResourceNode{
			ID:        resourceID("ReplicaSet", rs.Namespace, rs.Name),
			Kind:      "ReplicaSet",
			Name:      rs.Name,
			Namespace: rs.Namespace,
			Labels:    rs.Labels,
			Selector:  selector,
			Status:    fmt.Sprintf("%d/%d", rs.Status.ReadyReplicas, rs.Status.Replicas),
		})
		for _, ref := range rs.OwnerReferences {
			src := resourceID(ref.Kind, rs.Namespace, ref.Name)
			tgt := resourceID("ReplicaSet", rs.Namespace, rs.Name)
			pendingEdges = append(pendingEdges, models.ResourceEdge{
				ID:     src + "->" + tgt,
				Source: src,
				Target: tgt,
				Kind:   "owner",
			})
		}
	}

	// ── StatefulSets ──────────────────────────────────────────────────────────
	statefulSets, err := client.AppsV1().StatefulSets("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing statefulsets: %w", err)
	}
	for _, ss := range statefulSets.Items {
		selector := matchLabels(ss.Spec.Selector)
		addNode(models.ResourceNode{
			ID:        resourceID("StatefulSet", ss.Namespace, ss.Name),
			Kind:      "StatefulSet",
			Name:      ss.Name,
			Namespace: ss.Namespace,
			Labels:    ss.Labels,
			Selector:  selector,
			Status:    fmt.Sprintf("%d/%d", ss.Status.ReadyReplicas, ss.Status.Replicas),
		})
	}

	// ── DaemonSets ────────────────────────────────────────────────────────────
	daemonSets, err := client.AppsV1().DaemonSets("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing daemonsets: %w", err)
	}
	for _, ds := range daemonSets.Items {
		selector := matchLabels(ds.Spec.Selector)
		addNode(models.ResourceNode{
			ID:        resourceID("DaemonSet", ds.Namespace, ds.Name),
			Kind:      "DaemonSet",
			Name:      ds.Name,
			Namespace: ds.Namespace,
			Labels:    ds.Labels,
			Selector:  selector,
			Status:    fmt.Sprintf("%d ready", ds.Status.NumberReady),
		})
	}

	// ── Services ──────────────────────────────────────────────────────────────
	services, err := client.CoreV1().Services("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing services: %w", err)
	}
	for _, svc := range services.Items {
		addNode(models.ResourceNode{
			ID:        resourceID("Service", svc.Namespace, svc.Name),
			Kind:      "Service",
			Name:      svc.Name,
			Namespace: svc.Namespace,
			Labels:    svc.Labels,
			Selector:  svc.Spec.Selector,
			Status:    string(svc.Spec.Type),
		})
		if len(svc.Spec.Selector) > 0 {
			for _, p := range pods.Items {
				if p.Namespace == svc.Namespace && labelsContain(p.Labels, svc.Spec.Selector) {
					src := resourceID("Service", svc.Namespace, svc.Name)
					tgt := resourceID("Pod", p.Namespace, p.Name)
					pendingEdges = append(pendingEdges, models.ResourceEdge{
						ID:     src + "->" + tgt,
						Source: src,
						Target: tgt,
						Kind:   "selector",
					})
				}
			}
		}
	}

	// ── Ingresses ─────────────────────────────────────────────────────────────
	ingresses, err := client.NetworkingV1().Ingresses("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing ingresses: %w", err)
	}
	for _, ing := range ingresses.Items {
		addNode(models.ResourceNode{
			ID:        resourceID("Ingress", ing.Namespace, ing.Name),
			Kind:      "Ingress",
			Name:      ing.Name,
			Namespace: ing.Namespace,
			Labels:    ing.Labels,
		})
		for _, rule := range ing.Spec.Rules {
			if rule.HTTP == nil {
				continue
			}
			for _, path := range rule.HTTP.Paths {
				if path.Backend.Service != nil {
					src := resourceID("Ingress", ing.Namespace, ing.Name)
					tgt := resourceID("Service", ing.Namespace, path.Backend.Service.Name)
					pendingEdges = append(pendingEdges, models.ResourceEdge{
						ID:     src + "->" + tgt,
						Source: src,
						Target: tgt,
						Kind:   "ingress",
					})
				}
			}
		}
	}

	// ── Filter edges: both endpoints must exist ───────────────────────────────
	edgeSet := make(map[string]bool)
	for _, e := range pendingEdges {
		if nodeSet[e.Source] && nodeSet[e.Target] && !edgeSet[e.ID] {
			edgeSet[e.ID] = true
			graph.Edges = append(graph.Edges, e)
		}
	}

	return graph, nil
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
