import { useRef, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { VscClose, VscRefresh, VscSearch, VscTrash } from 'react-icons/vsc';
import { DeleteObject } from '../../../wailsjs/go/controller_app/App';
import { useTabContext } from '../../contexts/TabContext';
import CrdTree from './CrdTree';
import InstanceTable, { InstanceRow } from './InstanceTable';
import { useCrdExplorer } from './useCrdExplorer';
import './crd.css';

const CRD_GROUP = 'apiextensions.k8s.io';
const CRD_RESOURCE = 'customresourcedefinitions';

const SCOPE_OPTIONS = [
    { label: 'Namespaced', value: 'Namespaced' },
    { label: 'Cluster', value: 'Cluster' },
];

/** A pending delete of either a CRD itself or a set of its instances. */
type DeleteTarget = {
    kind: 'crd' | 'instances';
    /** Singular label shown in the dialog ("CRD" / "<Kind>"). */
    label: string;
    group: string;
    resource: string;
    items: { name: string; namespace: string }[];
};

/**
 * CRD explorer: a searchable API group → kind tree on the left, and the
 * selected kind's instances on the right rendered with the server's own
 * printer columns.
 */
export default function CrdListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const explorer = useCrdExplorer(clusterName, api);
    const { openObjectYaml, openDescribePanel } = useTabContext();
    const toast = useRef<Toast | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [deleting, setDeleting] = useState(false);

    const referencePanel = `crds:${clusterName}`;
    const { selected } = explorer;

    const openInstanceYaml = (row: InstanceRow) => {
        if (!selected) return;
        openObjectYaml({
            clusterName,
            kind: selected.kind,
            group: selected.group,
            resource: selected.plural,
            name: row.name,
            namespace: row.namespace,
            referencePanel,
        });
    };

    // The plural alone addresses the instance: the backend resolves it to a
    // GroupKind through the REST mapper and falls back to kubectl's generic
    // describer for kinds (like these) that have no dedicated one.
    const openInstanceDescribe = (row: InstanceRow) => {
        if (!selected) return;
        openDescribePanel({
            clusterName,
            resource: selected.plural,
            name: row.name,
            namespace: row.namespace,
            referencePanel,
        });
    };

    const openCrdYaml = () => {
        if (!selected) return;
        openObjectYaml({
            clusterName,
            kind: 'CustomResourceDefinition',
            group: CRD_GROUP,
            resource: CRD_RESOURCE,
            name: selected.name,
            namespace: '',
            referencePanel,
        });
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        const failures: string[] = [];
        for (const item of deleteTarget.items) {
            try {
                await DeleteObject(clusterName, deleteTarget.group, deleteTarget.resource, item.namespace, item.name);
            } catch (e: any) {
                failures.push(`${item.name}: ${e?.message ?? String(e)}`);
            }
        }
        const deleted = deleteTarget.items.length - failures.length;
        if (deleted > 0) {
            toast.current?.show({
                severity: 'success',
                summary: 'Deleted',
                detail: `${deleted} ${deleteTarget.label} deleted`,
                life: 3000,
            });
        }
        if (failures.length > 0) {
            toast.current?.show({
                severity: 'error',
                summary: 'Delete failed',
                detail: failures.join('\n'),
                life: 5000,
            });
        }
        const wasCrd = deleteTarget.kind === 'crd';
        setDeleteTarget(null);
        setDeleting(false);
        if (wasCrd) explorer.refreshCatalog();
        else explorer.refreshTable();
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

            <div className="crd-toolbar">
                <h3>Custom Resource Definitions</h3>
                <Tag
                    value={
                        explorer.matchCount === explorer.crds.length
                            ? `${explorer.crds.length} CRDs`
                            : `${explorer.matchCount} / ${explorer.crds.length} CRDs`
                    }
                    severity="info"
                />
                <span className="crd-toolbar__search">
                    <VscSearch size={14} />
                    <InputText
                        value={explorer.search}
                        onChange={(e) => explorer.setSearch(e.target.value)}
                        placeholder="Search kind, group or resource…"
                        className="p-inputtext-sm"
                    />
                </span>
                <label className="crd-checkbox" title="Hide CRDs that currently have no instances">
                    <Checkbox
                        inputId="crd-only-live"
                        checked={explorer.onlyWithInstances}
                        onChange={(e) => explorer.setOnlyWithInstances(!!e.checked)}
                    />
                    <span>Only with instances</span>
                </label>
                <MultiSelect
                    value={explorer.scopes}
                    options={SCOPE_OPTIONS}
                    onChange={(e) => explorer.setScopes(e.value ?? [])}
                    placeholder="Any scope"
                    maxSelectedLabels={1}
                    className="p-inputtext-sm"
                    style={{ minWidth: '10rem' }}
                />
                <Button
                    icon={<VscRefresh size={16} />}
                    text
                    severity="secondary"
                    style={{ marginLeft: 'auto' }}
                    loading={explorer.catalogLoading || explorer.countsLoading}
                    onClick={explorer.refreshCatalog}
                    tooltip="Refresh definitions and instance counts"
                    tooltipOptions={{ position: 'left' }}
                />
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <Splitter className="crd-splitter" style={{ height: '100%' }}>
                    <SplitterPanel size={28} minSize={15} className="crd-splitter__pane">
                        <CrdTree
                            groups={explorer.groups}
                            counts={explorer.counts}
                            countsLoading={explorer.countsLoading}
                            catalogLoading={explorer.catalogLoading}
                            selectedName={selected?.name ?? null}
                            onSelect={explorer.select}
                            isExpanded={explorer.isExpanded}
                            onToggleGroup={explorer.toggleGroup}
                        />
                    </SplitterPanel>
                    <SplitterPanel size={72} minSize={30} className="crd-splitter__pane">
                        <InstanceTable
                            crd={selected}
                            table={explorer.table}
                            loading={explorer.tableLoading}
                            error={explorer.tableError}
                            onRefresh={explorer.refreshTable}
                            onOpenYaml={openInstanceYaml}
                            onDescribe={openInstanceDescribe}
                            onDeleteRows={(rows) =>
                                selected &&
                                setDeleteTarget({
                                    kind: 'instances',
                                    label: selected.kind,
                                    group: selected.group,
                                    resource: selected.plural,
                                    items: rows.map((r) => ({ name: r.name, namespace: r.namespace })),
                                })
                            }
                            onEditCrd={openCrdYaml}
                            onDeleteCrd={() =>
                                selected &&
                                setDeleteTarget({
                                    kind: 'crd',
                                    label: 'CRD',
                                    group: CRD_GROUP,
                                    resource: CRD_RESOURCE,
                                    items: [{ name: selected.name, namespace: '' }],
                                })
                            }
                        />
                    </SplitterPanel>
                </Splitter>
            </div>

            <Dialog
                header="Delete Confirmation"
                visible={!!deleteTarget}
                style={{ width: '32rem' }}
                modal
                footer={deleteDialogFooter}
                onHide={() => { if (!deleting) setDeleteTarget(null); }}
            >
                {deleteTarget && (
                    <>
                        <p className="m-0 mb-3">
                            Delete the following {deleteTarget.items.length === 1 ? deleteTarget.label : `${deleteTarget.items.length} ${deleteTarget.label} records`}?
                            {deleteTarget.kind === 'crd' && ' This also removes all of its custom resources.'}
                        </p>
                        <ul className="m-0 pl-3">
                            {deleteTarget.items.map((item) => (
                                <li key={`${item.namespace}/${item.name}`}>
                                    {item.namespace ? `${item.namespace}/` : ''}{item.name}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </Dialog>
        </div>
    );
}
