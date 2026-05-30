import { useEffect, useRef, useState } from 'react';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetEndpoints } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
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

export default function EndpointListComponent() {
    const [endpoints, setEndpoints] = useState<models.EndpointInfo[]>([]);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const loadEndpoints = async () => {
        try {
            const items = await GetEndpoints();
            setEndpoints(items.map((item: any) => models.EndpointInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load endpoints:', error);
            setEndpoints([]);
        }
    };

    useEffect(() => {
        loadEndpoints();
        const intervalId = window.setInterval(loadEndpoints, 2000);
        return () => window.clearInterval(intervalId);
    }, []);

    const handleRowDoubleClick = (ep: models.EndpointInfo) => {
        openYamlPanel({
            resourceKind: 'endpoint',
            name: ep.name,
            namespace: ep.namespace,
            referencePanel: 'endpoints',
        });
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Endpoint List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon="pi pi-filter-slash"
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                </div>
            </div>

            <DataTable
                value={endpoints}
                dataKey="name"
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.EndpointInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No endpoints found"
            >
                <Column
                    field="name"
                    header="Name"
                    sortable
                    filter
                    filterField="name"
                    filterPlaceholder="Search name"
                    showFilterMenu={false}
                    style={{ minWidth: '14rem' }}
                />
                <Column
                    field="namespace"
                    header="Namespace"
                    sortable
                    filter
                    filterField="namespace"
                    filterPlaceholder="Search namespace"
                    showFilterMenu={false}
                    style={{ minWidth: '10rem' }}
                />
                <Column
                    header="Addresses"
                    style={{ minWidth: '18rem' }}
                    body={(row: models.EndpointInfo) => formatAddresses(row.subsets)}
                />
                <Column
                    header="Ports"
                    style={{ minWidth: '16rem' }}
                    body={(row: models.EndpointInfo) => formatPorts(row.subsets)}
                />
                <Column
                    field="ready"
                    header="Ready"
                    sortable
                    style={{ minWidth: '7rem' }}
                    body={(row: models.EndpointInfo) => (
                        <Tag
                            value={String(row.ready)}
                            severity={row.ready > 0 ? 'success' : 'secondary'}
                        />
                    )}
                />
                <Column
                    field="not_ready"
                    header="Not Ready"
                    sortable
                    style={{ minWidth: '7rem' }}
                    body={(row: models.EndpointInfo) => (
                        row.not_ready > 0
                            ? <Tag value={String(row.not_ready)} severity="warning" />
                            : <span style={{ color: 'var(--ink3)' }}>0</span>
                    )}
                />
            </DataTable>
        </div>
    );
}
