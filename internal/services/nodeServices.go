package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"
	"time"

	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	metricsv1beta1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
	"sigs.k8s.io/yaml"
)

func GetNodes(k8sClient *kubernetes.Clientset, mc *metricsclient.Clientset) ([]models.NodeInfo, error) {
	nodes, err := k8sClient.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	nodeMetrics := map[string]metricsv1beta1.NodeMetrics{}
	if mc != nil {
		if ml, err := mc.MetricsV1beta1().NodeMetricses().List(context.TODO(), metav1.ListOptions{}); err == nil {
			for _, m := range ml.Items {
				nodeMetrics[m.Name] = m
			}
		}
	}

	result := make([]models.NodeInfo, 0, len(nodes.Items))
	for _, node := range nodes.Items {
		result = append(result, nodeToInfo(node, nodeMetrics))
	}
	return result, nil
}

func CordonNode(name string, k8sClient *kubernetes.Clientset) error {
	patch := []byte(`{"spec":{"unschedulable":true}}`)
	_, err := k8sClient.CoreV1().Nodes().Patch(context.TODO(), name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

func UncordonNode(name string, k8sClient *kubernetes.Clientset) error {
	patch := []byte(`{"spec":{"unschedulable":false}}`)
	_, err := k8sClient.CoreV1().Nodes().Patch(context.TODO(), name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

func DrainNode(name string, k8sClient *kubernetes.Clientset) error {
	if err := CordonNode(name, k8sClient); err != nil {
		return fmt.Errorf("cordon failed: %w", err)
	}

	pods, err := k8sClient.CoreV1().Pods("").List(context.TODO(), metav1.ListOptions{
		FieldSelector: "spec.nodeName=" + name,
	})
	if err != nil {
		return fmt.Errorf("failed to list pods: %w", err)
	}

	for _, pod := range pods.Items {
		if isDaemonSetPod(pod) || isMirrorPod(pod) {
			continue
		}
		eviction := &policyv1.Eviction{
			ObjectMeta: metav1.ObjectMeta{Name: pod.Name, Namespace: pod.Namespace},
		}
		if err := k8sClient.PolicyV1().Evictions(pod.Namespace).Evict(context.TODO(), eviction); err != nil {
			return fmt.Errorf("failed to evict pod %s/%s: %w", pod.Namespace, pod.Name, err)
		}
	}
	return nil
}

func isDaemonSetPod(pod corev1.Pod) bool {
	for _, ref := range pod.OwnerReferences {
		if ref.Kind == "DaemonSet" {
			return true
		}
	}
	return false
}

func isMirrorPod(pod corev1.Pod) bool {
	_, ok := pod.Annotations["kubernetes.io/config.mirror"]
	return ok
}

func GetNodeYaml(name string, k8sClient *kubernetes.Clientset) (string, error) {
	if name == "" {
		return "", fmt.Errorf("node name is required")
	}
	node, err := k8sClient.CoreV1().Nodes().Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return toApplyYaml(node)
}

func UpdateNodeYaml(name, yamlContent string, k8sClient *kubernetes.Clientset) error {
	if name == "" {
		return fmt.Errorf("node name is required")
	}
	var node corev1.Node
	if err := yaml.Unmarshal([]byte(yamlContent), &node); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}
	node.Name = name
	_, err := k8sClient.CoreV1().Nodes().Update(context.TODO(), &node, metav1.UpdateOptions{})
	return err
}

func nodeToInfo(node corev1.Node, metrics map[string]metricsv1beta1.NodeMetrics) models.NodeInfo {
	status := "Unknown"
	for _, cond := range node.Status.Conditions {
		if cond.Type == corev1.NodeReady {
			if cond.Status == corev1.ConditionTrue {
				status = "Ready"
			} else {
				status = "NotReady"
			}
			break
		}
	}

	internalIP := ""
	for _, addr := range node.Status.Addresses {
		if addr.Type == corev1.NodeInternalIP {
			internalIP = addr.Address
			break
		}
	}

	cpuCapMillis := node.Status.Capacity.Cpu().MilliValue()
	memCapMi := node.Status.Capacity.Memory().Value() / (1024 * 1024)

	info := models.NodeInfo{
		Name:              node.Name,
		Status:            status,
		InternalIP:        internalIP,
		KubeletVersion:    node.Status.NodeInfo.KubeletVersion,
		OSImage:           node.Status.NodeInfo.OSImage,
		CpuCapacity:       node.Status.Capacity.Cpu().String(),
		MemoryCapacity:    node.Status.Capacity.Memory().String(),
		CpuCapacityMillis: cpuCapMillis,
		MemCapacityMi:     memCapMi,
		CreatedAt:         node.CreationTimestamp.Time.Format(time.RFC3339),
		Unschedulable:     node.Spec.Unschedulable,
	}

	if m, ok := metrics[node.Name]; ok {
		info.CpuUsageMillis = m.Usage.Cpu().MilliValue()
		info.MemUsageMi = m.Usage.Memory().Value() / (1024 * 1024)
		info.MetricsAvailable = true
	}

	return info
}
