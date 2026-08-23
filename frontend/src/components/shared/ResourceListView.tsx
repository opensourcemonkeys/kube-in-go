import React, { useLayoutEffect, useRef, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { VscClearAll, VscTrash, VscClose } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { VscInfo } from 'react-icons/vsc';
import { useResourceList, ResourceRow } from '../../lib/useResourceList';
import { useTabContext } from '../../contexts/TabContext';
import ErrorBanner from './ErrorBanner';

// PrimeReact's DataTable finds its columns via React.Children.toArray(children),
// which flattens arrays but NOT Fragments. The `columns` render-prop returns a
// single <>…</> Fragment, so we must unwrap it into a keyed array here — otherwise
// the data columns are invisible and the table renders empty.
// `extra` is appended after the view's own columns. It must be added *after*
// the Fragment is unwrapped, never by wrapping both in another Fragment: the
// outer wrapper's children would then be [innerFragment, extra], and
// React.Children.toArray would leave the inner Fragment intact — losing every
// data column, which is the exact failure this function exists to prevent.
function toColumnArray(node: React.ReactNode, extra?: React.ReactNode): React.ReactNode {
    const unwrapped =
        React.isValidElement(node) && node.type === React.Fragment
            ? (node as React.ReactElement<{ children?: React.ReactNode }>).props.children
            : node;
    const children = extra ? [unwrapped, extra] : unwrapped;
    // Action columns (the control-button column) are declared with an empty
    // header and carry no `field`. They have a fixed width and must not be
    // user-resizable. In PrimeReact's default "fit" resize mode the action
    // column is the last one (no resizer of its own), but dragging the column
    // *before* it steals width from it — so we tag both the action column and
    // its left neighbour and hide both resize handles via theme CSS.
    const arr = React.Children.toArray(children);
    const isActionColumn = (node: React.ReactNode) => {
        if (!React.isValidElement(node)) return false;
        const p = node.props as { header?: React.ReactNode; field?: string };
        return (p.header === '' || p.header == null) && !p.field;
    };
    const tag = new Set<number>();
    arr.forEach((child, i) => {
        if (isActionColumn(child)) {
            tag.add(i);
            if (i > 0) tag.add(i - 1);
        }
    });
    return arr.map((child, i) => {
        if (!tag.has(i) || !React.isValidElement(child)) return child;
        const props = child.props as { headerClassName?: string };
        return React.cloneElement(child as React.ReactElement<any>, {
            headerClassName: [props.headerClassName, 'ktable-actions-col'].filter(Boolean).join(' '),
        });
    });
}

// Must match the fixed row height enforced by theme-monolith.css
// (.p-datatable-tbody > tr > td { height: 40px }).
const ROW_HEIGHT = 40;

export interface ColumnsContext<T extends ResourceRow> {
    items: T[];
    /**
     * Unique IN-filter options ({label,value}) for a given row field.
     * Array-valued fields are flattened (pair them with `ARRAY_IN`).
     */
    buildInOptions: (field: keyof T) => { label: string; value: string }[];
    /**
     * Refetches the list. Row actions that mutate the object (scale, restart,
     * suspend) call this so the change shows immediately instead of waiting out
     * the poll interval.
     */
    reload: () => Promise<void>;
    /** The list's own toast, so row actions report success/failure in the same place deletes do. */
    toastRef: React.RefObject<Toast>;
}

export interface ResourceListViewProps<T extends ResourceRow> {
    title: string;
    clusterName: string;
    api?: DockviewPanelApi;
    fetcher: (clusterName: string) => Promise<any[]>;
    createFrom: (raw: any) => T;
    /** When provided, enables multi-select + Delete Selected + confirmation dialog. */
    deleter?: (clusterName: string, name: string, namespace: string) => Promise<void>;
    /** Singular label for delete UI, e.g. "pod". */
    deleteLabel?: string;
    /**
     * DataTable row key. Defaults to the `__rowKey` (`namespace/name`) that
     * `useResourceList` stamps on every row, which is unique because a panel
     * lists exactly one kind. Only override it for a view whose rows are *not*
     * `namespace/name`-unique.
     */
    dataKey?: string;
    /**
     * Plural resource name (e.g. "pods"). When set, a Describe button column is
     * appended automatically — one prop instead of a hand-written button in
     * every view. The strings match the sidebar/TUI view keys and are resolved
     * to a GroupKind server-side by the REST mapper.
     */
    describeResource?: string;
    defaultFilters: DataTableFilterMeta;
    pollInterval?: number;
    emptyMessage: string;
    onRowDoubleClick?: (row: T) => void;
    /**
     * Extra toolbar content, rendered left of Delete Selected. Receives `reload`
     * so a create action can refresh immediately instead of waiting out a poll.
     */
    toolbarExtra?: (ctx: { reload: () => Promise<void> }) => React.ReactNode;
    /** Returns the <Column> elements for this resource (excluding the selection column). */
    columns: (ctx: ColumnsContext<T>) => React.ReactNode;
}

export default function ResourceListView<T extends ResourceRow>(props: ResourceListViewProps<T>) {
    const {
        title,
        clusterName,
        api,
        fetcher,
        createFrom,
        deleter,
        deleteLabel = 'resource',
        dataKey = '__rowKey',
        describeResource,
        defaultFilters,
        pollInterval,
        emptyMessage,
        onRowDoubleClick,
        toolbarExtra,
        columns,
    } = props;

    const {
        items,
        error,
        loading,
        refreshing,
        selected,
        setSelected,
        filters,
        setFilters,
        deleting,
        deleteDialogVisible,
        openDeleteDialog,
        closeDeleteDialog,
        handleDeleteSelected,
        reload,
        toastRef,
        buildInOptions,
    } = useResourceList<T>({
        clusterName,
        fetcher,
        createFrom,
        deleter,
        deleteLabel,
        defaultFilters,
        pollInterval,
        api,
    });

    const deletable = !!deleter;
    const { openDescribePanel } = useTabContext();

    // Appended after the view's own columns, so on views that already have an
    // action column this lands immediately to its right — and `toColumnArray`
    // tags both (it tags the action column *and* its left neighbour), which is
    // exactly the pair whose resize handles must stay hidden.
    const describeColumn = describeResource ? (
        <Column
            key="__describe"
            header=""
            headerStyle={{ width: '3.2rem' }}
            style={{ minWidth: '3.2rem', maxWidth: '3.2rem' }}
            body={(row: T) => (
                <Button
                    icon={<VscInfo size={16} />}
                    text
                    size="small"
                    severity="secondary"
                    aria-label="Describe"
                    onClick={(e) => {
                        e.stopPropagation();
                        openDescribePanel({
                            clusterName,
                            resource: describeResource,
                            name: row.name,
                            namespace: row.namespace ?? '',
                            referencePanel: `${describeResource}:${clusterName}`,
                        });
                    }}
                />
            )}
        />
    ) : null;

    // PrimeReact's VirtualScroller derives its visible row count from the viewport
    // height captured at init() time. With scrollHeight="flex" that height is
    // purely CSS-flex-derived and the scroller only re-measures on a *window*
    // resize whose pixel height actually differs (virtualscroller.js onResize:
    // `isDiffHeight = height !== defaultHeight`). Inside a Dockview panel the flex
    // height is stable after the first paint, so when the panel is wide the
    // scroller measures once (often before data arrives) and never re-renders —
    // the table stays empty until the window is resized. Feeding an *explicit*
    // measured pixel scrollHeight instead makes every height change re-run the
    // scroller's init() (useUpdateEffect on props.scrollHeight), and ResizeObserver
    // — unlike window.resize — also fires on Dockview splitter drags / tab show.
    const tableWrapRef = useRef<HTMLDivElement>(null);
    const [scrollHeight, setScrollHeight] = useState<string>('flex');
    useLayoutEffect(() => {
        const el = tableWrapRef.current;
        if (!el) return;
        let last = -1;
        const apply = (height: number) => {
            // Ignore 0 (tab backgrounded/hidden) so we keep the last good height.
            if (height === 0 || height === last) return;
            last = height;
            setScrollHeight(`${height}px`);
        };
        // Measured synchronously in a *layout* effect, before the browser paints.
        // `observe()` delivers its first callback a frame later, which was late
        // enough for the table to paint at the 'flex' height and then be torn down
        // by the `key` below — the visible flicker on a panel's first load. The
        // wrapper is rendered unconditionally (the first-load spinner sits *inside*
        // it) precisely so this can run while the first fetch is still in flight,
        // leaving the table nothing to re-measure by the time it mounts.
        apply(Math.round(el.clientHeight));
        const observer = new ResizeObserver((entries) => {
            apply(Math.round(entries[0]?.contentRect.height ?? 0));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // PrimeReact's DataTable selection props are a discriminated union; spreading a
    // conditionally-typed object keeps TS from trying to resolve `selectionMode` as
    // `'multiple' | undefined` (which fails overload resolution).
    const selectionProps: any = deletable
        ? {
              selectionMode: 'multiple',
              selection: selected,
              onSelectionChange: (e: any) => setSelected(Array.isArray(e.value) ? e.value : []),
          }
        : {};

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon={<VscClose size={16} />} text onClick={closeDeleteDialog} disabled={deleting} />
            <Button label="Delete" icon={<VscTrash size={16} />} severity="danger" onClick={handleDeleteSelected} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toastRef} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>{title}</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {toolbarExtra?.({ reload })}
                    <Button
                        icon={<VscClearAll size={16} />}
                        text
                        severity="secondary"
                        onClick={() => setFilters(defaultFilters)}
                        tooltip="Clear filters"
                        tooltipOptions={{ position: 'left' }}
                    />
                    {deletable && (
                        <Button
                            label="Delete Selected"
                            icon={<VscTrash size={16} />}
                            severity="danger"
                            onClick={openDeleteDialog}
                            disabled={selected.length === 0 || deleting}
                        />
                    )}
                </div>
            </div>

            {/* Three distinct outcomes, deliberately not collapsed into one
                "nothing here" state (beta-plan S8): still loading, failed, or
                genuinely empty. `error` with rows behind it means stale, not gone. */}
            <ErrorBanner
                message={error}
                onRetry={reload}
                busy={refreshing}
                stale={items.length > 0}
                context={`${title} (${clusterName})`}
            />

            {/* The wrapper is never conditional: it is what the layout effect above
                measures, and it has to exist (and have its final height) while the
                first fetch is still running so the table can mount already knowing
                its height. Only its *contents* swap from spinner to table. */}
            <div
                ref={tableWrapRef}
                className="ktable-fill"
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    ...(loading ? { alignItems: 'center', justifyContent: 'center' } : null),
                }}
            >
                {loading ? (
                    <ProgressSpinner style={{ width: 40, height: 40 }} strokeWidth="4" />
                ) : (
                <DataTable
                    // The virtual scroller captures its viewport height once at init time.
                    // When a panel is auto-opened during app launch, that init can run before
                    // the flex layout has a real height (scrollHeight still "flex"), so rows
                    // render into the DOM but are clipped/hidden and never recover. Remounting
                    // once a measured pixel height is available forces a fresh init with the
                    // correct height, after which normal value updates render rows. (Manually
                    // opened panels already mount into a settled layout, so they never hit this.)
                    // This flips exactly once, and because the wrapper is measured in a
                    // layout effect it flips *before* the table has ever painted, so the
                    // remount is invisible. Never key this to the live height: that would
                    // remount on every resize, and PrimeReact's VirtualScroller already
                    // re-runs init() when its scrollHeight prop changes (useUpdateEffect on
                    // [itemSize, scrollHeight, scrollWidth]) — no remount needed for that.
                    key={scrollHeight === 'flex' ? 'measuring' : 'measured'}
                    value={items}
                    dataKey={dataKey}
                    {...selectionProps}
                    onRowDoubleClick={onRowDoubleClick ? (e: any) => onRowDoubleClick(e.data as T) : undefined}
                    filters={filters}
                    onFilter={(e) => setFilters(e.filters)}
                    filterDisplay="row"
                    stripedRows
                    showGridlines
                    resizableColumns
                    scrollable
                    scrollHeight={scrollHeight}
                    virtualScrollerOptions={{ itemSize: ROW_HEIGHT }}
                    // A failed fetch must not read as "there are none of these":
                    // the banner above is the message in that case.
                    emptyMessage={error ? ' ' : emptyMessage}
                >
                    {deletable && (
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ minWidth: '3rem', maxWidth: '3rem' }} />
                    )}
                    {toColumnArray(columns({ items, buildInOptions, reload, toastRef }), describeColumn)}
                </DataTable>
                )}
            </div>

            {deletable && (
                <Dialog
                    header={`Delete ${deleteLabel.charAt(0).toUpperCase() + deleteLabel.slice(1)} Confirmation`}
                    visible={deleteDialogVisible}
                    style={{ width: '30rem' }}
                    modal
                    footer={deleteDialogFooter}
                    onHide={closeDeleteDialog}
                >
                    <p className="m-0 mb-3">Do you want to delete the selected {deleteLabel} records?</p>
                    <ul className="m-0 pl-3">
                        {selected.map((row) => (
                            <li key={`${row.namespace ?? ''}-${row.name}`}>{row.namespace ? `${row.namespace}/` : ''}{row.name}</li>
                        ))}
                    </ul>
                </Dialog>
            )}
        </div>
    );
}
