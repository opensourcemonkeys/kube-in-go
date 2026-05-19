# Changelog

All notable changes to this project will be documented in this file.

## [v0.1.0-alpha] - 2026-05-19

### Added

#### Workloads
- **Pods** — list, delete, YAML view, log streaming
- **Deployments** — list, scale, delete, YAML view/edit, log streaming
- **StatefulSets** — list, delete, YAML view/edit, log streaming
- **ReplicaSets** — list, delete, YAML view/edit, log streaming
- **DaemonSets** — list, delete, YAML view/edit, log streaming
- **Jobs** — list, delete, YAML view (read-only), log streaming
- **CronJobs** — list, suspend/resume, delete, YAML view/edit, log streaming

#### Cluster Management
- Multi-cluster support — add, edit, and switch between clusters
- Cluster connection health check (polls every 20 seconds)
- Cluster resource graph visualization (ReactFlow)
- kubeconfig stored per-cluster under `~/.kube-ins/`

#### Networking
- **Network Policies** — list, YAML view, visual policy diagram (ingress/egress rules)

#### Workspace
- **YAML Editor** — apply arbitrary YAML to the active cluster (Monaco editor)
- **Terminal** — integrated kubectl terminal (xterm.js + pty)
- **Log Viewer** — real-time pod log streaming with pod selector for workload-level views

#### UI / UX
- Dockview resizable panel layout — drag, split, and dock panels freely
- PrimeReact Lara Dark theme with monolith overrides
- VSCode-style sharp corners (zero border-radius) on modals, buttons, inputs
- DataTable column resizing with visible resize handles
- Sidebar navigation grouped by resource category
- Dark monolith CSS theme with custom color palette

#### CI/CD
- GitHub Actions multi-platform build matrix (Linux amd64, Windows amd64, macOS universal)
- Automatic GitHub Release creation and artifact upload on tag push
