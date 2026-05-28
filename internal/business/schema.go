package business

import _ "embed"

//go:embed assets/k8s-schema.json
var k8sSchemaJSON string

func GetK8sSchema() string {
	return k8sSchemaJSON
}
