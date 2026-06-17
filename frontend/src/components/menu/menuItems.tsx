import React from 'react';
import { VscCircleLarge, VscCopy, VscDatabase, VscDesktopDownload, VscPlay, VscCalendar, VscSync, VscGlobe, VscTypeHierarchySub, VscGitCompare, VscShield, VscBug, VscNote, VscKey, VscAccount, VscLock, VscLink, VscFolder, VscInbox, VscBriefcase, VscServer, VscBell, VscGraph, VscSettings, VscPulse } from 'react-icons/vsc';

const S = { fontSize: '0.875rem' };

export type NavItem = { label: string; view: string; icon: React.ReactNode };
export type NavGroup = { key: string; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
    { key: 'workloads', label: 'WORKLOADS', items: [
        { label: 'Pods',         view: 'pods',         icon: <VscCircleLarge style={S} /> },
        { label: 'Deployments',  view: 'deployments',  icon: <VscCopy style={S} /> },
        { label: 'StatefulSets', view: 'statefulsets', icon: <VscDatabase style={S} /> },
        { label: 'ReplicaSets',  view: 'replicasets',  icon: <VscCopy style={S} /> },
        { label: 'DaemonSets',   view: 'daemonsets',   icon: <VscDesktopDownload style={S} /> },
        { label: 'Jobs',         view: 'jobs',         icon: <VscPlay style={S} /> },
        { label: 'CronJobs',     view: 'cronjobs',     icon: <VscCalendar style={S} /> },
    ]},
    { key: 'networking', label: 'NETWORKING', items: [
        { label: 'Services',         view: 'services',        icon: <VscSync style={S} /> },
        { label: 'Ingresses',        view: 'ingresses',       icon: <VscGlobe style={S} /> },
        { label: 'Ingress Classes',  view: 'ingressclasses',  icon: <VscTypeHierarchySub style={S} /> },
        { label: 'Endpoints',        view: 'endpoints',       icon: <VscGitCompare style={S} /> },
        { label: 'Network Policies', view: 'networkpolicies', icon: <VscShield style={S} /> },
    ]},
    { key: 'config', label: 'CONFIG & SECRETS', items: [
        { label: 'ConfigMaps',       view: 'configmaps',          icon: <VscNote style={S} /> },
        { label: 'Secrets',          view: 'secrets',             icon: <VscKey style={S} /> },
    ]},
    { key: 'security', label: 'SECURITY', items: [
        { label: 'Service Accounts',  view: 'serviceaccounts', icon: <VscAccount style={S} /> },
        { label: 'Roles',             view: 'roles',           icon: <VscLock style={S} /> },
        { label: 'Role Bindings',     view: 'rolebindings',    icon: <VscLink style={S} /> },
        { label: 'Security Role Map', view: 'securityrolemap', icon: <VscTypeHierarchySub style={S} /> },
        { label: 'Vulnerability Scan', view: 'trivy',         icon: <VscBug style={S} /> },
    ]},
    { key: 'storage', label: 'STORAGE', items: [
        { label: 'Persistent Volumes', view: 'persistentvolumes',      icon: <VscFolder style={S} /> },
        { label: 'Volume Claims',      view: 'persistentvolumeclaims', icon: <VscInbox style={S} /> },
        { label: 'Storage Classes',    view: 'storageclasses',         icon: <VscBriefcase style={S} /> },
    ]},
    { key: 'cluster', label: 'CLUSTER', items: [
        { label: 'Monitoring',      view: 'monitoring',     icon: <VscPulse style={S} /> },
        { label: 'Nodes',           view: 'nodes',          icon: <VscServer style={S} /> },
        { label: 'Namespaces',      view: 'namespaces',     icon: <VscTypeHierarchySub style={S} /> },
        { label: 'Events',          view: 'events',         icon: <VscBell style={S} /> },
        { label: 'Resource Quotas', view: 'resourcequotas', icon: <VscGraph style={S} /> },
        { label: 'Limit Ranges',    view: 'limitranges',    icon: <VscSettings style={S} /> },
    ]},
];

export const VIEW_GROUP: Record<string, string> = Object.fromEntries(
    NAV_GROUPS.flatMap(g => g.items.map(item => [item.view, g.key]))
);
