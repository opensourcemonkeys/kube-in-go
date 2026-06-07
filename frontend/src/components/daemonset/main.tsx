import { useEffect, useMemo, useRef, useState } from 'react';


import { VscClearAll, VscTrash, VscClose, VscListFlat } from 'react-icons/vsc';

import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { GetDaemonSets, DeleteDaemonSet } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext, LogPanelDef } from '../../contexts/TabContext';

function DaemonSetDesiredBody({ row }: { row: models.DaemonSetInfo }) {
    return (
        <Tag
            value={`${row.number_ready} / ${row.desired_number_scheduled}`}
            severity={getReadySeverity(row.number_ready, row.desired_number_scheduled)}
        />
    );
}

function DaemonSetCurrentBody({ row }: { row: models.DaemonSetInfo }) {
    return (
        <Tag
            value={`${row.current_number_scheduled} current / ${row.number_available} available`}
            severity={row.number_available === row.desired_number_scheduled ? 'success' : 'warning'}
        />
    );
}

function DaemonSetActionsBody({ row, clusterName, onOpenLog }: { row: models.DaemonSetInfo; clusterName: string; onOpenLog: (def: LogPanelDef) => void }) {
    return (
        <Button
            icon={<VscListFlat size={16} />}
            text
            size="small"
            severity="secondary"
            style={{ padding: '0.2rem', fontSize: '0.7rem' }}
            onClick={() => onOpenLog({ clusterName, resourceKind: 'daemonset', name: row.name, namespace: row.namespace, referencePanel: `daemonsets:${clusterName}` })}
        />
    );
}

const getReadySeverity = (ready: number, desired: number): 'success' | 'warning' | 'danger' => {
    if (desired === 0) return 'warning';
    if (ready === desired) return 'success';
    if (ready === 0) return 'danger';
    return 'warning';
};

const getStatusSeverity = (status: string): 'success' | 'warning' | 'danger' | 'secondary' => {
    switch (status) {
        case 'Available':     return 'success';
        case 'Degraded':      return 'danger';
        case 'Not Scheduled': return 'secondary';
        default:              return 'secondary';
    }
};

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    status:    { value: null, matchMode: FilterMatchMode.IN },
};

export default function DaemonSetListComponent({ clusterName }: { clusterName: string }) {
    const [items, setItems] = useState<models.DaemonSetInfo[]>([]);
    const [selected, setSelected] = useState<models.DaemonSetInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel, openLogPanel } = useTabContext();

    const namespaceOptions = useMemo(() =>
        [...new Set(items.map(i => i.namespace).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [items]
    );
    const statusOptions = useMemo(() =>
        [...new Set(items.map(i => i.status).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [items]
    );

    const load = async () => {
        try {
            const data = await GetDaemonSets(clusterName);
            setItems(data.map((item: any) => models.DaemonSetInfo.createFrom(item)));
        } catch {
            setItems([]);
        }
    };

    useEffect(() => {
        load();
        const id = window.setInterval(load, 2000);
        return () => window.clearInterval(id);
    }, []);

    const handleDeleteSelected = async () => {
        if (selected.length === 0) { setDeleteDialogVisible(false); return; }
        setDeleting(true);
        for (const d of [...selected]) {
            try {
                await DeleteDaemonSet(clusterName, d.name, d.namespace);
                toast.current?.show({ severity: 'success', summary: 'Deleted', detail: `${d.namespace}/${d.name}`, life: 2500 });
            } catch {
                toast.current?.show({ severity: 'error', summary: 'Delete failed', detail: `${d.namespace}/${d.name}`, life: 3500 });
            }
        }
        setSelected([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await load();
    };

    const handleRowDoubleClick = (d: models.DaemonSetInfo) => {
        openYamlPanel({ clusterName,
            resourceKind: 'daemonset', name: d.name, namespace: d.namespace, referencePanel: `daemonsets:${clusterName}` });
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon={<VscClose size={16} />} text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon={<VscTrash size={16} />} severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>DaemonSet List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button icon={<VscClearAll size={16} />} text severity="secondary" onClick={() => setFilters(defaultFilters)} tooltip="Clear filters" tooltipOptions={{ position: 'left' }} />
                    <Button label="Delete Selected" icon={<VscTrash size={16} />} severity="danger" onClick={() => { if (selected.length > 0) setDeleteDialogVisible(true); }} disabled={selected.length === 0 || deleting} />
                </div>
            </div>

            <DataTable
                value={items}
                dataKey="name"
                selectionMode="multiple"
                selection={selected}
                onSelectionChange={(e) => setSelected(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.DaemonSetInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No daemonsets found"
            >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ minWidth: '3rem', maxWidth: '3rem' }} />
                <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={namespaceOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    field="status"
                    header="Status"
                    sortable
                    filter
                    filterField="status"
                    showFilterMenu={false}
                    style={{ minWidth: '10rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={statusOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                    body={(row: models.DaemonSetInfo) => (
                        <Tag value={row.status} severity={getStatusSeverity(row.status)} />
                    )}
                />
                <Column
                    header="Desired / Ready"
                    sortable
                    sortField="desired_number_scheduled"
                    style={{ minWidth: '11rem' }}
                    body={(row: models.DaemonSetInfo) => <DaemonSetDesiredBody row={row} />}
                />
                <Column
                    header="Current / Available"
                    sortable
                    sortField="current_number_scheduled"
                    style={{ minWidth: '12rem' }}
                    body={(row: models.DaemonSetInfo) => <DaemonSetCurrentBody row={row} />}
                />
                <Column
                    header=""
                    style={{ width: '4rem', textAlign: 'center' }}
                    body={(row: models.DaemonSetInfo) => <DaemonSetActionsBody row={row} clusterName={clusterName} onOpenLog={openLogPanel} />}
                />
            </DataTable>

            <Dialog
                header="Delete DaemonSet Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected daemonset records?</p>
                <ul className="m-0 pl-3">
                    {selected.map((d) => <li key={`${d.namespace}-${d.name}`}>{d.namespace}/{d.name}</li>)}
                </ul>
            </Dialog>
        </div>
    );
}
