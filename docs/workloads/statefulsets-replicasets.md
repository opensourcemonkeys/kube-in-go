---
description: View and manage Kubernetes StatefulSets and ReplicaSets — replicas, rollout, and YAML — in Kube Inspector.
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

- **View / Edit YAML** — Opens the YAML editor. Direct edits are applied immediately.
- **View Logs** — Streams logs from the pods in this ReplicaSet.
- **Delete** — Deletes the ReplicaSet and its pods. If owned by a Deployment, the Deployment will recreate it.

!!! note
    Modifying a ReplicaSet owned by a Deployment may cause the Deployment controller to overwrite your changes on the next reconcile cycle. Prefer editing the parent Deployment instead.
