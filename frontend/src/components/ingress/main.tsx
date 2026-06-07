import { useEffect, useMemo, useRef, useState } from 'react';


import { VscClearAll, VscTrash, VscClose } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { GetIngresses, DeleteIngress } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
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

export default function IngressListComponent() {
    const [ingresses, setIngresses] = useState<models.IngressInfo[]>([]);
    const [selectedIngresses, setSelectedIngresses] = useState<models.IngressInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const namespaceOptions = useMemo(() =>
        [...new Set(ingresses.map(i => i.namespace).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [ingresses]
    );
    const classNameOptions = useMemo(() =>
        [...new Set(ingresses.map(i => i.class_name).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [ingresses]
    );

    const loadIngresses = async () => {
        try {
            const items = await GetIngresses();
            setIngresses(items.map((item: any) => models.IngressInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load ingresses:', error);
            setIngresses([]);
        }
    };

    useEffect(() => {
        loadIngresses();
        const intervalId = window.setInterval(loadIngresses, 2000);
        return () => window.clearInterval(intervalId);
    }, []);

    const openDeleteDialog = () => {
        if (selectedIngresses.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedIngresses.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedIngresses];

        for (const ing of toDelete) {
            try {
                await DeleteIngress(ing.name, ing.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${ing.namespace}/${ing.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${ing.namespace}/${ing.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedIngresses([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadIngresses();
    };

    const handleRowDoubleClick = (ing: models.IngressInfo) => {
        openYamlPanel({
            resourceKind: 'ingress',
            name: ing.name,
            namespace: ing.namespace,
            referencePanel: 'ingresses',
        });
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon={<VscClose size={16} />} text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon={<VscTrash size={16} />} severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Ingress List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon={<VscClearAll size={16} />}
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                    <Button
                        label="Delete Selected"
                        icon={<VscTrash size={16} />}
                        severity="danger"
                        onClick={openDeleteDialog}
                        disabled={selectedIngresses.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={ingresses}
                dataKey="name"
                selectionMode="multiple"
                selection={selectedIngresses}
                onSelectionChange={(e) => setSelectedIngresses(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.IngressInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No ingresses found"
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
                    showFilterMenu={false}
                    style={{ minWidth: '10rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={namespaceOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    field="class_name"
                    header="Class"
                    sortable
                    filter
                    filterField="class_name"
                    showFilterMenu={false}
                    style={{ minWidth: '9rem' }}
                    body={(row: models.IngressInfo) => row.class_name || '-'}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={classNameOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    header="Hosts"
                    style={{ minWidth: '16rem' }}
                    body={(row: models.IngressInfo) => formatHosts(row.rules)}
                />
                <Column
                    header="Paths"
                    style={{ minWidth: '18rem' }}
                    body={(row: models.IngressInfo) => formatPaths(row.rules)}
                />
                <Column
                    field="address"
                    header="Address"
                    sortable
                    style={{ minWidth: '12rem' }}
                    body={(row: models.IngressInfo) => row.address || '-'}
                />
                <Column
                    field="tls"
                    header="TLS"
                    sortable
                    style={{ minWidth: '6rem' }}
                    body={(row: models.IngressInfo) => (
                        <Tag
                            value={row.tls ? 'Yes' : 'No'}
                            severity={row.tls ? 'success' : 'secondary'}
                        />
                    )}
                />
            </DataTable>

            <Dialog
                header="Delete Ingress Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected ingress records?</p>
                <ul className="m-0 pl-3">
                    {selectedIngresses.map((ing) => (
                        <li key={`${ing.namespace}-${ing.name}`}>{ing.namespace}/{ing.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
