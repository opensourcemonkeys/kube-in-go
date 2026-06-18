# Services

The Services screen lists all `Service` resources across namespaces in the active cluster.

## Columns

| Column | Description |
|---|---|
| Name | Service name |
| Namespace | Namespace |
| Type | `ClusterIP`, `NodePort`, `LoadBalancer`, or `ExternalName` |
| Cluster IP | The in-cluster virtual IP |
| External IP | External address (for `LoadBalancer` / `ExternalName`) |
| Ports | Exposed port → target port mappings |
| Age | Time since creation |

## Actions

### View / Edit YAML

Double-click a row to open the service manifest. Apply changes from the editor to update the service.

### Delete

Select one or more services with the checkbox column and click **Delete Selected**, then confirm.

## Tips

- Filter by **Type** to find all `LoadBalancer` services awaiting an external address.
