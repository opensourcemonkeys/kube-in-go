import { useEffect, useRef, useState } from 'react';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import FilterListOff from '@mui/icons-material/FilterListOff';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { FilterMatchMode } from 'primereact/api';
import { GetEvents } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

const getTypeSeverity = (type: string): TagSeverity => {
    switch (type) {
        case 'Warning': return 'warning';
        case 'Normal':  return 'success';
        default:        return 'secondary';
    }
};

const defaultFilters: DataTableFilterMeta = {
    namespace:   { value: null, matchMode: FilterMatchMode.CONTAINS },
    type:        { value: null, matchMode: FilterMatchMode.CONTAINS },
    reason:      { value: null, matchMode: FilterMatchMode.CONTAINS },
    object_kind: { value: null, matchMode: FilterMatchMode.CONTAINS },
    object:      { value: null, matchMode: FilterMatchMode.CONTAINS },
};

const formatTime = (ts: string): string => {
    if (!ts) return '-';
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return ts;
    }
};

export default function EventListComponent() {
    const [events, setEvents] = useState<models.EventInfo[]>([]);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const [warningOnly, setWarningOnly] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<models.EventInfo | null>(null);
    const toast = useRef<Toast | null>(null);

    const loadEvents = async () => {
        try {
            const items = await GetEvents();
            setEvents(items.map((item: any) => models.EventInfo.createFrom(item)));
        } catch (error) {
            console.error('Failed to load events:', error);
            setEvents([]);
        }
    };

    useEffect(() => {
        loadEvents();
        const intervalId = window.setInterval(loadEvents, 5000);
        return () => window.clearInterval(intervalId);
    }, []);

    const displayedEvents = warningOnly
        ? events.filter(e => e.type === 'Warning')
        : events;

    const ev = selectedEvent;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Event List</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        label="Warnings Only"
                        icon={<WarningAmberOutlined fontSize="small" />}
                        text
                        severity={warningOnly ? 'warning' : 'secondary'}
                        onClick={() => setWarningOnly(p => !p)}
                        tooltip="Show only Warning events"
                        tooltipOptions={{ position: 'left' }}
                    />
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
                value={displayedEvents}
                dataKey="name"
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight="flex"
                emptyMessage="No events found"
                sortField="last_timestamp"
                sortOrder={-1}
                onRowDoubleClick={(e: any) => setSelectedEvent(e.data as models.EventInfo)}
            >
                <Column
                    field="type"
                    header="Type"
                    sortable
                    filter
                    filterField="type"
                    filterPlaceholder="Search"
                    showFilterMenu={false}
                    style={{ minWidth: '8rem' }}
                    body={(row: models.EventInfo) => (
                        <Tag value={row.type || '-'} severity={getTypeSeverity(row.type)} />
                    )}
                />
                <Column
                    field="namespace"
                    header="Namespace"
                    sortable
                    filter
                    filterField="namespace"
                    filterPlaceholder="Search"
                    showFilterMenu={false}
                    style={{ minWidth: '10rem' }}
                />
                <Column
                    field="object_kind"
                    header="Kind"
                    sortable
                    filter
                    filterField="object_kind"
                    filterPlaceholder="Search"
                    showFilterMenu={false}
                    style={{ minWidth: '9rem' }}
                />
                <Column
                    field="object"
                    header="Object"
                    sortable
                    filter
                    filterField="object"
                    filterPlaceholder="Search"
                    showFilterMenu={false}
                    style={{ minWidth: '14rem' }}
                />
                <Column
                    field="reason"
                    header="Reason"
                    sortable
                    filter
                    filterField="reason"
                    filterPlaceholder="Search"
                    showFilterMenu={false}
                    style={{ minWidth: '11rem' }}
                />
                <Column
                    field="message"
                    header="Message"
                    style={{ minWidth: '22rem' }}
                    body={(row: models.EventInfo) => {
                        const msg = row.message || '';
                        const truncated = msg.length > 40 ? msg.slice(0, 40) + '…' : msg;
                        return (
                            <span style={{ fontSize: '12px', color: row.type === 'Warning' ? 'var(--yellow)' : 'inherit' }}>
                                {truncated}
                            </span>
                        );
                    }}
                />
                <Column
                    field="count"
                    header="Count"
                    sortable
                    style={{ minWidth: '6rem' }}
                    body={(row: models.EventInfo) => (
                        row.count > 1
                            ? <Tag value={String(row.count)} severity="secondary" />
                            : <span>{row.count}</span>
                    )}
                />
                <Column
                    field="last_timestamp"
                    header="Last Seen"
                    sortable
                    style={{ minWidth: '13rem' }}
                    body={(row: models.EventInfo) => formatTime(row.last_timestamp)}
                />
            </DataTable>

            <Dialog
                header={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {ev && <Tag value={ev.type} severity={getTypeSeverity(ev.type)} />}
                        <span>{ev?.reason}</span>
                    </div>
                }
                visible={!!selectedEvent}
                style={{ width: '42rem' }}
                modal
                onHide={() => setSelectedEvent(null)}
            >
                {ev && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '13px' }}>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Namespace</span>
                            <span>{ev.namespace}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Object</span>
                            <span>{ev.object_kind} / {ev.object}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Reason</span>
                            <span>{ev.reason}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Count</span>
                            <span>{ev.count}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>First Seen</span>
                            <span>{formatTime(ev.first_timestamp)}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Last Seen</span>
                            <span>{formatTime(ev.last_timestamp)}</span>
                        </div>
                        <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '0.8rem' }}>
                            <span style={{ ...labelStyle, display: 'block', marginBottom: '0.4rem' }}>Message</span>
                            <div style={{
                                background: 'var(--surface-ground)',
                                border: '1px solid var(--surface-border)',
                                borderRadius: '6px',
                                padding: '0.7rem 0.9rem',
                                fontSize: '12px',
                                lineHeight: '1.6',
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                                color: ev.type === 'Warning' ? 'var(--yellow)' : 'var(--ink)',
                            }}>
                                {ev.message || '-'}
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
}

const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'baseline',
    borderBottom: '1px solid var(--surface-border)',
    paddingBottom: '0.5rem',
};

const labelStyle: React.CSSProperties = {
    color: 'var(--ink3)',
    minWidth: '7rem',
    flexShrink: 0,
};
