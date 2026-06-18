# Pods

The Pods screen lists all pods across all namespaces in the active cluster.

![Pods screen](../assets/screenshots/pods.png){ .doc-shot }

## Columns

| Column | Description |
|---|---|
| Name | Pod name |
| Namespace | Namespace the pod belongs to |
| Status | Running, Pending, CrashLoopBackOff, etc. |
| Ready | Container readiness count (e.g. `2/2`) |
| Restarts | Total restart count for all containers |
| Node | Node the pod is scheduled on |
| Age | Time since the pod was created |

## Actions

### View Logs

Click the **Logs** button on a pod row to open the [Log Viewer](../workspace/log-viewer.md) for that pod. Logs stream in real time.

### View YAML

Double-click a pod row to open its full YAML definition in a panel. Pod YAML is read-only (pods are ephemeral; edit the controlling resource such as a Deployment instead).

### Delete

Select one or more pods using the checkbox column and click **Delete Selected**. Confirm in the dialog. The pod is deleted immediately — if it is managed by a controller, Kubernetes will recreate it.

## Tips

- Use the **Status** filter to quickly isolate failing pods (e.g., type `Crash` to find `CrashLoopBackOff` pods).
- Sort by **Restarts** descending to surface the most unstable pods.
