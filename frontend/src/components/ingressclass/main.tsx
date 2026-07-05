import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetIngressClasses } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const defaultFilters: DataTableFilterMeta = {
    name:       { value: null, matchMode: FilterMatchMode.CONTAINS },
    controller: { value: null, matchMode: FilterMatchMode.IN },
};

export default function IngressClassListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel } = useTabContext();
    const referencePanel = `ingressclasses:${clusterName}`;

    return (
        <ResourceListView<models.IngressClassInfo>
            title="Ingress Class List"
            clusterName={clusterName}
            api={api}
            fetcher={GetIngressClasses}
            createFrom={models.IngressClassInfo.createFrom}
            pollInterval={5000}
            defaultFilters={defaultFilters}
            emptyMessage="No ingress classes found"
            onRowDoubleClick={(ic) => openYamlPanel({ clusterName, resourceKind: 'ingressclass', name: ic.name, namespace: '', referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="controller" header="Controller" sortable filter filterField="controller" showFilterMenu={false} style={{ minWidth: '20rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('controller')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="is_default" header="Default" sortable style={{ minWidth: '8rem' }}
                        body={(row: models.IngressClassInfo) => (row.is_default ? <Tag value="Default" severity="success" /> : <span style={{ color: 'var(--ink3)' }}>—</span>)} />
                </>
            )}
        />
    );
}
