import React from 'react';
import type { DockviewPanelApi } from 'dockview';
import { VscClearAll, VscTrash, VscClose } from 'react-icons/vsc';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { useResourceList, ResourceRow } from '../../lib/useResourceList';

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

            <DataTable
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
                scrollHeight="flex"
                emptyMessage={emptyMessage}
            >
                {deletable && (
                    <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} style={{ minWidth: '3rem', maxWidth: '3rem' }} />
                )}
                {columns({ items, buildInOptions })}
            </DataTable>

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
