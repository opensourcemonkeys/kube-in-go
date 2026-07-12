---
description: View, edit YAML for, and delete Kubernetes DaemonSets in Kube Inspector, with rollout and per-node status at a glance.
---

# DaemonSets

DaemonSets ensure that a copy of a pod runs on every (or a subset of) nodes in the cluster. Common uses are log collectors, monitoring agents, and network plugins.

## Columns

| Column | Description |
|---|---|
| Name | DaemonSet name |
| Namespace | Namespace |
| Desired | Number of nodes that should run the pod |
| Ready | Number of nodes where the pod is running |
| Image | Container image |
| Age | Time since creation |

## Actions

### View / Edit YAML

Double-click a row to open the YAML editor. Editing the DaemonSet spec (e.g., updating the image) triggers a rolling update across all scheduled nodes.

### View Logs

Opens the log panel streaming output from the pods managed by this DaemonSet. Use the pod selector to focus on a specific node's pod.

### Delete

Deletes the DaemonSet and all pods it manages. DaemonSet pods are removed from every node.
