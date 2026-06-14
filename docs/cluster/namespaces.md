# Namespaces

The Namespaces screen lists all namespaces in the active cluster.

## Columns

| Column | Description |
|---|---|
| Name | Namespace name |
| Status | `Active` or `Terminating` |

## Actions

### Filter

Use the filter row under each column header to search by name or status. Click **Clear filters** (filter-slash icon) to reset.

### View YAML

Double-click any namespace row to open its YAML definition in a panel. Namespace YAML is viewable but not editable from this screen.

### Bulk Delete

1. Select one or more namespaces using the checkbox column.
2. Click **Delete Selected** in the toolbar.
3. Confirm in the dialog.

!!! danger "Namespace deletion is destructive"
    Deleting a namespace removes all resources inside it — Pods, Deployments, Services, ConfigMaps, Secrets, PVCs, and more. This action cannot be undone. Double-check the list before confirming.

Namespaces in `Terminating` status are being deleted by Kubernetes. Kube Inspector reflects this with a red status tag. If a namespace is stuck in `Terminating`, it usually means a finalizer is blocking deletion — this must be resolved via `kubectl` or by editing the finalizers in the YAML view.
