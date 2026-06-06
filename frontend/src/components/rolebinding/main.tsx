import { useEffect, useState } from 'react';

import { VscClearAll, VscSettings } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { GetRoleBindings } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

export default function RoleBindingListComponent() {
    const [items, setItems] = useState<models.RoleBindingInfo[]>([]);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const { openYamlPanel, openRoleBindingEditor } = useTabContext();

    const load = async () => {
        try {
            const data = await GetRoleBindings();
            setItems(data.map((d: any) => models.RoleBindingInfo.createFrom(d)));
        } catch {
            setItems([]);
        }
    };

    useEffect(() => {
        load();
        const id = window.setInterval(load, 10000);
        return () => window.clearInterval(id);
    }, []);

    const roleRefBody = (rowData: models.RoleBindingInfo) => (
        <span>{rowData.role_ref_kind}/{rowData.role_ref_name}</span>
    );

    const actionBody = (rowData: models.RoleBindingInfo) => (
        <Button
            icon={<VscSettings size={16} />}
            text
            size="small"
            severity="secondary"
            style={{ padding: '0.2rem', fontSize: '0.7rem' }}
            onClick={() => openRoleBindingEditor({ name: rowData.name, namespace: rowData.namespace, referencePanel: 'rolebindings' })}
        />
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Role Binding List</h3>
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
                    const rb = e.data as models.RoleBindingInfo;
                    openYamlPanel({ resourceKind: 'rolebinding', name: rb.name, namespace: rb.namespace, referencePanel: 'rolebindings' });
                }}
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No role bindings found"
            >
                <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                <Column field="namespace" header="Namespace" sortable filter filterField="namespace" filterPlaceholder="Search namespace" showFilterMenu={false} style={{ minWidth: '10rem' }} />
                <Column header="RoleRef" body={roleRefBody} style={{ minWidth: '12rem' }} />
                <Column header="Subjects" body={(rb: models.RoleBindingInfo) => (rb.subjects ?? []).length} style={{ minWidth: '7rem' }} />
                <Column field="created_at" header="Created" sortable style={{ minWidth: '12rem' }} />
                <Column header="" body={actionBody} style={{ width: '4rem', textAlign: 'center' }} />
            </DataTable>
        </div>
    );
}
