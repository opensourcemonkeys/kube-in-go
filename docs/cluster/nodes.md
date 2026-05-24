# Nodes

The Nodes screen shows all nodes in the cluster as cards. Each card displays the node's health, hardware details, and live CPU/RAM usage.

## Node Card Layout

Each card contains:

- **Node name** with status tag (`Ready` / `NotReady`) and an `Unschedulable` badge when cordoned
- **Metadata** — internal IP, kubelet version, OS image, CPU capacity, memory capacity
- **Usage charts** — horizontal bars showing CPU (millicores) and RAM (MiB) utilization, color-coded:
  - Green — below 60%
  - Amber — 60–80%
  - Red — above 80%

!!! note "Metrics Server"
    CPU and RAM usage charts require the **Metrics Server** to be installed in the cluster. If it is not available, the charts section shows an informational message instead.

## Actions

### Cordon

Marks the node as **unschedulable**. New pods will not be scheduled here. Existing pods continue running. The node card border turns yellow and an `Unschedulable` badge appears.

Use cordon when you want to drain a node gradually or temporarily exclude it from scheduling without evicting existing workloads.

### Uncordon

Removes the unschedulable taint, allowing new pods to be scheduled on the node again.

### Drain

Drain performs two steps:

1. **Cordons** the node (marks it unschedulable)
2. **Evicts** all pods except DaemonSet pods and static mirror pods

A confirmation dialog is shown before drain starts. DaemonSet pods are intentionally left in place because they are managed by DaemonSet controllers and would be immediately rescheduled anyway.

!!! warning
    Draining a node evicts all workloads on it. Ensure the remaining nodes have sufficient capacity to absorb the rescheduled pods before draining.

### Edit YAML

Click the **Edit YAML** button (pencil icon) to open the node manifest in a YAML editor panel. Node-level changes such as labels, annotations, and taints can be applied here.

## Refresh Rate

Node data refreshes every **3 seconds** to keep usage charts current.
