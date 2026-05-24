# Workloads

The Workloads section covers all Kubernetes compute resources. Each resource type has its own screen accessible from the sidebar.

## Available Resource Types

| Resource | Sidebar Label | Key Actions |
|---|---|---|
| Pods | Pods | View logs, delete, YAML view |
| Deployments | Deployments | Scale, delete, YAML edit, logs |
| StatefulSets | StatefulSets | Delete, YAML edit, logs |
| ReplicaSets | ReplicaSets | Delete, YAML edit, logs |
| DaemonSets | DaemonSets | Delete, YAML edit, logs |
| Jobs | Jobs | Delete, YAML view (read-only) |
| CronJobs | CronJobs | Suspend/Resume, delete, YAML edit |

## Common Interactions

### Filtering

Every workload screen has a filter row directly in the table. Type in any column's filter field to narrow results. Click the **filter-slash** button in the toolbar to reset all active filters at once.

### Sorting

Click any column header to sort ascending; click again to sort descending.

### YAML View / Edit

Double-click a row to open its YAML in a panel to the right. Most resources allow editing — make changes in the Monaco editor and click **Apply** to push the updated YAML to the cluster. Jobs are read-only.

### Multi-select & Bulk Delete

Click the checkbox column to select one or more rows. With rows selected, click **Delete Selected** in the toolbar. A confirmation dialog lists every resource to be deleted before the operation proceeds.

### Log Streaming

Resources that run pods (Pods, Deployments, StatefulSets, etc.) show a **Logs** button. Clicking it opens the [Log Viewer](../workspace/log-viewer.md) for that resource in a new panel.
