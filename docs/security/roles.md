# Roles

The Roles screen lists namespaced `Role` resources and their permission rules.

## Columns

| Column | Description |
|---|---|
| Name | Role name |
| Namespace | Namespace |
| Rules | Summary of the policy rules (API groups, resources, verbs) |
| Age | Time since creation |

## Actions

### View / Edit YAML

Double-click a row to open the role in a dedicated editor panel where you can review and apply changes to its `rules`.

## See also

- [Role Bindings](role-bindings.md) — bind a role to users, groups or service accounts.
- [Security Role Map](security-role-map.md) — see which resources a role grants access to.
