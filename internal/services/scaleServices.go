package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"

	autoscalingv1 "k8s.io/api/autoscaling/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// ScaleWorkload sets the replica count of a scalable workload.
//
// It writes through the `scale` subresource rather than updating the whole
// object. A full Update would send back every field we last read, which races
// the controller that owns the rest of the spec and silently reverts any
// concurrent change (an image bump landing between our Get and Update would be
// undone). The scale subresource carries exactly one field, so nothing else can
// be clobbered.
//
// `kind` is the singular lowercase name used by the frontend's `resourceKind`
// vocabulary ("deployment", "statefulset", "replicaset").
func ScaleWorkload(kind, namespace, name string, replicas int32, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}
	if replicas < 0 {
		return errNegativeReplicas
	}

	scale := &autoscalingv1.Scale{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec:       autoscalingv1.ScaleSpec{Replicas: replicas},
	}
	ctx := context.Background()

	switch kind {
	case "deployment":
		_, err := client.AppsV1().Deployments(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
		return err
	case "statefulset":
		_, err := client.AppsV1().StatefulSets(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
		return err
	case "replicaset":
		_, err := client.AppsV1().ReplicaSets(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
		return err
	}
	return fmt.Errorf("scaling not supported for %q", kind)
}

// scaleTargetKinds maps our lowercase kind vocabulary to the TitleCase Kind an
// HPA writes in spec.scaleTargetRef.
var scaleTargetKinds = map[string]string{
	"deployment":  "Deployment",
	"statefulset": "StatefulSet",
	"replicaset":  "ReplicaSet",
}

// FindScaleAutoscaler returns the HPA governing a workload, or nil when there is
// none. Callers use it to warn that a manual scale will be reverted.
//
// A nil result and a nil error mean "no HPA targets this object"; a non-nil
// error means we could not find out (no list permission, or a cluster without
// autoscaling/v2). The distinction matters because the caller degrades to
// "unknown" rather than blocking the scale — see business.GetWorkloadAutoscaler.
func FindScaleAutoscaler(kind, namespace, name string, client *kubernetes.Clientset) (*models.HPAInfo, error) {
	if namespace == "" || name == "" {
		return nil, errNamespaceNameRequired
	}
	targetKind, ok := scaleTargetKinds[kind]
	if !ok {
		return nil, nil
	}

	list, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for _, hpa := range list.Items {
		ref := hpa.Spec.ScaleTargetRef
		if ref.Kind != targetKind || ref.Name != name {
			continue
		}
		info := &models.HPAInfo{
			Name:        hpa.Name,
			MaxReplicas: hpa.Spec.MaxReplicas,
		}
		// MinReplicas is optional and defaults to 1 when unset.
		if hpa.Spec.MinReplicas != nil {
			info.MinReplicas = *hpa.Spec.MinReplicas
		} else {
			info.MinReplicas = 1
		}
		return info, nil
	}
	return nil, nil
}
