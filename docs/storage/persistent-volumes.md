# Persistent Volumes

The Persistent Volumes screen lists cluster-scoped `PersistentVolume` (PV) resources.

## Columns

| Column | Description |
|---|---|
| Name | PV name |
| Status | `Available`, `Bound`, `Released`, `Failed` |
| Capacity | Provisioned storage size |
| Access Modes | `RWO`, `ROX`, `RWX` |
| Reclaim Policy | `Retain`, `Delete`, `Recycle` |
| Storage Class | Backing storage class |
| Volume Mode | `Filesystem` or `Block` |
| Claim | The bound `PersistentVolumeClaim` (namespace/name) |
| Age | Time since creation |

## Actions

### View YAML

Double-click a row to open the manifest (read-only).

## See also

- [Volume Claims](volume-claims.md) — the namespaced requests that bind to PVs.
