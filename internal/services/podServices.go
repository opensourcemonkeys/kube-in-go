package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

type podLiveUsage struct{ cpu, mem int64 }

func GetPods(namespace string, repoK8sClient *kubernetes.Clientset, mc *metricsclient.Clientset) ([]models.PodInfo, error) {

	pods, err := repoK8sClient.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	// ReplicaSet -> Deployment map so pods roll up to their Deployment.
	rsToDeploy := map[string]string{}
	if rsl, e := repoK8sClient.AppsV1().ReplicaSets("").List(context.Background(), metav1.ListOptions{}); e == nil {
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
		if pm, e := mc.MetricsV1beta1().PodMetricses("").List(context.Background(), metav1.ListOptions{}); e == nil {
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

	return repoK8sClient.CoreV1().Pods(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
}

func GetPodYaml(namespace string, name string, repoK8sClient *kubernetes.Clientset) (string, error) {
	if namespace == "" || name == "" {
		return "", fmt.Errorf("namespace and pod name are required")
	}

	pod, err := repoK8sClient.CoreV1().Pods(namespace).Get(context.Background(), name, metav1.GetOptions{})
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

	// Per-container live status: init containers first, then regular ones (kubectl order).
	containerStatuses := make([]models.ContainerStatusInfo, 0, len(pod.Status.InitContainerStatuses)+len(pod.Status.ContainerStatuses))
	var restarts int32
	var lastRestartAt time.Time
	for _, cs := range pod.Status.InitContainerStatuses {
		info := mapContainerStatus(cs, true)
		containerStatuses = append(containerStatuses, info)
		restarts += cs.RestartCount
		lastRestartAt = latestRestart(lastRestartAt, info.LastRestartAt)
	}
	for _, cs := range pod.Status.ContainerStatuses {
		info := mapContainerStatus(cs, false)
		containerStatuses = append(containerStatuses, info)
		restarts += cs.RestartCount
		lastRestartAt = latestRestart(lastRestartAt, info.LastRestartAt)
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

	lastRestartAtStr := ""
	if !lastRestartAt.IsZero() {
		lastRestartAtStr = lastRestartAt.Format(time.RFC3339)
	}

	return models.PodInfo{
		Name:              pod.Name,
		Namespace:         pod.Namespace,
		Status:            getPodStatus(pod),
		Containers:        containers,
		ContainerStatuses: containerStatuses,
		Restarts:          restarts,
		LastRestartAt:     lastRestartAtStr,
		CreatedAt:         pod.CreationTimestamp.Time.Format(time.RFC3339),
		PodIP:             pod.Status.PodIP,
		OwnerKind:         ownerKind,
		CpuMillis:         cpuUsage,
		MemMi:             memUsage,
	}
}

// latestRestart returns the later of the running max and a container's
// LastRestartAt (RFC3339, "" if the container never restarted).
func latestRestart(max time.Time, candidate string) time.Time {
	if candidate == "" {
		return max
	}
	t, err := time.Parse(time.RFC3339, candidate)
	if err != nil || t.Before(max) {
		return max
	}
	return t
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

// mapContainerStatus flattens a k8s ContainerStatus into the frontend model,
// resolving the current State ("Running"/"Waiting"/"Terminated") and its reason.
func mapContainerStatus(cs corev1.ContainerStatus, init bool) models.ContainerStatusInfo {
	info := models.ContainerStatusInfo{
		Name:         cs.Name,
		Ready:        cs.Ready,
		RestartCount: cs.RestartCount,
		Init:         init,
	}
	switch {
	case cs.State.Running != nil:
		info.State = "Running"
	case cs.State.Waiting != nil:
		info.State = "Waiting"
		info.Reason = cs.State.Waiting.Reason
	case cs.State.Terminated != nil:
		info.State = "Terminated"
		info.Reason = cs.State.Terminated.Reason
	}

	switch {
	case cs.LastTerminationState.Terminated != nil:
		info.LastRestartAt = cs.LastTerminationState.Terminated.FinishedAt.Time.Format(time.RFC3339)
	case cs.RestartCount > 0 && cs.State.Running != nil:
		// kubelet can drop LastTerminationState after a while; the current
		// container's start time is still a reasonable stand-in.
		info.LastRestartAt = cs.State.Running.StartedAt.Time.Format(time.RFC3339)
	}
	return info
}
