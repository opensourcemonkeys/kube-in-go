# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**kube-ins** is a desktop application for managing Kubernetes clusters with a visual interface. It's built using:
- **Backend**: Go with Wails v2 (desktop app framework)
- **Frontend**: React 18 + TypeScript with Vite, using PrimeReact + MUI components and Dockview for a resizable panel layout
- **Kubernetes Integration**: Uses `k8s.io/client-go` to interact with Kubernetes clusters

The app provides a unified interface to visualize and manage Kubernetes resources (pods, deployments, network policies, etc.) across multiple cluster configurations.

## Architecture

### Backend Architecture (Go)

The backend follows a layered architecture with clear separation of concerns:

```
main.go
└── controller/
    ├── app.go (Wails binding point, holds context + InstanceHub)
    └── functionBuilder.go (Exposes Go functions to frontend via Wails)
        ├── business/
        │   ├── pod.go, deployment.go, networkPolicy.go, cluster.go, terminal.go, log.go, etc.
        │   └── applyYaml.go, clusterResource.go
        ├── services/
        │   └── *Services.go (handles Kubernetes client logic and YAML operations)
        ├── repository/
        │   └── k8sClient.go (abstracts kubeconfig loading and k8s.io/client-go initialization)
        └── ipc/
            ├── hub.go (WebSocket hub for multi-instance discovery and panel transfer)
            └── messages.go (message types: MsgRegister, MsgInstanceList, MsgTransferTab)
models/
└── *Info.go (data structures for frontend serialization)
└── instanceModels.go (InstanceInfo, SerializedPanel — used by IPC system)
```

**Layer Responsibilities**:

1. **Controller** (`internal/controller/`): Entry point for Wails bindings. The `App` struct holds the `context.Context` and an `*ipc.InstanceHub`. `functionBuilder.go` exposes all callable methods to the frontend via Wails RPC, including `GetInstances()`, `GetSelfInstanceInfo()`, and `TransferTab()`.

2. **Business** (`internal/business/`): Orchestration layer that coordinates repository and service calls. Also manages app state like active cluster selection (persisted to `~/.kube-ins/.active` file).

3. **Services** (`internal/services/`): Direct Kubernetes API interactions. Takes a `kubernetes.Clientset` as a parameter (not a global). Examples: `GetPods()`, `DeletePod()`, `GetPodYaml()`, `GetClusterGraph()`.

> The backend has grown to cover most core Kubernetes resources — each has a parallel `business/<kind>.go`, `services/<kind>Services.go`, and `models/<kind>Info.go` triple (pods, deployments, daemonsets, statefulsets, jobs, cronjobs, services, endpoints, ingresses, configmaps, secrets, RBAC roles/bindings/service accounts, PVs/PVCs, storage classes, namespaces, nodes, events, quotas, limit ranges, etc.). The `securityGraph` feature (`business/securityGraph.go` → `services/securityGraphServices.go` → `models/securityGraphInfo.go`, surfaced by `components/security/SecurityRoleMap.tsx`) builds an RBAC subject→role→resource graph and needs both client and rest config (`NewK8sClientAndConfigForCluster`). The `trivy` vulnerability scanner (`business/trivy.go` → `services/trivyServices.go` → `models/trivyScanInfo.go`, surfaced by `components/security/TrivyScanner.tsx`) is different: instead of calling the k8s API it imports the **Trivy library directly** (`github.com/aquasecurity/trivy`). `services.ScanImage` hand-builds a `flag.Options` and runs `artifact.NewRunner(...).ScanImage(...)`; several non-obvious defaults are mandatory (`PackageOptions.PkgTypes`, `VulnSeveritySources: "auto"`, and the blank import `_ "modernc.org/sqlite"` for the Java/RPM DB) or scans silently return nothing. The cluster scan is implemented as the frontend listing all pod images (`TrivyListPodImages`) and scanning each via `TrivyScanImage` — there is no `trivy k8s` misconfig scan. Follow the existing triples when adding a resource — see "Adding a New Resource Type" below.

> Four features go beyond the per-resource triples:
> - **Live resource Monitoring** (`business/metrics.go` → `services/metricsServices.go` → `models/metricsInfo.go`, surfaced by `components/monitoring/main.tsx`). `GetMetricsSnapshot(clusterName)` returns one point-in-time `MetricsSnapshot` (cluster totals, nodes, pods, workloads) from metrics-server; pods carry per-container usage and a resolved top-level owner (ReplicaSet→Deployment) so the dashboard can drill down. metrics-server is point-in-time only, so trend charts are built **client-side**: the dashboard polls every ~4s and keeps a rolling time-series in `stores/metricsStore.ts` (in-memory, **not** persisted — contrast with `eventsStore`). Charts use PrimeReact's `Chart` (chart.js) with a linear time x-axis.
> - **In-app update check** (`business/update.go` → `models/UpdateInfo`, `App.CheckForUpdate`): fetches `https://kubeinspector.com/version.json` and compares with `appVersion` via `golang.org/x/mod/semver`; the title bar shows an "Update available" pill linking to the downloads page. The manifest is generated from the git tag by the Makefile `docs-downloads` target and published with the site.
> - **Window screenshot** (`App.SaveSnapshot` → `business/snapshot.go` → `services/snapshotServices.go`): the frontend renders a panel to a PNG via `html-to-image`, then the controller opens a native `runtime.SaveFileDialog` and the service writes the file (webview `a[download]` is unreliable in WebKitGTK).
> - **AI assistant** (`internal/ai/` + `business/ai.go`, surfaced by `components/ai/AiChat.tsx`): a local-LLM chat agent backed by **Ollama** (`github.com/ollama/ollama/api`), default host `http://localhost:11434`. Not a per-resource triple — see the dedicated section below.

4. **Repository** (`internal/repository/`): Abstracts kubeconfig loading. Provides six constructors in two families:
   - `NewK8sClient()` / `NewK8sClientAndConfig()` / `NewMetricsClient()` — read the global active kubeconfig path (set via `SetActiveKubeconfig()`). Still used by cluster-management functions that don't have a per-tab cluster.
   - `NewK8sClientForCluster(clusterName)` / `NewK8sClientAndConfigForCluster(clusterName)` / `NewMetricsClientForCluster(clusterName)` — load `~/.kube-ins/{clusterName}.yaml` directly, **bypassing the global active path**. Used by all resource-fetching business functions so each panel stays pinned to its cluster regardless of which cluster the user has globally selected. Falls back to `NewK8sClient()` when `clusterName == ""`.

5. **Models** (`internal/models/`): Struct definitions for frontend serialization (e.g., `PodInfo`, `DeploymentInfo`). These are marshaled to JSON by Wails.

6. **IPC** (`internal/ipc/`): Multi-instance discovery and panel transfer over WebSocket. The first kube-ins process binds `localhost:34200` and becomes the hub server; subsequent processes connect as clients. The hub auto-reassigns when the server exits. Exposes `GetInstances()`, `GetSelfInfo()`, `TransferTab()` on `InstanceHub`.

7. **AI** (`internal/ai/`): The Ollama-backed assistant agent loop, kept separate from the per-resource layers. `agent.go` runs the chat↔tool loop (`RunChat`); `registry.go`/`models.go` handle model discovery, capability detection, and pulls; `client.go` wraps the Ollama API client; `tools.go` defines the `Tool` type. The **tool registry** (the list of cluster actions the model may call) lives in `business/ai.go::aiTools()` — each tool's `Run` closure delegates to the same `business.GetPods`/`DeletePod`/`ApplyYaml`/etc. functions the UI uses, so the assistant is pinned to the active cluster the same way panels are. See "AI Assistant" below.

8. **TUI** (`internal/tui/`): A `tview`/`tcell` terminal UI that is an alternative front end to the **same `internal/business` functions** — it imports no Wails and adds no service endpoints. `Run(ctx, version)` (`run.go`) drives a `tview.Pages` stack (cluster screen → resource menu → generic list → yaml/logs/exec overlays); only one primary screen is visible at a time (no dockview/split). `registry.go` is the data-driven core: each resource `view` maps via a `resourceDef` to its `business.GetX`/`GetXYaml`/`UpdateXYaml`/`DeleteX` functions (+ extra `rowAction`s like node cordon/drain) — add a resource by appending one entry. Logs use `business.StartLogStream` with a `QueueUpdateDraw` callback; exec uses `app.Suspend()` to hand the raw tty to `business.CreatePodExecSession` (tview has no embedded terminal emulator), disconnect with **Ctrl-]**. Keybindings (`keys.go`) are cross-platform-safe single letters (k9s-style), shown top-right by the status bar. See "TUI / CLI Mode" below.

**Key Patterns**:
- Business functions call repository constructors each time (not singletons).
- All resource-fetching business functions take `clusterName string` as their first parameter and call `NewK8sClientForCluster(clusterName)` so that each panel is pinned to the cluster it was opened with. The controller passes `clusterName` through from the frontend call.
- `clusterName` flows: Dockview panel params → frontend component → Wails call → controller function → business function → `NewK8sClientForCluster(clusterName)` → service function.

### Frontend Architecture (React)

```
frontend/src/
├── main.tsx (Vite entry point, routes and global setup)
├── pages/
│   └── main/appmain.tsx (main app layout)
├── components/
│   ├── workspace/
│   │   ├── DockviewContainer.tsx (panel manager, routes panel IDs to components)
│   │   ├── FloatableTab.tsx (custom Dockview tab header — right-click to transfer panel)
│   │   ├── TabInstanceBridge.tsx (zero-render bridge: wires InstanceContext → TabContext)
│   │   ├── ViewPanel.tsx, YamlEditorPanel.tsx, ApplyYamlPanel.tsx, etc.
│   ├── transfer/
│   │   └── InstancePickerMenu.tsx (portal context menu for selecting transfer target)
│   ├── pod/, deployment/, networkpolicy/ (resource-specific views)
│   ├── terminal/ (xterm.js wrapper)
│   ├── logs/ (react-logviewer wrapper)
│   ├── cluster/ (cluster selection UI)
│   └── menu/ (sidebar navigation)
├── contexts/
│   ├── ClusterContext.tsx (manages cluster list, active cluster, connection health checks)
│   ├── TabContext.tsx (manages dockview panel lifecycle and routing)
│   └── InstanceContext.tsx (multi-instance discovery, panel transfer via IPC hub)
└── lib/ (Monaco editor theme, utilities)
```

**State Management**:
- **ClusterContext**: Loaded on app startup, persists active cluster selection. Polls `CheckClusterConnection()` every 20 seconds.
- **TabContext**: Manages Dockview API for opening/closing panels. Each resource type (pods, deployments, etc.) opens as a panel.
- **InstanceContext**: Polls `GetInstances()` every 3 seconds. Listens for `tab:received` Wails event and calls the registered `onPanelReceived` callback. `TabInstanceBridge` wires this to `TabContext.openReceivedPanel`.
- **Zustand stores** (`frontend/src/stores/`): React Context holds app-wide state; per-tab view state that must survive a tab close/reopen uses Zustand instead. `eventsStore.ts` is the reference example — a `persist`-middleware store keyed by `events:${clusterName}` so each cluster's Events tab keeps its rows, filters, and toggles across app restarts (persisted to the Wails webview's localStorage). New persistent per-tab state should follow this keyed-by-panel-id pattern rather than living in component `useState`. `metricsStore.ts` is the non-persisted counterpart — a plain (no `persist`) store, also keyed by cluster, holding the Monitoring dashboard's rolling time-series in memory only (ephemeral data that should reset on restart). `aiChatStore.ts` (persisted) holds the assistant's open/host/model/messages; `themeStore.ts` (persisted) holds the selected theme.

**UI Framework**:
- **Dockview** (v6): Resizable, draggable panel layout. Components are registered in `DockviewContainer.tsx` and instantiated by panel type string.
- **PrimeReact**: DataTable, Dialogs, Tags, Buttons, etc. Built on the `lara-dark-cyan` theme, but heavily re-skinned by `frontend/src/theme-monolith.css` — a single global stylesheet imported last in `main.tsx` that overrides `.p-*` selectors using the app's `--app/--panel/--ink/--teal/...` CSS variables (defined in its `:root`). **Style new PrimeReact components by adding global `.p-*` overrides to this file rather than per-component CSS**; match the Dockview tab look via the `.dockview-theme-monolith` rules in the same file.
- **Themes**: `theme-monolith.css` also defines alternate palettes (`last-samurai`, `god-of-war`, `hello-kitty`) as `html[data-theme="..."]` blocks that only re-bind the same `--app/--panel/--ink/...` variables — so every `.p-*` override automatically re-skins. The default `monolith` palette lives in bare `:root` (no attribute). `stores/themeStore.ts` (Zustand + `persist`, localStorage key `kube-ins-theme`) toggles the `data-theme` attribute on `<html>` and applies the persisted theme synchronously at module load to avoid a flash. **To add a theme, add an entry to `THEMES` in the store and an `html[data-theme="id"]` variable block in the CSS — do not write per-theme component rules.**
- **MUI** (`@mui/material`): Used alongside PrimeReact for some UI elements.
- **Monaco Editor** (via `@monaco-editor/react`): YAML editing with `monaco-yaml` for schema validation.
- **xterm.js**: Terminal emulation.

**Registered Dockview panel types** (in `DockviewContainer.tsx`):
`view`, `yamlEditor`, `terminal`, `applyYaml`, `logViewer`, `policyViewer`, `clusterResource`, `configMapEditor`, `secretEditor`, `podExec`, `roleEditor`, `roleBindingEditor`, `objectYaml`

`FloatableTab` is registered as `defaultTabComponent` — it replaces the default Dockview tab header for all panels. Right-clicking a tab (when other instances are connected) shows `InstancePickerMenu` to transfer the panel. Panels whose component type is `terminal` or `podExec` are non-transferable.

**Event Streaming**: The frontend listens to Wails events for real-time updates:
- `terminal:output:${id}` for terminal output
- `log:output:${sessionId}` for pod logs
- `tab:received` for incoming panel transfers from other instances (payload: `SerializedPanel`)

These are emitted from backend functions via `runtime.EventsEmit()` in the controller.

### Per-tab Cluster Isolation

Each panel is frozen to the cluster it was opened with:
- **Panel ID scheme**: View panels use `${view}:${clusterName}` (e.g., `pods:my-cluster`). Sub-panels use the cluster name in their ID too (e.g., `yaml:pod:my-cluster:ns/name`).
- **Tab title**: `${label} • ${clusterName}` (e.g., `Pods • my-cluster`).
- **`clusterName` stored in Dockview `params`**: All panel components destructure `clusterName` from `params` and pass it to every API call. Changing the global cluster via `ClusterBar` does not affect existing open tabs.
- **`referencePanel`**: When opening sub-panels from a list view, `referencePanel` is the view panel ID (`pods:my-cluster`). `TabContext.openYamlPanel` extracts the view key via `def.referencePanel.split(':')[0]` to build the title.

### AI Assistant (Ollama)

The assistant is a tool-calling agent over a **local Ollama** server (default `http://localhost:11434`; the frontend gates everything on `AiAvailable(host)`). It is not part of the per-resource triple convention.

- **Agent loop** (`internal/ai/agent.go::RunChat`): a non-streaming-per-turn chat↔tool loop, capped at `maxIterations` (8) round-trips. Each turn it inspects the whole assistant message, runs any tool calls, feeds results back, and repeats until the model replies with no tool calls (the final answer).
- **Two tool-calling modes**: `business/ai.go` picks the mode from `ai.SupportsTools(host, model)` (queries the model's `tools` capability via Ollama `Show`). Native-capable models use Ollama's `tool_calls` field; others get the tools described in the system prompt (`ai.ToolSpec`) and their JSON-text replies are parsed by `parseTextToolCalls` — **raw tool-call JSON is never surfaced to the user**. Tool results go back as a `tool`-role message (native) or a `TOOL RESULT (...)` user message (prompt mode).
- **Tool registry** (`business/ai.go::aiTools()`): the single source of truth for what the model can do. Read tools (`list_pods`, `list_deployments`, `list_events`, `get_*_yaml`, `get_pod_logs`) run immediately; **mutating** tools (`delete_pod`, `delete_deployment`, `apply_yaml`, `update_deployment_yaml`) carry `Mutating: true` and are gated behind user confirmation in the agent loop. Each `Run` closure delegates to the existing `business.*` functions, so tools are pinned to the active `clusterName`. Add a tool by appending an `ai.Tool` here — no controller/binding change needed.
- **Controller streaming** (`functionBuilder.go`, "AI Assistant" section): `StartAiChat(sessionId, …)` runs the loop in a goroutine and pushes everything to the frontend as Wails events suffixed with the session ID: `ai:token:${id}` (assistant prose), `ai:tool:${id}` (a `ToolEvent` activity line), `ai:confirm:${id}` (a mutating-tool approval request — the backend blocks on a channel until the frontend calls the confirm method), `ai:done:${id}`, `ai:error:${id}`. Model downloads stream `ai:pull` / `ai:pull-done` / `ai:pull-error`. Sessions are tracked in `aiSessions` so a new turn or a stop cancels the previous context.
- **Model management**: `ModelCatalog` merges Ollama's experimental recommendations + a `curatedModels` base list + locally-installed models; `ModelTags` hits the Ollama OCI registry (`registry.ollama.ai`) directly — including the anonymous bearer-token handshake — to list size/quant variants. `PullAiModel` streams download progress.

### Cluster Configuration

Clusters are stored as YAML files in `~/.kube-ins/` with a `.yaml` extension (e.g., `my-cluster.yaml`). The active cluster is tracked in `~/.kube-ins/.active`. When a cluster is selected via the UI:
1. Backend calls `SetActiveCluster(name)` which calls `SetActiveKubeconfig(path)`.
2. This updates the global active path used by `NewK8sClient()` / `NewK8sClientAndConfig()` / `NewMetricsClient()`.
3. Newly opened panels pass the selected cluster name through `clusterName` and call `NewK8sClientForCluster(clusterName)` directly — so the global path matters only for the cluster-management functions (listing clusters, checking connections, etc.).

## Build & Run

> **`GOEXPERIMENT=jsonv2` is required to compile.** The Trivy scanner library pulls in `encoding/json/v2`, which is gated behind the `jsonv2` GOEXPERIMENT on Go 1.26 (the project is on `go 1.26.3`). The `Makefile` exports it for every target (`export GOEXPERIMENT := jsonv2`) and CI sets it in the workflow `env:`. If you run bare `go build`/`go test`/`wails` outside `make`, prefix with `GOEXPERIMENT=jsonv2` or the build fails with `build constraints exclude all Go files in .../encoding/json/v2`.

### Development

Use `make dev` rather than bare `wails dev` — it injects the app version from the latest git tag via ldflags:

```bash
make dev
```

This starts:
- Vite dev server on `localhost:5173` (frontend hot reload)
- Wails dev server on `localhost:34115` (Go methods accessible from browser devtools)
- Wails app window

**Frontend only** (if Go backend is unchanged):
```bash
cd frontend
npm run dev
```

### Building

```bash
make build           # current platform
make build-linux     # linux/amd64
make build-windows   # windows/amd64 (with NSIS installer)
make build-mac       # darwin/universal
```

Output goes to `build/bin/`.

The Makefile injects the version from git tags: `git describe --tags --abbrev=0` → `kube-ins/internal/business.appVersion`.

**Packaging** (requires `nfpm` on PATH):
```bash
make pkg-deb    # .deb package
make pkg-rpm    # .rpm package
make pkg-mac    # .dmg (runs build/dmg-builder/build.js)
make pkg-all    # all platforms
```

Packages go to `./dist/`.

**Frontend build only**:
```bash
cd frontend
npm run build
```

### Documentation site (MkDocs)

The marketing/docs site lives in `docs/` (MkDocs Material, config `mkdocs.yml`, custom theme overrides in `overrides/` + `docs/stylesheets/extra.css`). Build/preview with the Makefile (needs `pip install mkdocs-material`):
```bash
make docs-serve   # live-reload preview at http://127.0.0.1:8000
make docs-build   # build to ./site (gitignored), --strict
```
`docs-build` first runs `docs-downloads`, which substitutes the git tag into the (git-ignored, generated) `docs/downloads.md` and writes `docs/version.json` (consumed by the in-app update check). On a git **tag** push, the `deploy-docs` job in `.github/workflows/build.yml` builds the site and `aws s3 sync`s it to the Cloudflare R2 bucket root, while `upload-r2` publishes the release artifacts under `/dist` on the same bucket (served at `kubeinspector.com`). Both R2 jobs need the `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` secrets and the `R2_BUCKET` variable.

## Key Dependencies

**Backend (Go)**:
- `wailsapp/wails/v2`: Desktop app framework, handles Go-to-JS RPC and event emission
- `k8s.io/client-go`: Kubernetes API client
- `k8s.io/metrics`: Metrics API client for node/pod resource usage
- `k8s.io/apimachinery`: Kubernetes data types
- `creack/pty`: Pseudo-terminal for terminal sessions
- `sigs.k8s.io/yaml`: YAML marshaling
- `gorilla/websocket`: WebSocket server/client used by the IPC hub
- `google/uuid`: Unique instance IDs for the IPC hub
- `github.com/aquasecurity/trivy`: Vulnerability scanner, imported as a library (pulls in `encoding/json/v2` → needs `GOEXPERIMENT=jsonv2`)
- `golang.org/x/mod/semver`: Semantic-version compare for the in-app update check
- `github.com/ollama/ollama`: Ollama API client for the local-LLM AI assistant (`internal/ai/`)

**Frontend**:
- `react`, `react-dom`, `react-router-dom`: Core framework
- `primereact`, `@mui/material`: Component libraries (both are used)
- `dockview`: Panel layout manager
- `@monaco-editor/react`, `monaco-yaml`: YAML editor with schema validation
- `@xterm/xterm`: Terminal emulation
- `@melloware/react-logviewer`: Log streaming viewer
- `reactflow`: Cluster graph visualization
- `chart.js`: Charts (node metrics, monitoring trends) — used via PrimeReact's `Chart` wrapper
- `zustand`: Per-tab state stores (`stores/`, see Zustand note above)
- `html-to-image`: Renders a panel to PNG for the monitoring "Take snapshot" feature

## Common Tasks

### Adding a New Resource Type (e.g., Services)

1. **Create model** (`internal/models/serviceInfo.go`):
   ```go
   package models
   type ServiceInfo struct {
       Name      string
       Namespace string
       // ... other fields
   }
   ```

2. **Add service layer** (`internal/services/serviceServices.go`):
   ```go
   func GetServices(namespace string, client *kubernetes.Clientset) ([]models.ServiceInfo, error) {
       // Use client.CoreV1().Services(namespace).List()
   }
   ```

3. **Add business layer** (`internal/business/service.go`):
   ```go
   func GetServices(clusterName string) []models.ServiceInfo {
       client, _ := repository.NewK8sClientForCluster(clusterName)
       return services.GetServices("", client)
   }
   ```

4. **Expose in controller** (`internal/controller/functionBuilder.go`):
   ```go
   func (a *App) GetServices(clusterName string) []models.ServiceInfo {
       return business.GetServices(clusterName)
   }
   ```

5. **Create frontend component** (`frontend/src/components/service/main.tsx`):
   - `export default function ServiceListComponent({ clusterName }: { clusterName: string })`
   - Call `GetServices(clusterName)` via Wails bindings
   - Pass `clusterName` to all `openYamlPanel` / `openLogPanel` calls and include it in `referencePanel: \`services:${clusterName}\``

6. **Register in Dockview** (`frontend/src/components/workspace/DockviewContainer.tsx`):
   ```js
   const components = {
       // ...
       services: ServiceComponent,
   };
   ```

7. **Add menu item** (`frontend/src/components/menu/menuItems.tsx`):
   - Add to appropriate category (Workloads, Discovery, etc.)

### Debugging Wails Events

The frontend listens to Wails events. To debug:
```javascript
// In browser console
window.runtime.EventsOn('terminal:output:sessionId', (data) => console.log(data));
```

Backend emits via:
```go
runtime.EventsEmit(a.ctx, "event:name", payload)
```

## TypeScript & Wails Bindings

Wails auto-generates TypeScript definitions from Go structs and exposed methods. Located in `frontend/wailsjs/go/`:
- `controller_app/App.ts`: Generated from `internal/controller/functionBuilder.go`
- `models/`: Generated from `internal/models/`

After modifying Go methods or models, regenerate bindings:
```bash
wails generate bindings
```

## Testing

There are no Go unit tests, but a Selenium + pytest **end-to-end suite** lives in `e2e_tests/` (`test_main_flow.py`, `test_navigation.py`, `test_panels.py`, `test_yaml_crud.py`). It drives the live Wails dev server via Chrome:

```bash
make dev                 # in one terminal (serves http://localhost:34115)
make test-e2e            # in another: installs deps, runs pytest, emits report.html
E2E_HEADLESS=1 make test-e2e   # headless (CI uses xvfb)
```

The CI `e2e` job spins up an ephemeral `kind` cluster, writes its kubeconfig to `~/.kube-ins/ci.yaml`, sets `.active` to `ci`, then runs the suite. Ad-hoc Go tests still follow conventions (`GOEXPERIMENT=jsonv2 go test ./...`); note any test touching the Trivy scanner downloads the vulnerability DB and needs network.

## Code Conventions

1. **Package names**: kebab-case in imports, but use aliases (`controller_app`, `services_k8sclient`)
2. **Error handling**: Business layer logs errors with `fmt.Println()`, returns them as second return value
3. **Concurrency**: Terminal and log streaming use callback functions emitted via Wails events
4. **State**: Cluster selection is the only persistent app state (file-based in `~/.kube-ins/`)

## Known Patterns

- **Callback-based streaming**: Terminal input/output and log streaming use callback functions passed from controller to business layer, which emit results via `runtime.EventsEmit()`
- **Namespace filtering**: Some functions take `namespace=""` to fetch across all namespaces
- **Panel ID scheme**:
  - View panels: `${view}:${clusterName}` → e.g., `pods:my-cluster`
  - YAML panels: `yaml:${kind}:${clusterName}:${namespace}/${name}`
  - Log panels: `log:${kind}:${clusterName}:${namespace}/${name}`
  - Exec panels: `exec:${clusterName}:${namespace}/${name}:${container}`
  - Policy viewer: `policy:${clusterName}:${namespace}/${name}`
- **Error recovery**: Frontend gracefully handles Wails call failures and displays toasts
- **Multi-instance tab transfer**: Right-clicking any tab (except `terminal`/`podExec`) shows a picker to send the panel to another running instance. The sender calls `TransferTab(targetId, SerializedPanel)` on the backend; the hub routes it via WebSocket; the receiver emits `tab:received` which `InstanceContext` delivers to `TabContext.openReceivedPanel`. `TabInstanceBridge` is the glue component that connects the two contexts without prop drilling. Instance names ("Instance 1", "Instance 2", ...) are assigned by the server in connection order and broadcast to all clients.
- **Dockview tab insertion at index**: When opening a sub-panel (YAML, logs, exec, etc.) from within an existing panel, `positionAfter()` in `TabContext` uses `direction: 'within'` + `index: refIndex + 1` to insert the new tab immediately to the right of the source panel within the same group.
- **`FloatableTab` component type detection**: Uses `panelId.startsWith('cluster-resource-view')` (prefix match) rather than exact equality, because cluster resource view IDs encode the cluster name (`cluster-resource-view:${clusterName}`).
- **Module-level body helpers** (e.g., `DaemonSetActionsBody`, `NodeCard`): When a DataTable column body renderer needs `clusterName`, it must be received as an explicit prop — it cannot close over `clusterName` from the parent component since it is defined at module scope.
