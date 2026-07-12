---
description: View Kubernetes Ingress resources, their hosts, paths, and backend services in Kube Inspector.
---

# Ingresses

The Ingresses screen lists all `Ingress` resources across namespaces, showing how external traffic is routed to services.

## Columns

| Column | Description |
|---|---|
| Name | Ingress name |
| Namespace | Namespace |
| Class | Ingress class that handles the resource |
| Hosts | Host rules defined on the ingress |
| Paths | Path → backend service mappings |
| Address | External address assigned by the controller |
| TLS | Whether TLS is configured |
| Age | Time since creation |

## Actions

### View / Edit YAML

Double-click a row to open the ingress manifest and apply changes.

### Delete

Select rows and click **Delete Selected**, then confirm.
