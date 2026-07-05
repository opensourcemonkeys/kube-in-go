import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetIngresses, DeleteIngress } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const defaultFilters: DataTableFilterMeta = {
    name:       { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace:  { value: null, matchMode: FilterMatchMode.IN },
    class_name: { value: null, matchMode: FilterMatchMode.IN },
};

const formatHosts = (rules: models.IngressRuleInfo[]): string => {
    if (!rules || rules.length === 0) return '*';
    return rules.map(r => r.host || '*').join(', ');
};

const formatPaths = (rules: models.IngressRuleInfo[]): string => {
    if (!rules || rules.length === 0) return '-';
    const paths: string[] = [];
    for (const r of rules) {
        if (r.paths && r.paths.length > 0) {
            for (const p of r.paths) {
                paths.push(r.host ? `${r.host}${p}` : p);
            }
        }
    }
    return paths.length > 0 ? paths.join(', ') : '-';
};

export default function IngressListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel } = useTabContext();
    const referencePanel = `ingresses:${clusterName}`;

    return (
        <ResourceListView<models.IngressInfo>
            title="Ingress List"
            clusterName={clusterName}
            api={api}
            fetcher={GetIngresses}
            createFrom={models.IngressInfo.createFrom}
            deleter={DeleteIngress}
            deleteLabel="ingress"
            pollInterval={2000}
            defaultFilters={defaultFilters}
            emptyMessage="No ingresses found"
            onRowDoubleClick={(ing) => openYamlPanel({ clusterName, resourceKind: 'ingress', name: ing.name, namespace: ing.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="class_name" header="Class" sortable filter filterField="class_name" showFilterMenu={false} style={{ minWidth: '9rem' }}
                        body={(row: models.IngressInfo) => row.class_name || '-'}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('class_name')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column header="Hosts" style={{ minWidth: '16rem' }} body={(row: models.IngressInfo) => formatHosts(row.rules)} />
                    <Column header="Paths" style={{ minWidth: '18rem' }} body={(row: models.IngressInfo) => formatPaths(row.rules)} />
                    <Column field="address" header="Address" sortable style={{ minWidth: '12rem' }} body={(row: models.IngressInfo) => row.address || '-'} />
                    <Column field="tls" header="TLS" sortable style={{ minWidth: '6rem' }}
                        body={(row: models.IngressInfo) => <Tag value={row.tls ? 'Yes' : 'No'} severity={row.tls ? 'success' : 'secondary'} />} />
                </>
            )}
        />
    );
}
