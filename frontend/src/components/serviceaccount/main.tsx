import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetServiceAccounts, DeleteServiceAccount } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
};

export default function ServiceAccountListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel } = useTabContext();
    const referencePanel = `serviceaccounts:${clusterName}`;

    return (
        <ResourceListView<models.ServiceAccountInfo>
            title="Service Account List"
            clusterName={clusterName}
            api={api}
            fetcher={GetServiceAccounts}
            createFrom={models.ServiceAccountInfo.createFrom}
            pollInterval={10000}
            deleter={DeleteServiceAccount}
            deleteLabel="service account"
            describeResource="serviceaccounts"
            defaultFilters={defaultFilters}
            emptyMessage="No service accounts found"
            onRowDoubleClick={(sa) => openYamlPanel({ clusterName, resourceKind: 'serviceaccount', name: sa.name, namespace: sa.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="secrets" header="Secrets" sortable style={{ minWidth: '7rem' }} />
                    <Column field="created_at" header="Created" sortable style={{ minWidth: '12rem' }} />
                </>
            )}
        />
    );
}
