# Adding Clusters

kube-ins stores each cluster as a separate kubeconfig file under `~/.kube-ins/`. You can add, edit, and switch between clusters at any time.

## Opening the Cluster Manager

Click the cluster name in the **top bar** to open the cluster manager. From there you can:

- See all saved clusters and their connection status
- Add a new cluster
- Edit an existing cluster's kubeconfig
- Delete a cluster
- Switch the active cluster

## Adding a New Cluster

1. Click **Add Cluster** in the cluster manager.
2. Enter a **name** for the cluster (used as a label inside kube-ins).
3. Paste the full kubeconfig content into the editor.
4. Click **Save**.

kube-ins saves the kubeconfig to `~/.kube-ins/<name>.yaml` and immediately tries to connect.

!!! tip "Getting your kubeconfig"
    If you manage your cluster with `kubectl`, you can copy the relevant context from your existing config:
    ```bash
    kubectl config view --raw --minify --context=<context-name>
    ```
    Paste the output into the kube-ins editor.

## Switching Clusters

Click any cluster in the cluster manager list to make it active. The top bar updates to show the selected cluster name and a live connection indicator (green = healthy, red = unreachable). The connection is polled every 20 seconds.

## Editing a Cluster

Click the edit icon next to a cluster name. The kubeconfig editor opens with the current content. Make your changes and click **Save** to update.

## Deleting a Cluster

Click the delete icon next to a cluster name. The kubeconfig file is removed from `~/.kube-ins/`. This does not affect any files in `~/.kube/`.

## Connection Health Check

kube-ins polls the active cluster's API server every 20 seconds. The status indicator in the top bar reflects the latest check:

- **Green** — cluster is reachable and responding
- **Red** — cluster is unreachable or returned an error

Switching to a different cluster triggers an immediate health check for that cluster.
