package services_k8sclient

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"kube-ins/internal/models"
)

// tableAccept asks the apiserver to render the list server-side as a
// meta.k8s.io Table — the exact column set `kubectl get` prints, including a
// CRD's own additionalPrinterColumns. Falling back to plain JSON keeps the
// request valid against servers that cannot render tables.
const tableAccept = "application/json;as=Table;v=v1;g=meta.k8s.io,application/json"

// GetResourceTable lists any (group, resource) as a server-rendered table.
//
// The dynamic client cannot be used here: it decodes every response into an
// *unstructured.UnstructuredList, and a Table carries "rows" rather than
// "items", so the conversion fails. A raw REST client pinned to the resolved
// GroupVersion is the same path kubectl takes.
func GetResourceTable(config *rest.Config, group, resource, namespace string) (models.ResourceTable, error) {
	_, mapper, err := newDynamicAndMapper(config)
	if err != nil {
		return models.ResourceTable{}, err
	}
	gvr, err := mapper.ResourceFor(schema.GroupVersionResource{Group: group, Resource: resource})
	if err != nil {
		return models.ResourceTable{}, err
	}

	table, err := requestTable(config, gvr, namespace)
	if err != nil || len(table.ColumnDefinitions) == 0 {
		// Aggregated apiservers may not implement table conversion. Degrade to
		// the plain listing rather than showing an empty panel.
		return fallbackTable(config, group, resource)
	}
	return toResourceTable(table), nil
}

func requestTable(config *rest.Config, gvr schema.GroupVersionResource, namespace string) (*metav1.Table, error) {
	cfg := rest.CopyConfig(config)
	cfg.GroupVersion = &schema.GroupVersion{Group: gvr.Group, Version: gvr.Version}
	if gvr.Group == "" {
		cfg.APIPath = "/api"
	} else {
		cfg.APIPath = "/apis"
	}
	cfg.NegotiatedSerializer = scheme.Codecs.WithoutConversion()
	cfg.AcceptContentTypes = tableAccept

	client, err := rest.RESTClientFor(cfg)
	if err != nil {
		return nil, err
	}

	req := client.Get().Resource(gvr.Resource)
	if namespace != "" {
		req = req.Namespace(namespace)
	}
	// Metadata is the server default, but being explicit guarantees each row
	// carries the PartialObjectMetadata we read the name/namespace from.
	req = req.Param("includeObject", "Metadata").SetHeader("Accept", tableAccept)

	raw, err := req.DoRaw(context.Background())
	if err != nil {
		return nil, err
	}

	var table metav1.Table
	if err := json.Unmarshal(raw, &table); err != nil {
		return nil, err
	}
	if table.Kind != "" && table.Kind != "Table" {
		return nil, fmt.Errorf("server returned %s, not a Table", table.Kind)
	}
	return &table, nil
}

func toResourceTable(table *metav1.Table) models.ResourceTable {
	out := models.ResourceTable{
		Columns: make([]models.ResourceTableColumn, 0, len(table.ColumnDefinitions)),
		Rows:    make([]models.ResourceTableRow, 0, len(table.Rows)),
	}
	for _, c := range table.ColumnDefinitions {
		out.Columns = append(out.Columns, models.ResourceTableColumn{
			Name:     c.Name,
			Type:     c.Type,
			Priority: c.Priority,
		})
	}
	for i := range table.Rows {
		row := &table.Rows[i]
		cells := make([]string, 0, len(row.Cells))
		for _, cell := range row.Cells {
			cells = append(cells, cellToString(cell))
		}
		name, namespace := rowIdentity(row)
		out.Rows = append(out.Rows, models.ResourceTableRow{
			Name:      name,
			Namespace: namespace,
			Cells:     cells,
		})
	}
	return out
}

// rowIdentity reads the name/namespace off the row's embedded
// PartialObjectMetadata. The first cell is conventionally the name, so it acts
// as the fallback when a server omits the object.
func rowIdentity(row *metav1.TableRow) (string, string) {
	if len(row.Object.Raw) > 0 {
		var meta metav1.PartialObjectMetadata
		if err := json.Unmarshal(row.Object.Raw, &meta); err == nil {
			return meta.Name, meta.Namespace
		}
	}
	if len(row.Cells) > 0 {
		return cellToString(row.Cells[0]), ""
	}
	return "", ""
}

// fallbackTable renders the plain listing as a Name/Namespace/Age table so the
// panel still works when the server cannot produce a Table.
func fallbackTable(config *rest.Config, group, resource string) (models.ResourceTable, error) {
	items, err := GetCustomResources(config, group, resource)
	if err != nil {
		return models.ResourceTable{}, err
	}
	out := models.ResourceTable{
		Columns: []models.ResourceTableColumn{
			{Name: "Name", Type: "string"},
			{Name: "Age", Type: "string"},
		},
		Rows: make([]models.ResourceTableRow, 0, len(items)),
	}
	for _, item := range items {
		out.Rows = append(out.Rows, models.ResourceTableRow{
			Name:      item.Name,
			Namespace: item.Namespace,
			Cells:     []string{item.Name, item.Age},
		})
	}
	return out, nil
}

// cellToString flattens a table cell to text so the frontend never has to deal
// with the mixed types JSON decoding produces.
func cellToString(v interface{}) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case bool:
		return strconv.FormatBool(t)
	case float64:
		if t == math.Trunc(t) && math.Abs(t) < 1e15 {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	case json.Number:
		return t.String()
	default:
		return fmt.Sprintf("%v", t)
	}
}
