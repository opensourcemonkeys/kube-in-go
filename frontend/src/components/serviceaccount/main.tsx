import { useEffect, useState } from 'react';
import { VscClearAll } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { GetServiceAccounts } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

export default function ServiceAccountListComponent() {
    const [items, setItems] = useState<models.ServiceAccountInfo[]>([]);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const { openYamlPanel } = useTabContext();

    const load = async () => {
        try {
            const data = await GetServiceAccounts();
            setItems(data.map((d: any) => models.ServiceAccountInfo.createFrom(d)));
        } catch {
            setItems([]);
        }
    };

    useEffect(() => {
        load();
        const id = window.setInterval(load, 10000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Service Account List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon={<VscClearAll size={16} />}
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                </div>
            </div>

            <DataTable
                value={items}
                dataKey="name"
                filters={filters}
                onFilter={e => setFilters(e.filters)}
                filterDisplay="row"
                onRowDoubleClick={(e: any) => {
                    const sa = e.data as models.ServiceAccountInfo;
                    openYamlPanel({ resourceKind: 'serviceaccount', name: sa.name, namespace: sa.namespace, referencePanel: 'serviceaccounts' });
                }}
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No service accounts found"
            >
                <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                <Column field="namespace" header="Namespace" sortable filter filterField="namespace" filterPlaceholder="Search namespace" showFilterMenu={false} style={{ minWidth: '10rem' }} />
                <Column field="secrets" header="Secrets" sortable style={{ minWidth: '7rem' }} />
                <Column field="created_at" header="Created" sortable style={{ minWidth: '12rem' }} />
            </DataTable>
        </div>
    );
}
