# Deployments

The Deployments screen lists all Deployment resources across all namespaces.

## Columns

| Column | Description |
|---|---|
| Name | Deployment name |
| Namespace | Namespace |
| Replicas | Desired / ready replica count |
| Image | Container image(s) |
| Age | Time since creation |

## Actions

### Scale

Click the **Scale** button on a deployment row. Enter the desired replica count and confirm. kube-ins patches the deployment's replica count immediately.

### View / Edit YAML

Double-click a row to open the YAML editor panel. The full deployment manifest loads in Monaco editor. Make your changes and click **Apply** to push them to the cluster.

!!! warning
    Editing YAML directly bypasses kubectl rollout logic. For changes that should trigger a rolling update (e.g., changing the image), updating the YAML is correct. For scaling only, use the dedicated **Scale** button.

### View Logs

Click **Logs** to open a log panel that aggregates logs from all pods managed by this deployment. Use the pod selector dropdown inside the log panel to switch between individual pods.

### Delete

Select one or more deployments and click **Delete Selected**. This deletes the Deployment object; managed ReplicaSets and Pods are garbage collected by Kubernetes.
