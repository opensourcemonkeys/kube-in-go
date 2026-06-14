# Changelog

All notable changes to this project will be documented in this file.
## [v0.5.5-alpha] - 2026-06-14

### Fixed
- **CI / Packaging (Ubuntu 24.04)** — the Ubuntu 24.04 build now passes `WAILS_TAGS=webkit2_41` so Wails compiles against `webkit2gtk-4.1`. Previously the build failed because Ubuntu 24.04 no longer ships `webkit2gtk-4.0`, which Wails links against by default.

---

## [v0.5.4-alpha] - 2026-06-14

### Changed
- **CI / Packaging** — linux artifact build adjusted for latest distributions; artifact filenames now include distro markers.

---

## [v0.5.3-alpha] - 2026-06-14

### Added
- **Security graph** — added a dedicated security graph view to visualize role and policy relationships.
- **Events screen state persistence** — proof-of-concept state storage using Zustand for the events screen.

### Changed
- **Security role mapping improvements** — enhanced role mapping handling for more accurate security rule display.
- **React Flow optimization** — improved React Flow performance and rendering efficiency.

---
## [v0.5.1-alpha] - 2026-06-13

### Fixed
- **CI E2E pipeline** — the frontend is now built before launching `wails dev` so the `//go:embed all:frontend/dist` directive resolves on a clean checkout (`dist/` is gitignored). Previously the dev server failed to compile, never came up, and the readiness check hung.
- E2E readiness check now fails fast and prints the dev log when `wails dev` exits early, instead of waiting out the full timeout.

---

## [v0.5.0-alpha] - 2026-06-13

### Added

#### Config & Security (RBAC)
- **Service Accounts** — DataTable with namespace and secret/token columns; read-only YAML view; new model, service and business layers
- **Roles** — namespaced DataTable with rule summary; YAML view/edit via a dedicated `RoleEditorPanel`
- **Role Bindings** — DataTable showing role reference and subjects; YAML view/edit via `RoleBindingEditorPanel`

#### Multi-Instance Management
- **Instance discovery & panel transfer** over a WebSocket IPC hub (`localhost:34200`); the first kube-ins process becomes the hub server, later processes connect as clients, and the hub auto-reassigns when the server exits
- **Transfer a tab to another instance** — right-click any tab to send the panel to another running instance via `InstancePickerMenu`; `terminal` and `podExec` panels are non-transferable
- Instances are auto-named in connection order ("Instance 1", "Instance 2", …) and shown in the title bar
- New `InstanceContext`, `TabInstanceBridge` and a custom `FloatableTab` tab header

#### Per-tab Cluster Isolation
- Each panel is now pinned to the cluster it was opened with; new `NewK8sClientForCluster` / `NewK8sClientAndConfigForCluster` / `NewMetricsClientForCluster` constructors load the panel's cluster directly, bypassing the global active path
- Panel IDs and tab titles encode the cluster name, so changing the global cluster via the cluster bar no longer affects already-open tabs
- **Cluster bar menu** for per-cluster actions

#### DataTable Filters
- **MultiSelect (dropdown) filters** for string columns (namespace, status, type, …) with `IN` matching and built-in search; numeric columns keep a number input
- **Workload status column** added to workload lists; improved tab insertion order

#### UI
- Switched to **Material Icons** / VSCode icon sets across the app
- Log viewer theming, dropdown theming and oversize hidden-item theme fixes

#### Testing & CI
- **Selenium E2E suite** under `e2e_tests/` (pytest): app smoke flow, navigation across every sidebar item, full YAML CRUD lifecycle, and panel open/load checks (Logs, Exec, Resource Graph); self-contained HTML report with inline failure screenshots; `make test-e2e` target
- **GitHub Actions E2E stages** — on tag, an ephemeral `kind` cluster + `xvfb` + headless Chrome run the suite, and the report is emailed via Gmail SMTP

### Changed
- Controller, business and service layers thread `clusterName` through all resource-fetching functions

### Fixed
- **Apply YAML** now targets the active cluster's kubeconfig (`--kubeconfig`) and surfaces kubectl's error output instead of a bare `exit status 1`

---

## [v0.4.0-alpha] - 2026-05-30

### Added

#### Storage
- **Persistent Volumes** — DataTable showing status, capacity, access modes, reclaim policy, storage class, volume mode and bound claim; read-only YAML view
- **Volume Claims** — DataTable with request/limit columns (instead of generic capacity), status tag, multi-select delete, read-only YAML view
- **Storage Classes** — DataTable with default tag, provisioner, reclaim policy, binding mode; read-only YAML view

#### Networking
- **Ingresses** — DataTable with class, hosts, paths, address and TLS tag; YAML view/edit, delete action
- **Ingress Classes** — cluster-scoped resource; default tag, controller column; read-only YAML view
- **Endpoints** — DataTable with ready/not-ready address counts and port info; read-only YAML view

#### Cluster
- **Events** — DataTable with message truncation (40 chars), warning-only toggle filter, 5 s polling; double-click opens detail modal with full message
- **Limit Ranges** — DataTable with type tags and per-type CPU/memory columns; list button opens full resource table modal; YAML view/edit

#### Pod Exec
- **Exec into pod** — new terminal panel per pod opened via the Exec button in the pod list; uses `kubectl exec`-equivalent SPDY streaming via `k8s.io/client-go/tools/remotecommand`
- Pod list now exposes two action buttons per row: **Logs** (article icon) and **Exec** (terminal icon)
- `containers` field added to `PodInfo` model; exec session defaults to the first container

#### UI
- **Material Icons** (`@mui/icons-material`) added as icon library alongside PrimeIcons; used for pod action buttons
- Menu consolidated to a single source of truth in `menuItems.tsx`; `menu.tsx` no longer duplicates nav item definitions

---

## [v0.3.2-alpha] - 2026-05-30

### Added

#### CI/CD
- **macOS DMG packaging** — new `build/dmg-builder/` node package using `appdmg`; produces `kube-ins-<version>-macos-universal.dmg` under `dist/`
- `build-mac` and `pkg-mac` Makefile targets for local macOS builds and DMG generation
- `build-macos` job added to GitHub Actions pipeline (`macos-latest` runner); runs in parallel with Linux and Windows build jobs
- macOS DMG artifact downloaded and uploaded to GitHub Releases in the release job

---

## [v0.3.1-alpha] - 2026-05-30

### Fixed

#### CI/CD
- Linux package filenames now use `-` instead of `~` as the pre-release separator (`version_schema: none` in nfpm)
- Linux package filenames include platform label: `debian` for `.deb`, `rhel` for `.rpm`
- Windows installer filename includes version and platform: `kube-ins-<version>-windows-amd64.exe`
- NSIS (`makensis`) added to PATH after winget install step to fix "Cannot create installer: makensis not found" error
- GitHub Actions pipeline consolidated: Linux build and packaging merged into a single job

#### Documentation
- Installation guide updated: replaced EOL distro versions (Ubuntu 20.04, Debian 10, Fedora 36/37, openSUSE 15.4/15.5, etc.) with currently supported releases
- Linux dependency install commands corrected: runtime packages used instead of `-dev` packages; WebKitGTK 4.0/4.1 split by distro version
- Windows section updated to reflect NSIS installer workflow instead of plain binary
- Download table updated with current file naming format

---

## [v0.3.0-alpha] - 2026-05-30

### Added

#### Networking
- **Services** — DataTable with namespace filter, port/type tags, YAML view/edit, delete action

#### UI / UX
- **Onboarding Tour** — step-by-step guided tour on first launch covering key panels and actions
- **About Modal** — app version, build info, and repository link accessible from the cluster bar

#### Editor
- **Kubernetes YAML Schema Validation** — Monaco editor validates YAML against the full Kubernetes API schema; inline errors and autocompletion for all resource types

#### CI/CD
- Linux packages (`.deb` and `.rpm`) built with nfpm and published to GitHub Releases
- Windows NSIS installer built with `wails build -nsis` and published to GitHub Releases
- Makefile build targets: `build-linux`, `build-windows`, `pkg-deb`, `pkg-rpm`, `pkg-all`
- GitHub Actions pipeline split into Build & Package stage and Release stage

### Changed
- Dockview panel drag-and-drop uses a custom drag event for more reliable panel reordering
- Node and ResourceQuota screens refactored: leaner component structure, reduced DOM nesting

### Removed
- AI Assistant panel and all related backend endpoints

---

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
