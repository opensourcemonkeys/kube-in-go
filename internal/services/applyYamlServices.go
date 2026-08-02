package services_k8sclient

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilyaml "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

// fieldManager identifies this app as the owner of the fields it applies, so a
// later apply of the same manifest updates rather than conflicts.
const fieldManager = "kube-inspector"

// yamlDecodeBuffer is the lookahead the YAML/JSON sniffing decoder gets to
// decide which format a document is in.
const yamlDecodeBuffer = 4096

// ApplyYaml applies a (possibly multi-document) manifest with server-side apply
// against the cluster described by config. Field manager "kube-inspector".
// Returns one "<kind>/<name> applied" line per document.
//
// Wails discards the first return value when the error is non-nil, so on
// failure the output accumulated so far is folded into the error — it is the
// only thing the frontend gets to show.
func ApplyYaml(ctx context.Context, config *rest.Config, yamlContent string) (string, error) {
	dyn, mapper, err := newDynamicAndMapper(config)
	if err != nil {
		return "", err
	}

	decoder := utilyaml.NewYAMLOrJSONDecoder(strings.NewReader(yamlContent), yamlDecodeBuffer)
	var applied []string
	docIndex := 0

	for {
		var obj unstructured.Unstructured
		err := decoder.Decode(&obj)
		if errors.Is(err, io.EOF) {
			break
		}
		docIndex++
		if err != nil {
			return "", applyError(applied, docIndex, err)
		}
		// A `---` separator or a comment-only section decodes to nothing.
		if len(obj.Object) == 0 {
			continue
		}

		line, err := applyOne(ctx, dyn, mapper, &obj)
		if err != nil {
			return "", applyError(applied, docIndex, err)
		}
		applied = append(applied, line)
	}

	if len(applied) == 0 {
		return "", fmt.Errorf("no Kubernetes objects found in the manifest")
	}
	return strings.Join(applied, "\n") + "\n", nil
}

// applyOne resolves a single decoded document to its resource and applies it.
func applyOne(ctx context.Context, dyn dynamic.Interface, mapper meta.RESTMapper, obj *unstructured.Unstructured) (string, error) {
	apiVersion := obj.GetAPIVersion()
	kind := obj.GetKind()
	if apiVersion == "" || kind == "" {
		return "", fmt.Errorf("object is missing apiVersion or kind")
	}
	if obj.GetName() == "" {
		return "", fmt.Errorf("%s is missing metadata.name", kind)
	}

	// Server-side apply rejects an object that still carries managedFields,
	// which is exactly what a manifest pasted from `kubectl get -o yaml` has.
	unstructured.RemoveNestedField(obj.Object, "metadata", "managedFields")

	gvk := schema.FromAPIVersionAndKind(apiVersion, kind)
	mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
	if err != nil {
		return "", fmt.Errorf("unknown resource %s: %w", gvk, err)
	}

	namespace := obj.GetNamespace()
	if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
		if namespace == "" {
			namespace = "default"
			obj.SetNamespace(namespace)
		}
	} else if namespace != "" {
		// The API server rejects a namespace on a cluster-scoped object.
		obj.SetNamespace("")
		namespace = ""
	}

	ri := dyn.Resource(mapping.Resource)
	var target dynamic.ResourceInterface = ri
	if namespace != "" {
		target = ri.Namespace(namespace)
	}

	// Force is required: resources previously created by kubectl carry the
	// "kubectl-client-side-apply" field manager and would otherwise conflict.
	_, err = target.Apply(ctx, obj.GetName(), obj, metav1.ApplyOptions{
		FieldManager: fieldManager,
		Force:        true,
	})
	if err != nil {
		return "", err
	}

	if namespace != "" {
		return fmt.Sprintf("%s/%s applied to namespace %s", strings.ToLower(kind), obj.GetName(), namespace), nil
	}
	return fmt.Sprintf("%s/%s applied", strings.ToLower(kind), obj.GetName()), nil
}

// applyError folds the partial output into the error, tagged with the document
// index so a partial failure in a multi-document manifest is diagnosable.
func applyError(applied []string, docIndex int, err error) error {
	if len(applied) == 0 {
		return fmt.Errorf("document %d: %w", docIndex, err)
	}
	return fmt.Errorf("%s\ndocument %d: %w", strings.Join(applied, "\n"), docIndex, err)
}
