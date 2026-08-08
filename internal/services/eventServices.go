package services_k8sclient

import (
	"context"
	"kube-ins/internal/models"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func GetEvents(namespace string, client *kubernetes.Clientset) ([]models.EventInfo, error) {
	list, err := client.CoreV1().Events(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	infos := make([]models.EventInfo, 0, len(list.Items))
	for _, ev := range list.Items {
		infos = append(infos, eventToInfo(ev))
	}
	return infos, nil
}

func eventToInfo(ev corev1.Event) models.EventInfo {
	firstTs := ev.FirstTimestamp.Time
	lastTs := ev.LastTimestamp.Time

	if firstTs.IsZero() && ev.EventTime.Time != (time.Time{}) {
		firstTs = ev.EventTime.Time
	}
	if lastTs.IsZero() {
		lastTs = firstTs
	}

	count := ev.Count
	if count == 0 {
		count = 1
	}

	return models.EventInfo{
		Name:           ev.Name,
		Namespace:      ev.Namespace,
		Type:           ev.Type,
		Reason:         ev.Reason,
		Message:        ev.Message,
		Object:         ev.InvolvedObject.Name,
		ObjectKind:     ev.InvolvedObject.Kind,
		Count:          count,
		FirstTimestamp: firstTs.Format(time.RFC3339),
		LastTimestamp:  lastTs.Format(time.RFC3339),
	}
}
