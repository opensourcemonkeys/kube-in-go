import type { DockviewPanelApi } from 'dockview';
import { VscListFlat } from 'react-icons/vsc';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetCronJobs, DeleteCronJob } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
    schedule:  { value: null, matchMode: FilterMatchMode.IN },
};

export default function CronJobListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel, openLogPanel } = useTabContext();
    const referencePanel = `cronjobs:${clusterName}`;

    return (
        <ResourceListView<models.CronJobInfo>
            title="CronJob List"
            clusterName={clusterName}
            api={api}
            fetcher={GetCronJobs}
            createFrom={models.CronJobInfo.createFrom}
            deleter={DeleteCronJob}
            deleteLabel="cronjob"
            pollInterval={10000}
            defaultFilters={defaultFilters}
            emptyMessage="No cronjobs found"
            onRowDoubleClick={(cj) => openYamlPanel({ clusterName, resourceKind: 'cronjob', name: cj.name, namespace: cj.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="schedule" header="Schedule" sortable filter filterField="schedule" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('schedule')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header="Status" sortable sortField="suspend" style={{ minWidth: '8rem' }}
                        body={(row: models.CronJobInfo) => <Tag value={row.suspend ? 'Suspended' : 'Active'} severity={row.suspend ? 'warning' : 'success'} />} />
                    <Column field="active_count" header="Active Jobs" sortable style={{ minWidth: '8rem' }} body={(row: models.CronJobInfo) => row.active_count} />
                    <Column header="" style={{ width: '4rem', textAlign: 'center' }}
                        body={(row: models.CronJobInfo) => (
                            <Button icon={<VscListFlat size={16} />} text size="small" severity="secondary" style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                                onClick={() => openLogPanel({ clusterName, resourceKind: 'cronjob', name: row.name, namespace: row.namespace, referencePanel })} />
                        )} />
                </>
            )}
        />
    );
}
