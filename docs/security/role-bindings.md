---
description: Inspect Kubernetes RoleBindings and ClusterRoleBindings and the subjects they grant access to in Kube Inspector.
---

# Role Bindings

The Role Bindings screen lists `RoleBinding` resources — the link between a role and the subjects that hold it.

## Columns

| Column | Description |
|---|---|
| Name | RoleBinding name |
| Namespace | Namespace |
| Role | The referenced `Role` or `ClusterRole` |
| Subjects | Users, groups and service accounts granted the role |
| Age | Time since creation |

## Actions

### View / Edit YAML

Double-click a row to open the binding in a dedicated editor panel and apply changes to its `roleRef` / `subjects`.

## See also

- [Security Role Map](security-role-map.md) — follow a binding through to the resources it ultimately grants.
