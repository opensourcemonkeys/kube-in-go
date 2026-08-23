import React from 'react';
import type navEn from '../../locales/en/nav.json';
import { VscCircleLarge, VscCopy, VscDatabase, VscDesktopDownload, VscPlay, VscCalendar, VscSync, VscGlobe, VscTypeHierarchySub, VscGitCompare, VscShield, VscBug, VscNote, VscKey, VscAccount, VscLock, VscLink, VscFolder, VscInbox, VscBriefcase, VscServer, VscBell, VscGraph, VscSettings, VscPulse, VscListTree, VscDashboard } from 'react-icons/vsc';

const S = { fontSize: '0.875rem' };

// Labels are i18n keys, not text: the sidebar, the Dockview tab title and the
// YAML/describe panel headings all resolve them at render time, so a language
// switch re-labels every one of them without reopening anything.
// Deriving the view names from the catalog rather than declaring them here is
// what keeps `labelKey` a finite union of literal keys instead of `string` —
// which is the only form i18next's typed `t` will accept. Adding a view without
// its nav:item.* entry is therefore a compile error, not a raw key on screen.
export type ViewKey = keyof (typeof navEn)['item'];
export type GroupKey = keyof (typeof navEn)['group'];

export type NavItem = { labelKey: `nav:item.${ViewKey}`; view: ViewKey; icon: React.ReactNode };
export type NavGroup = { key: GroupKey; labelKey: `nav:group.${GroupKey}`; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [

    { key: 'workloads', labelKey: 'nav:group.workloads', items: [
        { labelKey: 'nav:item.pods', view: 'pods',         icon: <VscCircleLarge style={S} /> },
        { labelKey: 'nav:item.deployments', view: 'deployments',  icon: <VscCopy style={S} /> },
        { labelKey: 'nav:item.statefulsets', view: 'statefulsets', icon: <VscDatabase style={S} /> },
        { labelKey: 'nav:item.replicasets', view: 'replicasets',  icon: <VscCopy style={S} /> },
        { labelKey: 'nav:item.daemonsets', view: 'daemonsets',   icon: <VscDesktopDownload style={S} /> },
        { labelKey: 'nav:item.jobs', view: 'jobs',         icon: <VscPlay style={S} /> },
        { labelKey: 'nav:item.cronjobs', view: 'cronjobs',     icon: <VscCalendar style={S} /> },
    ]},
    { key: 'networking', labelKey: 'nav:group.networking', items: [
        { labelKey: 'nav:item.services', view: 'services',        icon: <VscSync style={S} /> },
        { labelKey: 'nav:item.ingresses', view: 'ingresses',       icon: <VscGlobe style={S} /> },
        { labelKey: 'nav:item.ingressclasses', view: 'ingressclasses',  icon: <VscTypeHierarchySub style={S} /> },
        { labelKey: 'nav:item.endpoints', view: 'endpoints',       icon: <VscGitCompare style={S} /> },
        { labelKey: 'nav:item.networkpolicies', view: 'networkpolicies', icon: <VscShield style={S} /> },
    ]},
    { key: 'config', labelKey: 'nav:group.config', items: [
        { labelKey: 'nav:item.configmaps', view: 'configmaps',          icon: <VscNote style={S} /> },
        { labelKey: 'nav:item.secrets', view: 'secrets',             icon: <VscKey style={S} /> },
    ]},
    { key: 'security', labelKey: 'nav:group.security', items: [
        { labelKey: 'nav:item.serviceaccounts', view: 'serviceaccounts', icon: <VscAccount style={S} /> },
        { labelKey: 'nav:item.roles', view: 'roles',           icon: <VscLock style={S} /> },
        { labelKey: 'nav:item.rolebindings', view: 'rolebindings',    icon: <VscLink style={S} /> },
        { labelKey: 'nav:item.securityrolemap', view: 'securityrolemap', icon: <VscTypeHierarchySub style={S} /> },
        { labelKey: 'nav:item.trivy', view: 'trivy',         icon: <VscBug style={S} /> },
    ]},
    { key: 'storage', labelKey: 'nav:group.storage', items: [
        { labelKey: 'nav:item.persistentvolumes', view: 'persistentvolumes',      icon: <VscFolder style={S} /> },
        { labelKey: 'nav:item.persistentvolumeclaims', view: 'persistentvolumeclaims', icon: <VscInbox style={S} /> },
        { labelKey: 'nav:item.storageclasses', view: 'storageclasses',         icon: <VscBriefcase style={S} /> },
    ]},
    { key: 'cluster', labelKey: 'nav:group.cluster', items: [
        { labelKey: 'nav:item.overview', view: 'overview', icon: <VscDashboard style={S} /> },
        { labelKey: 'nav:item.monitoring', view: 'monitoring',     icon: <VscPulse style={S} /> },
        { labelKey: 'nav:item.nodes', view: 'nodes',          icon: <VscServer style={S} /> },
        { labelKey: 'nav:item.namespaces', view: 'namespaces',     icon: <VscTypeHierarchySub style={S} /> },
        { labelKey: 'nav:item.events', view: 'events',         icon: <VscBell style={S} /> },
        { labelKey: 'nav:item.resourcequotas', view: 'resourcequotas', icon: <VscGraph style={S} /> },
        { labelKey: 'nav:item.limitranges', view: 'limitranges',    icon: <VscSettings style={S} /> },
        { labelKey: 'nav:item.crds', view: 'crds',           icon: <VscListTree style={S} /> },
    ]},
];

export const VIEW_GROUP: Record<string, string> = Object.fromEntries(
    NAV_GROUPS.flatMap(g => g.items.map(item => [item.view, g.key]))
);
