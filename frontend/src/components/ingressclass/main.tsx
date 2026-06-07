import { useEffect, useMemo, useRef, useState } from 'react';


import { VscClearAll, VscTrash, VscClose } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { GetIngressClasses } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:       { value: null, matchMode: FilterMatchMode.CONTAINS },
    controller: { value: null, matchMode: FilterMatchMode.IN },
};

export default function IngressClassListComponent({ clusterName }: { clusterName: string }) {
    const [ingressClasses, setIngressClasses] = useState<models.IngressClassInfo[]>([]);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const controllerOptions = useMemo(() =>
        [...new Set(ingressClasses.map(i => i.controller).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [ingressClasses]
    );

    const loadIngressClasses = async () => {
        try {
            const items = await GetIngressClasses(clusterName);
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
        openYamlPanel({ clusterName,
            resourceKind: 'ingressclass',
            name: ic.name,
            namespace: '',
            referencePanel: `ingressclasses:${clusterName}`,
        });
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Ingress Class List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        icon={<VscClearAll size={16} />}
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
                    showFilterMenu={false}
                    style={{ minWidth: '20rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={controllerOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
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
