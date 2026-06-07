import { useEffect, useMemo, useRef, useState } from 'react';


import { VscClearAll, VscTrash, VscClose, VscListOrdered } from 'react-icons/vsc';

import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { GetLimitRanges } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
};

const formatResourceMap = (m: Record<string, string> | null): string => {
    if (!m) return '-';
    const entries = Object.entries(m);
    if (entries.length === 0) return '-';
    return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
};

export default function LimitRangeListComponent({ clusterName }: { clusterName: string }) {
    const [limitRanges, setLimitRanges] = useState<models.LimitRangeInfo[]>([]);
    const [selectedLimitRange, setSelectedLimitRange] = useState<models.LimitRangeInfo | null>(null);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toast = useRef<Toast | null>(null);
    const { openYamlPanel } = useTabContext();

    const namespaceOptions = useMemo(() =>
        [...new Set(limitRanges.map(l => l.namespace).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [limitRanges]
    );

    const loadLimitRanges = async () => {
        try {
            const items = await GetLimitRanges(clusterName);
            setLimitRanges(items.map((item: any) => models.LimitRangeInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load limit ranges:', error);
            setLimitRanges([]);
        }
    };

    useEffect(() => {
        loadLimitRanges();
        const intervalId = window.setInterval(loadLimitRanges, 5000);
        return () => window.clearInterval(intervalId);
    }, []);

    const handleRowDoubleClick = (lr: models.LimitRangeInfo) => {
        openYamlPanel({ clusterName,
            resourceKind: 'limitrange',
            name: lr.name,
            namespace: lr.namespace,
            referencePanel: `limitranges:${clusterName}`,
        });
    };

    const lr = selectedLimitRange;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Limit Range List</h3>
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
                value={limitRanges}
                dataKey="name"
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No limit ranges found"
                onRowDoubleClick={(e: any) => handleRowDoubleClick(e.data as models.LimitRangeInfo)}
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
                    header="Types"
                    style={{ minWidth: '14rem' }}
                    body={(row: models.LimitRangeInfo) => {
                        if (!row.limits || row.limits.length === 0) return '-';
                        return (
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                {row.limits.map((l, i) => (
                                    <Tag key={i} value={l.type} severity="info" />
                                ))}
                            </div>
                        );
                    }}
                />
                <Column
                    header="CPU (default / max)"
                    style={{ minWidth: '14rem' }}
                    body={(row: models.LimitRangeInfo) => {
                        if (!row.limits || row.limits.length === 0) return '-';
                        return row.limits.map((l, i) => {
                            const def = l.default?.cpu ?? '-';
                            const max = l.max?.cpu ?? '-';
                            return <div key={i} style={{ fontSize: '12px' }}>{l.type}: {def} / {max}</div>;
                        });
                    }}
                />
                <Column
                    header="Memory (default / max)"
                    style={{ minWidth: '16rem' }}
                    body={(row: models.LimitRangeInfo) => {
                        if (!row.limits || row.limits.length === 0) return '-';
                        return row.limits.map((l, i) => {
                            const def = l.default?.memory ?? '-';
                            const max = l.max?.memory ?? '-';
                            return <div key={i} style={{ fontSize: '12px' }}>{l.type}: {def} / {max}</div>;
                        });
                    }}
                />
                <Column
                    header=""
                    style={{ minWidth: '5rem', maxWidth: '5rem' }}
                    body={(row: models.LimitRangeInfo) => (
                        <Button
                            icon={<VscListOrdered size={16} />}
                            text
                            size="small"
                            tooltip="View limits"
                            tooltipOptions={{ position: 'left' }}
                            onClick={() => setSelectedLimitRange(row)}
                        />
                    )}
                />
            </DataTable>

            <Dialog
                header={`Limit Range — ${lr?.namespace}/${lr?.name}`}
                visible={!!selectedLimitRange}
                style={{ width: '52rem' }}
                modal
                onHide={() => setSelectedLimitRange(null)}
            >
                {lr?.limits?.map((item, i) => (
                    <div key={i} style={{ marginBottom: '1.2rem' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <Tag value={item.type} severity="info" />
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                    <th style={thStyle}>Resource</th>
                                    <th style={thStyle}>Min</th>
                                    <th style={thStyle}>Max</th>
                                    <th style={thStyle}>Default Request</th>
                                    <th style={thStyle}>Default Limit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allKeys(item).map(resource => (
                                    <tr key={resource} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                        <td style={tdStyle}><code style={{ fontSize: '12px' }}>{resource}</code></td>
                                        <td style={tdStyle}>{item.min?.[resource] ?? '-'}</td>
                                        <td style={tdStyle}>{item.max?.[resource] ?? '-'}</td>
                                        <td style={tdStyle}>{item.default_request?.[resource] ?? '-'}</td>
                                        <td style={tdStyle}>{item.default?.[resource] ?? '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </Dialog>
        </div>
    );
}

function allKeys(item: models.LimitRangeItemInfo): string[] {
    const keys = new Set<string>();
    for (const m of [item.min, item.max, item.default, item.default_request]) {
        if (m) Object.keys(m).forEach(k => keys.add(k));
    }
    return Array.from(keys).sort();
}

const thStyle: React.CSSProperties = {
    padding: '0.4rem 0.6rem',
    textAlign: 'left',
    color: 'var(--ink3)',
    fontWeight: 500,
    fontSize: '12px',
};

const tdStyle: React.CSSProperties = {
    padding: '0.4rem 0.6rem',
    color: 'var(--ink)',
};
