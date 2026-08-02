package services_k8sclient

import "errors"

var errNamespaceNameRequired = errors.New("namespace and name are required")
var errNamespaceDeploymentRequired = errors.New("namespace and deployment name are required")
var errNamespaceServiceRequired = errors.New("namespace and service name are required")
var errNamespaceServiceAccountRequired = errors.New("namespace and service account name are required")
var errNamespaceRoleRequired = errors.New("namespace and role name are required")
var errNamespaceRoleBindingRequired = errors.New("namespace and role binding name are required")
