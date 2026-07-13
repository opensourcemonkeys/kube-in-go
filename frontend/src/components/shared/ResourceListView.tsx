import React, { useEffect, useRef, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { VscClearAll, VscTrash, VscClose } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { useResourceList, ResourceRow } from '../../lib/useResourceList';

// PrimeReact's DataTable finds its columns via React.Children.toArray(children),
// which flattens arrays but NOT Fragments. The `columns` render-prop returns a
// single <>…</> Fragment, so we must unwrap it into a keyed array here — otherwise
// the data columns are invisible and the table renders empty.
function toColumnArray(node: React.ReactNode): React.ReactNode {
    const children =
        React.isValidElement(node) && node.type === React.Fragment
            ? (node as React.ReactElement<{ children?: React.ReactNode }>).props.children
            : node;
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
    /** Unique IN-filter options ({label,value}) for a given row field. */
    buildInOptions: (field: keyof T) => { label: string; value: string }[];
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
    /** DataTable row key (default "name"). Use a synthetic id when names can collide across namespaces. */
    dataKey?: string;
    defaultFilters: DataTableFilterMeta;
    pollInterval?: number;
    emptyMessage: string;
    onRowDoubleClick?: (row: T) => void;
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
        dataKey = 'name',
        defaultFilters,
        pollInterval,
        emptyMessage,
        onRowDoubleClick,
        columns,
    } = props;

    const {
        items,
        selected,
        setSelected,
        filters,
        setFilters,
        deleting,
        deleteDialogVisible,
        openDeleteDialog,
        closeDeleteDialog,
        handleDeleteSelected,
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
    useEffect(() => {
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
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
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

            <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <DataTable
                    // The virtual scroller captures its viewport height once at init time.
                    // When a panel is auto-opened during app launch, that init can run before
                    // the flex layout has a real height (scrollHeight still "flex"), so rows
                    // render into the DOM but are clipped/hidden and never recover. Remounting
                    // once a measured pixel height is available forces a fresh init with the
                    // correct height, after which normal value updates render rows. (Manually
                    // opened panels already mount into a settled layout, so they never hit this.)
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
                    emptyMessage={emptyMessage}
                >
                    {deletable && (
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ minWidth: '3rem', maxWidth: '3rem' }} />
                    )}
                    {toColumnArray(columns({ items, buildInOptions }))}
                </DataTable>
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
