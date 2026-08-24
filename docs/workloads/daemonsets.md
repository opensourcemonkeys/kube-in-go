---
description: View, restart, describe, edit YAML for and delete Kubernetes DaemonSets in Kube Inspector, with per-node rollout status at a glance.
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

Per-row actions live in the **⋮** menu at the end of the row: Describe and
Rollout restart. There is **no Scale** — a DaemonSet has no replica count; it
runs one pod per matching node, so change `spec.template.spec.nodeSelector` or
the node labels instead.

### Rollout restart

**⋮ → Rollout restart.** Confirms, then rolls every DaemonSet pod one generation
forward using the same `kubectl.kubernetes.io/restartedAt` annotation
`kubectl rollout restart` writes.

This restarts the agent on **every node the DaemonSet covers**, governed by the
DaemonSet's `updateStrategy` — `RollingUpdate` with `maxUnavailable: 1` walks
the cluster one node at a time, while `OnDelete` will not restart anything until
the pods are deleted. For a log collector or a CNI plugin, that is a
cluster-wide operation: check the strategy before confirming.

### Describe

**⋮ → Describe.** Opens `kubectl describe` output — desired/current/ready counts
per node, the update strategy, and the object's recent events. See
[Describe](../workspace/describe.md).

### View / Edit YAML

Double-click a row to open the YAML editor. Editing the DaemonSet spec (e.g., updating the image) triggers a rolling update across all scheduled nodes.

### View Logs

Opens the log panel streaming output from the pods managed by this DaemonSet. Use the pod selector to focus on a specific node's pod.

### Delete

Deletes the DaemonSet and all pods it manages. DaemonSet pods are removed from every node.
