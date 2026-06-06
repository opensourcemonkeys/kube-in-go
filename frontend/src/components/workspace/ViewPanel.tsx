import { IDockviewPanelProps } from 'dockview';
import DataTableComponent from '../pod/main';
import DeploymentListComponent from '../deployment/main';
import StatefulSetListComponent from '../statefulset/main';
import ReplicaSetListComponent from '../replicaset/main';
import DaemonSetListComponent from '../daemonset/main';
import JobListComponent from '../job/main';
import CronJobListComponent from '../cronjob/main';
import ServiceListComponent from '../service/main';
import IngressListComponent from '../ingress/main';
import IngressClassListComponent from '../ingressclass/main';
import EndpointListComponent from '../endpoints/main';
import NetworkPolicyListComponent from '../networkpolicy/main';
import ConfigMapListComponent from '../configmap/main';
import SecretListComponent from '../secret/main';
import NodeListComponent from '../node/main';
import NamespaceListComponent from '../namespace/main';
import ResourceQuotaListComponent from '../resourcequota/main';
import EventListComponent from '../events/main';
import LimitRangeListComponent from '../limitrange/main';
import PersistentVolumeListComponent from '../persistentvolume/main';
import PersistentVolumeClaimListComponent from '../persistentvolumeclaim/main';
import StorageClassListComponent from '../storageclass/main';
import ServiceAccountListComponent from '../serviceaccount/main';
import RoleListComponent from '../role/main';
import RoleBindingListComponent from '../rolebinding/main';

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
    if (view === 'statefulsets') return <StatefulSetListComponent />;
    if (view === 'replicasets') return <ReplicaSetListComponent />;
    if (view === 'daemonsets') return <DaemonSetListComponent />;
    if (view === 'jobs') return <JobListComponent />;
    if (view === 'cronjobs') return <CronJobListComponent />;
    if (view === 'services') return <ServiceListComponent />;
    if (view === 'ingresses') return <IngressListComponent />;
    if (view === 'ingressclasses') return <IngressClassListComponent />;
    if (view === 'endpoints') return <EndpointListComponent />;
    if (view === 'networkpolicies') return <NetworkPolicyListComponent />;
    if (view === 'configmaps') return <ConfigMapListComponent />;
    if (view === 'secrets') return <SecretListComponent />;
    if (view === 'nodes') return <NodeListComponent />;
    if (view === 'namespaces') return <NamespaceListComponent />;
    if (view === 'events') return <EventListComponent />;
    if (view === 'resourcequotas') return <ResourceQuotaListComponent />;
    if (view === 'limitranges') return <LimitRangeListComponent />;
    if (view === 'persistentvolumes') return <PersistentVolumeListComponent />;
    if (view === 'persistentvolumeclaims') return <PersistentVolumeClaimListComponent />;
    if (view === 'storageclasses') return <StorageClassListComponent />;
    if (view === 'serviceaccounts') return <ServiceAccountListComponent />;
    if (view === 'roles') return <RoleListComponent />;
    if (view === 'rolebindings') return <RoleBindingListComponent />;

    return (
        <div className="card p-4">
            <h2 className="mt-0 mb-2">{viewTitles[view] ?? 'Kubernetes Resource'}</h2>
            <p className="m-0 text-color-secondary">
                This section is ready in the menu. Its detailed table can be connected next.
            </p>
        </div>
    );
}
