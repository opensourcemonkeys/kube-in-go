package models

// ResourceTableColumn is one column of a server-rendered resource table — the
// same column set `kubectl get` prints, including a CRD's own
// additionalPrinterColumns.
type ResourceTableColumn struct {
	Name string `json:"name"`
	Type string `json:"type"` // string | integer | number | boolean | date
	// Priority > 0 marks a column kubectl only shows with `-o wide`.
	Priority int32 `json:"priority"`
}

// ResourceTableRow is one object rendered as cells. Name/Namespace are taken
// from the row's PartialObjectMetadata rather than the cells, so the frontend
// can key rows and build actions without guessing which cell holds the name.
type ResourceTableRow struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Cells     []string `json:"cells"` // same order as Columns, stringified here
}

// ResourceTable is the generic (group, resource) listing used by the CRD
// explorer's instance table.
type ResourceTable struct {
	Columns []ResourceTableColumn `json:"columns"`
	Rows    []ResourceTableRow    `json:"rows"`
}
