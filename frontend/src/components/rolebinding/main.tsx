import { useEffect, useMemo, useState } from 'react';

import { VscClearAll, VscSettings } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { GetRoleBindings } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
};

export default function RoleBindingListComponent({ clusterName }: { clusterName: string }) {
    const [items, setItems] = useState<models.RoleBindingInfo[]>([]);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const { openYamlPanel, openRoleBindingEditor } = useTabContext();

    const namespaceOptions = useMemo(() =>
        [...new Set(items.map(i => i.namespace).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [items]
    );

    const load = async () => {
        try {
            const data = await GetRoleBindings(clusterName);
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
            onClick={() => openRoleBindingEditor({ clusterName,
            name: rowData.name, namespace: rowData.namespace, referencePanel: `rolebindings:${clusterName}` })}
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
                    openYamlPanel({ clusterName,
            resourceKind: 'rolebinding', name: rb.name, namespace: rb.namespace, referencePanel: `rolebindings:${clusterName}` });
                }}
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No role bindings found"
            >
                <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }} filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={namespaceOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )} />
                <Column header="RoleRef" body={roleRefBody} style={{ minWidth: '12rem' }} />
                <Column header="Subjects" body={(rb: models.RoleBindingInfo) => (rb.subjects ?? []).length} style={{ minWidth: '7rem' }} />
                <Column field="created_at" header="Created" sortable style={{ minWidth: '12rem' }} />
                <Column header="" body={actionBody} style={{ width: '4rem', textAlign: 'center' }} />
            </DataTable>
        </div>
    );
}
