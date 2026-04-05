import React, { useEffect, useRef, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import {  GetPods } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';

const getStatusSeverity = (status: string) => {
    switch (status) {
        case 'Running':
            return 'success';
        case 'Pending':
            return 'warning';
        case 'Terminating':
            return 'danger';
        default:
            return 'info';
    }
};

const formatCreatedAt = (value: any) => {
    if (!value) {
        return '-';
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? String(value) : parsedDate.toLocaleString();
};

export default function DataTableComponent() {
    const [pods, setPods] = useState<models.PodInfo[]>([]);
    const [selectedPods, setSelectedPods] = useState<models.PodInfo[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const toast = useRef<Toast | null>(null);

    const loadPods = async () => {
        try {
            const items = await GetPods();
            setPods(items.map((item: any) => models.PodInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load pods:', error);
            setPods([]);
        }
    };

    useEffect(() => {
        loadPods();
        const intervalId = window.setInterval(loadPods, 2000);

        return () => window.clearInterval(intervalId);
    }, []);

    const openDeleteDialog = () => {
        if (selectedPods.length > 0) {
            setDeleteDialogVisible(true);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedPods.length === 0) {
            setDeleteDialogVisible(false);
            return;
        }

        setDeleting(true);
        const podsToDelete = [...selectedPods];

        for (const pod of podsToDelete) {
            try {
                await DeletePod(pod.name, pod.namespace);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Pod silindi',
                    detail: `${pod.namespace}/${pod.name} silindi`,
                    life: 2500,
                });
            } catch (error) {
                console.error(`Failed to delete pod ${pod.namespace}/${pod.name}:`, error);
                toast.current?.show({
                    severity: 'error',
                    summary: 'Silme başarısız',
                    detail: `${pod.namespace}/${pod.name} silinemedi`,
                    life: 3500,
                });
            }
        }

        setSelectedPods([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await loadPods();
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button
                label="Vazgeç"
                icon="pi pi-times"
                text
                onClick={() => setDeleteDialogVisible(false)}
                disabled={deleting}
            />
            <Button
                label="Sil"
                icon="pi pi-trash"
                severity="danger"
                onClick={handleDeleteSelected}
                loading={deleting}
            />
        </div>
    );

    return (
        <div className="card">
            <Toast ref={toast} position="top-right" />

            <div className="flex justify-content-between align-items-center mb-3">
                <h3 className="m-0">Pod List</h3>
                <Button
                    label="Seçilenleri Sil"
                    icon="pi pi-trash"
                    severity="danger"
                    onClick={openDeleteDialog}
                    disabled={selectedPods.length === 0 || deleting}
                />
            </div>

            <DataTable
                value={pods}
                dataKey="name"
                selectionMode="multiple"
                selection={selectedPods}
                onSelectionChange={(e) => setSelectedPods(Array.isArray(e.value) ? e.value : [])}
                stripedRows
                showGridlines
                responsiveLayout="scroll"
                emptyMessage="No pods found"
            >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
                <Column field="name" header="Name" sortable />
                <Column field="namespace" header="Namespace" sortable />
                <Column
                    field="status"
                    header="Status"
                    sortable
                    body={(rowData: models.PodInfo) => (
                        <Tag value={rowData.status} severity={getStatusSeverity(rowData.status)} />
                    )}
                />
                <Column
                    field="created_at"
                    header="Created At"
                    sortable
                    body={(rowData: models.PodInfo) => formatCreatedAt(rowData.created_at)}
                />
            </DataTable>

            <Dialog
                header="Pod silme onayı"
                visible={deleteDialogVisible}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => {
                    if (!deleting) {
                        setDeleteDialogVisible(false);
                    }
                }}
            >
                <p className="m-0 mb-3">Seçilen pod kayıtları silinsin mi?</p>
                <ul className="m-0 pl-3">
                    {selectedPods.map((pod) => (
                        <li key={`${pod.namespace}-${pod.name}`}>
                            {pod.namespace}/{pod.name}
                        </li>
                    ))}
                </ul>
            </Dialog>
        </div>
    );
}
