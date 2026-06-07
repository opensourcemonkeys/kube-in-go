import React, { createContext, useContext, useRef, useCallback } from 'react';
import { DockviewApi } from 'dockview';

const viewLabels: Record<string, string> = {
    pods: 'Pods',
    deployments: 'Deployments',
    statefulsets: 'StatefulSets',
    replicasets: 'ReplicaSets',
    daemonsets: 'DaemonSets',
    jobs: 'Jobs',
    cronjobs: 'CronJobs',
    services: 'Services',
    ingresses: 'Ingresses',
    ingressclasses: 'Ingress Classes',
    endpoints: 'Endpoints',
    networkpolicies: 'Network Policies',
    configmaps: 'ConfigMaps',
    secrets: 'Secrets',
    serviceaccounts: 'Service Accounts',
    roles: 'Roles',
    rolebindings: 'Role Bindings',
    persistentvolumes: 'Persistent Volumes',
    persistentvolumeclaims: 'Volume Claims',
    storageclasses: 'Storage Classes',
    nodes: 'Nodes',
    namespaces: 'Namespaces',
    events: 'Events',
    resourcequotas: 'Resource Quotas',
    limitranges: 'Limit Ranges',
};

export interface TabDef {
    view: string;
    title: string;
    icon?: React.ReactNode;
}

export interface YamlPanelDef {
    resourceKind: 'pod' | 'deployment' | 'statefulset' | 'replicaset' | 'daemonset' | 'job' | 'cronjob' | 'service' | 'ingress' | 'ingressclass' | 'endpoint' | 'configmap' | 'secret' | 'node' | 'namespace' | 'resourcequota' | 'limitrange' | 'persistentvolume' | 'persistentvolumeclaim' | 'storageclass' | 'serviceaccount' | 'role' | 'rolebinding';
    name: string;
    namespace: string;
    /** dockview panel id of the list panel to split beside */
    referencePanel: string;
}

export interface LogPanelDef {
    resourceKind: 'pod' | 'deployment' | 'statefulset' | 'replicaset' | 'daemonset' | 'job' | 'cronjob';
    name: string;
    namespace: string;
    referencePanel: string;
}

export interface ExecPanelDef {
    name: string;
    namespace: string;
    container: string;
    referencePanel: string;
}

export interface PolicyViewerDef {
    name: string;
    namespace: string;
    referencePanel: string;
}

export interface ConfigMapEditorDef {
    name: string;
    namespace: string;
    referencePanel: string;
}

export interface SecretEditorDef {
    name: string;
    namespace: string;
    referencePanel: string;
}

export interface RoleEditorDef {
    name: string;
    namespace: string;
    referencePanel: string;
}

export interface RoleBindingEditorDef {
    name: string;
    namespace: string;
    referencePanel: string;
}

export interface ReceivedPanel {
    componentType: string;
    title: string;
    params: Record<string, any>;
}

interface TabContextValue {
    registerApi: (api: DockviewApi) => void;
    openTab: (def: TabDef) => void;
    openYamlPanel: (def: YamlPanelDef) => void;
    openLogPanel: (def: LogPanelDef) => void;
    openExecPanel: (def: ExecPanelDef) => void;
    openPolicyViewer: (def: PolicyViewerDef) => void;
    openConfigMapEditor: (def: ConfigMapEditorDef) => void;
    openSecretEditor: (def: SecretEditorDef) => void;
    openRoleEditor: (def: RoleEditorDef) => void;
    openRoleBindingEditor: (def: RoleBindingEditorDef) => void;
    openTerminal: () => void;
    openApplyYaml: () => void;
    openClusterResourceView: () => void;
    openReceivedPanel: (panel: ReceivedPanel) => void;
}

function positionAfter(api: DockviewApi, referenceId: string) {
    const ref = api.getPanel(referenceId);
    if (!ref) return undefined;
    const panels: any[] = (ref as any).group?.panels ?? [];
    const idx = panels.findIndex((p: any) => p.id === referenceId);
    return { referencePanel: referenceId, direction: 'within' as const, index: idx >= 0 ? idx + 1 : undefined };
}

const TabContext = createContext<TabContextValue | null>(null);

export function TabProvider({ children }: { children: React.ReactNode }) {
    const apiRef = useRef<DockviewApi | null>(null);
    const terminalCounterRef = useRef(0);
    const applyYamlCounterRef = useRef(0);

    const registerApi = useCallback((api: DockviewApi) => {
        apiRef.current = api;
    }, []);

    const openTab = useCallback((def: TabDef) => {
        const api = apiRef.current;
        if (!api) return;

        const existing = api.getPanel(def.view);
        if (existing) {
            existing.focus();
            return;
        }

        api.addPanel({
            id: def.view,
            component: 'view',
            title: def.title,
            params: { view: def.view, icon: def.icon ?? null },
        });
    }, []);

    const openTerminal = useCallback(() => {
        const api = apiRef.current;
        if (!api) return;

        terminalCounterRef.current += 1;
        const n = terminalCounterRef.current;
        const sessionId = `terminal-${n}-${Date.now()}`;

        api.addPanel({
            id: sessionId,
            component: 'terminal',
            title: `Terminal ${n}`,
            params: { sessionId },
        });
    }, []);

    const openApplyYaml = useCallback(() => {
        const api = apiRef.current;
        if (!api) return;

        applyYamlCounterRef.current += 1;
        const n = applyYamlCounterRef.current;

        api.addPanel({
            id: `apply-yaml-${n}`,
            component: 'applyYaml',
            title: n === 1 ? 'YAML Editor' : `YAML Editor ${n}`,
            params: {},
        });
    }, []);

    const openLogPanel = useCallback((def: LogPanelDef) => {
        const api = apiRef.current;
        if (!api) return;

        const panelId = `log:${def.resourceKind}:${def.namespace}/${def.name}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.focus();
            return;
        }

        const addOptions: any = {
            id: panelId,
            component: 'logViewer',
            title: `Logs • ${def.namespace}/${def.name}`,
            params: {
                resourceKind: def.resourceKind,
                name: def.name,
                namespace: def.namespace,
            },
        };

        const pos = positionAfter(api, def.referencePanel);
        if (pos) addOptions.position = pos;

        api.addPanel(addOptions);
    }, []);

    const openExecPanel = useCallback((def: ExecPanelDef) => {
        const api = apiRef.current;
        if (!api) return;

        const panelId = `exec:${def.namespace}/${def.name}:${def.container}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.focus();
            return;
        }

        const sessionId = `exec-${Date.now()}`;
        const addOptions: any = {
            id: panelId,
            component: 'podExec',
            title: `Exec • ${def.namespace}/${def.name}`,
            params: {
                sessionId,
                name: def.name,
                namespace: def.namespace,
                container: def.container,
            },
        };

        const pos = positionAfter(api, def.referencePanel);
        if (pos) addOptions.position = pos;

        api.addPanel(addOptions);
    }, []);

    const openPolicyViewer = useCallback((def: PolicyViewerDef) => {
        const api = apiRef.current;
        if (!api) return;

        const panelId = `policy:${def.namespace}/${def.name}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.focus();
            return;
        }

        const addOptions: any = {
            id: panelId,
            component: 'policyViewer',
            title: `Policy • ${def.namespace}/${def.name}`,
            params: { name: def.name, namespace: def.namespace },
        };

        const pos = positionAfter(api, def.referencePanel);
        if (pos) addOptions.position = pos;

        api.addPanel(addOptions);
    }, []);

    const openConfigMapEditor = useCallback((def: ConfigMapEditorDef) => {
        const api = apiRef.current;
        if (!api) return;

        const panelId = `configmap-editor:${def.namespace}/${def.name}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.focus();
            return;
        }

        const addOptions: any = {
            id: panelId,
            component: 'configMapEditor',
            title: `Edit • ${def.namespace}/${def.name}`,
            params: { name: def.name, namespace: def.namespace },
        };

        const pos = positionAfter(api, def.referencePanel);
        if (pos) addOptions.position = pos;

        api.addPanel(addOptions);
    }, []);

    const openSecretEditor = useCallback((def: SecretEditorDef) => {
        const api = apiRef.current;
        if (!api) return;

        const panelId = `secret-editor:${def.namespace}/${def.name}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.focus();
            return;
        }

        const addOptions: any = {
            id: panelId,
            component: 'secretEditor',
            title: `Edit • ${def.namespace}/${def.name}`,
            params: { name: def.name, namespace: def.namespace },
        };

        const pos = positionAfter(api, def.referencePanel);
        if (pos) addOptions.position = pos;

        api.addPanel(addOptions);
    }, []);

    const openRoleEditor = useCallback((def: RoleEditorDef) => {
        const api = apiRef.current;
        if (!api) return;

        const panelId = `role-editor:${def.namespace}/${def.name}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.focus();
            return;
        }

        const addOptions: any = {
            id: panelId,
            component: 'roleEditor',
            title: `Edit • ${def.namespace}/${def.name}`,
            params: { name: def.name, namespace: def.namespace },
        };

        const pos = positionAfter(api, def.referencePanel);
        if (pos) addOptions.position = pos;

        api.addPanel(addOptions);
    }, []);

    const openRoleBindingEditor = useCallback((def: RoleBindingEditorDef) => {
        const api = apiRef.current;
        if (!api) return;

        const panelId = `rolebinding-editor:${def.namespace}/${def.name}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.focus();
            return;
        }

        const addOptions: any = {
            id: panelId,
            component: 'roleBindingEditor',
            title: `Edit • ${def.namespace}/${def.name}`,
            params: { name: def.name, namespace: def.namespace },
        };

        const pos = positionAfter(api, def.referencePanel);
        if (pos) addOptions.position = pos;

        api.addPanel(addOptions);
    }, []);

    const openClusterResourceView = useCallback(() => {
        const api = apiRef.current;
        if (!api) return;

        const panelId = 'cluster-resource-view';
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.focus();
            return;
        }

        api.addPanel({
            id: panelId,
            component: 'clusterResource',
            title: 'Resource Graph',
            params: {},
        });
    }, []);

    const openYamlPanel = useCallback((def: YamlPanelDef) => {
        const api = apiRef.current;
        if (!api) return;

        const panelId = `yaml:${def.resourceKind}:${def.namespace}/${def.name}`;
        const existing = api.getPanel(panelId);
        if (existing) {
            existing.focus();
            return;
        }

        const addOptions: any = {
            id: panelId,
            component: 'yamlEditor',
            title: `${viewLabels[def.referencePanel] ?? def.referencePanel} • ${def.namespace}/${def.name}`,
            params: {
                resourceKind: def.resourceKind,
                name: def.name,
                namespace: def.namespace,
            },
        };

        const pos = positionAfter(api, def.referencePanel);
        if (pos) addOptions.position = pos;

        api.addPanel(addOptions);
    }, []);

    const openReceivedPanel = useCallback((panel: ReceivedPanel) => {
        const p = panel.params ?? {};
        switch (panel.componentType) {
            case 'view':
                openTab({ view: p.view ?? 'pods', title: panel.title });
                break;
            case 'yamlEditor':
                openYamlPanel({ resourceKind: p.resourceKind, name: p.name, namespace: p.namespace, referencePanel: '' });
                break;
            case 'logViewer':
                openLogPanel({ resourceKind: p.resourceKind, name: p.name, namespace: p.namespace, referencePanel: '' });
                break;
            case 'policyViewer':
                openPolicyViewer({ name: p.name, namespace: p.namespace, referencePanel: '' });
                break;
            case 'configMapEditor':
                openConfigMapEditor({ name: p.name, namespace: p.namespace, referencePanel: '' });
                break;
            case 'secretEditor':
                openSecretEditor({ name: p.name, namespace: p.namespace, referencePanel: '' });
                break;
            case 'roleEditor':
                openRoleEditor({ name: p.name, namespace: p.namespace, referencePanel: '' });
                break;
            case 'roleBindingEditor':
                openRoleBindingEditor({ name: p.name, namespace: p.namespace, referencePanel: '' });
                break;
            case 'clusterResource':
                openClusterResourceView();
                break;
            case 'applyYaml':
                openApplyYaml();
                break;
        }
    }, [openTab, openYamlPanel, openLogPanel, openPolicyViewer, openConfigMapEditor, openSecretEditor, openRoleEditor, openRoleBindingEditor, openClusterResourceView, openApplyYaml]);

    return (
        <TabContext.Provider value={{ registerApi, openTab, openYamlPanel, openLogPanel, openExecPanel, openPolicyViewer, openConfigMapEditor, openSecretEditor, openRoleEditor, openRoleBindingEditor, openTerminal, openApplyYaml, openClusterResourceView, openReceivedPanel }}>
            {children}
        </TabContext.Provider>
    );
}

export function useTabContext() {
    const ctx = useContext(TabContext);
    if (!ctx) throw new Error('useTabContext must be used within TabProvider');
    return ctx;
}
