# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [v0.14.0-alpha] - 2026-07-26

### Added
- **In-app updater** — the "Update available" pill in the title bar now opens an updater dialog instead of sending you to the website. It downloads the new version with a progress bar, verifies it against the checksum published alongside the release, installs it, and restarts the app. On Linux the package is installed through the system package manager, so you are asked for your password once; on Windows and macOS the installer handles it. Where an automatic update is not possible the dialog explains why and still offers the downloads page.
- **Cancelable download** — the download step can be stopped and the dialog closed at any point. Once installation has begun it is left to finish, so a package manager transaction is never interrupted half-way.

### Changed
- **Releases now publish a checksum for every artifact** — each deb, rpm, installer and dmg is uploaded alongside a `.sha256` file, which the updater checks before installing anything.

---

## [v0.13.0-alpha] - 2026-07-25

### Added
- **Pod age and last restart** — the Pods screen gained two columns: **Age** (kubectl-style relative time since creation) and **Last Restart** (when a container in the pod last restarted, highlighted when it has). Hovering either shows the exact local timestamp. Last-restart time is read from the container's last termination state, falling back to the current container's start time when the kubelet has already dropped that state. Both columns are also in the CLI's pod list, using the same formatting so the desktop app and terminal UI agree.
- **Middle-click to close a tab** — clicking a workspace tab with the middle mouse button closes it. The close fires on release over the tab, so pressing and dragging away leaves the tab open.

### Fixed
- **Resource tables now follow their panel's height** — table rows stayed pinned to the size a panel had when it first opened, so resizing or maximizing a tab left empty space below the rows. The virtual scroller no longer latches its initial height, and the row count now follows the panel as it resizes.
- **Wheel-scrolling the tab strip** — with many tabs open, scrolling over the tab bar did nothing. The global smooth-scroll behaviour was cancelling dockview's own scrolling mid-flight; the tab strip is now excluded from it and scrolls normally again.

---

## [v0.12.0-alpha] - 2026-07-19

### Added
- **Multi-window panel management** — improved transfer and docking flows so panels can be moved more smoothly between windows and instances.

### Changed
- **Electron dev experience** — refined the Electron development workflow with improved backend/shell integration, RPC handling, and startup behavior for local development.
- **Window/tab UX** — updated the title bar, transfer menu, and dockview tab behavior for better multi-window interactions.
---

## [v0.11.0-alpha] - 2026-07-19

### Breaking
- **macOS is now Apple Silicon only.** The previous universal build supported Intel Macs; this release ships an `arm64` dmg. Intel users should stay on v0.10.0-alpha or use the [CLI](https://kubeinspector.com/cli/), which is still universal.
- **Linux install path changed** — the app now lives in `/opt/kube-inspector` with a `/usr/bin/kube-inspector` symlink, instead of a single binary in `/usr/local/bin`. Package managers handle this on upgrade.

### Changed
- **The desktop app now ships with an embedded Chromium (Electron) instead of the system webview.** On Linux this removes the `libwebkit2gtk` dependency entirely: the packages declare **no dependencies at all**, and a single build now works on every distribution. The previous per-distro packages (`ubuntu-22.04` / `ubuntu-24.04`, `rhel9` / `rhel10`, split only because of the webkit2gtk 4.0-vs-4.1 divide) are replaced by one `linux-amd64` deb and one `linux-x86_64` rpm. Rendering is now identical on Linux, Windows and macOS, and Chrome DevTools is available.
- **Package size** — roughly 180MB (was ~90MB), about 523MB installed. Most of that is the bundled Chromium plus the built-in Trivy vulnerability scanner.

### Added
- **Terminal-only mode is unaffected** — `kube-inspector-cli` continues to ship as a separate, webview-free package with no new dependencies.

### Internal
- The controller layer is now **shell-agnostic**: everything Wails-specific sits behind a `Transport` interface, and a loopback HTTP/WebSocket RPC server exposes the same API to any shell. The Go backend runs as a sidecar process that the shell launches; all Kubernetes work, event streaming and the embedded frontend are unchanged.
- The Wails shell remains available for development (`make dev`, `make build`) but is no longer packaged or released.

---

## [v0.10.0-alpha] - 2026-07-13

### Added
- **Overview screen** — a new default workspace tab gives an at-a-glance summary of the cluster when a panel first opens, sharing the usage helpers (`lib/usage.tsx`) with the Monitoring dashboard.
- **Multi-pod exec** — the Pods screen can now open an exec/shell session across multiple selected pods at once.
- **Pod container status column** — the Pods table now surfaces per-container status, backed by new fields on `PodInfo` and the pod service layer.

### Changed
- **Events & resource list scrolling** — smoother scroll behavior in the Events screen and the shared `ResourceListView`.

### Fixed
- **Build fixes** — resolved build issues.

---

## [v0.9.0-alpha] - 2026-07-12

### Added
- **Custom Resource Definitions (CRDs) screen** — a new workspace view lists the cluster's CRDs and row-expands to each CRD's live instances. Any object (a CRD or a custom-resource instance) can be viewed, edited, deleted, or described generically by (group, resource, namespace, name) through the dynamic client — the same generic path the Security Role Map and TUI describe reuse.
- **Kubernetes YAML IntelliSense** — the YAML editor and Apply-YAML panels now share a Kubernetes-aware completion/validation helper (`k8sYamlIntellisense`) for smarter editing.
- **CLI / TUI additions** — the terminal UI gained CRDs, an apply-YAML (empty editor) window, Resource Quotas, and a Monitoring screen, further closing the gap with the desktop app.

### Changed
- **Resource list filtering** — refined DataTable filter behavior across the shared resource list views.
- **Sidebar cluster-management navigation** — repositioned so the managed-cluster nav sits correctly.

---

## [v0.8.1-alpha] - 2026-07-05

### Changed
- **Unified resource list views** — all ~21 table-based resource screens (pods, deployments, services, configmaps, secrets, RBAC, storage, networking, …) were rebuilt on a shared `ResourceListView` component and `useResourceList` hook. Filtering, polling (paused while a tab is backgrounded), multi-select delete, and toasts now behave identically across every screen, and ~2,600 lines of duplicated table code were removed.
- **Website refresh** — styling and home page refinements on the documentation site.

---

## [v0.8.0-alpha] - 2026-06-28

### Added
- **Inspect window in CLI** — a new inspect/detail view was added to the CLI screen so users can inspect selected resources more conveniently.

### Changed
- **CLI/TUI build size optimization** — the terminal-only build now excludes Trivy and desktop/Wails-specific code paths, resulting in a much smaller standalone binary.
- **Release packaging improvements** — production builds now strip debug symbols and avoid VCS metadata in the binary, which reduces artifact size for distribution.

### Fixed
- **Large standalone CLI binary** — the `kube-inspector-cli` artifact is now built with lighter defaults so it is more practical to ship and install.

---

## [v0.7.0-alpha] - 2026-06-28

### Added
- **Terminal UI (TUI)** — a new `tview`-based terminal interface that mirrors the desktop app (resource menu, tables, cluster add/select/delete, YAML view/edit, delete, pod logs and exec) on a single focused screen. It reuses the same `internal/business` functions as the GUI, so no new service endpoints were added. Ships two ways:
  - **Standalone CLI** — a separate, webview-free `kube-inspector-cli` binary (`cmd/tui`) with its own packages (`make build-tui*`, `make pkg-tui-deb`/`pkg-tui-rpm`). No `libwebkit2gtk` dependency.
  - **CLI Mode in the GUI** — an **Open ▸ CLI Mode** action opens a fullscreen terminal (xterm.js) running the TUI over the dockview/menu (which stay mounted underneath). The GUI re-execs itself with `--tui` in a pty; quitting the TUI restores the desktop UI.
- Cross-platform, k9s-style single-key shortcuts (`/` filter, `r` refresh, `y` yaml, `e` edit, `d` delete, `l` logs, `s` shell, `c` cluster, `?` help) shown as hints in the top bar.

### Changed
- **Release artifact names** — the desktop binary/installers are now published as `kube-inspector-*` (was `kube-ins-*`) and the CLI as `kube-inspector-cli-*`.

---

## [v0.6.4-alpha] - 2026-06-27

### Added
- **Vulnerability detail view** — clicking a CVE in the **Vulnerability Scan** screen now opens a detail panel with the full description, published date, fixed version, and external reference links; the underlying scan model was extended with `description`, `references`, and `publishedDate` (and richer fields for Kubernetes misconfiguration findings).

### Changed
- **Workspace layout** — the standalone cluster bar was removed; cluster selection now lives inside the sidebar and the **sidebar toggle moved into the title bar**, giving a cleaner, more compact top area.

---

## [v0.6.3-alpha] - 2026-06-27

### Added
- **AI Assistant improvements** — Ollama-backed chat experience with model discovery, pull flow, and cluster-aware tool actions.
- **Security scanning enhancements** — expanded Trivy-based image and cluster scan workflow with richer result handling.

### Changed
- **Security UI** — Trivy scanner view and scan result models were refined for clearer vulnerability reporting.
- **App experience** — theme handling, title bar interactions, and related UI polish were improved across the desktop experience.

## [v0.6.2-alpha] - 2026-06-18

### Changed
- **Monitoring** — selectable chart **time window** (5 min – 2 hours) with a time-based axis and easier hover tooltips; an animated **Pods / Workloads** switch; **Take snapshot** now uses a native Save dialog (reliable across Linux/macOS/Windows).

---

## [v0.6.0-alpha] - 2026-06-17

### Added
- **Monitoring dashboard** — new **Monitoring** screen under the Cluster menu with live cluster, node, pod, and workload CPU/memory usage charts, rolling time-series history, and filterable resource tables.
- **Dashboard snapshot export** — save the Monitoring panel as a PNG snapshot for reporting or sharing.
- **Update availability** — title bar now checks for newer releases and displays an update prompt with a download link.

### Changed
- **Cluster metrics collection** — improved monitoring by combining metrics-server data with Kubernetes objects for richer live resource usage reporting.

---

## [v0.5.9-alpha] - 2026-06-15

### Changed
- **Dropped remaining GitHub references** — removed the GitHub Releases / repository links from the README and the installation docs, and pointed the Linux package `homepage` to `https://kubeinspector.com`.

---

## [v0.5.8-alpha] - 2026-06-15

### Added
- **Vulnerability scanning (Trivy)** — a new **Vulnerability Scan** screen under the Security menu that integrates the Trivy library directly. Three tabs: a full-cluster scan (every image running across namespaces), a single-image scan, and per-namespace pod images. Results show a severity summary and a filterable, sortable table of CVEs (linked to cve.org), grouped by image.
- **Release distribution (Cloudflare R2)** — release artifacts are published to an R2 bucket under `/dist`.

### Changed
- **Rebranded to "Kube Inspector"** — all user-facing names (window title, title bar, About dialog, documentation) now read *Kube Inspector*. Internal identifiers (the `kube-ins` module/binary/package names and the `~/.kube-ins` config directory) are unchanged.
- **Cluster manager** — reworked the add/manage cluster modal.
- **Build toolchain** — the Trivy library pulls in `encoding/json/v2`, so the build now sets `GOEXPERIMENT=jsonv2` (exported by the Makefile) and CI builds with Go 1.26.

---

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
