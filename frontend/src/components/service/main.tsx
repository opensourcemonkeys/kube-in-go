import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetServices, DeleteService } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

const getTypeSeverity = (type: string): TagSeverity => {
    switch (type) {
        case 'LoadBalancer': return 'success';
        case 'NodePort':     return 'warning';
        case 'ExternalName': return 'contrast';
        default:             return 'info';
    }
};

const getStatusSeverity = (status: string): TagSeverity =>
    status === 'Active' ? 'success' : 'warning';

const formatPorts = (ports: models.ServicePortInfo[]): string => {
    if (!ports || ports.length === 0) return '-';
    return ports
        .map(p => p.node_port ? `${p.port}:${p.node_port}/${p.protocol}` : `${p.port}/${p.protocol}`)
        .join(', ');
};

const formatExternalIPs = (ips: string[]): string => {
    if (!ips || ips.length === 0) return '-';
    return ips.join(', ');
};

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    type:      { value: null, matchMode: FilterMatchMode.IN },
};

export default function ServiceListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel } = useTabContext();
    const referencePanel = `services:${clusterName}`;

    return (
        <ResourceListView<models.ServiceInfo>
            title="Service List"
            clusterName={clusterName}
            api={api}
            fetcher={GetServices}
            createFrom={models.ServiceInfo.createFrom}
            deleter={DeleteService}
            deleteLabel="service"
            pollInterval={2000}
            defaultFilters={defaultFilters}
            emptyMessage="No services found"
            onRowDoubleClick={(svc) => openYamlPanel({ clusterName, resourceKind: 'service', name: svc.name, namespace: svc.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="status" header="Status" sortable style={{ minWidth: '7rem' }}
                        body={(row: models.ServiceInfo) => <Tag value={row.status} severity={getStatusSeverity(row.status)} />} />
                    <Column field="type" header="Type" sortable filter filterField="type" showFilterMenu={false} style={{ minWidth: '9rem' }}
                        body={(row: models.ServiceInfo) => <Tag value={row.type} severity={getTypeSeverity(row.type)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('type')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="cluster_ip" header="Cluster IP" sortable style={{ minWidth: '10rem' }} />
                    <Column field="external_ips" header="External IP" style={{ minWidth: '12rem' }} body={(row: models.ServiceInfo) => formatExternalIPs(row.external_ips)} />
                    <Column header="Ports" style={{ minWidth: '14rem' }} body={(row: models.ServiceInfo) => formatPorts(row.ports)} />
                </>
            )}
        />
    );
}
