---
description: View and manage Kubernetes StatefulSets and ReplicaSets in Kube Inspector — scale, rollout restart, describe, port forward, YAML and delete.
---

# StatefulSets & ReplicaSets

## StatefulSets

StatefulSets manage pods that require stable network identities and persistent storage. The screen lists all StatefulSets across namespaces.

### Columns

| Column | Description |
|---|---|
| Name | StatefulSet name |
| Namespace | Namespace |
| Replicas | Desired / ready count |
| Image | Container image |
| Age | Time since creation |

### Actions

Per-row actions live in the **⋮** menu: Describe, Port forward, Scale and
Rollout restart.

#### Scale

**⋮ → Scale.** Patches `spec.replicas` only. StatefulSet pods are created and
removed **in order**, so scaling up starts at the next ordinal and scaling down
removes the highest ordinals first — the change is not instantaneous the way a
Deployment's is.

The dialog warns if a HorizontalPodAutoscaler targets the StatefulSet, and if
you ask for 0 replicas (which stops the workload without deleting it or its
PVCs).

#### Rollout restart

**⋮ → Rollout restart.** Sets the same `kubectl.kubernetes.io/restartedAt`
annotation `kubectl rollout restart` uses, rolling the pods one generation
forward. For a StatefulSet that means **one pod at a time, highest ordinal
first**, respecting the update strategy — expect it to take longer than a
Deployment restart.

#### Describe and Port forward

**⋮ → Describe** opens [describe output](../workspace/describe.md) including the
object's events. **⋮ → Port forward** opens a tunnel to one of its pods, with
[reconnection](../workspace/port-forwarding.md#reconnection) if that pod is
replaced.

#### The rest

- **View / Edit YAML** — Double-click a row to open the YAML editor. Apply changes to trigger a rolling update.
- **View Logs** — Streams logs from the pods managed by this StatefulSet.
- **Delete** — Select and delete one or more StatefulSets. Pods and PVCs are managed according to the StatefulSet's `persistentVolumeClaimRetentionPolicy`.

## ReplicaSets

ReplicaSets are typically managed by Deployments. The ReplicaSets screen is useful for inspecting the history of a Deployment's rollouts or for standalone ReplicaSets.

### Columns

| Column | Description |
|---|---|
| Name | ReplicaSet name |
| Namespace | Namespace |
| Replicas | Desired / ready count |
| Owner | Owning Deployment (if any) |
| Age | Time since creation |

### Actions

The **⋮** menu offers Describe, Port forward and Scale. There is **no rollout
restart** — a ReplicaSet has no rollout of its own; restart the owning
Deployment instead.

#### Scale

**⋮ → Scale.** Patches `spec.replicas` directly.

!!! warning "Scaling a Deployment-owned ReplicaSet does not stick"
    The Deployment controller reconciles its ReplicaSets back to the replica
    count the Deployment specifies, usually within seconds. Scale the
    [Deployment](deployments.md#scale) instead. This action is for standalone
    ReplicaSets.

#### The rest

- **View / Edit YAML** — Opens the YAML editor. Direct edits are applied immediately.
- **View Logs** — Streams logs from the pods in this ReplicaSet.
- **Delete** — Deletes the ReplicaSet and its pods. If owned by a Deployment, the Deployment will recreate it.

!!! note
    Modifying a ReplicaSet owned by a Deployment may cause the Deployment controller to overwrite your changes on the next reconcile cycle. Prefer editing the parent Deployment instead.
