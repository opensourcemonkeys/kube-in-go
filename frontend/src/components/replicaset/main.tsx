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
import { GetReplicaSets, DeleteReplicaSet } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext, LogPanelDef } from '../../contexts/TabContext';

function ReplicaSetReplicasBody({ row }: { row: models.ReplicaSetInfo }) {
    return <Tag value={`${row.ready_replicas} / ${row.replicas}`} severity={getReplicasSeverity(row.ready_replicas, row.replicas)} />;
}

function ReplicaSetAvailableBody({ row }: { row: models.ReplicaSetInfo }) {
    return <Tag value={`${row.available_replicas} available`} severity={row.available_replicas > 0 ? 'success' : 'danger'} />;
}

function ReplicaSetActionsBody({ row, clusterName, onOpenLog }: { row: models.ReplicaSetInfo; clusterName: string; onOpenLog: (def: LogPanelDef) => void }) {
    return (
        <Button
            icon={<VscListFlat size={16} />}
            text
            size="small"
            severity="secondary"
            style={{ padding: '0.2rem', fontSize: '0.7rem' }}
            onClick={() => onOpenLog({ clusterName, resourceKind: 'replicaset', name: row.name, namespace: row.namespace, referencePanel: `replicasets:${clusterName}` })}
        />
    );
}

const getReplicasSeverity = (ready: number, total: number): 'success' | 'warning' | 'danger' => {
    if (total === 0) return 'warning';
    if (ready === total) return 'success';
    if (ready === 0) return 'danger';
    return 'warning';
};

const getStatusSeverity = (status: string): 'success' | 'warning' | 'danger' | 'secondary' => {
    switch (status) {
        case 'Available':   return 'success';
        case 'Degraded':    return 'danger';
        default:            return 'secondary';
    }
};

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    status:    { value: null, matchMode: FilterMatchMode.IN },
    replicas:  { value: null, matchMode: FilterMatchMode.EQUALS },
};

export default function ReplicaSetListComponent({ clusterName }: { clusterName: string }) {
    const [items, setItems] = useState<models.ReplicaSetInfo[]>([]);
    const [selected, setSelected] = useState<models.ReplicaSetInfo[]>([]);
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
            const data = await GetReplicaSets(clusterName);
            setItems(data.map((item: any) => models.ReplicaSetInfo.createFrom(item)));
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
        for (const r of [...selected]) {
            try {
                await DeleteReplicaSet(clusterName, r.name, r.namespace);
                toast.current?.show({ severity: 'success', summary: 'Deleted', detail: `${r.namespace}/${r.name}`, life: 2500 });
            } catch {
                toast.current?.show({ severity: 'error', summary: 'Delete failed', detail: `${r.namespace}/${r.name}`, life: 3500 });
            }
        }
        setSelected([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await load();
    };

    const handleRowDoubleClick = (r: models.ReplicaSetInfo) => {
        openYamlPanel({ clusterName,
            resourceKind: 'replicaset', name: r.name, namespace: r.namespace, referencePanel: `replicasets:${clusterName}` });
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
                <h3 style={{ margin: 0 }}>ReplicaSet List</h3>
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
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.ReplicaSetInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No replicasets found"
            >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ minWidth: '3rem', maxWidth: '3rem' }} />
                <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }} filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={namespaceOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )} />
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
                    body={(row: models.ReplicaSetInfo) => (
                        <Tag value={row.status} severity={getStatusSeverity(row.status)} />
                    )}
                />
                <Column
                    header="Replicas"
                    sortable
                    sortField="replicas"
                    filter
                    filterField="replicas"
                    filterPlaceholder="Total replicas"
                    showFilterMenu={false}
                    dataType="numeric"
                    style={{ minWidth: '9rem' }}
                    body={(row: models.ReplicaSetInfo) => <ReplicaSetReplicasBody row={row} />}
                />
                <Column
                    header="Available"
                    sortable
                    sortField="available_replicas"
                    style={{ minWidth: '8rem' }}
                    body={(row: models.ReplicaSetInfo) => <ReplicaSetAvailableBody row={row} />}
                />
                <Column
                    header=""
                    style={{ width: '4rem', textAlign: 'center' }}
                    body={(row: models.ReplicaSetInfo) => <ReplicaSetActionsBody row={row} clusterName={clusterName} onOpenLog={openLogPanel} />}
                />
            </DataTable>

            <Dialog
                header="Delete ReplicaSet Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected replicaset records?</p>
                <ul className="m-0 pl-3">
                    {selected.map((r) => <li key={`${r.namespace}-${r.name}`}>{r.namespace}/{r.name}</li>)}
                </ul>
            </Dialog>
        </div>
    );
}
