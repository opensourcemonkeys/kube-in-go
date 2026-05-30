export type NavItem = { label: string; view: string; icon: string };
export type NavGroup = { key: string; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
    { key: 'workloads', label: 'WORKLOADS', items: [
        { label: 'Pods',         view: 'pods',         icon: 'pi pi-circle' },
        { label: 'Deployments',  view: 'deployments',  icon: 'pi pi-clone' },
        { label: 'StatefulSets', view: 'statefulsets', icon: 'pi pi-database' },
        { label: 'ReplicaSets',  view: 'replicasets',  icon: 'pi pi-copy' },
        { label: 'DaemonSets',   view: 'daemonsets',   icon: 'pi pi-desktop' },
        { label: 'Jobs',         view: 'jobs',         icon: 'pi pi-play-circle' },
        { label: 'CronJobs',     view: 'cronjobs',     icon: 'pi pi-clock' },
    ]},
    { key: 'networking', label: 'NETWORKING', items: [
        { label: 'Services',         view: 'services',        icon: 'pi pi-arrows-h' },
        { label: 'Ingresses',        view: 'ingresses',       icon: 'pi pi-globe' },
        { label: 'Ingress Classes',  view: 'ingressclasses',  icon: 'pi pi-sitemap' },
        { label: 'Endpoints',        view: 'endpoints',       icon: 'pi pi-share-alt' },
        { label: 'Network Policies', view: 'networkpolicies', icon: 'pi pi-shield' },
    ]},
    { key: 'config', label: 'CONFIG & SECURITY', items: [
        { label: 'ConfigMaps',       view: 'configmaps',          icon: 'pi pi-file-edit' },
        { label: 'Secrets',          view: 'secrets',             icon: 'pi pi-key' },
        { label: 'Service Accounts', view: 'serviceaccounts',     icon: 'pi pi-id-card' },
        { label: 'Roles',            view: 'roles',               icon: 'pi pi-lock' },
        { label: 'Role Bindings',    view: 'rolebindings',        icon: 'pi pi-link' },
    ]},
    { key: 'storage', label: 'STORAGE', items: [
        { label: 'Persistent Volumes', view: 'persistentvolumes',      icon: 'pi pi-folder' },
        { label: 'Volume Claims',      view: 'persistentvolumeclaims', icon: 'pi pi-inbox' },
        { label: 'Storage Classes',    view: 'storageclasses',         icon: 'pi pi-briefcase' },
    ]},
    { key: 'cluster', label: 'CLUSTER', items: [
        { label: 'Nodes',           view: 'nodes',          icon: 'pi pi-server' },
        { label: 'Namespaces',      view: 'namespaces',     icon: 'pi pi-sitemap' },
        { label: 'Events',          view: 'events',         icon: 'pi pi-bell' },
        { label: 'Resource Quotas', view: 'resourcequotas', icon: 'pi pi-chart-bar' },
        { label: 'Limit Ranges',    view: 'limitranges',    icon: 'pi pi-sliders-h' },
    ]},
];

export const VIEW_GROUP: Record<string, string> = Object.fromEntries(
    NAV_GROUPS.flatMap(g => g.items.map(item => [item.view, g.key]))
);
