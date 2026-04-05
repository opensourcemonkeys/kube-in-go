import { MenuItem } from 'primereact/menuitem';
import { NavigateFunction } from 'react-router-dom';

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
    navigate: NavigateFunction,
    activeView: string
): MenuItem => ({
    label,
    icon,
    command: () => navigate(`/?view=${view}`),
    className: activeView === view ? 'text-primary font-semibold' : undefined,
});

export function getMenuItems(navigate: NavigateFunction, activeView: string): PanelMenuItem[] {
    return [
        {
            key: 'workloads',
            label: 'Workloads',
            icon: 'pi pi-box',
            items: [
                createItem('Pods', 'pi pi-box', 'pods', navigate, activeView),
                createItem('Deployments', 'pi pi-clone', 'deployments', navigate, activeView),
                createItem('StatefulSets', 'pi pi-database', 'statefulsets', navigate, activeView),
                createItem('ReplicaSets', 'pi pi-copy', 'replicasets', navigate, activeView),
                createItem('DaemonSets', 'pi pi-desktop', 'daemonsets', navigate, activeView),
                createItem('Jobs', 'pi pi-play-circle', 'jobs', navigate, activeView),
                createItem('CronJobs', 'pi pi-clock', 'cronjobs', navigate, activeView),
            ],
        },
        {
            key: 'networking',
            label: 'Networking',
            icon: 'pi pi-globe',
            items: [
                createItem('Services', 'pi pi-directions-alt', 'services', navigate, activeView),
                createItem('Ingresses', 'pi pi-globe', 'ingresses', navigate, activeView),
                createItem('Endpoints', 'pi pi-share-alt', 'endpoints', navigate, activeView),
                createItem('Network Policies', 'pi pi-shield', 'networkpolicies', navigate, activeView),
            ],
        },
        {
            key: 'config-security',
            label: 'Config & Security',
            icon: 'pi pi-key',
            items: [
                createItem('ConfigMaps', 'pi pi-file-edit', 'configmaps', navigate, activeView),
                createItem('Secrets', 'pi pi-key', 'secrets', navigate, activeView),
                createItem('Service Accounts', 'pi pi-id-card', 'serviceaccounts', navigate, activeView),
                createItem('Roles', 'pi pi-lock', 'roles', navigate, activeView),
                createItem('Role Bindings', 'pi pi-link', 'rolebindings', navigate, activeView),
            ],
        },
        {
            key: 'storage',
            label: 'Storage',
            icon: 'pi pi-folder',
            items: [
                createItem('Persistent Volumes', 'pi pi-folder', 'persistentvolumes', navigate, activeView),
                createItem('Volume Claims', 'pi pi-inbox', 'persistentvolumeclaims', navigate, activeView),
                createItem('Storage Classes', 'pi pi-briefcase', 'storageclasses', navigate, activeView),
            ],
        },
        {
            key: 'cluster',
            label: 'Cluster',
            icon: 'pi pi-server',
            items: [
                createItem('Nodes', 'pi pi-server', 'nodes', navigate, activeView),
                createItem('Namespaces', 'pi pi-sitemap', 'namespaces', navigate, activeView),
                createItem('Events', 'pi pi-bell', 'events', navigate, activeView),
                createItem('Resource Quotas', 'pi pi-chart-bar', 'resourcequotas', navigate, activeView),
                createItem('Limit Ranges', 'pi pi-sliders-h', 'limitranges', navigate, activeView),
            ],
        },
    ];
}
