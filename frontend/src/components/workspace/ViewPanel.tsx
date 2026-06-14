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
import SecurityRoleMap from '../security/SecurityRoleMap';

interface ViewPanelParams {
    view: string;
    clusterName: string;
}

export default function ViewPanel({ params, api }: IDockviewPanelProps<ViewPanelParams>) {
    const { view, clusterName } = params;
    const cn = clusterName ?? '';

    if (view === 'pods') return <DataTableComponent clusterName={cn} />;
    if (view === 'deployments') return <DeploymentListComponent clusterName={cn} />;
    if (view === 'statefulsets') return <StatefulSetListComponent clusterName={cn} />;
    if (view === 'replicasets') return <ReplicaSetListComponent clusterName={cn} />;
    if (view === 'daemonsets') return <DaemonSetListComponent clusterName={cn} />;
    if (view === 'jobs') return <JobListComponent clusterName={cn} />;
    if (view === 'cronjobs') return <CronJobListComponent clusterName={cn} />;
    if (view === 'services') return <ServiceListComponent clusterName={cn} />;
    if (view === 'ingresses') return <IngressListComponent clusterName={cn} />;
    if (view === 'ingressclasses') return <IngressClassListComponent clusterName={cn} />;
    if (view === 'endpoints') return <EndpointListComponent clusterName={cn} />;
    if (view === 'networkpolicies') return <NetworkPolicyListComponent clusterName={cn} />;
    if (view === 'configmaps') return <ConfigMapListComponent clusterName={cn} />;
    if (view === 'secrets') return <SecretListComponent clusterName={cn} />;
    if (view === 'nodes') return <NodeListComponent clusterName={cn} />;
    if (view === 'namespaces') return <NamespaceListComponent clusterName={cn} />;
    if (view === 'events') return <EventListComponent clusterName={cn} api={api} />;
    if (view === 'resourcequotas') return <ResourceQuotaListComponent clusterName={cn} />;
    if (view === 'limitranges') return <LimitRangeListComponent clusterName={cn} />;
    if (view === 'persistentvolumes') return <PersistentVolumeListComponent clusterName={cn} />;
    if (view === 'persistentvolumeclaims') return <PersistentVolumeClaimListComponent clusterName={cn} />;
    if (view === 'storageclasses') return <StorageClassListComponent clusterName={cn} />;
    if (view === 'serviceaccounts') return <ServiceAccountListComponent clusterName={cn} />;
    if (view === 'roles') return <RoleListComponent clusterName={cn} />;
    if (view === 'rolebindings') return <RoleBindingListComponent clusterName={cn} />;
    if (view === 'securityrolemap') return <SecurityRoleMap clusterName={cn} />;

    return (
        <div className="card p-4">
            <h2 className="mt-0 mb-2">{view}</h2>
            <p className="m-0 text-color-secondary">This resource view is not yet connected.</p>
        </div>
    );
}
