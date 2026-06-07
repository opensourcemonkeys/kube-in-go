import { useEffect, useMemo, useRef, useState } from 'react';


import { VscClearAll, VscTrash, VscClose } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { GetStorageClasses } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:        { value: null, matchMode: FilterMatchMode.CONTAINS },
    provisioner: { value: null, matchMode: FilterMatchMode.IN },
};

export default function StorageClassListComponent() {
    const [items, setItems] = useState<models.StorageClassInfo[]>([]);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const provisionerOptions = useMemo(() =>
        [...new Set(items.map(i => i.provisioner).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [items]
    );

    const load = async () => {
        try {
            const data = await GetStorageClasses();
            setItems((data ?? []).map((d: any) => models.StorageClassInfo.createFrom(d)));
        } catch {
            setItems([]);
        }
    };

    useEffect(() => {
        load();
        const id = window.setInterval(load, 10000);
        return () => window.clearInterval(id);
    }, []);

    const handleRowDoubleClick = (sc: models.StorageClassInfo) => {
        openYamlPanel({
            resourceKind: 'storageclass',
            name: sc.name,
            namespace: '',
            referencePanel: 'storageclasses',
        });
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Storage Classes</h3>
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
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.StorageClassInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No storage classes found"
            >
                <Column
                    field="name"
                    header="Name"
                    sortable
                    filter
                    filterField="name"
                    filterPlaceholder="Search name"
                    showFilterMenu={false}
                    style={{ minWidth: '16rem' }}
                />
                <Column
                    header="Default"
                    style={{ minWidth: '7rem' }}
                    body={(row: models.StorageClassInfo) =>
                        row.is_default
                            ? <Tag value="Default" severity="success" />
                            : <span style={{ color: 'var(--text-color-secondary)' }}>—</span>
                    }
                />
                <Column
                    field="provisioner"
                    header="Provisioner"
                    sortable
                    filter
                    filterField="provisioner"
                    showFilterMenu={false}
                    style={{ minWidth: '20rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={provisionerOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column field="reclaim_policy" header="Reclaim Policy" sortable style={{ minWidth: '10rem' }} />
                <Column field="volume_binding_mode" header="Binding Mode" sortable style={{ minWidth: '12rem' }} />
            </DataTable>
        </div>
    );
}
