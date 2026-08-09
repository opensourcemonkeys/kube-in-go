import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetNetworkPolicies, DeleteNetworkPolicy } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
};

const policyTypesBody = (row: models.NetworkPolicyInfo) => {
    const types: string[] = row.policy_types ?? [];
    if (types.length === 0) return <Tag value="None" severity="secondary" />;
    return (
        <div className="flex gap-1 flex-wrap">
            {types.map((t) => <Tag key={t} value={t} severity={t === 'Ingress' ? 'info' : 'warning'} />)}
        </div>
    );
};

export default function NetworkPolicyListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openPolicyViewer } = useTabContext();
    const referencePanel = `networkpolicies:${clusterName}`;

    return (
        <ResourceListView<models.NetworkPolicyInfo>
            title="Network Policy List"
            clusterName={clusterName}
            api={api}
            fetcher={GetNetworkPolicies}
            createFrom={models.NetworkPolicyInfo.createFrom}
            deleter={DeleteNetworkPolicy}
            deleteLabel="network policy"
            pollInterval={2000}
            describeResource="networkpolicies"
            defaultFilters={defaultFilters}
            emptyMessage="No network policies found"
            onRowDoubleClick={(policy) => openPolicyViewer({ clusterName, name: policy.name, namespace: policy.namespace, referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                    <Column field="pod_selector" header="Pod Selector" sortable style={{ minWidth: '12rem' }} />
                    <Column header="Policy Types" style={{ minWidth: '12rem' }} body={policyTypesBody} />
                    <Column header="Ingress" field="ingress_rule_count" sortable dataType="numeric" style={{ width: '6rem', textAlign: 'center' }}
                        body={(row: models.NetworkPolicyInfo) => <Tag value={String(row.ingress_rule_count)} severity="info" />} />
                    <Column header="Egress" field="egress_rule_count" sortable dataType="numeric" style={{ width: '6rem', textAlign: 'center' }}
                        body={(row: models.NetworkPolicyInfo) => <Tag value={String(row.egress_rule_count)} severity="warning" />} />
                </>
            )}
        />
    );
}
