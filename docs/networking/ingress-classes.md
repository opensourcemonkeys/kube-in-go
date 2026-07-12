---
description: List Kubernetes IngressClass resources and their controllers in Kube Inspector.
---

# Ingress Classes

The Ingress Classes screen lists cluster-scoped `IngressClass` resources — the controllers available to handle ingresses.

## Columns

| Column | Description |
|---|---|
| Name | IngressClass name |
| Controller | The controller that implements this class |
| Default | Tag shown when this is the cluster's default class |
| Age | Time since creation |

## Actions

### View YAML

Double-click a row to open the manifest. Ingress classes are shown read-only in this panel.
