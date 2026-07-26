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
import { ARRAY_IN } from '../../lib/tableFilters';

const defaultFilters: DataTableFilterMeta = {
    name:       { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace:  { value: null, matchMode: FilterMatchMode.IN },
    // Addresses/Ports satırda düz bir alan değil, `subsets` içinden türetiliyor —
    // filtre satırdaki sentetik dizilere bakar (bkz. createFrom).
    _addresses: { value: null, matchMode: ARRAY_IN },
    _ports:     { value: null, matchMode: ARRAY_IN },
};

const addressesOf = (subsets: models.EndpointSubsetInfo[]): string[] => {
    const ips: string[] = [];
    for (const s of subsets ?? []) {
        for (const a of s.addresses ?? []) ips.push(a.ip);
    }
    return ips;
};

const portsOf = (subsets: models.EndpointSubsetInfo[]): string[] => {
    const ports: string[] = [];
    for (const s of subsets ?? []) {
        for (const p of s.ports ?? []) {
            const label = p.name ? `${p.name}:${p.port}/${p.protocol}` : `${p.port}/${p.protocol}`;
            if (!ports.includes(label)) ports.push(label);
        }
    }
    return ports;
};

type EndpointRow = models.EndpointInfo & { _addresses: string[]; _ports: string[] };

const createFrom = (raw: any): EndpointRow => {
    const ep = models.EndpointInfo.createFrom(raw) as EndpointRow;
    ep._addresses = addressesOf(ep.subsets);
    ep._ports = portsOf(ep.subsets);
    return ep;
};

export default function EndpointListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel } = useTabContext();
    const referencePanel = `endpoints:${clusterName}`;

    return (
        <ResourceListView<EndpointRow>
            title="Endpoint List"
            clusterName={clusterName}
            api={api}
            fetcher={GetEndpoints}
            createFrom={createFrom}
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
                    <Column header="Addresses" filter filterField="_addresses" showFilterMenu={false} style={{ minWidth: '18rem' }}
                        body={(row: EndpointRow) => addressesOf(row.subsets).join(', ') || '-'}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('_addresses')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header="Ports" filter filterField="_ports" showFilterMenu={false} style={{ minWidth: '16rem' }}
                        body={(row: EndpointRow) => portsOf(row.subsets).join(', ') || '-'}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('_ports')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="ready" header="Ready" sortable style={{ minWidth: '7rem' }}
                        body={(row: EndpointRow) => <Tag value={String(row.ready)} severity={row.ready > 0 ? 'success' : 'secondary'} />} />
                    <Column field="not_ready" header="Not Ready" sortable style={{ minWidth: '7rem' }}
                        body={(row: EndpointRow) => (row.not_ready > 0 ? <Tag value={String(row.not_ready)} severity="warning" /> : <span style={{ color: 'var(--ink3)' }}>0</span>)} />
                </>
            )}
        />
    );
}
