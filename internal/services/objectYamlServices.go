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
	"k8s.io/kubectl/pkg/describe"
	"sigs.k8s.io/yaml"
)

// client-go defaults to 5 QPS / 10 burst, which these paths blow straight
// through: building the REST mapper alone issues one request per API
// group-version, and the CRD instance-count sweep fans out one list per CRD.
// At the default rate those queue behind client-side throttling for seconds
// ("Waited before sending request"). The apiserver's own priority-and-fairness
// still governs, so lifting the client-side limit only stops us from
// rate-limiting ourselves.
const (
	fanoutQPS   = 50
	fanoutBurst = 100
)

// newDynamicAndMapper builds a dynamic client and a discovery-backed REST mapper
// for working with arbitrary resource types by (group, resource).
func newDynamicAndMapper(config *rest.Config) (dynamic.Interface, meta.RESTMapper, error) {
	cfg := rest.CopyConfig(config)
	cfg.QPS = fanoutQPS
	cfg.Burst = fanoutBurst

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, nil, err
	}
	dc, err := discovery.NewDiscoveryClientForConfig(cfg)
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

// GetObjectDescribe renders the full `kubectl describe` output for a single
// object identified by (resource, namespace, name), using kubectl's own
// describers (k8s.io/kubectl/pkg/describe) over the API — no subprocess. The
// plural resource is resolved to its GroupKind via the REST mapper (empty group
// so the mapper picks the right API group from the plural, matching TUI views).
func GetObjectDescribe(config *rest.Config, resource, namespace, name string) (string, error) {
	_, mapper, err := newDynamicAndMapper(config)
	if err != nil {
		return "", err
	}
	gvr, err := mapper.ResourceFor(schema.GroupVersionResource{Resource: resource})
	if err != nil {
		return "", err
	}
	gvk, err := mapper.KindFor(gvr)
	if err != nil {
		return "", err
	}

	describer, ok := describe.DescriberFor(gvk.GroupKind(), config)
	if !ok {
		// Fall back to the generic (table-style) describer for kinds without a
		// dedicated describer (e.g. CRDs).
		if mapping, mErr := mapper.RESTMapping(gvk.GroupKind(), gvk.Version); mErr == nil {
			describer, ok = describe.GenericDescriberFor(mapping, config)
		}
	}
	if !ok {
		return fmt.Sprintf("describe not available for %s", gvk.Kind), nil
	}

	return describer.Describe(namespace, name, describe.DescriberSettings{ShowEvents: true, ChunkSize: 500})
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
