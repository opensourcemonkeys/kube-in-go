import { useEffect, useRef, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { Tag } from 'primereact/tag';
import { VscTypeHierarchySub, VscNote, VscTrash, VscClose, VscRefresh } from 'react-icons/vsc';
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

export default function CrdListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const [crds, setCrds] = useState<models.CRDInfo[]>([]);
    const [expandedRows, setExpandedRows] = useState<any>({});
    // Custom-resource instances keyed by CRD name (lazily loaded on expand).
    const [instances, setInstances] = useState<Record<string, models.CustomResourceInfo[]>>({});
    const [loadingCrds, setLoadingCrds] = useState<Record<string, boolean>>({});
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [deleting, setDeleting] = useState(false);

    const toast = useRef<Toast | null>(null);
    const expandedRef = useRef<Record<string, boolean>>({});
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

    useEffect(() => {
        if (!active) return;
        loadCrds();
        const id = window.setInterval(() => {
            loadCrds();
            // Refresh the instance lists of currently-expanded CRDs.
            crds.forEach((crd) => { if (expandedRef.current[crd.name]) loadInstances(crd); });
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

    const onRowToggle = (e: any) => {
        setExpandedRows(e.data);
        // e.data is an object keyed by dataKey (crd name) → true.
        expandedRef.current = e.data || {};
    };

    const groupLabel = (group: string) => group || 'core';

    // Precompute how many CRDs live in each group for the subheader count.
    const groupCounts: Record<string, number> = {};
    crds.forEach((c) => { groupCounts[c.group] = (groupCounts[c.group] || 0) + 1; });

    const rowGroupHeaderTemplate = (crd: models.CRDInfo) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <VscTypeHierarchySub style={{ color: 'var(--teal)' }} />
            {groupLabel(crd.group)}
            <Tag value={String(groupCounts[crd.group] ?? 0)} style={{ fontSize: '0.7rem' }} />
        </span>
    );

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
        return (
            <div style={{ padding: '0.75rem 1.5rem', background: 'var(--panel2, var(--surface-ground))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{crd.kind} instances</span>
                    <Tag value={String(rows.length)} style={{ fontSize: '0.68rem' }} />
                    <Button icon={<VscRefresh size={14} />} text size="small" severity="secondary" loading={loading} onClick={() => loadInstances(crd)} tooltip="Refresh" tooltipOptions={{ position: 'top' }} />
                </div>
                <DataTable value={rows} dataKey="name" size="small" emptyMessage={loading ? 'Loading…' : `No ${crd.kind} instances found`} stripedRows>
                    <Column field="name" header="Name" style={{ minWidth: '16rem' }} />
                    <Column header="Namespace" style={{ minWidth: '12rem' }}
                        body={(cr: models.CustomResourceInfo) => (namespaced ? cr.namespace : <span style={{ color: 'var(--text-color-secondary)' }}>—</span>)} />
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
                <Tag value={`${crds.length} CRDs`} severity="info" />
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <DataTable
                    value={crds}
                    dataKey="name"
                    rowGroupMode="subheader"
                    groupRowsBy="group"
                    sortMode="single"
                    sortField="group"
                    sortOrder={1}
                    rowGroupHeaderTemplate={rowGroupHeaderTemplate}
                    expandableRowGroups={false}
                    expandedRows={expandedRows}
                    onRowToggle={onRowToggle}
                    rowExpansionTemplate={rowExpansionTemplate}
                    stripedRows
                    emptyMessage="No CRDs found in this cluster"
                >
                    <Column expander style={{ width: '3rem' }} />
                    <Column field="name" header="Name" style={{ minWidth: '20rem' }} />
                    <Column field="kind" header="Kind" style={{ minWidth: '12rem' }} />
                    <Column field="scope" header="Scope" style={{ minWidth: '9rem' }}
                        body={(crd: models.CRDInfo) => <Tag value={crd.scope} severity={crd.scope === 'Namespaced' ? 'info' : 'warning'} style={{ fontSize: '0.7rem' }} />} />
                    <Column field="version" header="Version" style={{ minWidth: '7rem' }} />
                    <Column field="age" header="Age" style={{ minWidth: '6rem' }} />
                    <Column header="" style={{ width: '7rem' }} body={crdActions} />
                </DataTable>
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
