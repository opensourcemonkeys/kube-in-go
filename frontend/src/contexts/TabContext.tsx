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
    icon?: string;
}

export interface YamlPanelDef {
    resourceKind: 'pod' | 'deployment';
    name: string;
    namespace: string;
    /** dockview panel id of the list panel to split beside */
    referencePanel: string;
}

interface TabContextValue {
    registerApi: (api: DockviewApi) => void;
    openTab: (def: TabDef) => void;
    openYamlPanel: (def: YamlPanelDef) => void;
    openTerminal: () => void;
    openApplyYaml: () => void;
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
            params: { view: def.view, icon: def.icon ?? '' },
        });
    }, []);

    const openTerminal = useCallback(() => {
        const api = apiRef.current;
        if (!api) return;

        terminalCounterRef.current += 1;
        const n = terminalCounterRef.current;
        const sessionId = `terminal-${n}`;

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
            title: n === 1 ? 'Apply YAML' : `Apply YAML ${n}`,
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

        if (api.getPanel(def.referencePanel)) {
            addOptions.position = { referencePanel: def.referencePanel, direction: 'within' };
        }

        api.addPanel(addOptions);
    }, []);

    return (
        <TabContext.Provider value={{ registerApi, openTab, openYamlPanel, openTerminal, openApplyYaml }}>
            {children}
        </TabContext.Provider>
    );
}

export function useTabContext() {
    const ctx = useContext(TabContext);
    if (!ctx) throw new Error('useTabContext must be used within TabProvider');
    return ctx;
}
