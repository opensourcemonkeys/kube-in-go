package tui

import (
	"kube-ins/internal/business"
	"kube-ins/internal/models"
)

// crdChildDef builds the drill-down list for one CRD's instances. The def is
// constructed per-Enter from the CRD row and never registered: its view is the
// CRD's plural, which doubles as the resource name GetObjectDescribe resolves
// for the describe pane (plurals shared across API groups may resolve to the
// wrong group there — the pane then just shows the error text).
func crdChildDef(cluster string, row rowData) *resourceDef {
	crd, ok := row.ref.(models.CRDInfo)
	if !ok {
		return nil
	}
	group, plural := crd.Group, crd.Plural
	namespaced := crd.Scope == "Namespaced"
	headers := []string{"NAME", "AGE"}
	if namespaced {
		headers = []string{"NAMESPACE", "NAME", "AGE"}
	}
	return &resourceDef{
		view:       plural,
		title:      crd.Kind,
		namespaced: namespaced,
		parent:     "crds",
		headers:    headers,
		list: func(c string) ([]rowData, error) {
			items, err := business.GetCustomResources(c, group, plural)
			if err != nil {
				return nil, err
			}
			var rows []rowData
			for _, it := range items {
				cells := []string{it.Name, dash(it.Age)}
				if namespaced {
					cells = []string{it.Namespace, it.Name, dash(it.Age)}
				}
				rows = append(rows, rowData{name: it.Name, namespace: it.Namespace, cells: cells})
			}
			return rows, nil
		},
		getYAML: func(c, name, ns string) (string, error) {
			return business.GetObjectYaml(c, group, plural, ns, name)
		},
		updateYAML: func(c, name, ns, yaml string) error {
			return business.UpdateObjectYaml(c, group, plural, ns, name, yaml)
		},
		del: func(c, name, ns string) error {
			return business.DeleteObject(c, group, plural, ns, name)
		},
	}
}
