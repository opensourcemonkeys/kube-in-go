import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { MultiSelect } from 'primereact/multiselect';
import { FilterMatchMode } from 'primereact/api';
import { GetEndpoints } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
};

const formatAddresses = (subsets: models.EndpointSubsetInfo[]): string => {
    if (!subsets || subsets.length === 0) return '-';
    const ips: string[] = [];
    for (const s of subsets) {
        if (s.addresses) {
            for (const a of s.addresses) ips.push(a.ip);
        }
    }
    return ips.length > 0 ? ips.join(', ') : '-';
};

const formatPorts = (subsets: models.EndpointSubsetInfo[]): string => {
    if (!subsets || subsets.length === 0) return '-';
    const ports: string[] = [];
    for (const s of subsets) {
        if (s.ports) {
            for (const p of s.ports) {
                const label = p.name ? `${p.name}:${p.port}/${p.protocol}` : `${p.port}/${p.protocol}`;
                if (!ports.includes(label)) ports.push(label);
            }
        }
    }
    return ports.length > 0 ? ports.join(', ') : '-';
};

export default function EndpointListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel } = useTabContext();
    const referencePanel = `endpoints:${clusterName}`;

    return (
        <ResourceListView<models.EndpointInfo>
            title="Endpoint List"
            clusterName={clusterName}
            api={api}
            fetcher={GetEndpoints}
            createFrom={models.EndpointInfo.createFrom}
            pollInterval={2000}
            defaultFilters={defaultFilters}
            emptyMessage="No endpoints found"
            onRowDoubleClick={(ep) => openYamlPanel({ clusterName, resourceKind: 'endpoint', name: ep.name, namespace: ep.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header="Addresses" style={{ minWidth: '18rem' }} body={(row: models.EndpointInfo) => formatAddresses(row.subsets)} />
                    <Column header="Ports" style={{ minWidth: '16rem' }} body={(row: models.EndpointInfo) => formatPorts(row.subsets)} />
                    <Column field="ready" header="Ready" sortable style={{ minWidth: '7rem' }}
                        body={(row: models.EndpointInfo) => <Tag value={String(row.ready)} severity={row.ready > 0 ? 'success' : 'secondary'} />} />
                    <Column field="not_ready" header="Not Ready" sortable style={{ minWidth: '7rem' }}
                        body={(row: models.EndpointInfo) => (row.not_ready > 0 ? <Tag value={String(row.not_ready)} severity="warning" /> : <span style={{ color: 'var(--ink3)' }}>0</span>)} />
                </>
            )}
        />
    );
}
