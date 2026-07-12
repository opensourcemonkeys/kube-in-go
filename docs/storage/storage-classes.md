---
description: View Kubernetes StorageClasses and their provisioners and parameters in Kube Inspector.
---

# Storage Classes

The Storage Classes screen lists cluster-scoped `StorageClass` resources — the provisioners available for dynamic volume provisioning.

## Columns

| Column | Description |
|---|---|
| Name | StorageClass name |
| Default | Tag shown when this is the cluster's default class |
| Provisioner | The volume provisioner |
| Reclaim Policy | Default reclaim policy for volumes it creates |
| Binding Mode | `Immediate` or `WaitForFirstConsumer` |
| Age | Time since creation |

## Actions

### View YAML

Double-click a row to open the manifest (read-only).
