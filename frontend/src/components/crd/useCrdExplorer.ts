import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { GetCRDs, GetCRDInstanceCounts, GetResourceTable } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { usePanelActive } from '../../lib/usePanelActive';
import { useDocumentVisible } from '../../lib/useDocumentVisible';
import { errText } from '../../lib/errText';

// The catalog sweep costs one API round-trip per CRD (see
// services.GetCRDInstanceCounts), so it refreshes far more slowly than the
// single list backing the selected kind's table.
const CATALOG_POLL_MS = 60_000;
const INSTANCE_POLL_MS = 10_000;

/** Instance count meaning "could not be taken" (no permission, unresolvable). */
export const COUNT_UNKNOWN = -1;

export interface CrdGroup {
    /** API group, "" for the core group. */
    group: string;
    crds: models.CRDInfo[];
}

export type ScopeFilter = string[];

export interface CrdExplorer {
    // Catalog
    crds: models.CRDInfo[];
    groups: CrdGroup[];
    counts: Record<string, number>;
    catalogLoading: boolean;
    countsLoading: boolean;
    matchCount: number;
    refreshCatalog: () => void;

    // Filters
    search: string;
    setSearch: (v: string) => void;
    onlyWithInstances: boolean;
    setOnlyWithInstances: (v: boolean) => void;
    scopes: ScopeFilter;
    setScopes: (v: ScopeFilter) => void;

    // Tree expansion
    isExpanded: (group: string) => boolean;
    toggleGroup: (group: string) => void;

    // Selection + instance table
    selected: models.CRDInfo | null;
    select: (crd: models.CRDInfo) => void;
    table: models.ResourceTable | null;
    tableLoading: boolean;
    tableError: string | null;
    refreshTable: () => void;
}

/**
 * Owns every piece of CRD explorer state: the catalog (definitions + instance
 * counts), the search/scope filters that narrow the tree, and the
 * server-rendered table for whichever kind is selected.
 *
 * All polling is gated on `usePanelActive` + `useDocumentVisible`, so a
 * backgrounded Dockview tab and a minimised window both go quiet.
 */
export function useCrdExplorer(clusterName: string, api?: DockviewPanelApi): CrdExplorer {
    const active = usePanelActive(api) && useDocumentVisible();

    const [crds, setCrds] = useState<models.CRDInfo[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [countsLoading, setCountsLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [onlyWithInstances, setOnlyWithInstances] = useState(false);
    const [scopes, setScopes] = useState<ScopeFilter>([]);
    // Only collapsed groups are tracked; groups default to expanded.
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [table, setTable] = useState<models.ResourceTable | null>(null);
    const [tableLoading, setTableLoading] = useState(false);
    const [tableError, setTableError] = useState<string | null>(null);

    const selected = useMemo(
        () => crds.find((c) => c.name === selectedName) ?? null,
        [crds, selectedName],
    );

    // ── Catalog ──────────────────────────────────────────────────────────────

    const loadCatalog = useCallback(async () => {
        setCatalogLoading(true);
        setCountsLoading(true);
        // Definitions and counts are fetched in parallel: the tree renders as
        // soon as the definitions land, and the badges fill in afterwards.
        const definitions = GetCRDs(clusterName)
            .then((items) => setCrds(items.map((i: any) => models.CRDInfo.createFrom(i))))
            .catch((e) => {
                console.error('Failed to load CRDs:', e);
                setCrds([]);
            })
            .finally(() => setCatalogLoading(false));

        const instanceCounts = GetCRDInstanceCounts(clusterName)
            .then((m) => setCounts(m ?? {}))
            .catch((e) => {
                console.error('Failed to count CRD instances:', e);
                setCounts({});
            })
            .finally(() => setCountsLoading(false));

        await Promise.all([definitions, instanceCounts]);
    }, [clusterName]);

    useEffect(() => {
        if (!active) return;
        loadCatalog();
        const id = window.setInterval(loadCatalog, CATALOG_POLL_MS);
        return () => window.clearInterval(id);
    }, [active, loadCatalog]);

    // Drop a selection whose CRD disappeared from the cluster.
    useEffect(() => {
        if (selectedName && !catalogLoading && !crds.some((c) => c.name === selectedName)) {
            setSelectedName(null);
            setTable(null);
        }
    }, [crds, catalogLoading, selectedName]);

    // ── Instance table ───────────────────────────────────────────────────────

    // Guards against a slow response for a previously-selected kind landing
    // after a faster one for the kind the user has since clicked.
    const requestId = useRef(0);

    const loadTable = useCallback(
        async (crd: models.CRDInfo, silent: boolean) => {
            const id = ++requestId.current;
            if (!silent) {
                setTableLoading(true);
                setTable(null);
                setTableError(null);
            }
            try {
                const result = await GetResourceTable(clusterName, crd.group, crd.plural, '');
                if (id !== requestId.current) return;
                setTable(models.ResourceTable.createFrom(result));
                setTableError(null);
            } catch (e: any) {
                if (id !== requestId.current) return;
                setTable(null);
                setTableError(errText(e));
            } finally {
                if (id === requestId.current) setTableLoading(false);
            }
        },
        [clusterName],
    );

    useEffect(() => {
        if (!active || !selected) return;
        loadTable(selected, false);
        const id = window.setInterval(() => loadTable(selected, true), INSTANCE_POLL_MS);
        return () => window.clearInterval(id);
    }, [active, selected, loadTable]);

    // ── Filtering / grouping ─────────────────────────────────────────────────

    const groups = useMemo(() => {
        const needle = search.trim().toLowerCase();
        const matches = (crd: models.CRDInfo) => {
            if (scopes.length > 0 && !scopes.includes(crd.scope)) return false;
            if (onlyWithInstances && !((counts[crd.name] ?? COUNT_UNKNOWN) > 0)) return false;
            if (!needle) return true;
            return [crd.kind, crd.plural, crd.name, crd.group]
                .some((v) => String(v ?? '').toLowerCase().includes(needle));
        };

        const byGroup = new Map<string, models.CRDInfo[]>();
        for (const crd of crds) {
            if (!matches(crd)) continue;
            const key = crd.group || '';
            if (!byGroup.has(key)) byGroup.set(key, []);
            byGroup.get(key)!.push(crd);
        }
        for (const list of byGroup.values()) list.sort((a, b) => a.kind.localeCompare(b.kind));
        return Array.from(byGroup.entries())
            .map(([group, list]) => ({ group, crds: list }))
            .sort((a, b) => (a.group || 'core').localeCompare(b.group || 'core'));
    }, [crds, search, scopes, onlyWithInstances, counts]);

    const matchCount = useMemo(() => groups.reduce((n, g) => n + g.crds.length, 0), [groups]);

    const searching = search.trim().length > 0;
    const isExpanded = useCallback(
        // While searching, every surviving group is forced open — collapsing
        // state is preserved untouched and returns when the search clears.
        (group: string) => searching || !collapsed[group],
        [searching, collapsed],
    );
    const toggleGroup = useCallback((group: string) => {
        setCollapsed((m) => ({ ...m, [group]: !m[group] }));
    }, []);

    const select = useCallback((crd: models.CRDInfo) => setSelectedName(crd.name), []);
    const refreshTable = useCallback(() => {
        if (selected) loadTable(selected, false);
    }, [selected, loadTable]);

    return {
        crds,
        groups,
        counts,
        catalogLoading,
        countsLoading,
        matchCount,
        refreshCatalog: loadCatalog,
        search,
        setSearch,
        onlyWithInstances,
        setOnlyWithInstances,
        scopes,
        setScopes,
        isExpanded,
        toggleGroup,
        selected,
        select,
        table,
        tableLoading,
        tableError,
        refreshTable,
    };
}
