import { useEffect, useMemo, useRef, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { Tag } from 'primereact/tag';
import { MultiSelect } from 'primereact/multiselect';
import { FilterMatchMode } from 'primereact/api';
import { VscTypeHierarchySub, VscNote, VscTrash, VscClose, VscRefresh, VscClearAll } from 'react-icons/vsc';
import { GetCRDs, GetCustomResources, DeleteObject } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import { usePanelActive } from '../../lib/usePanelActive';

const CRD_GROUP = 'apiextensions.k8s.io';
const CRD_RESOURCE = 'customresourcedefinitions';

// A pending delete, either of a CRD or one of its custom-resource instances.
type DeleteTarget = {
    kind: 'crd' | 'cr';
    label: string;      // singular label for the dialog ("CRD" / "<Kind>")
    group: string;
    resource: string;   // plural
    namespace: string;
    name: string;
    crdName: string;    // owning CRD name (for refreshing the right instance list)
};

const groupLabel = (group: string) => group || 'core';

const SCOPE_OPTIONS = [
    { label: 'Namespaced', value: 'Namespaced' },
    { label: 'Cluster', value: 'Cluster' },
];

const defaultCrdFilters = (): DataTableFilterMeta => ({
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    kind: { value: null, matchMode: FilterMatchMode.CONTAINS },
    scope: { value: null, matchMode: FilterMatchMode.IN },
    version: { value: null, matchMode: FilterMatchMode.CONTAINS },
});

const defaultInstanceFilters = (): DataTableFilterMeta => ({
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.IN },
});

const filterValue = (filters: DataTableFilterMeta, field: string): any => {
    const meta = filters[field] as { value?: any } | undefined;
    return meta?.value ?? null;
};

// Mirrors the CONTAINS/IN filter semantics used by the group DataTables so we can
// hide groups that end up with no matching rows.
const matchesCrdFilters = (crd: models.CRDInfo, filters: DataTableFilterMeta): boolean => {
    const contains = (v: string, needle: any) =>
        !needle || String(v ?? '').toLowerCase().includes(String(needle).toLowerCase());
    const inList = (v: string, list: any) => !list || (Array.isArray(list) && list.length === 0) || (Array.isArray(list) && list.includes(v));
    return (
        contains(crd.name, filterValue(filters, 'name')) &&
        contains(crd.kind, filterValue(filters, 'kind')) &&
        inList(crd.scope, filterValue(filters, 'scope')) &&
        contains(crd.version, filterValue(filters, 'version'))
    );
};

export default function CrdListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const [crds, setCrds] = useState<models.CRDInfo[]>([]);
    // Expanded rows kept per API group, since each group renders its own DataTable.
    const [expandedByGroup, setExpandedByGroup] = useState<Record<string, Record<string, boolean>>>({});
    // Custom-resource instances keyed by CRD name (lazily loaded on expand).
    const [instances, setInstances] = useState<Record<string, models.CustomResourceInfo[]>>({});
    const [loadingCrds, setLoadingCrds] = useState<Record<string, boolean>>({});
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [deleting, setDeleting] = useState(false);
    // Filter row state: each API group filters independently (keyed by group),
    // plus per-CRD filters for each expanded instance table.
    const [crdFiltersByGroup, setCrdFiltersByGroup] = useState<Record<string, DataTableFilterMeta>>({});
    const [instanceFilters, setInstanceFilters] = useState<Record<string, DataTableFilterMeta>>({});

    const toast = useRef<Toast | null>(null);
    const crdsRef = useRef<models.CRDInfo[]>([]);
    const expandedNamesRef = useRef<Set<string>>(new Set());
    const { openObjectYaml } = useTabContext();
    const active = usePanelActive(api);
    const referencePanel = `crds:${clusterName}`;

    const loadCrds = async () => {
        try {
            const items = await GetCRDs(clusterName);
            setCrds(items.map((item: any) => models.CRDInfo.createFrom(item)));
        } catch (e) {
            console.error('Failed to load CRDs:', e);
            setCrds([]);
        }
    };

    const loadInstances = async (crd: models.CRDInfo) => {
        setLoadingCrds((m) => ({ ...m, [crd.name]: true }));
        try {
            const items = await GetCustomResources(clusterName, crd.group, crd.plural);
            setInstances((m) => ({ ...m, [crd.name]: items.map((i: any) => models.CustomResourceInfo.createFrom(i)) }));
        } catch (e) {
            console.error(`Failed to load instances for ${crd.name}:`, e);
            setInstances((m) => ({ ...m, [crd.name]: [] }));
        } finally {
            setLoadingCrds((m) => ({ ...m, [crd.name]: false }));
        }
    };

    // Keep refs current so the polling interval can see the latest state.
    useEffect(() => { crdsRef.current = crds; }, [crds]);
    useEffect(() => {
        const s = new Set<string>();
        Object.values(expandedByGroup).forEach((obj) => {
            Object.keys(obj || {}).forEach((k) => { if ((obj as any)[k]) s.add(k); });
        });
        expandedNamesRef.current = s;
    }, [expandedByGroup]);

    useEffect(() => {
        if (!active) return;
        loadCrds();
        const id = window.setInterval(() => {
            loadCrds();
            // Refresh the instance lists of currently-expanded CRDs.
            crdsRef.current.forEach((crd) => { if (expandedNamesRef.current.has(crd.name)) loadInstances(crd); });
        }, 10000);
        return () => window.clearInterval(id);
    }, [clusterName, active]); // eslint-disable-line react-hooks/exhaustive-deps

    const showToast = (severity: 'success' | 'error', summary: string, detail: string) => {
        toast.current?.show({ severity, summary, detail, life: 3000 });
    };

    const editCrd = (crd: models.CRDInfo) => {
        openObjectYaml({ clusterName, kind: 'CustomResourceDefinition', group: CRD_GROUP, resource: CRD_RESOURCE, name: crd.name, namespace: '', referencePanel });
    };

    const editInstance = (crd: models.CRDInfo, cr: models.CustomResourceInfo) => {
        openObjectYaml({ clusterName, kind: crd.kind, group: crd.group, resource: crd.plural, name: cr.name, namespace: cr.namespace, referencePanel });
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await DeleteObject(clusterName, deleteTarget.group, deleteTarget.resource, deleteTarget.namespace, deleteTarget.name);
            showToast('success', 'Deleted', `${deleteTarget.name} deleted`);
            const target = deleteTarget;
            setDeleteTarget(null);
            if (target.kind === 'crd') {
                loadCrds();
            } else {
                const crd = crds.find((c) => c.name === target.crdName);
                if (crd) loadInstances(crd);
            }
        } catch (e: any) {
            showToast('error', 'Delete failed', e?.message ?? String(e));
        } finally {
            setDeleting(false);
        }
    };

    const clearFilters = () => {
        setCrdFiltersByGroup({});
        setInstanceFilters({});
    };

    // Group CRDs by API group for per-group tables, sorted by group then name.
    // Each group keeps its full row set — filtering happens inside each table.
    const groups = useMemo(() => {
        const map = new Map<string, models.CRDInfo[]>();
        for (const c of crds) {
            const g = c.group || '';
            if (!map.has(g)) map.set(g, []);
            map.get(g)!.push(c);
        }
        for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
        return Array.from(map.entries()).sort((a, b) => groupLabel(a[0]).localeCompare(groupLabel(b[0])));
    }, [crds]);

    // Total rows currently passing each group's own filter (for the toolbar count).
    const filteredCount = useMemo(() => {
        let n = 0;
        for (const [group, list] of groups) {
            const f = crdFiltersByGroup[group];
            n += f ? list.filter((c) => matchesCrdFilters(c, f)).length : list.length;
        }
        return n;
    }, [groups, crdFiltersByGroup]);

    const crdActions = (crd: models.CRDInfo) => (
        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
            <Button icon={<VscNote size={16} />} text size="small" severity="secondary" onClick={() => editCrd(crd)} tooltip="Edit YAML" tooltipOptions={{ position: 'top' }} />
            <Button icon={<VscTrash size={16} />} text size="small" severity="danger"
                onClick={() => setDeleteTarget({ kind: 'crd', label: 'CRD', group: CRD_GROUP, resource: CRD_RESOURCE, namespace: '', name: crd.name, crdName: crd.name })}
                tooltip="Delete CRD" tooltipOptions={{ position: 'top' }} />
        </div>
    );

    const rowExpansionTemplate = (crd: models.CRDInfo) => {
        const rows = instances[crd.name] ?? [];
        const loading = loadingCrds[crd.name];
        const namespaced = crd.scope === 'Namespaced';
        const nsOptions = Array.from(new Set(rows.map((r) => r.namespace).filter(Boolean)))
            .sort()
            .map((ns) => ({ label: ns, value: ns }));
        return (
            <div style={{ padding: '0.75rem 1.5rem', background: 'var(--panel2, var(--surface-ground))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{crd.kind} instances</span>
                    <Tag value={String(rows.length)} style={{ fontSize: '0.68rem' }} />
                    <Button icon={<VscRefresh size={14} />} text size="small" severity="secondary" loading={loading} onClick={() => loadInstances(crd)} tooltip="Refresh" tooltipOptions={{ position: 'top' }} />
                </div>
                <DataTable value={rows} dataKey="name" size="small" emptyMessage={loading ? 'Loading…' : `No ${crd.kind} instances found`} stripedRows
                    filterDisplay="row"
                    filters={instanceFilters[crd.name] ?? defaultInstanceFilters()}
                    onFilter={(e) => setInstanceFilters((m) => ({ ...m, [crd.name]: e.filters }))}>
                    <Column field="name" header="Name" style={{ minWidth: '16rem' }} filter showFilterMenu={false} filterPlaceholder="Filter name" />
                    {namespaced && (
                        <Column field="namespace" header="Namespace" style={{ minWidth: '12rem' }}
                            filter showFilterMenu={false}
                            filterElement={(options) => (
                                <MultiSelect value={options.value} options={nsOptions} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                            )}
                            body={(cr: models.CustomResourceInfo) => cr.namespace} />
                    )}
                    <Column field="age" header="Age" style={{ minWidth: '6rem' }} />
                    <Column header="" style={{ width: '7rem' }}
                        body={(cr: models.CustomResourceInfo) => (
                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                <Button icon={<VscNote size={16} />} text size="small" severity="secondary" onClick={() => editInstance(crd, cr)} tooltip="Edit YAML" tooltipOptions={{ position: 'top' }} />
                                <Button icon={<VscTrash size={16} />} text size="small" severity="danger"
                                    onClick={() => setDeleteTarget({ kind: 'cr', label: crd.kind, group: crd.group, resource: crd.plural, namespace: cr.namespace, name: cr.name, crdName: crd.name })}
                                    tooltip="Delete" tooltipOptions={{ position: 'top' }} />
                            </div>
                        )} />
                </DataTable>
            </div>
        );
    };

    const deleteDialogFooter = (
        <div className="flex justify-content-end gap-2">
            <Button label="Cancel" icon={<VscClose size={16} />} text onClick={() => setDeleteTarget(null)} disabled={deleting} />
            <Button label="Delete" icon={<VscTrash size={16} />} severity="danger" onClick={confirmDelete} loading={deleting} />
        </div>
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--line, var(--surface-border))', flexShrink: 0 }}>
                <h3 style={{ margin: 0 }}>Custom Resource Definitions</h3>
                <Tag value={filteredCount === crds.length ? `${crds.length} CRDs` : `${filteredCount} / ${crds.length} CRDs`} severity="info" />
                <Button
                    icon={<VscClearAll size={16} />}
                    text
                    severity="secondary"
                    style={{ marginLeft: 'auto' }}
                    onClick={clearFilters}
                    tooltip="Clear filters"
                    tooltipOptions={{ position: 'left' }}
                />
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.5rem 0' }}>
                {crds.length === 0 && (
                    <div style={{ padding: '1rem', color: 'var(--text-color-secondary)' }}>No CRDs found in this cluster</div>
                )}
                {groups.map(([group, list]) => (
                    <div key={group || 'core'} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--line, var(--surface-border))' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', fontWeight: 700, background: 'var(--panel)' }}>
                            <VscTypeHierarchySub style={{ color: 'var(--teal)' }} />
                            {groupLabel(group)}
                            <Tag value={String(list.length)} style={{ fontSize: '0.7rem' }} />
                        </div>
                        <DataTable
                            value={list}
                            dataKey="name"
                            size="small"
                            expandedRows={expandedByGroup[group] ?? {}}
                            onRowToggle={(e) => setExpandedByGroup((m) => ({ ...m, [group]: e.data as Record<string, boolean> }))}
                            onRowExpand={(e) => loadInstances(e.data as models.CRDInfo)}
                            rowExpansionTemplate={rowExpansionTemplate}
                            filterDisplay="row"
                            filters={crdFiltersByGroup[group] ?? defaultCrdFilters()}
                            onFilter={(e) => setCrdFiltersByGroup((m) => ({ ...m, [group]: e.filters }))}
                            emptyMessage="No CRDs match the filter"
                            stripedRows
                        >
                            <Column expander style={{ width: '3rem' }} />
                            <Column field="name" header="Name" style={{ minWidth: '20rem' }} filter showFilterMenu={false} filterPlaceholder="Filter name" />
                            <Column field="kind" header="Kind" style={{ minWidth: '12rem' }} filter showFilterMenu={false} filterPlaceholder="Filter kind" />
                            <Column field="scope" header="Scope" style={{ minWidth: '9rem' }}
                                filter showFilterMenu={false}
                                filterElement={(options) => (
                                    <MultiSelect value={options.value} options={SCOPE_OPTIONS} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                                )}
                                body={(crd: models.CRDInfo) => <Tag value={crd.scope} severity={crd.scope === 'Namespaced' ? 'info' : 'warning'} style={{ fontSize: '0.7rem' }} />} />
                            <Column field="version" header="Version" style={{ minWidth: '7rem' }} filter showFilterMenu={false} filterPlaceholder="Filter" />
                            <Column field="age" header="Age" style={{ minWidth: '6rem' }} />
                            <Column header="" style={{ width: '7rem' }} body={crdActions} />
                        </DataTable>
                    </div>
                ))}
            </div>

            <Dialog
                header="Delete Confirmation"
                visible={!!deleteTarget}
                style={{ width: '30rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteTarget(null); }}
            >
                {deleteTarget && (
                    <p className="m-0">
                        Delete {deleteTarget.label}{' '}
                        <strong>{deleteTarget.namespace ? `${deleteTarget.namespace}/` : ''}{deleteTarget.name}</strong>?
                        {deleteTarget.kind === 'crd' && ' This also removes all of its custom resources.'}
                    </p>
                )}
            </Dialog>
        </div>
    );
}
