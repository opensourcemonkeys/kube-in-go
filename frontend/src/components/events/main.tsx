import { useEffect, useMemo, useRef, useState } from 'react';

import { VscWarning, VscClearAll } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { MultiSelect } from 'primereact/multiselect';
import { ColumnFilterElementTemplateOptions } from 'primereact/column';
import type { DockviewPanelApi } from 'dockview';
import { GetEvents } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useEventsStore, defaultEventFilters } from '../../stores/eventsStore';
import { usePanelActive } from '../../lib/usePanelActive';
import { useDocumentVisible } from '../../lib/useDocumentVisible';
import { useDeferredMount } from '../../lib/useDeferredMount';
import { errText } from '../../lib/errText';
import ErrorBanner from '../shared/ErrorBanner';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useT } from '../../i18n/useT';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

const getTypeSeverity = (type: string): TagSeverity => {
    switch (type) {
        case 'Warning': return 'warning';
        case 'Normal':  return 'success';
        default:        return 'secondary';
    }
};

// Stable empty array so the store selector returns a consistent reference
// before a tab snapshot exists (avoids needless re-renders).
const EMPTY_EVENTS: models.EventInfo[] = [];

const formatTime = (ts: string): string => {
    if (!ts) return '-';
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return ts;
    }
};

export default function EventListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const t = useT();
    // Whether this panel is the foreground tab. When backgrounded we tear down
    // the table DOM and pause polling; the latest data lives in the persisted
    // store, so returning to the foreground rebuilds instantly from it.
    const active = usePanelActive(api) && useDocumentVisible();
    // Lazily mount the heavy DataTable a couple of frames after the tab paints,
    // so switching to this tab feels instant instead of janking on a big render.
    const showTable = useDeferredMount(active);

    // Persisted, per-cluster tab snapshot (events, filters, warningOnly). Reading
    // from the store on mount is what restores the tab "where it left off"; every
    // write below is auto-persisted to disk by the store's persist middleware.
    const storeKey = `events:${clusterName}`;
    const tab = useEventsStore((s) => s.tabs[storeKey]);
    const patchTab = useEventsStore((s) => s.patchTab);

    const events = tab?.events ?? EMPTY_EVENTS;
    const filters = tab?.filters ?? defaultEventFilters();
    const warningOnly = tab?.warningOnly ?? false;

    const setEvents = (next: models.EventInfo[]) => patchTab(storeKey, { events: next });
    const setFilters = (next: DataTableFilterMeta) => patchTab(storeKey, { filters: next });
    const setWarningOnly = (next: boolean) => patchTab(storeKey, { warningOnly: next });

    const namespaceOptions = useMemo(() =>
        [...new Set(events.map(e => e.namespace).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [events]
    );
    const typeOptions = useMemo(() =>
        [...new Set(events.map(e => e.type).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [events]
    );
    const reasonOptions = useMemo(() =>
        [...new Set(events.map(e => e.reason).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [events]
    );
    const objectKindOptions = useMemo(() =>
        [...new Set(events.map(e => e.object_kind).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [events]
    );
    const objectOptions = useMemo(() =>
        [...new Set(events.map(e => e.object).filter(Boolean))].sort().map(v => ({ label: v, value: v })),
        [events]
    );
    const [selectedEvent, setSelectedEvent] = useState<models.EventInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // PrimeReact's VirtualScroller captures its viewport height once at init()
    // time. With scrollHeight="flex" that height is purely CSS-flex-derived and
    // the scroller only re-measures on a *window* resize whose pixel height
    // differs — so inside a Dockview panel it often measures once (before data
    // arrives) and the table stays empty until the window is resized. Feeding an
    // explicit measured pixel height (via ResizeObserver, which unlike
    // window.resize also fires on tab show / splitter drags) and remounting once
    // a real height exists forces a correct init. Mirrors ResourceListView.
    const tableWrapRef = useRef<HTMLDivElement>(null);
    const [scrollHeight, setScrollHeight] = useState<string>('flex');
    useEffect(() => {
        if (!active) return;
        const el = tableWrapRef.current;
        if (!el) return;
        let last = -1;
        const observer = new ResizeObserver((entries) => {
            const height = Math.round(entries[0]?.contentRect.height ?? 0);
            // Ignore 0 (tab backgrounded/hidden) so we keep the last good height.
            if (height === 0 || height === last) return;
            last = height;
            setScrollHeight(`${height}px`);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [active, showTable]);

    const loadEvents = async () => {
        setRefreshing(true);
        try {
            const items = await GetEvents(clusterName);
            setEvents(items.map((item: any) => models.EventInfo.createFrom(item)));
            setError(null);
        } catch (e) {
            // Keep the last persisted snapshot on a transient fetch failure so the
            // tab still shows where it left off instead of going blank. Until S8
            // that failure was invisible; now the banner says the rows are stale.
            console.error('Failed to load events:', e);
            setError(errText(e));
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (!active) return;
        loadEvents();
        const intervalId = window.setInterval(loadEvents, 5000);
        return () => window.clearInterval(intervalId);
    }, [active]);

    // Backgrounded: render nothing heavy so the table DOM is released. The full
    // UI is rebuilt from the persisted store the moment the tab is reactivated.
    if (!active) {
        return <div style={{ height: '100%' }} />;
    }

    const displayedEvents = warningOnly
        ? events.filter(e => e.type === 'Warning')
        : events;

    const ev = selectedEvent;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>{t('panels:events.title')}</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Button
                        label={t('panels:events.warningsOnly')}
                        icon={<VscWarning size={16} />}
                        text
                        severity={warningOnly ? 'warning' : 'secondary'}
                        onClick={() => setWarningOnly(!warningOnly)}
                        tooltip={t('panels:events.warningsOnlyTooltip')}
                        tooltipOptions={{ position: 'left' }}
                    />
                    <Button
                        icon={<VscClearAll size={16} />}
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultEventFilters())}
                        tooltip={t('action.clearFilters')}
                        tooltipOptions={{ position: 'left' }}
                    />
                </div>
            </div>

            <ErrorBanner
                message={error}
                onRetry={loadEvents}
                busy={refreshing}
                stale={events.length > 0}
                context={`Events (${clusterName})`}
            />

            <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!showTable ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ProgressSpinner style={{ width: 40, height: 40 }} strokeWidth="4" />
                </div>
            ) : (
            <DataTable
                // Remount once a measured pixel height is available so the virtual
                // scroller re-runs init() with a real viewport height (see note above).
                key={scrollHeight === 'flex' ? 'measuring' : 'measured'}
                value={displayedEvents}
                dataKey="name"
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                filterDisplay="row"
                stripedRows
                showGridlines
                resizableColumns
                scrollable
                scrollHeight={scrollHeight}
                virtualScrollerOptions={{ itemSize: 46 }}
                emptyMessage={error ? ' ' : t('panels:events.empty')}
                sortField="last_timestamp"
                sortOrder={-1}
                onRowDoubleClick={(e: any) => setSelectedEvent(e.data as models.EventInfo)}
            >
                <Column
                    field="type"
                    header={t('resources:column.type')}
                    sortable
                    filter
                    filterField="type"
                    showFilterMenu={false}
                    style={{ minWidth: '8rem' }}
                    body={(row: models.EventInfo) => (
                        <Tag value={row.type || '-'} severity={getTypeSeverity(row.type)} />
                    )}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={typeOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder={t('filter.all')} filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    field="namespace"
                    header={t('resources:column.namespace')}
                    sortable
                    filter
                    filterField="namespace"
                    showFilterMenu={false}
                    style={{ minWidth: '10rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={namespaceOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder={t('filter.all')} filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    field="object_kind"
                    header={t('resources:column.kind')}
                    sortable
                    filter
                    filterField="object_kind"
                    showFilterMenu={false}
                    style={{ minWidth: '9rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={objectKindOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder={t('filter.all')} filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    field="object"
                    header={t('resources:column.object')}
                    sortable
                    filter
                    filterField="object"
                    showFilterMenu={false}
                    style={{ minWidth: '14rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={objectOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder={t('filter.all')} filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    field="reason"
                    header={t('resources:column.reason')}
                    sortable
                    filter
                    filterField="reason"
                    showFilterMenu={false}
                    style={{ minWidth: '11rem' }}
                    filterElement={(options: ColumnFilterElementTemplateOptions) => (
                        <MultiSelect value={options.value} options={reasonOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder={t('filter.all')} filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                    )}
                />
                <Column
                    field="message"
                    header={t('resources:column.message')}
                    filter
                    filterField="message"
                    filterPlaceholder={t('resources:filter.searchMessage')}
                    showFilterMenu={false}
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
                    header={t('resources:column.count')}
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
                    header={t('resources:column.lastSeen')}
                    sortable
                    style={{ minWidth: '13rem' }}
                    body={(row: models.EventInfo) => formatTime(row.last_timestamp)}
                />
            </DataTable>
            )}
            </div>

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
                            <span style={labelStyle}>{t('resources:column.object')}</span>
                            <span>{ev.object_kind} / {ev.object}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>{t('resources:column.reason')}</span>
                            <span>{ev.reason}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>{t('resources:column.count')}</span>
                            <span>{ev.count}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>{t('panels:events.firstSeen')}</span>
                            <span>{formatTime(ev.first_timestamp)}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>{t('resources:column.lastSeen')}</span>
                            <span>{formatTime(ev.last_timestamp)}</span>
                        </div>
                        <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '0.8rem' }}>
                            <span style={{ ...labelStyle, display: 'block', marginBottom: '0.4rem' }}>{t('resources:column.message')}</span>
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
