# Graph Report - kube-in-go  (2026-08-08)

## Corpus Check
- 316 files · ~452,801 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2357 nodes · 3725 edges · 221 communities (163 shown, 58 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 357 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `73623cb1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Wails Controller Bindings
- Cluster & CRD Business Layer
- AI Assistant Agent Loop
- RPC Shell Transport Server
- Trivy Vulnerability Scanning
- App Bootstrap & IPC Hub
- YAML Editor & Policy Panels
- Trivy Scanner Frontend
- CI Pipeline & Changelog Docs
- Monitoring & Overview Dashboards
- MkDocs Build Hooks
- TUI Describe & Metrics Render
- Network Policy Stack
- E2E DataTable Helpers
- Resource List Components
- Cluster Resource Graph
- RBAC Security Graph
- E2E Panel Tests
- Frontend TypeScript Config
- Pod & Metrics Services
- Tab Context & ConfigMaps
- CRD List & Shared List View
- TUI Application Shell
- Workload & Security Docs
- Electron Package Manifest
- Log Streaming Business Layer
- Node Services & Cordon/Drain
- E2E Navigation Tests
- Frontend Dependencies
- Log Services Layer
- RoleBinding Stack
- Role Stack
- E2E YAML CRUD Helpers
- Electron Main Process
- Events View & Store
- Multi-Instance Tab Transfer
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Incremental --update Flow
- Community 126
- Community 127
- Community 128
- @fontsource/jetbrains-mono
- Community 130
- Community 131
- ModelTags
- limitRange.go
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- messages.go
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 148
- open_resource_graph
- Community 150
- LogViewerPanel.tsx
- Community 153
- Community 156
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- @fontsource/jetbrains-mono
- Community 165
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- GetIngressClasses
- @dagrejs/dagre
- Community 177
- Community 178
- Community 179
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 186
- Community 187
- main.tsx
- Community 193
- Community 194
- Community 195
- Community 196
- Community 197
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
- Community 212
- dockview
- @fontsource/geist
- monaco-yaml
- @xterm/addon-fit
- yaml
- dockview-react
- @melloware/react-logviewer
- motion
- primeflex
- primereact
- react

## God Nodes (most connected - your core abstractions)
1. `App` - 155 edges
2. `NewK8sClientForCluster()` - 108 edges
3. `useTabContext()` - 67 edges
4. `toApplyYaml()` - 26 edges
5. `Kube Inspector: ALPHA → BETA Planı` - 24 edges
6. `Server` - 21 edges
7. `App` - 21 edges
8. `InstanceHub` - 20 edges
9. `shell()` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `kubeinsdev Build Tag Relaxations` --semantically_similar_to--> `No API Key Required Policy`  [AMBIGUOUS] [semantically similar]
  CLAUDE.md → .claude/skills/graphify/SKILL.md
- `Semantic Extraction Cache` --semantically_similar_to--> `frontend/dist/.gitkeep Embed Bootstrap Cycle`  [INFERRED] [semantically similar]
  .claude/skills/graphify/SKILL.md → CLAUDE.md
- `main()` --calls--> `Run()`  [INFERRED]
  cmd/tui/main.go → internal/tui/run.go
- `main()` --calls--> `NewApp()`  [INFERRED]
  main.go → internal/controller/app.go
- `serve()` --calls--> `NewServer()`  [INFERRED]
  main.go → internal/controller/rpcserver.go

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI Build/Package/Publish Flow** — _github_workflows_build_pipeline, _github_workflows_build_goexperiment_jsonv2, _github_workflows_build_cloudflare_r2, _github_workflows_build_nfpm_packaging, _github_workflows_build_deploy_docs [EXTRACTED 0.90]
- **Shell-agnostic Electron Migration** — changelog_electron_shell, changelog_transport_interface, changelog_sidecar_process, changelog_webkit_removal [EXTRACTED 0.90]
- **CLI Same-engine Dual Delivery** — docs_cli_index_kube_inspector_cli, docs_cli_index_same_engine, docs_cli_index_cli_mode, changelog_tui [EXTRACTED 0.85]
- **RBAC Security Chain** — docs_security_roles_roles_screen, docs_security_role_bindings_role_bindings_screen, docs_security_security_role_map_security_role_map [EXTRACTED 1.00]
- **Kubernetes Workload Screens** — docs_workloads_pods_pods_screen, docs_workloads_deployments_deployments, docs_workloads_statefulsets_replicasets_statefulsets_replicasets, docs_workloads_daemonsets_daemonsets, docs_workloads_jobs_cronjobs_jobs_cronjobs [EXTRACTED 1.00]
- **Docs Site Build & SEO Pipeline** — mkdocs_mkdocs_config, overrides_main_base_override, overrides_home_landing_hero, overrides_main_json_ld [INFERRED 0.85]
- **Shell Transport Implementations** — claude_shell_transport, claude_wails_shell, claude_rpc_server, claude_shell_channel, claude_electron_shell [EXTRACTED 1.00]
- **Per-tab Cluster Pinning Flow** — claude_dockview_panel_system, claude_panel_id_scheme, claude_use_resource_list, claude_controller_layer, claude_business_layer, claude_repository_layer [EXTRACTED 1.00]
- **graphify Build Pipeline Stages** — _claude_skills_graphify_skill_interpreter_detection, _claude_skills_graphify_skill_ast_extraction, _claude_skills_graphify_skill_semantic_extraction, _claude_skills_graphify_skill_extraction_cache, _claude_skills_graphify_skill_community_clustering, _claude_skills_graphify_skill_graph_health_check, _claude_skills_graphify_skill_god_nodes [EXTRACTED 1.00]

## Communities (221 total, 58 thin omitted)

### Community 1 - "Cluster & CRD Business Layer"
Cohesion: 0.05
Nodes (49): CheckClusterConnection(), clusterFile(), DeleteCluster(), GetClusterContent(), init(), kubeInsDir(), ListClusters(), SaveCluster() (+41 more)

### Community 2 - "AI Assistant Agent Loop"
Cohesion: 0.13
Nodes (16): Client, ListModels(), newClient(), baseName(), Context, IsAvailable(), ModelCatalog(), PullModel() (+8 more)

### Community 3 - "RPC Shell Transport Server"
Cohesion: 0.47
Nodes (4): App, Context, jsonRepresentable(), Type

### Community 4 - "Trivy Vulnerability Scanning"
Cohesion: 0.07
Nodes (46): driver(), pytest_runtest_makereport(), Single Chrome WebDriver instance shared across the entire test session.      The, Capture a full-page screenshot whenever a test fails and embed it in the     pyt, Context, lockTrivyCache(), trivyCacheSubdir(), TrivyListPodImages() (+38 more)

### Community 5 - "App Bootstrap & IPC Hub"
Cohesion: 0.06
Nodes (29): Bool, Transport, Context, App, NewApp(), Bootstrap(), App, Context (+21 more)

### Community 6 - "YAML Editor & Policy Panels"
Cohesion: 0.08
Nodes (35): buildGraph(), NODE_DENY, NODE_EGRESS, NODE_INGRESS, NODE_PODS, NODE_POLICY, NODE_TYPES, PolicyViewerPanel() (+27 more)

### Community 7 - "Trivy Scanner Frontend"
Cohesion: 0.07
Nodes (31): cveBody(), defaultMisconfigFilters, defaultSecretFilters, defaultVulnFilters, DetailFinding, escapeHtml(), ImageScanTab(), K8sScanResult (+23 more)

### Community 8 - "CI Pipeline & Changelog Docs"
Cohesion: 0.07
Nodes (33): Cloudflare R2 Artifact Publishing, MkDocs Site Deploy Job, Disabled E2E (kind + xvfb + Chrome), GOEXPERIMENT=jsonv2 Build Flag, nfpm deb/rpm Packaging, Build & Release CI Pipeline, Embedded Chromium (Electron) Shell, Monitoring Dashboard (+25 more)

### Community 9 - "Monitoring & Overview Dashboards"
Cohesion: 0.06
Nodes (54): CrdTree(), CrdTreeProps, groupLabel(), InstanceRow, InstanceTableProps, CrdListComponent(), DeleteTarget, SCOPE_OPTIONS (+46 more)

### Community 10 - "MkDocs Build Hooks"
Cohesion: 0.09
Nodes (30): _abs_url(), _app_version(), _build_timeline(), _first_paragraph(), on_config(), on_page_markdown(), on_post_build(), _ordered_pages() (+22 more)

### Community 11 - "TUI Describe & Metrics Render"
Cohesion: 0.21
Nodes (21): hexOf(), barColor(), barColumn(), buildDescribeText(), fmtCPU(), fmtMem(), Color, kv() (+13 more)

### Community 12 - "Network Policy Stack"
Cohesion: 0.11
Nodes (28): DeleteNetworkPolicy(), GetNetworkPolicies(), GetNetworkPolicyDetail(), GetNetworkPolicyYaml(), ParseNetworkPolicyYaml(), UpdateNetworkPolicyYaml(), DeleteNetworkPolicy(), egressRuleToInfo() (+20 more)

### Community 13 - "E2E DataTable Helpers"
Cohesion: 0.13
Nodes (22): assert_row_absent(), click_delete_selected_button(), click_dialog_button(), filter_datatable_by_name(), find_datatable_row(), Reusable Selenium helpers for kube-ins E2E tests.  All helpers accept an explici, Type *name* into the DataTable's 'Search name' plain-text filter input     (the, Wait until a DataTable <tr> containing a cell with *cell_text* is present. (+14 more)

### Community 14 - "Resource List Components"
Cohesion: 0.08
Nodes (23): ConfigMapListComponent(), ConfigMapRow, defaultFilters, CronJobListComponent(), defaultFilters, defaultFilters, IngressClassListComponent(), defaultFilters (+15 more)

### Community 15 - "Cluster Resource Graph"
Cohesion: 0.23
Nodes (24): IngressRule, collectDaemonSets(), collectDeployments(), collectIngresses(), collectPods(), collectReplicaSets(), collectServices(), collectStatefulSets() (+16 more)

### Community 16 - "RBAC Security Graph"
Cohesion: 0.14
Nodes (24): clusterRoleID(), expandRules(), GetSecurityGraph(), Clientset, Config, Context, Interface, PolicyRule (+16 more)

### Community 17 - "E2E Panel Tests"
Cohesion: 0.14
Nodes (15): pod_data_rows(), Wait for a PrimeReact DataTable (`.p-datatable`) to be present.      The table r, Return the list of real (non-empty-message) <tr> elements currently in the     P, Wait until the *active* Dockview tab (`.dv-active-tab`) contains     *title_frag, wait_for_active_tab(), wait_for_datatable(), _open_pods_list(), Panel open/load E2E tests for kube-ins.  Verifies that the interactive resource (+7 more)

### Community 18 - "Frontend TypeScript Config"
Cohesion: 0.09
Nodes (22): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+14 more)

### Community 19 - "Pod & Metrics Services"
Cohesion: 0.15
Nodes (20): ContainerStatus, controllerRef(), GetMetricsSnapshot(), Clientset, OwnerReference, resolveOwner(), DeletePod(), GetPods() (+12 more)

### Community 20 - "Tab Context & ConfigMaps"
Cohesion: 0.10
Nodes (23): GROUP_ICONS, NAV_GROUPS, NavGroup, NavItem, S, VIEW_GROUP, ConfigMapEditorDef, ExecPanelDef (+15 more)

### Community 21 - "CRD List & Shared List View"
Cohesion: 0.20
Nodes (14): normalizedCall, textCall, ToolEvent, argsToAPI(), Context, jsonObjects(), parseTextToolCalls(), RunChat() (+6 more)

### Community 22 - "TUI Application Shell"
Cohesion: 0.14
Nodes (11): Application, Duration, Flex, Color, Mutex, Primitive, App, newApp() (+3 more)

### Community 23 - "Workload & Security Docs"
Cohesion: 0.14
Nodes (19): Role Bindings Screen, Roles Screen, RBAC Interactive Graph, Security Role Map, DaemonSets Screen, Deployments Screen, Workloads Section, Jobs & CronJobs Screen (+11 more)

### Community 24 - "Electron Package Manifest"
Cohesion: 0.11
Nodes (18): electron, electron-builder, dependencies, ws, description, devDependencies, electron, electron-builder (+10 more)

### Community 25 - "Log Streaming Business Layer"
Cohesion: 0.12
Nodes (23): DeleteJob(), GetJobs(), GetJobYaml(), GetCronJobPods(), GetDaemonSetPods(), GetDeploymentPods(), GetJobPods(), GetPodContainers() (+15 more)

### Community 26 - "Node Services & Cordon/Drain"
Cohesion: 0.53
Nodes (4): NamespacedResourceQuota, NamespaceInfo, ResourceQuotaEntry, ResourceQuotaInfo

### Community 27 - "E2E Navigation Tests"
Cohesion: 0.12
Nodes (17): click_sidebar_item(), expand_sidebar_group(), navigate_to(), Wait for an <h3> with exactly *heading_text* to appear in the DOM.      Each res, Expand a sidebar section (e.g. 'WORKLOADS') if it is currently collapsed.      T, Click a sidebar nav item by its visible label text (e.g. 'Pods')., Expand a sidebar group and click one of its items in a single call., Wait until any Dockview tab whose title contains *title_fragment* exists.      T (+9 more)

### Community 28 - "Frontend Dependencies"
Cohesion: 0.22
Nodes (9): @fontsource/geist, dependencies, @fontsource/geist, react-router-dom, reactflow, @xterm/xterm, react-router-dom, reactflow (+1 more)

### Community 29 - "Log Services Layer"
Cohesion: 0.22
Nodes (15): GetCronJobPods(), GetDaemonSetPods(), GetDeploymentPods(), GetJobPods(), GetPodContainers(), GetPodLogsTail(), GetReplicaSetPods(), GetStatefulSetPods() (+7 more)

### Community 30 - "RoleBinding Stack"
Cohesion: 0.15
Nodes (15): GetRoleBindings(), GetRoleBindingYaml(), UpdateRoleBinding(), UpdateRoleBindingYaml(), GetRoleBindings(), GetRoleBindingYaml(), Clientset, roleBindingToInfo() (+7 more)

### Community 31 - "Role Stack"
Cohesion: 0.20
Nodes (12): UpdateRole(), GetRoles(), GetRoleYaml(), Clientset, PolicyRule, policyRulesToK8s(), roleToInfo(), UpdateRole() (+4 more)

### Community 32 - "E2E YAML CRUD Helpers"
Cohesion: 0.19
Nodes (12): click_apply_button(), open_apply_yaml_panel(), Wait for a PrimeReact Toast of the given severity and return its summary text., Wait until all PrimeReact toast messages have faded away., Open the Apply YAML panel via the TitleBar 'Open → YAML Editor' menu.      The T, Click the 'Apply' button inside the YAML editor toolbar., wait_for_toast(), wait_for_toast_gone() (+4 more)

### Community 33 - "Electron Main Process"
Cohesion: 0.12
Nodes (18): boundsNearCursor(), clearDragHover(), connectShellChannel(), createWindow(), electron, fatal(), logTail, openExternal() (+10 more)

### Community 34 - "Events View & Store"
Cohesion: 0.40
Nodes (4): DeleteService(), GetServices(), GetServiceYaml(), UpdateServiceYaml()

### Community 35 - "Multi-Instance Tab Transfer"
Cohesion: 0.17
Nodes (14): Context, RunSelfUpdate(), DownloadFile(), FetchExpectedSha256(), Context, Time, T, sortedKeys() (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (15): graphify Skill Trigger Declaration, Token Reduction Benchmark, Agent-Crawlable Wiki Export, EXTRACTED/INFERRED/AMBIGUOUS Confidence Rubric, Deterministic Node ID Format, Native CLAUDE.md Integration, --cluster-only Reclustering, Community Detection and Cohesion Scoring (+7 more)

### Community 37 - "Community 37"
Cohesion: 0.14
Nodes (15): Hexagon Node-Graph Brand Mark, Kube Inspector Logo, CLI Pods TUI Screenshot, Single-Letter Keybinding Actions, tview Terminal UI (TUI/CLI Mode), Deployments List Screenshot, Dockview Multi-Tab Panel Layout, Kube Inspector Desktop App (+7 more)

### Community 38 - "Community 38"
Cohesion: 0.25
Nodes (14): PodExecPanel(), PodExecPanelParams, components, DockviewContainer(), dragHover(), dragLeave(), dropPanel(), fire() (+6 more)

### Community 39 - "Community 39"
Cohesion: 0.26
Nodes (6): crdChildDef(), App, App, App, resourceDef, rowData

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (11): ConfigMap, GetConfigMaps(), configMapToInfo(), DeleteConfigMap(), GetConfigMapData(), GetConfigMaps(), GetConfigMapYaml(), Clientset (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.19
Nodes (14): Dockview Tabbed Panel Workspace, Resource Category Sidebar Navigation, Embedded Terminal Sessions, Multi-Panel Terminal Layout, Terminal Screenshot, CVE Severity Results Table, Container Image Scan, Vulnerability Scan Screenshot (+6 more)

### Community 42 - "Community 42"
Cohesion: 0.18
Nodes (12): buildFlow(), computeDetail(), DetailItem, DetailSection, EDGE_STYLE, KIND_CONFIG, NodeDetail, nodeHeight() (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.23
Nodes (10): GetLimitRanges(), GetLimitRangeYaml(), Clientset, limitRangeToInfo(), resourceListToMap(), UpdateLimitRangeYaml(), LimitRange, LimitRangeInfo (+2 more)

### Community 44 - "Community 44"
Cohesion: 0.24
Nodes (10): DeleteSecret(), GetSecretData(), GetSecrets(), GetSecretYaml(), Clientset, secretToInfo(), UpdateSecretData(), UpdateSecretYaml() (+2 more)

### Community 45 - "Community 45"
Cohesion: 0.15
Nodes (7): E2E smoke tests for kube-ins.  Prerequisites: `make dev` must be running so the, The React mount point must exist as soon as the page loads., Dockview renders its container with the theme class we apply in         Dockview, The left sidebar (id='tour-sidebar') must be rendered and the         WORKLOADS, The CLUSTER section of the sidebar must also be present, confirming         all, Clicking the WORKLOADS section toggle should reveal the Pods menu         item (, TestMainFlow

### Community 46 - "Community 46"
Cohesion: 0.23
Nodes (12): children, fail(), fs, killTree(), main(), path, preflight(), ROOT (+4 more)

### Community 47 - "Community 47"
Cohesion: 0.18
Nodes (6): SaveFileOptions, shellRequest, Server, Request, ResponseWriter, App

### Community 48 - "Community 48"
Cohesion: 0.17
Nodes (6): Listener, Window, container, NoopWorker, root, App()

### Community 49 - "Community 49"
Cohesion: 0.18
Nodes (12): chatMsg, aiTools(), argInt(), argStr(), asJSON(), ApplyYaml(), DeleteDeployment(), GetDeploymentYaml() (+4 more)

### Community 50 - "Community 50"
Cohesion: 0.23
Nodes (12): Folder Watcher (--watch), URL Ingest (/graphify add), MCP stdio Server, Post-Commit Auto-Rebuild Hook, graphify explain (single-node explanation), graphify path (shortest path between concepts), Work Memory / Self-Improving Loop, Whisper Video/Audio Transcription (+4 more)

### Community 51 - "Community 51"
Cohesion: 0.15
Nodes (16): No API Key Required Policy, AI Assistant (Ollama tool-calling agent), AI Tool Registry (aiTools), Fixed app:// Origin with protocol.handle Proxy, kubeinsdev Build Tag Relaxations, Electron Shell (shipped GUI), GOEXPERIMENT=jsonv2 Build Requirement, Live Resource Monitoring Dashboard (+8 more)

### Community 52 - "Community 52"
Cohesion: 0.47
Nodes (3): Box, focusBorder(), App

### Community 53 - "Community 53"
Cohesion: 0.18
Nodes (8): main(), Context, Run(), applyTheme(), Color, statusColor(), main(), serve()

### Community 54 - "Community 54"
Cohesion: 0.27
Nodes (8): DaemonSet, daemonSetToInfo(), DeleteDaemonSet(), GetDaemonSets(), GetDaemonSetYaml(), Clientset, UpdateDaemonSetYaml(), DaemonSetInfo

### Community 55 - "Community 55"
Cohesion: 0.29
Nodes (9): Endpoints, endpointToInfo(), GetEndpoints(), GetEndpointYaml(), Clientset, EndpointAddressInfo, EndpointInfo, EndpointPortInfo (+1 more)

### Community 56 - "Community 56"
Cohesion: 0.26
Nodes (9): Ingress, DeleteIngress(), GetIngresses(), GetIngressYaml(), Clientset, ingressToInfo(), UpdateIngressYaml(), IngressInfo (+1 more)

### Community 57 - "Community 57"
Cohesion: 0.26
Nodes (9): DeleteService(), GetServices(), GetServiceYaml(), Clientset, serviceToInfo(), UpdateServiceYaml(), ServiceInfo, ServicePortInfo (+1 more)

### Community 58 - "Community 58"
Cohesion: 0.24
Nodes (9): GetStatefulSets(), DeleteStatefulSet(), GetStatefulSets(), GetStatefulSetYaml(), Clientset, statefulSetToInfo(), UpdateStatefulSetYaml(), StatefulSetInfo (+1 more)

### Community 59 - "Community 59"
Cohesion: 0.17
Nodes (12): NetworkPolicy Ingress/Egress Graph, Network Policies Screenshot, NetworkPolicy YAML Editor Split, Namespace/Status Filter and Search, Pod List Table View, Pods List Screenshot, ServiceAccount/RoleBinding/Role/ClusterRole Focus Filters, RBAC Subject-Role-Resource Graph (+4 more)

### Community 60 - "Community 60"
Cohesion: 0.18
Nodes (11): rpcResponse, wsClient, buildResponse(), Conn, Server, Request, ResponseWriter, RWMutex (+3 more)

### Community 61 - "Community 61"
Cohesion: 0.24
Nodes (9): CronJob, GetCronJobs(), cronJobToInfo(), DeleteCronJob(), GetCronJobs(), GetCronJobYaml(), Clientset, UpdateCronJobYaml() (+1 more)

### Community 62 - "Community 62"
Cohesion: 0.24
Nodes (9): Deployment, GetDeployments(), DeleteDeployment(), deploymentToInfo(), GetDeployments(), GetDeploymentYaml(), Clientset, UpdateDeploymentYaml() (+1 more)

### Community 63 - "Community 63"
Cohesion: 0.29
Nodes (8): DeleteJob(), GetJobs(), GetJobYaml(), Clientset, jobStatus(), jobToInfo(), Job, JobInfo

### Community 64 - "Community 64"
Cohesion: 0.36
Nodes (8): DeleteNamespace(), GetNamespaces(), GetNamespaceYaml(), Clientset, namespaceToInfo(), quantityToComparableNum(), Namespace, Quantity

### Community 65 - "Community 65"
Cohesion: 0.24
Nodes (9): GetReplicaSets(), DeleteReplicaSet(), GetReplicaSets(), GetReplicaSetYaml(), Clientset, replicaSetToInfo(), UpdateReplicaSetYaml(), ReplicaSetInfo (+1 more)

### Community 66 - "Community 66"
Cohesion: 0.17
Nodes (12): GetServiceAccounts(), GetServiceAccountYaml(), UpdateServiceAccount(), UpdateServiceAccountYaml(), GetServiceAccounts(), GetServiceAccountYaml(), Clientset, serviceAccountToInfo() (+4 more)

### Community 67 - "Community 67"
Cohesion: 0.05
Nodes (40): eslint, @eslint/js, eslint-plugin-react-hooks, devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, globals (+32 more)

### Community 68 - "Community 68"
Cohesion: 0.22
Nodes (10): buildFlow(), ClusterGraph, ClusterResourcePanel(), ClusterResourcePanelParams, K8sNode(), KIND_CONFIG, nodeTypes, ResourceNode (+2 more)

### Community 69 - "Community 69"
Cohesion: 0.30
Nodes (11): boolStr(), buildRegistry(), clusterScopedYAML(), dash(), humanSince(), i32(), iN(), join() (+3 more)

### Community 70 - "Community 70"
Cohesion: 0.18
Nodes (10): author, email, name, frontend:build, frontend:dev:serverUrl, frontend:dev:watcher, frontend:install, name (+2 more)

### Community 71 - "Community 71"
Cohesion: 0.16
Nodes (15): Business Orchestration Layer, Cluster Configuration (~/.kube-ins), ClusterContext, CRDs and Generic Object CRUD, Selenium + pytest E2E Suite, Models Layer (frontend serialization structs), Module-level DataTable Body Helpers, Panel ID Scheme (+7 more)

### Community 72 - "Community 72"
Cohesion: 0.24
Nodes (6): Event, GetEvents(), eventToInfo(), GetEvents(), Clientset, EventInfo

### Community 73 - "Community 73"
Cohesion: 0.29
Nodes (7): DeletePersistentVolumeClaim(), GetPersistentVolumeClaims(), GetPersistentVolumeClaimYaml(), Clientset, pvcToInfo(), PersistentVolumeClaimInfo, PersistentVolumeClaim

### Community 74 - "Community 74"
Cohesion: 0.08
Nodes (25): AiChat(), buildContext(), ConfirmReq, fmtBytes(), PullState, DEP_LABELS, Props, SideMenu() (+17 more)

### Community 75 - "Community 75"
Cohesion: 0.39
Nodes (7): createFrom(), defaultFilters, hostsOf(), IngressListComponent(), IngressRow, pathLabelsOf(), pathsOf()

### Community 76 - "Community 76"
Cohesion: 0.17
Nodes (13): Dockview Panel System, Event Streaming (terminal, logs, AI, tab transfer), InstanceContext, IPC InstanceHub (WebSocket multi-instance discovery), Multi-Instance Tab Transfer, Go Sidecar Process Lifecycle, TabContext, TabInstanceBridge (+5 more)

### Community 77 - "Community 77"
Cohesion: 0.31
Nodes (6): IngressClass, GetIngressClasses(), GetIngressClassYaml(), Clientset, ingressClassToInfo(), IngressClassInfo

### Community 78 - "Community 78"
Cohesion: 0.31
Nodes (6): GetPersistentVolumes(), GetPersistentVolumeYaml(), Clientset, pvToInfo(), PersistentVolumeInfo, PersistentVolume

### Community 79 - "Community 79"
Cohesion: 0.31
Nodes (6): GetStorageClasses(), GetStorageClassYaml(), Clientset, storageClassToInfo(), StorageClassInfo, StorageClass

### Community 80 - "Community 80"
Cohesion: 0.06
Nodes (32): Bağımlılık grafiği, Bu step'i çalıştıran oturuma tavsiye, Business / Controller, Context — bu plan neden var, Frontend, Her step oturumuna yapıştırılacak global önsöz, İlerleme, Karar: imzaları değiştir. Paralel mekanizma ekleme. (+24 more)

### Community 81 - "Community 81"
Cohesion: 0.28
Nodes (7): barOptions, getStatusSeverity(), getUsageColor(), NodeCard(), NodeListComponent(), Severity, UsageChart()

### Community 82 - "Community 82"
Cohesion: 0.24
Nodes (12): containerDotColor(), DataTableComponent(), defaultFilters, fmtCpu(), fmtMem(), getOwnerSeverity(), getStatusSeverity(), renderContainerItem() (+4 more)

### Community 83 - "Community 83"
Cohesion: 0.28
Nodes (7): barOptions, getStatusSeverity(), getUsageColor(), NamespaceGroup(), ResourceBar(), ResourceQuotaListComponent(), Severity

### Community 84 - "Community 84"
Cohesion: 0.39
Nodes (8): nextId(), RoleEditorPanel(), RoleEditorPanelParams, rowsEqual(), rowsToRules(), RuleRow, rulesToRows(), splitCSV()

### Community 85 - "Community 85"
Cohesion: 0.36
Nodes (8): nextId(), RoleBindingEditorPanel(), RoleBindingEditorPanelParams, rowsEqual(), rowsToSubjects(), SUBJECT_KINDS, SubjectRow, subjectsToRows()

### Community 86 - "Community 86"
Cohesion: 0.25
Nodes (5): CreateCliModeSession(), Cmd, File, selfExe(), cliModeSession

### Community 87 - "Community 87"
Cohesion: 0.50
Nodes (3): DeleteCronJob(), GetCronJobYaml(), UpdateCronJobYaml()

### Community 88 - "Community 88"
Cohesion: 0.17
Nodes (10): TabInstanceBridge(), InstanceContext, InstanceContextValue, InstanceInfo, InstanceProvider(), SerializedPanel, useInstanceContext(), isPrimaryWindow() (+2 more)

### Community 89 - "Community 89"
Cohesion: 0.18
Nodes (15): GetNodes(), CordonNode(), DrainNode(), GetNodes(), GetNodeYaml(), Clientset, Pod, isDaemonSetPod() (+7 more)

### Community 90 - "Community 90"
Cohesion: 0.39
Nodes (6): dataToRows(), KeyValueRow, nextId(), rowsEqual(), SecretEditorPanel(), SecretEditorPanelParams

### Community 91 - "Community 91"
Cohesion: 0.13
Nodes (19): addressesOf(), createFrom(), defaultFilters, EndpointListComponent(), EndpointRow, portsOf(), defaultFilters, getStatusSeverity() (+11 more)

### Community 92 - "Community 92"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include, vite.config.ts

### Community 93 - "Community 93"
Cohesion: 0.32
Nodes (6): GetResourceQuotas(), GetResourceQuotaYaml(), Clientset, UpdateResourceQuotaYaml(), toApplyYaml(), Object

### Community 94 - "Community 94"
Cohesion: 0.67
Nodes (3): FS, Handler, NewServer()

### Community 95 - "Community 95"
Cohesion: 0.18
Nodes (11): Verbatim source_file Rule, build_merge Replace-on-Re-extract, Semantic Extraction Cache, Controller Layer (Wails binding point), frontend/dist/.gitkeep Embed Bootstrap Cycle, Go-embedded Kubernetes JSON Schema, kube-ins Desktop Application, Layered Go Backend Architecture (+3 more)

### Community 96 - "Community 96"
Cohesion: 0.38
Nodes (7): Cross-Repo / Monorepo Graph Merge, GitHub Repo Clone, BFS Traversal Mode, DFS Traversal Mode, Constrained Query Expansion, Token-Budget-Aware Output, Fast Path for an Existing Graph

### Community 97 - "Community 97"
Cohesion: 0.48
Nodes (6): ConfigMapEditorPanel(), ConfigMapEditorPanelParams, dataToRows(), KeyValueRow, nextId(), rowsEqual()

### Community 98 - "Community 98"
Cohesion: 0.18
Nodes (8): expandHome(), App, headerCell(), Primitive, Table, App, statusColumnIndex(), TableCell

### Community 99 - "Community 99"
Cohesion: 0.19
Nodes (12): T, TestCheckForUpdateOffline(), TestCheckForUpdateResolvesAsset(), TestCheckForUpdateWithoutAssets(), CheckForUpdate(), isNewer(), manifestURL(), resolveAsset() (+4 more)

### Community 100 - "Community 100"
Cohesion: 0.40
Nodes (3): GetAppInfo(), AppInfo, DependencyInfo

### Community 101 - "Community 101"
Cohesion: 0.36
Nodes (5): GetMetricsSnapshot(), matchUsage(), ContainerUsage, MetricsSnapshot, ResourceUsage

### Community 102 - "Community 102"
Cohesion: 0.40
Nodes (5): allKeys(), defaultFilters, LimitRangeListComponent(), tdStyle, thStyle

### Community 104 - "Community 104"
Cohesion: 0.43
Nodes (7): CheckInstallable(), Context, PlatformAssetKey(), RunInstaller(), runningAppBundle(), shellQuote(), startSwapHelper()

### Community 105 - "Community 105"
Cohesion: 0.06
Nodes (49): GroupVersionResource, GetCRDInstanceCounts(), GetCRDs(), GetCustomResources(), applyError(), applyOne(), ApplyYaml(), Config (+41 more)

### Community 107 - "Community 107"
Cohesion: 0.40
Nodes (5): Call Edge Direction and Language Rule, Hyperedges, Rationale as Node Attribute, semantically_similar_to Edges, Part A - AST Structural Extraction

### Community 108 - "Community 108"
Cohesion: 0.19
Nodes (12): defaultFilters, getCompletionSeverity(), getStatusSeverity(), JobListComponent(), ColumnsContext, ResourceListView(), ResourceListViewProps, toColumnArray() (+4 more)

### Community 109 - "Community 109"
Cohesion: 0.60
Nodes (4): defaultFilters, DeploymentListComponent(), getReplicasSeverity(), getStatusSeverity()

### Community 110 - "Community 110"
Cohesion: 0.53
Nodes (5): Header, fetchRegistryToken(), ModelTags(), regGet(), ListAiModelTags()

### Community 111 - "Community 111"
Cohesion: 0.50
Nodes (3): DeleteReplicaSet(), GetReplicaSetYaml(), UpdateReplicaSetYaml()

### Community 112 - "Community 112"
Cohesion: 0.50
Nodes (3): GetRoles(), GetRoleYaml(), UpdateRoleYaml()

### Community 113 - "Community 113"
Cohesion: 0.19
Nodes (23): formatBytes(), Props, Stage, UpdateModal(), UpdateProgress, FloatableTab(), getComponentType(), NON_TRANSFERABLE (+15 more)

### Community 114 - "Community 114"
Cohesion: 0.33
Nodes (5): InstanceInfo, SerializedPanel, InstanceListPayload, RegisterPayload, TransferPayload

### Community 115 - "Community 115"
Cohesion: 0.70
Nodes (4): Tool, buildAPITools(), toAPITool(), Tools

### Community 116 - "Community 116"
Cohesion: 0.29
Nodes (3): wailsTransport, Context, App

### Community 117 - "Community 117"
Cohesion: 0.40
Nodes (5): ICONS, InstancePickerMenu(), keyOf(), Props, TabTarget

### Community 118 - "Community 118"
Cohesion: 0.33
Nodes (6): _click_first_row_action(), open_pod_exec_panel(), open_pod_log_panel(), Click the action button at *button_index* on the first data row of the     activ, Click the Logs action button on the first pod row.     Returns True if a pod row, Click the Exec (terminal) action button on the first pod row.     Returns True i

### Community 120 - "Community 120"
Cohesion: 0.33
Nodes (5): configmap_cleanup(), YAML CRUD lifecycle E2E test for kube-ins.  This test simulates a real user:   1, Pytest fixture that guarantees the test ConfigMap is deleted from the     cluste, Full Create → Read/Verify → Delete lifecycle via the kube-ins UI.      The test, TestConfigMapCRUD

### Community 121 - "Community 121"
Cohesion: 0.40
Nodes (4): DeleteIngress(), GetIngresses(), GetIngressYaml(), UpdateIngressYaml()

### Community 123 - "Community 123"
Cohesion: 0.38
Nodes (5): shellChannel, shellReply, Conn, Mutex, newShellChannel()

### Community 124 - "Community 124"
Cohesion: 0.23
Nodes (17): ClusterBar(), ClusterModal(), ParsedConfig, parseKubeconfig(), ParseResult, Props, sanitizeName(), suggestName() (+9 more)

### Community 126 - "Community 126"
Cohesion: 0.50
Nodes (4): defaultFilters, getStatusSeverity(), NamespaceListComponent(), Severity

### Community 127 - "Community 127"
Cohesion: 0.50
Nodes (3): aiSession, CancelFunc, Mutex

### Community 128 - "Community 128"
Cohesion: 0.83
Nodes (3): init(), initProgress(), initToggle()

### Community 129 - "@fontsource/jetbrains-mono"
Cohesion: 0.50
Nodes (4): defaultFilters, getStatusSeverity(), PersistentVolumeListComponent(), TagSeverity

### Community 131 - "Community 131"
Cohesion: 0.40
Nodes (4): DeleteDaemonSet(), GetDaemonSets(), GetDaemonSetYaml(), UpdateDaemonSetYaml()

### Community 134 - "limitRange.go"
Cohesion: 0.50
Nodes (3): GetLimitRanges(), GetLimitRangeYaml(), UpdateLimitRangeYaml()

### Community 135 - "Community 135"
Cohesion: 0.50
Nodes (3): DeletePersistentVolumeClaim(), GetPersistentVolumeClaims(), GetPersistentVolumeClaimYaml()

### Community 136 - "Community 136"
Cohesion: 0.50
Nodes (3): GetResourceQuotas(), GetResourceQuotaYaml(), UpdateResourceQuotaYaml()

### Community 137 - "Community 137"
Cohesion: 0.40
Nodes (4): open_resource_graph(), Click the 'Resource Graph' button in the ClusterBar, which opens the     cluster, Opening the Resource Graph from the ClusterBar mounts the ClusterResourcePanel, TestResourceGraphPanel

### Community 138 - "Community 138"
Cohesion: 0.33
Nodes (5): DeleteConfigMap(), GetConfigMapData(), GetConfigMapYaml(), UpdateConfigMapData(), UpdateConfigMapYaml()

### Community 139 - "Community 139"
Cohesion: 0.50
Nodes (3): DeleteStatefulSet(), GetStatefulSetYaml(), UpdateStatefulSetYaml()

### Community 142 - "Community 142"
Cohesion: 0.67
Nodes (3): Unified ResourceListView / useResourceList, Endpoints Screen, Services Screen

### Community 143 - "Community 143"
Cohesion: 0.67
Nodes (3): MkDocs Documentation Site, SEO / LLM Discoverability Files, In-app Update Check

### Community 145 - "Community 145"
Cohesion: 0.67
Nodes (3): Persistent Volumes Screen, Storage Classes Screen, Volume Claims Screen

### Community 151 - "LogViewerPanel.tsx"
Cohesion: 0.50
Nodes (4): fetchPodsForKind(), LogViewerPanel(), LogViewerPanelParams, WorkloadKind

### Community 153 - "Community 153"
Cohesion: 0.60
Nodes (4): defaultFilters, getReplicasSeverity(), getStatusSeverity(), StatefulSetListComponent()

### Community 179 - "Community 179"
Cohesion: 0.50
Nodes (4): CheckInstallable(), Context, PlatformAssetKey(), RunInstaller()

### Community 185 - "Community 185"
Cohesion: 0.50
Nodes (4): CheckInstallable(), Context, PlatformAssetKey(), RunInstaller()

### Community 186 - "Community 186"
Cohesion: 0.50
Nodes (3): DeleteNamespace(), GetNamespaces(), GetNamespaceYaml()

### Community 190 - "main.tsx"
Cohesion: 0.60
Nodes (4): DaemonSetListComponent(), defaultFilters, getReadySeverity(), getStatusSeverity()

### Community 222 - "@fontsource/geist"
Cohesion: 0.60
Nodes (4): defaultFilters, getReplicasSeverity(), getStatusSeverity(), ReplicaSetListComponent()

## Ambiguous Edges - Review These
- `Frontend index.html` → `MkDocs Site Config`  [AMBIGUOUS]
  frontend/index.html · relation: conceptually_related_to
- `kubeinsdev Build Tag Relaxations` → `No API Key Required Policy`  [AMBIGUOUS]
  CLAUDE.md · relation: semantically_similar_to
- `theme-monolith.css Variable-Driven Theming` → `Nunito Font Family`  [AMBIGUOUS]
  frontend/src/assets/fonts/OFL.txt · relation: references

## Knowledge Gaps
- **385 isolated node(s):** `{ spawn }`, `path`, `fs`, `ROOT`, `children` (+380 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **58 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Frontend index.html` and `MkDocs Site Config`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `kubeinsdev Build Tag Relaxations` and `No API Key Required Policy`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `theme-monolith.css Variable-Driven Theming` and `Nunito Font Family`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `App` connect `Wails Controller Bindings` to `AI Assistant Agent Loop`, `Trivy Vulnerability Scanning`, `Network Policy Stack`, `Community 144`, `Pod & Metrics Services`, `CRD List & Shared List View`, `Node Services & Cordon/Drain`, `RoleBinding Stack`, `Role Stack`, `Community 161`, `Community 162`, `Community 163`, `Community 40`, `Community 43`, `Community 44`, `Community 54`, `Community 55`, `Community 56`, `Community 57`, `Community 58`, `Community 61`, `Community 62`, `Community 63`, `Community 65`, `Community 66`, `Community 72`, `Community 73`, `Community 77`, `Community 78`, `Community 79`, `Community 89`, `.CheckForUpdate`, `Community 100`, `Community 101`, `Community 105`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `NewK8sClientForCluster()` connect `Log Streaming Business Layer` to `Cluster & CRD Business Layer`, `Community 131`, `Trivy Vulnerability Scanning`, `limitRange.go`, `Community 135`, `Community 136`, `Community 138`, `Community 139`, `Network Policy Stack`, `Community 148`, `open_resource_graph`, `RoleBinding Stack`, `Role Stack`, `Events View & Store`, `Community 165`, `Community 40`, `GetIngressClasses`, `Community 49`, `Community 186`, `Community 58`, `Community 61`, `Community 62`, `Community 65`, `Community 66`, `Community 72`, `Community 87`, `Community 89`, `Community 101`, `Community 111`, `Community 112`, `Community 121`, `Community 122`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `MetricsSnapshot` connect `Community 101` to `TUI Describe & Metrics Render`, `Pod & Metrics Services`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 103 inferred relationships involving `NewK8sClientForCluster()` (e.g. with `GetClusterGraph()` and `DeleteConfigMap()`) actually correct?**
  _`NewK8sClientForCluster()` has 103 INFERRED edges - model-reasoned connections that need verification._