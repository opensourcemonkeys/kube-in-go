import type { DockviewPanelApi } from 'dockview';
import { VscSettings } from 'react-icons/vsc';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetRoles, DeleteRole } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
};

export default function RoleListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel, openRoleEditor } = useTabContext();
    const referencePanel = `roles:${clusterName}`;

    return (
        <ResourceListView<models.RoleInfo>
            title="Role List"
            clusterName={clusterName}
            api={api}
            fetcher={GetRoles}
            createFrom={models.RoleInfo.createFrom}
            pollInterval={10000}
            deleter={DeleteRole}
            deleteLabel="role"
            describeResource="roles"
            defaultFilters={defaultFilters}
            emptyMessage="No roles found"
            onRowDoubleClick={(role) => openYamlPanel({ clusterName, resourceKind: 'role', name: role.name, namespace: role.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header="Rules" body={(r: models.RoleInfo) => (r.rules ?? []).length} style={{ minWidth: '6rem' }} />
                    <Column field="created_at" header="Created" sortable style={{ minWidth: '12rem' }} />
                    <Column header="" style={{ width: '4rem', textAlign: 'center' }}
                        body={(row: models.RoleInfo) => (
                            <Button icon={<VscSettings size={16} />} text size="small" severity="secondary" style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                                onClick={() => openRoleEditor({ clusterName, name: row.name, namespace: row.namespace, referencePanel })} />
                        )} />
                </>
            )}
        />
    );
}
