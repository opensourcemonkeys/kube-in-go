package services_k8sclient

import (
	"time"
	"context"
	"fmt"
	"kube-ins/internal/models"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

type podLiveUsage struct{ cpu, mem int64 }

func GetPods(namespace string, repoK8sClient *kubernetes.Clientset, mc *metricsclient.Clientset) ([]models.PodInfo, error) {

	pods, err := repoK8sClient.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	// ReplicaSet -> Deployment map so pods roll up to their Deployment.
	rsToDeploy := map[string]string{}
	if rsl, e := repoK8sClient.AppsV1().ReplicaSets("").List(context.TODO(), metav1.ListOptions{}); e == nil {
		for _, rs := range rsl.Items {
			if owner := controllerRef(rs.OwnerReferences); owner != nil && owner.Kind == "Deployment" {
				rsToDeploy[rs.Namespace+"/"+rs.Name] = owner.Name
			}
		}
	}

	// Live per-pod usage from metrics-server, keyed by namespace/name.
	metricsAvailable := false
	podUsage := map[string]podLiveUsage{}
	if mc != nil {
		if pm, e := mc.MetricsV1beta1().PodMetricses("").List(context.TODO(), metav1.ListOptions{}); e == nil {
			metricsAvailable = true
			for _, p := range pm.Items {
				var u podLiveUsage
				for _, c := range p.Containers {
					u.cpu += c.Usage.Cpu().MilliValue()
					u.mem += c.Usage.Memory().Value() / miDivisor
				}
				podUsage[p.Namespace+"/"+p.Name] = u
			}
		}
	}

	podInfos := make([]models.PodInfo, 0, len(pods.Items))
	for _, pod := range pods.Items {
		podInfos = append(podInfos, podToInfo(pod, rsToDeploy, podUsage, metricsAvailable))
	}

	return podInfos, nil
}

func DeletePod(namespace string, name string, repoK8sClient *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return fmt.Errorf("namespace and pod name are required")
	}

	return repoK8sClient.CoreV1().Pods(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
}

func GetPodYaml(namespace string, name string, repoK8sClient *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace and pod name are required")
	}

	pod, err := repoK8sClient.CoreV1().Pods(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}

	return toApplyYaml(pod)
}

func podToInfo(pod corev1.Pod, rsToDeploy map[string]string, podUsage map[string]podLiveUsage, metricsAvailable bool) models.PodInfo {
	containers := make([]string, 0, len(pod.Spec.Containers))
	for _, c := range pod.Spec.Containers {
		containers = append(containers, c.Name)
	}

	ownerKind, _ := resolveOwner(pod.OwnerReferences, pod.Namespace, rsToDeploy)

	cpuUsage, memUsage := int64(-1), int64(-1)
	if metricsAvailable {
		if u, ok := podUsage[pod.Namespace+"/"+pod.Name]; ok {
			cpuUsage, memUsage = u.cpu, u.mem
		} else {
			cpuUsage, memUsage = 0, 0
		}
	}

	return models.PodInfo{
		Name:       pod.Name,
		Namespace:  pod.Namespace,
		Status:     getPodStatus(pod),
		Containers: containers,
		CreatedAt:  pod.CreationTimestamp.Time.Format(time.RFC3339),
		PodIP:      pod.Status.PodIP,
		OwnerKind:  ownerKind,
		CpuMillis:  cpuUsage,
		MemMi:      memUsage,
	}
}

func getPodStatus(pod corev1.Pod) models.PodStatus {
	if pod.DeletionTimestamp != nil {
		return models.PodStatusTerminating
	}

	switch pod.Status.Phase {
	case corev1.PodRunning:
		return models.PodStatusRunning
	case corev1.PodPending:
		return models.PodStatusPending
	default:
		return models.PodStatus(pod.Status.Phase)
	}
}
