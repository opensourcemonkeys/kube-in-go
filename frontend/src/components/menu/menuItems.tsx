import { MenuItem } from 'primereact/menuitem';
import { TabDef } from '../../contexts/TabContext';

export type PanelMenuItem = MenuItem & { key?: string };

export const viewGroupMap: Record<string, string> = {
    pods: 'workloads',
    deployments: 'workloads',
    statefulsets: 'workloads',
    replicasets: 'workloads',
    daemonsets: 'workloads',
    jobs: 'workloads',
    cronjobs: 'workloads',
    services: 'networking',
    ingresses: 'networking',
    endpoints: 'networking',
    networkpolicies: 'networking',
    configmaps: 'config-security',
    secrets: 'config-security',
    serviceaccounts: 'config-security',
    roles: 'config-security',
    rolebindings: 'config-security',
    persistentvolumes: 'storage',
    persistentvolumeclaims: 'storage',
    storageclasses: 'storage',
    nodes: 'cluster',
    namespaces: 'cluster',
    events: 'cluster',
    resourcequotas: 'cluster',
    limitranges: 'cluster',
};

const createItem = (
    label: string,
    icon: string,
    view: string,
    openTab: (def: TabDef) => void,
    setActiveView: (v: string) => void,
    activeView: string
): MenuItem => ({
    label,
    icon,
    command: () => {
        setActiveView(view);
        openTab({ view, title: label, icon });
    },
    className: activeView === view ? 'text-primary font-semibold' : undefined,
});

export function getMenuItems(
    openTab: (def: TabDef) => void,
    setActiveView: (v: string) => void,
    activeView: string
): PanelMenuItem[] {
    const item = (label: string, icon: string, view: string) =>
        createItem(label, icon, view, openTab, setActiveView, activeView);

    return [
        {
            key: 'workloads',
            label: 'Workloads',
            icon: 'pi pi-box',
            items: [
                item('Pods', 'pi pi-box', 'pods'),
                item('Deployments', 'pi pi-clone', 'deployments'),
                item('StatefulSets', 'pi pi-database', 'statefulsets'),
                item('ReplicaSets', 'pi pi-copy', 'replicasets'),
                item('DaemonSets', 'pi pi-desktop', 'daemonsets'),
                item('Jobs', 'pi pi-play-circle', 'jobs'),
                item('CronJobs', 'pi pi-clock', 'cronjobs'),
            ],
        },
        {
            key: 'networking',
            label: 'Networking',
            icon: 'pi pi-globe',
            items: [
                item('Services', 'pi pi-directions-alt', 'services'),
                item('Ingresses', 'pi pi-globe', 'ingresses'),
                item('Endpoints', 'pi pi-share-alt', 'endpoints'),
                item('Network Policies', 'pi pi-shield', 'networkpolicies'),
            ],
        },
        {
            key: 'config-security',
            label: 'Config & Security',
            icon: 'pi pi-key',
            items: [
                item('ConfigMaps', 'pi pi-file-edit', 'configmaps'),
                item('Secrets', 'pi pi-key', 'secrets'),
                item('Service Accounts', 'pi pi-id-card', 'serviceaccounts'),
                item('Roles', 'pi pi-lock', 'roles'),
                item('Role Bindings', 'pi pi-link', 'rolebindings'),
            ],
        },
        {
            key: 'storage',
            label: 'Storage',
            icon: 'pi pi-folder',
            items: [
                item('Persistent Volumes', 'pi pi-folder', 'persistentvolumes'),
                item('Volume Claims', 'pi pi-inbox', 'persistentvolumeclaims'),
                item('Storage Classes', 'pi pi-briefcase', 'storageclasses'),
            ],
        },
        {
            key: 'cluster',
            label: 'Cluster',
            icon: 'pi pi-server',
            items: [
                item('Nodes', 'pi pi-server', 'nodes'),
                item('Namespaces', 'pi pi-sitemap', 'namespaces'),
                item('Events', 'pi pi-bell', 'events'),
                item('Resource Quotas', 'pi pi-chart-bar', 'resourcequotas'),
                item('Limit Ranges', 'pi pi-sliders-h', 'limitranges'),
            ],
        },
    ];
}
