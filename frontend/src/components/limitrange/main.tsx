import { useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { VscListOrdered } from 'react-icons/vsc';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { GetLimitRanges, DeleteLimitRange } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import ResourceListView from '../shared/ResourceListView';

const defaultFilters: DataTableFilterMeta = {
    name:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
};

function allKeys(item: models.LimitRangeItemInfo): string[] {
    const keys = new Set<string>();
    for (const m of [item.min, item.max, item.default, item.default_request]) {
        if (m) Object.keys(m).forEach(k => keys.add(k));
    }
    return Array.from(keys).sort();
}

const thStyle: React.CSSProperties = { padding: '0.4rem 0.6rem', textAlign: 'left', color: 'var(--ink3)', fontWeight: 500, fontSize: '12px' };
const tdStyle: React.CSSProperties = { padding: '0.4rem 0.6rem', color: 'var(--ink)' };

export default function LimitRangeListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel } = useTabContext();
    const referencePanel = `limitranges:${clusterName}`;
    const [selectedLimitRange, setSelectedLimitRange] = useState<models.LimitRangeInfo | null>(null);
    const lr = selectedLimitRange;

    return (
        <>
            <ResourceListView<models.LimitRangeInfo>
                title="Limit Range List"
                clusterName={clusterName}
                api={api}
                fetcher={GetLimitRanges}
                createFrom={models.LimitRangeInfo.createFrom}
                pollInterval={5000}
                deleter={DeleteLimitRange}
                deleteLabel="limit range"
                describeResource="limitranges"
                defaultFilters={defaultFilters}
                emptyMessage="No limit ranges found"
                onRowDoubleClick={(row) => openYamlPanel({ clusterName, resourceKind: 'limitrange', name: row.name, namespace: row.namespace, referencePanel })}
                columns={({ buildInOptions }) => (
                    <>
                        <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                        <Column field="namespace" header="Namespace" sortable filter filterField="namespace" showFilterMenu={false} style={{ minWidth: '10rem' }}
                            filterElement={(options: ColumnFilterElementTemplateOptions) => (
                                <MultiSelect value={options.value} options={buildInOptions('namespace')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                            )} />
                        <Column header="Types" style={{ minWidth: '14rem' }}
                            body={(row: models.LimitRangeInfo) => {
                                if (!row.limits || row.limits.length === 0) return '-';
                                return <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>{row.limits.map((l, i) => <Tag key={i} value={l.type} severity="info" />)}</div>;
                            }} />
                        <Column header="CPU (default / max)" style={{ minWidth: '14rem' }}
                            body={(row: models.LimitRangeInfo) => {
                                if (!row.limits || row.limits.length === 0) return '-';
                                return row.limits.map((l, i) => <div key={i} style={{ fontSize: '12px' }}>{l.type}: {l.default?.cpu ?? '-'} / {l.max?.cpu ?? '-'}</div>);
                            }} />
                        <Column header="Memory (default / max)" style={{ minWidth: '16rem' }}
                            body={(row: models.LimitRangeInfo) => {
                                if (!row.limits || row.limits.length === 0) return '-';
                                return row.limits.map((l, i) => <div key={i} style={{ fontSize: '12px' }}>{l.type}: {l.default?.memory ?? '-'} / {l.max?.memory ?? '-'}</div>);
                            }} />
                        <Column header="" style={{ minWidth: '5rem', maxWidth: '5rem' }}
                            body={(row: models.LimitRangeInfo) => (
                                <Button icon={<VscListOrdered size={16} />} text size="small" tooltip="View limits" tooltipOptions={{ position: 'left' }}
                                    onClick={() => setSelectedLimitRange(row)} />
                            )} />
                    </>
                )}
            />

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
        </>
    );
}
