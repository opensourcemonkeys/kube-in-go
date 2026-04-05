import React, { useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { GetPods } from '../../../wailsjs/go/controller_app/App';
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

    useEffect(() => {
        const loadPods = async () => {

            try {
                const items = await GetPods();
                setPods(items.map((item: any) => models.PodInfo.createFrom(item)));
            } catch (error) {
                console.error('Failed to load pods:', error);
                setPods([]);
            }
        };

        loadPods();
        const intervalId = window.setInterval(loadPods, 2000);

        return () => window.clearInterval(intervalId);
    }, []);

    return (
        <div className="card">
            <DataTable
                value={pods}
                dataKey="name"
                stripedRows
                showGridlines
                responsiveLayout="scroll"
                emptyMessage="No pods found"
            >
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
        </div>
    );
}
