package services_k8sclient

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/yaml"
)

// toApplyYaml converts a Kubernetes API object to apply-ready YAML.
// apiVersion and kind are resolved from the client-go scheme so callers
// don't need to pass them — client-go leaves TypeMeta empty on Get responses.
// Server-managed fields (managedFields, status, resourceVersion, uid, etc.)
// are stripped so the output can be submitted directly via kubectl apply.
func toApplyYaml(obj runtime.Object) (string, error) {
	gvks, _, err := scheme.Scheme.ObjectKinds(obj)
	if err != nil || len(gvks) == 0 {
		return "", fmt.Errorf("could not determine GVK: %w", err)
	}
	gvk := gvks[0]

	jsonBytes, err := json.Marshal(obj)
	if err != nil {
		return "", err
	}

	var m map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &m); err != nil {
		return "", err
	}

	m["apiVersion"] = gvk.GroupVersion().String()
	m["kind"] = gvk.Kind

	delete(m, "status")

	if meta, ok := m["metadata"].(map[string]interface{}); ok {
		delete(meta, "managedFields")
		delete(meta, "resourceVersion")
		delete(meta, "uid")
		delete(meta, "selfLink")
		delete(meta, "generation")
		delete(meta, "creationTimestamp")
		if annotations, ok := meta["annotations"].(map[string]interface{}); ok {
			delete(annotations, "kubectl.kubernetes.io/last-applied-configuration")
			if len(annotations) == 0 {
				delete(meta, "annotations")
			}
		}
	}

	yamlBytes, err := yaml.Marshal(m)
	if err != nil {
		return "", err
	}
	return string(yamlBytes), nil
}
