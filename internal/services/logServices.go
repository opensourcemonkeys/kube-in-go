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
	var parts []string
	for k, v := range dep.Spec.Selector.MatchLabels {
		parts = append(parts, fmt.Sprintf("%s=%s", k, v))
	}
	labelSelector := strings.Join(parts, ",")
	pods, err := client.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, err
	}
	podNames := make([]string, 0, len(pods.Items))
	for _, p := range pods.Items {
		podNames = append(podNames, p.Name)
	}
	return podNames, nil
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
