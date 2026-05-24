# ConfigMaps

The ConfigMaps screen lists all `ConfigMap` resources across namespaces.

## Columns

| Column | Description |
|---|---|
| Name | ConfigMap name |
| Namespace | Namespace |
| Data Keys | Number of key-value pairs in the ConfigMap |
| Age | Time since creation |

## Actions

### View / Edit YAML

Double-click a row to open the full ConfigMap YAML in an editor panel. Make changes and click **Apply** to update.

### Key-Value Editor

Click the **sliders** icon on a row to open the key-value editor panel. This gives a structured view of the ConfigMap's data — each key and value displayed in a table. You can:

- Edit values inline
- Add new key-value pairs
- Delete existing keys

Changes are saved back to the cluster when you click **Save** in the panel.

!!! tip
    The key-value editor is more convenient than YAML for ConfigMaps that store simple text configuration. Use YAML view when the values are multi-line (e.g., config files, nginx.conf).

### Bulk Delete

Select one or more ConfigMaps and click **Delete Selected**. Confirm in the dialog.

!!! warning
    Deleting a ConfigMap that is mounted by running pods does not immediately affect those pods — the mounted values are cached. However, pods that restart after deletion will fail to start if the ConfigMap is required.

## Filtering

Use the filter row under each column header to search by name, namespace, or data key count.
