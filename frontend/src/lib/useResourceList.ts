import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Toast } from 'primereact/toast';
import { usePanelActive } from './usePanelActive';

/** Minimal shape every list row shares. Namespace is absent for cluster-scoped resources. */
export interface ResourceRow {
    name: string;
    namespace?: string;
}

export interface UseResourceListOptions<T extends ResourceRow> {
    clusterName: string;
    /** Wails binding that returns the raw list, e.g. GetPods. */
    fetcher: (clusterName: string) => Promise<any[]>;
    /** Deserializer, e.g. models.PodInfo.createFrom. */
    createFrom: (raw: any) => T;
    /** Wails delete binding, e.g. DeletePod. When provided, the delete flow is enabled. */
    deleter?: (clusterName: string, name: string, namespace: string) => Promise<void>;
    /** Human label used in delete toasts/dialog, e.g. "pod". */
    deleteLabel?: string;
    defaultFilters: DataTableFilterMeta;
    /** Poll interval in ms (default 2000). */
    pollInterval?: number;
    /** Dockview panel api; when supplied, polling pauses while the tab is backgrounded. */
    api?: DockviewPanelApi;
}

export interface UseResourceListResult<T extends ResourceRow> {
    items: T[];
    selected: T[];
    setSelected: (rows: T[]) => void;
    filters: DataTableFilterMeta;
    setFilters: (f: DataTableFilterMeta) => void;
    deleting: boolean;
    deleteDialogVisible: boolean;
    openDeleteDialog: () => void;
    closeDeleteDialog: () => void;
    handleDeleteSelected: () => Promise<void>;
    reload: () => Promise<void>;
    toastRef: React.RefObject<Toast>;
    /** Builds unique IN-filter options ({label,value}) for a given row field. */
    buildInOptions: (field: keyof T) => { label: string; value: string }[];
}

export function useResourceList<T extends ResourceRow>(
    options: UseResourceListOptions<T>,
): UseResourceListResult<T> {
    const {
        clusterName,
        fetcher,
        createFrom,
        deleter,
        deleteLabel = 'resource',
        defaultFilters,
        pollInterval = 2000,
        api,
    } = options;

    const [items, setItems] = useState<T[]>([]);
    const [selected, setSelected] = useState<T[]>([]);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);
    const toastRef = useRef<Toast>(null);
    const active = usePanelActive(api);

    const reload = useCallback(async () => {
        try {
            const data = await fetcher(clusterName);
            setItems(data.map(createFrom));
        } catch (error) {
            console.error(`Failed to load ${deleteLabel} list:`, error);
            setItems([]);
        }
    }, [clusterName, fetcher, createFrom, deleteLabel]);

    useEffect(() => {
        if (!active) return;
        reload();
        const intervalId = window.setInterval(reload, pollInterval);
        return () => window.clearInterval(intervalId);
    }, [active, pollInterval, reload]);

    const openDeleteDialog = useCallback(() => {
        if (selected.length > 0) setDeleteDialogVisible(true);
    }, [selected]);

    const closeDeleteDialog = useCallback(() => {
        if (!deleting) setDeleteDialogVisible(false);
    }, [deleting]);

    const handleDeleteSelected = useCallback(async () => {
        if (!deleter || selected.length === 0) {
            setDeleteDialogVisible(false);
            return;
        }

        setDeleting(true);
        const toDelete = [...selected];

        for (const row of toDelete) {
            try {
                await deleter(clusterName, row.name, row.namespace ?? '');
                toastRef.current?.show({
                    severity: 'success',
                    summary: 'Deleted successfully',
                    detail: `${row.namespace ? `${row.namespace}/` : ''}${row.name} deleted`,
                    life: 2500,
                });
            } catch {
                toastRef.current?.show({
                    severity: 'error',
                    summary: 'Delete failed',
                    detail: `${row.namespace ? `${row.namespace}/` : ''}${row.name} could not be deleted`,
                    life: 3500,
                });
            }
        }

        setSelected([]);
        setDeleteDialogVisible(false);
        setDeleting(false);
        await reload();
    }, [deleter, selected, clusterName, reload]);

    const buildInOptions = useCallback(
        (field: keyof T) =>
            [...new Set(items.map((i) => i[field]).filter(Boolean) as string[])]
                .sort()
                .map((v) => ({ label: v, value: v })),
        [items],
    );

    return useMemo(
        () => ({
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
            reload,
            toastRef,
            buildInOptions,
        }),
        [
            items,
            selected,
            filters,
            deleting,
            deleteDialogVisible,
            openDeleteDialog,
            closeDeleteDialog,
            handleDeleteSelected,
            reload,
            buildInOptions,
        ],
    );
}
