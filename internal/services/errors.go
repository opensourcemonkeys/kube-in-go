package services_k8sclient

import "errors"

var errNamespaceNameRequired = errors.New("namespace and name are required")
var errNamespaceDeploymentRequired = errors.New("namespace and deployment name are required")
