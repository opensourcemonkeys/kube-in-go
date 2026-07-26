package services_k8sclient

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"kube-ins/internal/models"
)

var crdGVR = schema.GroupVersionResource{
	Group:    "apiextensions.k8s.io",
	Version:  "v1",
	Resource: "customresourcedefinitions",
}

// GetCRDs lists all CustomResourceDefinitions in the cluster via the dynamic
// client (no typed apiextensions clientset needed) and returns them sorted by
// group then name for the grouped CRD view.
func GetCRDs(config *rest.Config) ([]models.CRDInfo, error) {
	dyn, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	list, err := dyn.Resource(crdGVR).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	infos := make([]models.CRDInfo, 0, len(list.Items))
	for i := range list.Items {
		infos = append(infos, crdToInfo(&list.Items[i]))
	}
	sort.Slice(infos, func(i, j int) bool {
		if infos[i].Group != infos[j].Group {
			return infos[i].Group < infos[j].Group
		}
		return infos[i].Name < infos[j].Name
	})
	return infos, nil
}

func crdToInfo(u *unstructured.Unstructured) models.CRDInfo {
	group, _, _ := unstructured.NestedString(u.Object, "spec", "group")
	kind, _, _ := unstructured.NestedString(u.Object, "spec", "names", "kind")
	plural, _, _ := unstructured.NestedString(u.Object, "spec", "names", "plural")
	scope, _, _ := unstructured.NestedString(u.Object, "spec", "scope")

	// Pick the storage version (fall back to the first served version).
	version := ""
	if versions, found, _ := unstructured.NestedSlice(u.Object, "spec", "versions"); found {
		for _, v := range versions {
			vm, ok := v.(map[string]interface{})
			if !ok {
				continue
			}
			name, _, _ := unstructured.NestedString(vm, "name")
			if version == "" {
				version = name
			}
			if storage, _, _ := unstructured.NestedBool(vm, "storage"); storage {
				version = name
				break
			}
		}
	}

	return models.CRDInfo{
		Name:    u.GetName(),
		Group:   group,
		Kind:    kind,
		Plural:  plural,
		Scope:   scope,
		Version: version,
		Age:     humanAge(u.GetCreationTimestamp().Time),
	}
}

// GetCustomResources lists all instances of a custom resource identified by its
// (group, plural resource). A namespaced resource is listed across all
// namespaces; the REST mapper resolves the served version.
func GetCustomResources(config *rest.Config, group, resource string) ([]models.CustomResourceInfo, error) {
	dyn, mapper, err := newDynamicAndMapper(config)
	if err != nil {
		return nil, err
	}
	ri, err := resolveResourceInterface(dyn, mapper, group, resource, "")
	if err != nil {
		return nil, err
	}
	list, err := ri.List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	infos := make([]models.CustomResourceInfo, 0, len(list.Items))
	for i := range list.Items {
		item := &list.Items[i]
		infos = append(infos, models.CustomResourceInfo{
			Name:      item.GetName(),
			Namespace: item.GetNamespace(),
			Age:       humanAge(item.GetCreationTimestamp().Time),
		})
	}
	sort.Slice(infos, func(i, j int) bool {
		if infos[i].Namespace != infos[j].Namespace {
			return infos[i].Namespace < infos[j].Namespace
		}
		return infos[i].Name < infos[j].Name
	})
	return infos, nil
}

// countWorkers bounds how many CRDs are counted at once. A cluster can carry
// hundreds of CRDs and each count is a separate API round-trip.
const countWorkers = 8

// countTimeout caps a single CRD's count so one unresponsive aggregated
// apiserver cannot stall the whole sweep.
const countTimeout = 10 * time.Second

// GetCRDInstanceCounts returns the number of live instances per CRD, keyed by
// CRD name. A value of -1 means the count could not be taken (no permission,
// unresolvable resource, timeout) — the caller renders that as "unknown"
// rather than as zero.
//
// The count is cheap by design: List with Limit 1 returns a single object and
// the server reports the rest in metadata.remainingItemCount. Note that
// ResourceVersion "0" must NOT be set — the watch cache cannot paginate, so it
// would ignore the limit and stream every object back instead.
func GetCRDInstanceCounts(config *rest.Config, crds []models.CRDInfo) (map[string]int, error) {
	// Discovery is expensive, so the mapper is built once for the whole sweep.
	dyn, mapper, err := newDynamicAndMapper(config)
	if err != nil {
		return nil, err
	}

	counts := make(map[string]int, len(crds))
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, countWorkers)

	for _, crd := range crds {
		wg.Add(1)
		go func(crd models.CRDInfo) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			count := countInstances(dyn, mapper, crd)
			mu.Lock()
			counts[crd.Name] = count
			mu.Unlock()
		}(crd)
	}
	wg.Wait()
	return counts, nil
}

func countInstances(dyn dynamic.Interface, mapper meta.RESTMapper, crd models.CRDInfo) int {
	ri, err := resolveResourceInterface(dyn, mapper, crd.Group, crd.Plural, "")
	if err != nil {
		return -1
	}
	ctx, cancel := context.WithTimeout(context.TODO(), countTimeout)
	defer cancel()

	list, err := ri.List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		return -1
	}
	count := len(list.Items)
	if remaining := list.GetRemainingItemCount(); remaining != nil {
		count += int(*remaining)
	}
	return count
}

// DeleteObject deletes any object identified by (group, resource, namespace,
// name) via the dynamic client. Generic counterpart to Get/UpdateObjectYaml.
func DeleteObject(config *rest.Config, group, resource, namespace, name string) error {
	dyn, mapper, err := newDynamicAndMapper(config)
	if err != nil {
		return err
	}
	ri, err := resolveResourceInterface(dyn, mapper, group, resource, namespace)
	if err != nil {
		return err
	}
	return ri.Delete(context.TODO(), name, metav1.DeleteOptions{})
}

// humanAge renders a compact age string (e.g. "5d", "3h", "12m") from a
// creation timestamp, matching how k8s CLIs present AGE columns.
func humanAge(created time.Time) string {
	if created.IsZero() {
		return ""
	}
	d := time.Since(created)
	switch {
	case d < time.Minute:
		return fmt.Sprintf("%ds", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("%dm", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd", int(d.Hours()/24))
	}
}
