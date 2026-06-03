import { useEffect, useRef, useState } from 'react';
import FilterListOff from '@mui/icons-material/FilterListOff';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import Close from '@mui/icons-material/Close';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetIngressClasses } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:       { value: null, matchMode: FilterMatchMode.CONTAINS },
    controller: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

export default function IngressClassListComponent() {
    const [ingressClasses, setIngressClasses] = useState<models.IngressClassInfo[]>([]);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const loadIngressClasses = async () => {
        try {
            const items = await GetIngressClasses();
            setIngressClasses(items.map((item: any) => models.IngressClassInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load ingress classes:', error);
            setIngressClasses([]);
        }
    };

    useEffect(() => {
        loadIngressClasses();
        const intervalId = window.setInterval(loadIngressClasses, 5000);
        return () => window.clearInterval(intervalId);
    }, []);

    const handleRowDoubleClick = (ic: models.IngressClassInfo) => {
        openYamlPanel({
            resourceKind: 'ingressclass',
            name: ic.name,
            namespace: '',
            referencePanel: 'ingressclasses',
        });
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Ingress Class List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon={<FilterListOff fontSize="small" />}
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                </div>
            </div>

            <DataTable
                value={ingressClasses}
                dataKey="name"
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No ingress classes found"
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.IngressClassInfo)}
            >
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
                    field="controller"
                    header="Controller"
                    sortable
                    filter
                    filterField="controller"
                    filterPlaceholder="Search controller"
                    showFilterMenu={false}
                    style={{ minWidth: '20rem' }}
                />
                <Column
                    field="is_default"
                    header="Default"
                    sortable
                    style={{ minWidth: '8rem' }}
                    body={(row: models.IngressClassInfo) => (
                        row.is_default
                            ? <Tag value="Default" severity="success" />
                            : <span style={{ color: 'var(--ink3)' }}>—</span>
                    )}
                />
            </DataTable>
        </div>
    );
}
