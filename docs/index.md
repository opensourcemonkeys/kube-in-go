# kube-ins

**kube-ins** is a desktop application for managing Kubernetes clusters through a visual interface. It lets you inspect resources, edit configurations, stream logs, and run kubectl commands — all from a single window without switching between terminals and dashboards.

## Key Features

| Category | Features |
|---|---|
| **Workloads** | Pods, Deployments, StatefulSets, ReplicaSets, DaemonSets, Jobs, CronJobs |
| **Cluster** | Namespaces, Nodes (with cordon/drain), Resource Quotas |
| **Networking** | Network Policies with visual diagrams |
| **Config & Secrets** | ConfigMaps and Secrets with key-value editor |
| **Workspace** | YAML editor (Monaco), integrated kubectl terminal, real-time log viewer |
| **Multi-cluster** | Add and switch between multiple kubeconfigs |

## Interface Layout

kube-ins uses a **dockview** panel layout. Panels are resizable and can be dragged, split, and docked freely. The main areas are:

- **Sidebar** (left) — navigation grouped by resource category
- **Main panel area** — resource lists, YAML editors, terminals, and log viewers open here as tabs
- **Cluster bar** (top) — shows the active cluster and connection status

## Quick Navigation

- [Install kube-ins](getting-started/installation.md)
- [Add your first cluster](getting-started/cluster-setup.md)
- [Manage workloads](workloads/index.md)
