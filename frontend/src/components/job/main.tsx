import type { DockviewPanelApi } from 'dockview';
import { VscListFlat } from 'react-icons/vsc';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetJobs, DeleteJob } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

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
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    status:    { value: null, matchMode: FilterMatchMode.IN },
};

export default function JobListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel, openLogPanel } = useTabContext();
    const referencePanel = `jobs:${clusterName}`;

    return (
        <ResourceListView<models.JobInfo>
            title="Job List"
            clusterName={clusterName}
            api={api}
            fetcher={GetJobs}
            createFrom={models.JobInfo.createFrom}
            deleter={DeleteJob}
            deleteLabel="job"
            pollInterval={5000}
            describeResource="jobs"
            defaultFilters={defaultFilters}
            emptyMessage="No jobs found"
            onRowDoubleClick={(job) => openYamlPanel({ clusterName, resourceKind: 'job', name: job.name, namespace: job.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="status" header="Status" sortable filter filterField="status" showFilterMenu={false} style={{ minWidth: '9rem' }}
                        body={(row: models.JobInfo) => <Tag value={row.status} severity={getStatusSeverity(row.status)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('status')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header="Completions" sortable sortField="succeeded" style={{ minWidth: '10rem' }}
                        body={(row: models.JobInfo) => <Tag value={`${row.succeeded} / ${row.completions}`} severity={getCompletionSeverity(row.succeeded, row.completions, row.failed)} />} />
                    <Column field="active" header="Active" sortable style={{ minWidth: '6rem' }} body={(row: models.JobInfo) => row.active} />
                    <Column header="" style={{ width: '4rem', textAlign: 'center' }}
                        body={(row: models.JobInfo) => (
                            <Button icon={<VscListFlat size={16} />} text size="small" severity="secondary" style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                                onClick={() => openLogPanel({ clusterName, resourceKind: 'job', name: row.name, namespace: row.namespace, referencePanel })} />
                        )} />
                </>
            )}
        />
    );
}
