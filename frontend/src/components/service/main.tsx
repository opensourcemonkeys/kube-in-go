import { useEffect, useRef, useState } from 'react';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetServices, DeleteService } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

const getTypeSeverity = (type: string): TagSeverity => {
    switch (type) {
        case 'LoadBalancer': return 'success';
        case 'NodePort':     return 'warning';
        case 'ExternalName': return 'contrast';
        default:             return 'info';
    }
};

const getStatusSeverity = (status: string): TagSeverity =>
    status === 'Active' ? 'success' : 'warning';

const formatPorts = (ports: models.ServicePortInfo[]): string => {
    if (!ports || ports.length === 0) return '-';
    return ports
        .map(p => p.node_port ? `${p.port}:${p.node_port}/${p.protocol}` : `${p.port}/${p.protocol}`)
        .join(', ');
};

const formatExternalIPs = (ips: string[]): string => {
    if (!ips || ips.length === 0) return '-';
    return ips.join(', ');
};

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
    type:      { value: null, matchMode: FilterMatchMode.CONTAINS },
};

export default function ServiceListComponent() {
    const [services, setServices] = useState<models.ServiceInfo[]>([]);
    const [selectedServices, setSelectedServices] = useState<models.ServiceInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const loadServices = async () => {
        try {
            const items = await GetServices();
            setServices(items.map((item: any) => models.ServiceInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load services:', error);
            setServices([]);
        }
    };

    useEffect(() => {
        loadServices();
        const intervalId = window.setInterval(loadServices, 2000);
        return () => window.clearInterval(intervalId);
    }, []);

    const openDeleteDialog = () => {
        if (selectedServices.length > 0) setDeleteDialogVisible(true);
    };

    const handleDeleteSelected = async () => {
        if (selectedServices.length === 0) { setDeleteDialogVisible(false); return; }

        setDeleting(true);
        const toDelete = [...selectedServices];

        for (const svc of toDelete) {
            try {
                await DeleteService(svc.name, svc.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${svc.namespace}/${svc.name} deleted`,
                    life: 2500,
                });
            } catch {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${svc.namespace}/${svc.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelectedServices([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadServices();
    };

    const handleRowDoubleClick = (svc: models.ServiceInfo) => {
        openYamlPanel({
            resourceKind: 'service',
            name: svc.name,
            namespace: svc.namespace,
            referencePanel: 'services',
        });
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon="pi pi-times" text onClick={() => setDeleteDialogVisible(false)} disabled={deleting} />
            <Button label="Delete" icon="pi pi-trash" severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Service List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon="pi pi-filter-slash"
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                    <Button
                        label="Delete Selected"
                        icon="pi pi-trash"
                        severity="danger"
                        onClick={openDeleteDialog}
                        disabled={selectedServices.length === 0 || deleting}
                    />
                </div>
            </div>

            <DataTable
                value={services}
                dataKey="name"
                selectionMode="multiple"
                selection={selectedServices}
                onSelectionChange={(e) => setSelectedServices(Array.isArray(e.value) ? e.value : [])}
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.ServiceInfo)}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No services found"
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
                    field="status"
                    header="Status"
                    sortable
                    style={{ minWidth: '7rem' }}
                    body={(rowData: models.ServiceInfo) => (
                        <Tag value={rowData.status} severity={getStatusSeverity(rowData.status)} />
                    )}
                />
                <Column
                    field="type"
                    header="Type"
                    sortable
                    filter
                    filterField="type"
                    filterPlaceholder="Search type"
                    showFilterMenu={false}
                    style={{ minWidth: '9rem' }}
                    body={(rowData: models.ServiceInfo) => (
                        <Tag value={rowData.type} severity={getTypeSeverity(rowData.type)} />
                    )}
                />
                <Column
                    field="cluster_ip"
                    header="Cluster IP"
                    sortable
                    style={{ minWidth: '10rem', fontFamily: 'monospace' }}
                />
                <Column
                    field="external_ips"
                    header="External IP"
                    style={{ minWidth: '12rem', fontFamily: 'monospace' }}
                    body={(rowData: models.ServiceInfo) => formatExternalIPs(rowData.external_ips)}
                />
                <Column
                    header="Ports"
                    style={{ minWidth: '14rem', fontFamily: 'monospace' }}
                    body={(rowData: models.ServiceInfo) => formatPorts(rowData.ports)}
                />
            </DataTable>

            <Dialog
                header="Delete Service Confirmation"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteDialogVisible(false); }}
            >
                <p className="m-0 mb-3">Do you want to delete the selected service records?</p>
                <ul className="m-0 pl-3">
                    {selectedServices.map((svc) => (
                        <li key={`${svc.namespace}-${svc.name}`}>{svc.namespace}/{svc.name}</li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
