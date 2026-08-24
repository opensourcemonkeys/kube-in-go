---
description: List and inspect Kubernetes Services — type, cluster IP, ports, and selectors — in Kube Inspector.
---

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

Per-row actions live in the **⋮** menu at the end of the row: **Describe** and
**Port forward**.

### Port forward

**⋮ → Port forward.** The dialog lists the service's declared ports by name, so
a `ClusterIP` service with no external address becomes reachable at
`127.0.0.1:<port>`. The tunnel re-resolves and reconnects when the pod behind it
is replaced. See [Port forwarding](../workspace/port-forwarding.md).

### Describe

**⋮ → Describe.** Shows the selector, endpoints, ports and session affinity as
`kubectl describe service` prints them — the fastest way to confirm a service is
actually selecting the pods you think it is. See
[Describe](../workspace/describe.md).

### View / Edit YAML

Double-click a row to open the service manifest. Apply changes from the editor to update the service.

### Delete

Select one or more services with the checkbox column and click **Delete Selected**, then confirm.

## Tips

- Filter by **Type** to find all `LoadBalancer` services awaiting an external address.
