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
import { GetCronJobs, DeleteCronJob } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext, LogPanelDef } from '../../contexts/TabContext';

function CronJobStatusBody({ row }: { row: models.CronJobInfo }) {
    return (
        <Tag
            value={row.suspend ? 'Suspended' : 'Active'}
            severity={row.suspend ? 'warning' : 'success'}
        />
    );
}

function CronJobActionsBody({ row, clusterName, onOpenLog }: { row: models.CronJobInfo; clusterName: string; onOpenLog: (def: LogPanelDef) => void }) {
    return (
        <Button
            icon={<VscListFlat size={16} />}
            text
            size="small"
            severity="secondary"
            style={{ padding: '0.2rem', fontSize: '0.7rem' }}
            onClick={() => onOpenLog({ clusterName, resourceKind: 'cronjob', name: row.name, namespace: row.namespace, referencePanel: `cronjobs:${clusterName}` })}
        />
    );
}

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    schedule:  { value: null, matchMode: FilterMatchMode.IN },
};

export default function CronJobListComponent({ clusterName }: { clusterName: string }) {
    const [cronJobs, setCronJobs] = useState<models.CronJobInfo[]>([]);
    const [selectedCronJobs, setSelectedCronJobs] = useState<models.CronJobInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel, openLogPanel } = useTabContext();

    const namespaceOptions = useMemo(() =>
        [...new Set(cronJobs.map(c => c.namespace).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [cronJobs]
    );
    const scheduleOptions = useMemo(() =>
        [...new Set(cronJobs.map(c => c.schedule).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [cronJobs]
    );

    const loadCronJobs = async () => {
        try {
            const items = await GetCronJobs(clusterName);
            setCronJobs(items.map((item: any) => models.CronJobInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load cronjobs:', error);
            setCronJobs([]);
        }
    };

    useEffect(() => {
        loadCronJobs();
        const intervalId = window.setInterval(loadCronJobs, 10000);
        return () => window.clearInterval(intervalId);
    }, []);

    const openDeleteDialog = () => {
        if (selectedCronJobs.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedCronJobs.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedCronJobs];

        for (const cj of toDelete) {
            try {
                await DeleteCronJob(clusterName, cj.name, cj.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${cj.namespace}/${cj.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${cj.namespace}/${cj.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedCronJobs([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadCronJobs();
    };

    const handleRowDoubleClick = (cj: models.CronJobInfo) => {
        openYamlPanel({ clusterName,
            resourceKind: 'cronjob',
            name: cj.name,
            namespace: cj.namespace,
            referencePanel: `cronjobs:${clusterName}`,
        });
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
                <h3 style={{ margin: 0 }}>CronJob List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon={<VscClearAll size={16} />}
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                    <Button
                        label="Delete Selected"
                        icon={<VscTrash size={16} />}
                        severity="danger"
                        onClick={openDeleteDialog}
                        disabled={selectedCronJobs.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={cronJobs}
                dataKey="name"
                selectionMode="multiple"
                selection={selectedCronJobs}
                onSelectionChange={(e) => setSelectedCronJobs(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.CronJobInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No cronjobs found"
            >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ minWidth: '3rem', maxWidth: '3rem' }} />
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
                    showFilterMenu={false}
                    style={{ minWidth: '10rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={namespaceOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    field="schedule"
                    header="Schedule"
                    sortable
                    filter
                    filterField="schedule"
                    showFilterMenu={false}
                    style={{ minWidth: '10rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={scheduleOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    header="Status"
                    sortable
                    sortField="suspend"
                    style={{ minWidth: '8rem' }}
                    body={(row: models.CronJobInfo) => <CronJobStatusBody row={row} />}
                />
                <Column
                    field="active_count"
                    header="Active Jobs"
                    sortable
                    style={{ minWidth: '8rem' }}
                    body={(row: models.CronJobInfo) => row.active_count}
                />
                <Column
                    header=""
                    style={{ width: '4rem', textAlign: 'center' }}
                    body={(row: models.CronJobInfo) => <CronJobActionsBody row={row} clusterName={clusterName} onOpenLog={openLogPanel} />}
                />
            </DataTable>

            <Dialog
                header="Delete CronJob Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected cronjob records?</p>
                <ul className="m-0 pl-3">
                    {selectedCronJobs.map((cj) => (
                        <li key={`${cj.namespace}-${cj.name}`}>{cj.namespace}/{cj.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
