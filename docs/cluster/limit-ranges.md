---
description: View Kubernetes LimitRange objects and their default and min/max resource constraints per namespace in Kube Inspector.
---

# Limit Ranges

The Limit Ranges screen lists `LimitRange` resources — the per-namespace defaults and bounds applied to containers and pods.

## Columns

| Column | Description |
|---|---|
| Name | LimitRange name |
| Namespace | Namespace |
| Limits | Per-type CPU/memory min, max, default and default-request values |
| Age | Time since creation |

## Actions

### View / Edit YAML

Double-click a row to open the manifest and apply changes. A LimitRange can define `min`, `max`, `default` (limit) and `defaultRequest` for each resource type (`Container`, `Pod`, …).
