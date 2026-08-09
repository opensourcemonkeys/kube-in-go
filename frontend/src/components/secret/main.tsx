import type { DockviewPanelApi } from 'dockview';
import { VscSettings } from 'react-icons/vsc';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetSecrets, DeleteSecret } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const defaultFilters: DataTableFilterMeta = {
    name:       { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace:  { value: null, matchMode: FilterMatchMode.IN },
    type:       { value: null, matchMode: FilterMatchMode.IN },
    data_count: { value: null, matchMode: FilterMatchMode.EQUALS },
};

export default function SecretListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel, openSecretEditor } = useTabContext();
    const referencePanel = `secrets:${clusterName}`;

    return (
        <ResourceListView<models.SecretInfo>
            title="Secret List"
            clusterName={clusterName}
            api={api}
            fetcher={GetSecrets}
            createFrom={models.SecretInfo.createFrom}
            deleter={DeleteSecret}
            deleteLabel="secret"
            pollInterval={2000}
            describeResource="secrets"
            defaultFilters={defaultFilters}
            emptyMessage="No secrets found"
            onRowDoubleClick={(s) => openYamlPanel({ clusterName, resourceKind: 'secret', name: s.name, namespace: s.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="type" header="Type" sortable filter filterField="type" showFilterMenu={false} style={{ minWidth: '12rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('type')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="data_count" header="Data Keys" sortable filter filterField="data_count" filterPlaceholder="Count" showFilterMenu={false} dataType="numeric" style={{ minWidth: '8rem' }}
                        body={(row: models.SecretInfo) => <Tag value={row.data_count} severity={row.data_count > 0 ? 'info' : 'secondary'} />} />
                    <Column header="" style={{ width: '4rem', textAlign: 'center' }}
                        body={(row: models.SecretInfo) => (
                            <Button icon={<VscSettings size={16} />} text size="small" severity="secondary" style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                                onClick={() => openSecretEditor({ clusterName, name: row.name, namespace: row.namespace, referencePanel })} />
                        )} />
                </>
            )}
        />
    );
}
