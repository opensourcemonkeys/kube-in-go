# Volume Claims

The Volume Claims screen lists `PersistentVolumeClaim` (PVC) resources across namespaces.

## Columns

| Column | Description |
|---|---|
| Name | PVC name |
| Namespace | Namespace |
| Status | `Pending`, `Bound`, `Lost` |
| Volume | The bound `PersistentVolume` |
| Storage Class | Requested storage class |
| Access Modes | `RWO`, `ROX`, `RWX` |
| Request | Requested storage size |
| Limit | Storage limit (if set) |
| Age | Time since creation |

## Actions

### View YAML

Double-click a row to open the manifest (read-only).

!!! note
    The screen shows requested/limit capacity from the claim spec; live disk **usage** inside a volume is not exposed by the Kubernetes API and is not shown here.
