import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { VscListFlat } from 'react-icons/vsc';
import { GetDeployments, DeleteDeployment } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';
import WorkloadActions from '../shared/WorkloadActions';
import { useT } from '../../i18n/useT';

const getReplicasSeverity = (ready: number, total: number): 'success' | 'warning' | 'danger' => {
    if (total === 0) return 'warning';
    if (ready === total) return 'success';
    if (ready === 0) return 'danger';
    return 'warning';
};

const getStatusSeverity = (status: string): 'success' | 'warning' | 'danger' | 'secondary' => {
    switch (status) {
        case 'Available':   return 'success';
        case 'Progressing': return 'warning';
        case 'Degraded':    return 'danger';
        default:            return 'secondary';
    }
};

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    status:    { value: null, matchMode: FilterMatchMode.IN },
};

export default function DeploymentListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const t = useT();
    const { openYamlPanel, openLogPanel } = useTabContext();
    const referencePanel = `deployments:${clusterName}`;

    return (
        <ResourceListView<models.DeploymentInfo>
            title={t('resources:deployment.title')}
            clusterName={clusterName}
            api={api}
            fetcher={GetDeployments}
            createFrom={models.DeploymentInfo.createFrom}
            deleter={DeleteDeployment}
            deleteLabel="deployment"
            pollInterval={2000}
            describeResource="deployments"
            portForward={{ kind: 'deployment' }}
            defaultFilters={defaultFilters}
            emptyMessage={t('resources:deployment.empty')}
            onRowDoubleClick={(dep) => openYamlPanel({ clusterName, resourceKind: 'deployment', name: dep.name, namespace: dep.namespace, referencePanel })}
            columns={({ buildInOptions, reload, toastRef }) => (
                <>
                    <Column field="name" header={t('resources:column.name')} sortable filter filterField="name" filterPlaceholder={t('resources:filter.searchName')} showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header={t('resources:column.namespace')} sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder={t('filter.all')} filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="status" header={t('resources:column.status')} sortable filter filterField="status" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        body={(row: models.DeploymentInfo) => <Tag value={row.status} severity={getStatusSeverity(row.status)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('status')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder={t('filter.all')} filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header={t('resources:column.replicas')} sortable sortField="replicas" style={{ minWidth: '9rem' }}
                        body={(row: models.DeploymentInfo) => (
                            <Tag value={`${row.ready_replicas} / ${row.replicas}`} severity={getReplicasSeverity(row.ready_replicas, row.replicas)} />
                        )} />
                    <Column header="" style={{ width: '7.5rem', textAlign: 'center' }}
                        body={(row: models.DeploymentInfo) => (
                            <>
                                <Button icon={<VscListFlat size={16} />} text size="small" severity="secondary" style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                                    onClick={() => openLogPanel({ clusterName, resourceKind: 'deployment', name: row.name, namespace: row.namespace, referencePanel })} />
                                <WorkloadActions
                                    clusterName={clusterName} name={row.name} namespace={row.namespace}
                                    reload={reload} toastRef={toastRef}
                                    scale={{ kind: 'deployment', replicas: row.replicas }}
                                    restart={{ kind: 'deployment' }} />
                            </>
                        )} />
                </>
            )}
        />
    );
}
