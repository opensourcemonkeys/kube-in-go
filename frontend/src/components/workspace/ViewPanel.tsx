import { IDockviewPanelProps } from 'dockview';
import DataTableComponent from '../pod/main';
import DeploymentListComponent from '../deployment/main';

interface ViewPanelParams {
    view: string;
}

const viewTitles: Record<string, string> = {
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

export default function ViewPanel({ params }: IDockviewPanelProps<ViewPanelParams>) {
    const { view } = params;

    if (view === 'pods') return <DataTableComponent />;
    if (view === 'deployments') return <DeploymentListComponent />;

    return (
        <div className="card p-4">
            <h2 className="mt-0 mb-2">{viewTitles[view] ?? 'Kubernetes Resource'}</h2>
            <p className="m-0 text-color-secondary">
                This section is ready in the menu. Its detailed table can be connected next.
            </p>
        </div>
    );
}
