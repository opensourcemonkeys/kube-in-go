import { useEffect, useRef, useState } from 'react';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetJobs, DeleteJob } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext, LogPanelDef } from '../../contexts/TabContext';

function JobStatusBody({ row }: { row: models.JobInfo }) {
    return <Tag value={row.status} severity={getStatusSeverity(row.status)} />;
}

function JobCompletionsBody({ row }: { row: models.JobInfo }) {
    return (
        <Tag
            value={`${row.succeeded} / ${row.completions}`}
            severity={getCompletionSeverity(row.succeeded, row.completions, row.failed)}
        />
    );
}

function JobActionsBody({ row, onOpenLog }: { row: models.JobInfo; onOpenLog: (def: LogPanelDef) => void }) {
    return (
        <Button
            icon="pi pi-list"
            text
            size="small"
            severity="secondary"
            style={{ padding: '0.2rem', fontSize: '0.7rem' }}
            onClick={() => onOpenLog({ resourceKind: 'job', name: row.name, namespace: row.namespace, referencePanel: 'jobs' })}
        />
    );
}

const getStatusSeverity = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'secondary' => {
    switch (status) {
        case 'Succeeded': return 'success';
        case 'Running':   return 'warning';
        case 'Failed':    return 'danger';
        case 'Pending':   return 'secondary';
        default:          return 'info';
    }
};

const getCompletionSeverity = (succeeded: number, completions: number, failed: number): 'success' | 'warning' | 'danger' => {
    if (failed > 0) return 'danger';
    if (succeeded >= completions) return 'success';
    return 'warning';
};

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
    status:    { value: null, matchMode: FilterMatchMode.CONTAINS },
};

export default function JobListComponent() {
    const [jobs, setJobs] = useState<models.JobInfo[]>([]);
    const [selectedJobs, setSelectedJobs] = useState<models.JobInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel, openLogPanel } = useTabContext();

    const loadJobs = async () => {
        try {
            const items = await GetJobs();
            setJobs(items.map((item: any) => models.JobInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load jobs:', error);
            setJobs([]);
        }
    };

    useEffect(() => {
        loadJobs();
        const intervalId = window.setInterval(loadJobs, 5000);
        return () => window.clearInterval(intervalId);
    }, []);

    const openDeleteDialog = () => {
        if (selectedJobs.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedJobs.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedJobs];

        for (const job of toDelete) {
            try {
                await DeleteJob(job.name, job.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${job.namespace}/${job.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${job.namespace}/${job.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedJobs([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadJobs();
    };

    const handleRowDoubleClick = (job: models.JobInfo) => {
        openYamlPanel({
            resourceKind: 'job',
            name: job.name,
            namespace: job.namespace,
            referencePanel: 'jobs',
        });
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon="pi pi-times" text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon="pi pi-trash" severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Job List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon="pi pi-filter-slash"
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                    <Button
                        label="Delete Selected"
                        icon="pi pi-trash"
                        severity="danger"
                        onClick={openDeleteDialog}
                        disabled={selectedJobs.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={jobs}
                dataKey="name"
                selectionMode="multiple"
                selection={selectedJobs}
                onSelectionChange={(e) => setSelectedJobs(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.JobInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No jobs found"
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
                    filterPlaceholder="Search namespace"
                    showFilterMenu={false}
                    style={{ minWidth: '10rem' }}
                />
                <Column
                    field="status"
                    header="Status"
                    sortable
                    filter
                    filterField="status"
                    filterPlaceholder="Search status"
                    showFilterMenu={false}
                    style={{ minWidth: '9rem' }}
                    body={(row: models.JobInfo) => <JobStatusBody row={row} />}
                />
                <Column
                    header="Completions"
                    sortable
                    sortField="succeeded"
                    style={{ minWidth: '10rem' }}
                    body={(row: models.JobInfo) => <JobCompletionsBody row={row} />}
                />
                <Column
                    field="active"
                    header="Active"
                    sortable
                    style={{ minWidth: '6rem' }}
                    body={(row: models.JobInfo) => row.active}
                />
                <Column
                    header=""
                    style={{ width: '4rem', textAlign: 'center' }}
                    body={(row: models.JobInfo) => <JobActionsBody row={row} onOpenLog={openLogPanel} />}
                />
            </DataTable>

            <Dialog
                header="Delete Job Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected job records?</p>
                <ul className="m-0 pl-3">
                    {selectedJobs.map((job) => (
                        <li key={`${job.namespace}-${job.name}`}>{job.namespace}/{job.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
