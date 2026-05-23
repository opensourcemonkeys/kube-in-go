package services_k8sclient

import (
	"bufio"
	"context"
	"fmt"
	"strings"
	"sync"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type logSession struct {
	cancel context.CancelFunc
}

var (
	logMu       sync.Mutex
	logSessions = make(map[string]*logSession)
)

func GetPodContainers(namespace, name string, client *kubernetes.Clientset) ([]string, error) {
	pod, err := client.CoreV1().Pods(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(pod.Spec.Containers))
	for _, c := range pod.Spec.Containers {
		names = append(names, c.Name)
	}
	return names, nil
}

func GetDeploymentPods(namespace, name string, client *kubernetes.Clientset) ([]string, error) {
	dep, err := client.AppsV1().Deployments(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	if dep.Spec.Selector == nil {
		return nil, fmt.Errorf("deployment %s/%s has no selector", namespace, name)
	}
	return podsByLabelSelector(namespace, dep.Spec.Selector.MatchLabels, client)
}

func GetStatefulSetPods(namespace, name string, client *kubernetes.Clientset) ([]string, error) {
	ss, err := client.AppsV1().StatefulSets(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	if ss.Spec.Selector == nil {
		return nil, fmt.Errorf("statefulset %s/%s has no selector", namespace, name)
	}
	return podsByLabelSelector(namespace, ss.Spec.Selector.MatchLabels, client)
}

func GetReplicaSetPods(namespace, name string, client *kubernetes.Clientset) ([]string, error) {
	rs, err := client.AppsV1().ReplicaSets(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	if rs.Spec.Selector == nil {
		return nil, fmt.Errorf("replicaset %s/%s has no selector", namespace, name)
	}
	return podsByLabelSelector(namespace, rs.Spec.Selector.MatchLabels, client)
}

func GetDaemonSetPods(namespace, name string, client *kubernetes.Clientset) ([]string, error) {
	ds, err := client.AppsV1().DaemonSets(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	if ds.Spec.Selector == nil {
		return nil, fmt.Errorf("daemonset %s/%s has no selector", namespace, name)
	}
	return podsByLabelSelector(namespace, ds.Spec.Selector.MatchLabels, client)
}

func GetJobPods(namespace, name string, client *kubernetes.Clientset) ([]string, error) {
	pods, err := client.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: "batch.kubernetes.io/job-name=" + name,
	})
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(pods.Items))
	for _, p := range pods.Items {
		names = append(names, p.Name)
	}
	return names, nil
}

func GetCronJobPods(namespace, name string, client *kubernetes.Clientset) ([]string, error) {
	jobs, err := client.BatchV1().Jobs(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	var podNames []string
	for _, job := range jobs.Items {
		if !ownedByCronJob(job.OwnerReferences, name) {
			continue
		}
		jobPods, err := client.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
			LabelSelector: "batch.kubernetes.io/job-name=" + job.Name,
		})
		if err != nil {
			continue
		}
		for _, p := range jobPods.Items {
			podNames = append(podNames, p.Name)
		}
	}
	return podNames, nil
}

func ownedByCronJob(refs []metav1.OwnerReference, cronJobName string) bool {
	for _, ref := range refs {
		if ref.Kind == "CronJob" && ref.Name == cronJobName {
			return true
		}
	}
	return false
}

func podsByLabelSelector(namespace string, matchLabels map[string]string, client *kubernetes.Clientset) ([]string, error) {
	var parts []string
	for k, v := range matchLabels {
		parts = append(parts, fmt.Sprintf("%s=%s", k, v))
	}
	pods, err := client.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: strings.Join(parts, ","),
	})
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(pods.Items))
	for _, p := range pods.Items {
		names = append(names, p.Name)
	}
	return names, nil
}

func StartLogStream(sessionId, namespace, podName, container string, client *kubernetes.Clientset, onData func(string)) error {
	ctx, cancel := context.WithCancel(context.Background())

	logMu.Lock()
	if existing, ok := logSessions[sessionId]; ok {
		existing.cancel()
	}
	logSessions[sessionId] = &logSession{cancel: cancel}
	logMu.Unlock()

	tailLines := int64(1000)
	req := client.CoreV1().Pods(namespace).GetLogs(podName, &corev1.PodLogOptions{
		Container: container,
		Follow:    true,
		TailLines: &tailLines,
	})

	stream, err := req.Stream(ctx)
	if err != nil {
		cancel()
		logMu.Lock()
		delete(logSessions, sessionId)
		logMu.Unlock()
		return fmt.Errorf("failed to open log stream: %w", err)
	}

	go func() {
		defer func() {
			stream.Close()
			cancel()
			logMu.Lock()
			delete(logSessions, sessionId)
			logMu.Unlock()
		}()
		scanner := bufio.NewScanner(stream)
		scanner.Buffer(make([]byte, 64*1024), 64*1024)
		for scanner.Scan() {
			select {
			case <-ctx.Done():
				return
			default:
				onData(scanner.Text() + "\n")
			}
		}
	}()

	return nil
}

func StopLogStream(sessionId string) {
	logMu.Lock()
	defer logMu.Unlock()
	if s, ok := logSessions[sessionId]; ok {
		s.cancel()
		delete(logSessions, sessionId)
	}
}
