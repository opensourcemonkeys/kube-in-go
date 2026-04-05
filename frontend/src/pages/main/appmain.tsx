import SideMenu from '../../components/menu/menu';
import DataTableComponent from '../../components/pod/main';
import { useSearchParams } from 'react-router-dom';

function Appmain() {
    const [searchParams] = useSearchParams();
    const currentView = searchParams.get('view') ?? 'pods';

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

    const renderContent = () => {
        if (currentView === 'pods') {
            return <DataTableComponent />;
        }

        return (
            <div className="card p-4">
                <h2 className="mt-0 mb-2">{viewTitles[currentView] ?? 'Kubernetes Resource'}</h2>
                <p className="m-0 text-color-secondary">
                    This section is ready in the menu. Its detailed table can be connected next.
                </p>
            </div>
        );
    };

    return (
        <div id="appmain">
            <div className="grid">
                <div className="col-3">
                    <SideMenu />
                </div>

                <div className="col-9">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}

export default Appmain
