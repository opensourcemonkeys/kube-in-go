import { useEffect, useRef, useState } from 'react';
import FilterListOff from '@mui/icons-material/FilterListOff';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import Close from '@mui/icons-material/Close';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetNetworkPolicies, DeleteNetworkPolicy } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

export default function NetworkPolicyListComponent() {
    const [policies, setPolicies] = useState<models.NetworkPolicyInfo[]>([]);
    const [selectedPolicies, setSelectedPolicies] = useState<models.NetworkPolicyInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openPolicyViewer } = useTabContext();

    const loadPolicies = async () => {
        try {
            const items = await GetNetworkPolicies();
            setPolicies(items.map((item: any) => models.NetworkPolicyInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load network policies:', error);
            setPolicies([]);
        }
    };

    useEffect(() => {
        loadPolicies();
        const id = window.setInterval(loadPolicies, 2000);
        return () => window.clearInterval(id);
    }, []);

    const openDeleteDialog = () => {
        if (selectedPolicies.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedPolicies.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedPolicies];

        for (const policy of toDelete) {
            try {
                await DeleteNetworkPolicy(policy.name, policy.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${policy.namespace}/${policy.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${policy.namespace}/${policy.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedPolicies([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadPolicies();
    };

    const policyTypesBody = (rowData: models.NetworkPolicyInfo) => {
        const types: string[] = rowData.policy_types ?? [];
        if (types.length === 0) return <Tag value="None" severity="secondary" />;
        return (
            <div className="flex gap-1 flex-wrap">
                {types.map((t) => (
                    <Tag
                        key={t}
                        value={t}
                        severity={t === 'Ingress' ? 'info' : 'warning'}
                    />
                ))}
            </div>
        );
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon={<Close fontSize="small" />} text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon={<DeleteOutlineOutlined fontSize="small" />} severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Network Policy List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon={<FilterListOff fontSize="small" />}
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                    <Button
                        label="Delete Selected"
                        icon={<DeleteOutlineOutlined fontSize="small" />}
                        severity="danger"
                        onClick={openDeleteDialog}
                        disabled={selectedPolicies.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={policies}
                dataKey="name"
                selectionMode="multiple"
                selection={selectedPolicies}
                onSelectionChange={(e) => setSelectedPolicies(Array.isArray(e.value) ? e.value : [])}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                onRowDoubleClick={(e: any) => {
                    const policy = e.data as models.NetworkPolicyInfo;
                    openPolicyViewer({
                        name: policy.name,
                        namespace: policy.namespace,
                        referencePanel: 'networkpolicies',
                    });
                }}
                emptyMessage="No network policies found"
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
                    field="pod_selector"
                    header="Pod Selector"
                    sortable
                    style={{ minWidth: '12rem' }}
                />
                <Column
                    header="Policy Types"
                    style={{ minWidth: '12rem' }}
                    body={policyTypesBody}
                />
                <Column
                    header="Ingress"
                    field="ingress_rule_count"
                    sortable
                    dataType="numeric"
                    style={{ width: '6rem', textAlign: 'center' }}
                    body={(rowData: models.NetworkPolicyInfo) => (
                        <Tag value={String(rowData.ingress_rule_count)} severity="info" />
                    )}
                />
                <Column
                    header="Egress"
                    field="egress_rule_count"
                    sortable
                    dataType="numeric"
                    style={{ width: '6rem', textAlign: 'center' }}
                    body={(rowData: models.NetworkPolicyInfo) => (
                        <Tag value={String(rowData.egress_rule_count)} severity="warning" />
                    )}
                />
            </DataTable>

            <Dialog
                header="Delete Network Policy Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected network policy records?</p>
                <ul className="m-0 pl-3">
                    {selectedPolicies.map((p) => (
                        <li key={`${p.namespace}-${p.name}`}>{p.namespace}/{p.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
