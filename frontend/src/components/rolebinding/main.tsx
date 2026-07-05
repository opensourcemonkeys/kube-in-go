import type { DockviewPanelApi } from 'dockview';
import { VscSettings } from 'react-icons/vsc';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetRoleBindings } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
};

export default function RoleBindingListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel, openRoleBindingEditor } = useTabContext();
    const referencePanel = `rolebindings:${clusterName}`;

    return (
        <ResourceListView<models.RoleBindingInfo>
            title="Role Binding List"
            clusterName={clusterName}
            api={api}
            fetcher={GetRoleBindings}
            createFrom={models.RoleBindingInfo.createFrom}
            pollInterval={10000}
            defaultFilters={defaultFilters}
            emptyMessage="No role bindings found"
            onRowDoubleClick={(rb) => openYamlPanel({ clusterName, resourceKind: 'rolebinding', name: rb.name, namespace: rb.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header="RoleRef" style={{ minWidth: '12rem' }} body={(rb: models.RoleBindingInfo) => <span>{rb.role_ref_kind}/{rb.role_ref_name}</span>} />
                    <Column header="Subjects" style={{ minWidth: '7rem' }} body={(rb: models.RoleBindingInfo) => (rb.subjects ?? []).length} />
                    <Column field="created_at" header="Created" sortable style={{ minWidth: '12rem' }} />
                    <Column header="" style={{ width: '4rem', textAlign: 'center' }}
                        body={(row: models.RoleBindingInfo) => (
                            <Button icon={<VscSettings size={16} />} text size="small" severity="secondary" style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                                onClick={() => openRoleBindingEditor({ clusterName, name: row.name, namespace: row.namespace, referencePanel })} />
                        )} />
                </>
            )}
        />
    );
}
