# Cluster Graph

The Cluster Graph provides a visual overview of the resources in your cluster and the relationships between them.

## Opening the Graph

Click **Cluster Graph** in the sidebar under the Workspace section.

## What It Shows

The graph is rendered with ReactFlow and displays nodes and edges representing Kubernetes resources and their ownership/dependency relationships. Typical connections include:

- Deployment → ReplicaSet → Pods
- StatefulSet → Pods
- CronJob → Job → Pods
- Service → Pods (via label selectors)

Each node in the graph is labeled with the resource kind and name. Color coding distinguishes resource types.

## Interacting with the Graph

- **Pan** — Click and drag on the background to move around the graph.
- **Zoom** — Scroll to zoom in and out. Use the zoom controls in the corner.
- **Select** — Click a node to highlight it and its connections.
- **Fit to screen** — Use the fit button to center and resize the graph to show all nodes.

## Use Cases

- Understand how a Deployment relates to its ReplicaSets and Pods at a glance.
- Identify orphaned resources that have no owner.
- Audit a namespace's overall resource structure before making changes.
