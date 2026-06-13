package services_k8sclient

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"sigs.k8s.io/yaml"
)

// newDynamicAndMapper builds a dynamic client and a discovery-backed REST mapper
// for working with arbitrary resource types by (group, resource).
func newDynamicAndMapper(config *rest.Config) (dynamic.Interface, meta.RESTMapper, error) {
	dyn, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, nil, err
	}
	dc, err := discovery.NewDiscoveryClientForConfig(config)
	if err != nil {
		return nil, nil, err
	}
	groupResources, err := restmapper.GetAPIGroupResources(dc)
	if err != nil {
		return nil, nil, err
	}
	return dyn, restmapper.NewDiscoveryRESTMapper(groupResources), nil
}

// resolveResourceInterface resolves a (group, resource[, namespace]) into a
// dynamic ResourceInterface. A non-empty namespace selects the namespaced API.
func resolveResourceInterface(dyn dynamic.Interface, mapper meta.RESTMapper, group, resource, namespace string) (dynamic.ResourceInterface, error) {
	gvr, err := mapper.ResourceFor(schema.GroupVersionResource{Group: group, Resource: resource})
	if err != nil {
		return nil, err
	}
	if namespace != "" {
		return dyn.Resource(gvr).Namespace(namespace), nil
	}
	return dyn.Resource(gvr), nil
}

// GetObjectYaml fetches a single object by (group, resource, namespace, name)
// and returns a cleaned YAML representation (managedFields/status and volatile
// metadata stripped).
func GetObjectYaml(config *rest.Config, group, resource, namespace, name string) (string, error) {
	dyn, mapper, err := newDynamicAndMapper(config)
	if err != nil {
		return "", err
	}
	ri, err := resolveResourceInterface(dyn, mapper, group, resource, namespace)
	if err != nil {
		return "", err
	}
	obj, err := ri.Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	cleanUnstructured(obj)
	data, err := yaml.Marshal(obj.Object)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// UpdateObjectYaml applies edited YAML back to the object identified by
// (group, resource, namespace, name).
func UpdateObjectYaml(config *rest.Config, group, resource, namespace, name, yamlContent string) error {
	dyn, mapper, err := newDynamicAndMapper(config)
	if err != nil {
		return err
	}
	ri, err := resolveResourceInterface(dyn, mapper, group, resource, namespace)
	if err != nil {
		return err
	}
	var m map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlContent), &m); err != nil {
		return fmt.Errorf("invalid YAML: %w", err)
	}
	u := &unstructured.Unstructured{Object: m}
	u.SetName(name)
	if namespace != "" {
		u.SetNamespace(namespace)
	}
	_, err = ri.Update(context.TODO(), u, metav1.UpdateOptions{})
	return err
}

func cleanUnstructured(u *unstructured.Unstructured) {
	unstructured.RemoveNestedField(u.Object, "metadata", "managedFields")
	unstructured.RemoveNestedField(u.Object, "metadata", "creationTimestamp")
	unstructured.RemoveNestedField(u.Object, "metadata", "resourceVersion")
	unstructured.RemoveNestedField(u.Object, "metadata", "uid")
	unstructured.RemoveNestedField(u.Object, "metadata", "generation")
	unstructured.RemoveNestedField(u.Object, "metadata", "selfLink")
	unstructured.RemoveNestedField(u.Object, "status")
}
