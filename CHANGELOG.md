# Changelog

All notable changes to this project will be documented in this file.

## [v0.2.0-alpha] - 2026-05-24

### Added

#### Cluster
- **Namespaces** — DataTable with multi-select, bulk delete, status tag, double-click YAML view
- **Resource Quotas** — Hierarchical card layout grouped by namespace; per-quota usage bars (green/amber/red), used/hard values, inline YAML edit per quota; namespace filter
- **Nodes** — Custom card layout per node: CPU & RAM usage charts (Chart.js), cordon / uncordon / drain actions, YAML edit

#### Config & Secrets
- **ConfigMaps** — Key-value editor panel in addition to YAML view/edit
- **Secrets** — Key-value editor panel in addition to YAML view/edit

#### AI
- **AI Assistant** — Chat panel powered by configurable LLM; context-aware cluster queries

#### UI / UX
- Unified toolbar style across all resource screens — consistent `h3` title, padding, and bottom border
- All DataTable screens moved to standalone toolbar div (header extracted from PrimeReact DataTable)

### Changed
- Node screen header cleaned up; redundant "Updates every 3 seconds" annotation removed
- Various SonarQube code-quality and accessibility fixes

---

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
