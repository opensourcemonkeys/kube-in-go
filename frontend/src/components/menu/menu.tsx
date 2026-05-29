import { useState, useEffect } from 'react';
import { useTabContext } from '../../contexts/TabContext';

const SIDEBAR_STATE_KEY = 'kube-sidebar-state';

const VIEW_GROUP: Record<string, string> = {
    pods: 'workloads', deployments: 'workloads', statefulsets: 'workloads',
    replicasets: 'workloads', daemonsets: 'workloads', jobs: 'workloads', cronjobs: 'workloads',
    services: 'networking', ingresses: 'networking', endpoints: 'networking', networkpolicies: 'networking',
    configmaps: 'config', secrets: 'config', serviceaccounts: 'config', roles: 'config', rolebindings: 'config',
    persistentvolumes: 'storage', persistentvolumeclaims: 'storage', storageclasses: 'storage',
    nodes: 'cluster', namespaces: 'cluster', events: 'cluster', resourcequotas: 'cluster', limitranges: 'cluster',
};

type NavItem = { label: string; view: string; icon: string };
type NavGroup = { key: string; label: string; sectionIcon: React.ReactNode; items: NavItem[] };

const WorkloadsIcon = () => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M2.5 6h11M6 2.5v11"/>
    </svg>
);
const NetworkIcon = () => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2q-3.5 6 0 12M8 2q3.5 6 0 12"/>
    </svg>
);
const ConfigIcon = () => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="5.5" cy="8" r="3"/><path d="M8.3 8H14M12 8v3M14 8v2.5"/>
    </svg>
);
const StorageIcon = () => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M1.5 4.5a1 1 0 0 1 1-1H6l1.5 1.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/>
    </svg>
);
const ClusterIcon = () => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
        <rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>
    </svg>
);

const NAV: NavGroup[] = [
    { key: 'workloads', label: 'WORKLOADS', sectionIcon: <WorkloadsIcon />, items: [
        { label: 'Pods',         view: 'pods',         icon: 'pi pi-circle' },
        { label: 'Deployments',  view: 'deployments',  icon: 'pi pi-clone' },
        { label: 'StatefulSets', view: 'statefulsets', icon: 'pi pi-database' },
        { label: 'ReplicaSets',  view: 'replicasets',  icon: 'pi pi-copy' },
        { label: 'DaemonSets',   view: 'daemonsets',   icon: 'pi pi-desktop' },
        { label: 'Jobs',         view: 'jobs',         icon: 'pi pi-play-circle' },
        { label: 'CronJobs',     view: 'cronjobs',     icon: 'pi pi-clock' },
    ]},
    { key: 'networking', label: 'NETWORKING', sectionIcon: <NetworkIcon />, items: [
        { label: 'Services',         view: 'services',        icon: 'pi pi-arrows-h' },
        { label: 'Ingresses',        view: 'ingresses',       icon: 'pi pi-globe' },
        { label: 'Endpoints',        view: 'endpoints',       icon: 'pi pi-share-alt' },
        { label: 'Network Policies', view: 'networkpolicies', icon: 'pi pi-shield' },
    ]},
    { key: 'config', label: 'CONFIG & SECURITY', sectionIcon: <ConfigIcon />, items: [
        { label: 'ConfigMaps',       view: 'configmaps',         icon: 'pi pi-file-edit' },
        { label: 'Secrets',          view: 'secrets',            icon: 'pi pi-key' },
        { label: 'Service Accounts', view: 'serviceaccounts',    icon: 'pi pi-id-card' },
        { label: 'Roles',            view: 'roles',              icon: 'pi pi-lock' },
        { label: 'Role Bindings',    view: 'rolebindings',       icon: 'pi pi-link' },
    ]},
    { key: 'storage', label: 'STORAGE', sectionIcon: <StorageIcon />, items: [
        { label: 'Persistent Volumes', view: 'persistentvolumes',      icon: 'pi pi-folder' },
        { label: 'Volume Claims',      view: 'persistentvolumeclaims', icon: 'pi pi-inbox' },
        { label: 'Storage Classes',    view: 'storageclasses',         icon: 'pi pi-briefcase' },
    ]},
    { key: 'cluster', label: 'CLUSTER', sectionIcon: <ClusterIcon />, items: [
        { label: 'Nodes',           view: 'nodes',          icon: 'pi pi-server' },
        { label: 'Namespaces',      view: 'namespaces',     icon: 'pi pi-sitemap' },
        { label: 'Events',          view: 'events',         icon: 'pi pi-bell' },
        { label: 'Resource Quotas', view: 'resourcequotas', icon: 'pi pi-chart-bar' },
        { label: 'Limit Ranges',    view: 'limitranges',    icon: 'pi pi-sliders-h' },
    ]},
];

export default function SideMenu() {
    const { openTab } = useTabContext();
    const [activeView, setActiveView] = useState('pods');
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(SIDEBAR_STATE_KEY) ?? '{}');
            return Object.keys(saved).length > 0 ? saved : { workloads: true };
        } catch { return { workloads: true }; }
    });

    const navigate = (item: NavItem) => {
        setActiveView(item.view);
        openTab({ view: item.view, title: item.label, icon: item.icon });
    };

    const toggleGroup = (key: string) => {
        setExpanded(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(next));
            return next;
        });
    };

    useEffect(() => {
        const grp = VIEW_GROUP[activeView];
        if (!grp) return;
        setExpanded(prev => {
            if (prev[grp]) return prev;
            const next = { ...prev, [grp]: true };
            localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(next));
            return next;
        });
    }, [activeView]);

    return (
        <nav id="tour-sidebar" className="sidebar-nav">
            {NAV.map(group => (
                <div key={group.key} className="sidebar-section">
                    <button
                        className="sidebar-section__toggle"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={expanded[group.key]}
                    >
                        <svg
                            className="sidebar-section__chevron"
                            style={{ transform: expanded[group.key] ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                            width="11" height="11" viewBox="0 0 16 16"
                            fill="none" stroke="currentColor" strokeWidth="1.6"
                        >
                            <path d="M4 6l4 4 4-4"/>
                        </svg>
                        <span className="sidebar-section__badge">
                            <span className="sidebar-section__badge-icon">{group.sectionIcon}</span>
                            <span className="sidebar-section__badge-label">{group.label}</span>
                        </span>
                    </button>
                    {expanded[group.key] && (
                        <div className="sidebar-section__items">
                            {group.items.map(item => (
                                <button
                                    key={item.view}
                                    className={`sidebar-item${activeView === item.view ? ' sidebar-item--active' : ''}`}
                                    onClick={() => navigate(item)}
                                >
                                    <i className={`${item.icon} sidebar-item__icon`} />
                                    <span className="sidebar-item__label">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </nav>
    );
}
