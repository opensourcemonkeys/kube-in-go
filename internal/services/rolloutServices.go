package services_k8sclient

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

// restartedAtAnnotation is the key kubectl writes for `rollout restart`. Using
// the same key (rather than one of our own) is what keeps `kubectl rollout
// status` and `kubectl rollout history` consistent with restarts triggered here.
const restartedAtAnnotation = "kubectl.kubernetes.io/restartedAt"

// RestartWorkload triggers a rolling restart the way `kubectl rollout restart`
// does: it stamps a timestamp annotation onto the *pod template*, which changes
// the template hash and makes the controller roll pods over under its own
// update strategy. It deliberately does not delete pods — that would bypass
// maxUnavailable/PDBs and take the workload down.
func RestartWorkload(kind, namespace, name string, client *kubernetes.Clientset) error {
	if namespace == "" || name == "" {
		return errNamespaceNameRequired
	}

	patch, err := restartPatch(time.Now())
	if err != nil {
		return err
	}
	ctx := context.Background()

	switch kind {
	case "deployment":
		_, err := client.AppsV1().Deployments(namespace).Patch(ctx, name, types.StrategicMergePatchType, patch, metav1.PatchOptions{})
		return err
	case "statefulset":
		_, err := client.AppsV1().StatefulSets(namespace).Patch(ctx, name, types.StrategicMergePatchType, patch, metav1.PatchOptions{})
		return err
	case "daemonset":
		_, err := client.AppsV1().DaemonSets(namespace).Patch(ctx, name, types.StrategicMergePatchType, patch, metav1.PatchOptions{})
		return err
	}
	return fmt.Errorf("rollout restart not supported for %q", kind)
}

// restartPatch builds the strategic-merge patch body. It goes through
// json.Marshal rather than fmt.Sprintf so the timestamp can never break out of
// the JSON string it is embedded in.
func restartPatch(now time.Time) ([]byte, error) {
	body := map[string]any{
		"spec": map[string]any{
			"template": map[string]any{
				"metadata": map[string]any{
					"annotations": map[string]string{
						restartedAtAnnotation: now.Format(time.RFC3339),
					},
				},
			},
		},
	}
	return json.Marshal(body)
}
