import { useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { DataTableFilterMeta } from 'primereact/datatable';
import { Column, ColumnFilterElementTemplateOptions } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { FilterMatchMode } from 'primereact/api';
import { MultiSelect } from 'primereact/multiselect';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { VscAdd, VscClose, VscCheck } from 'react-icons/vsc';
import { GetNamespaces, DeleteNamespace, CreateNamespace } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import { errText } from '../../lib/errText';
import ResourceListView from '../shared/ResourceListView';

type Severity = 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'contrast' | undefined;

const getStatusSeverity = (status: string): Severity => {
    switch (status) {
        case 'Active':      return 'success';
        case 'Terminating': return 'danger';
        default:            return 'warning';
    }
};

const defaultFilters: DataTableFilterMeta = {
    name:   { value: null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null, matchMode: FilterMatchMode.IN },
};

/**
 * Create dialog for a new namespace.
 *
 * Only the name and optional `key=value` labels are collected: anything richer
 * belongs in the YAML editor, which already exists. The name itself is not
 * validated here — the API server owns the DNS-1123 rules and its rejection is
 * shown verbatim, which stays correct as those rules change.
 */
function NewNamespaceButton({ clusterName, reload }: { clusterName: string; reload: () => Promise<void> }) {
    const [visible, setVisible] = useState(false);
    const [name, setName] = useState('');
    const [labelText, setLabelText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const close = () => {
        if (busy) return;
        setVisible(false);
        setName('');
        setLabelText('');
        setError(null);
    };

    const create = async () => {
        setBusy(true);
        setError(null);
        try {
            const labels: Record<string, string> = {};
            for (const pair of labelText.split(',')) {
                const trimmed = pair.trim();
                if (!trimmed) continue;
                const eq = trimmed.indexOf('=');
                if (eq <= 0) throw new Error(`label "${trimmed}" must be key=value`);
                labels[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
            }
            await CreateNamespace(clusterName, name.trim(), labels);
            setVisible(false);
            setName('');
            setLabelText('');
            await reload();
        } catch (e) {
            setError(errText(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Button
                label="New Namespace"
                icon={<VscAdd size={16} />}
                size="small"
                onClick={() => setVisible(true)}
            />
            <Dialog
                header="Create Namespace"
                visible={visible}
                style={{ width: '28rem' }}
                modal
                onHide={close}
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancel" icon={<VscClose size={16} />} text onClick={close} disabled={busy} />
                        <Button
                            label="Create"
                            icon={<VscCheck size={16} />}
                            onClick={create}
                            loading={busy}
                            disabled={!name.trim()}
                        />
                    </div>
                }
            >
                <div className="flex flex-column gap-3">
                    <div className="flex flex-column gap-1">
                        <label htmlFor="ns-name" style={{ fontSize: '0.8rem', color: 'var(--ink2)' }}>Name</label>
                        <InputText
                            id="ns-name"
                            value={name}
                            autoFocus
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && !busy) create(); }}
                            placeholder="my-namespace"
                        />
                    </div>
                    <div className="flex flex-column gap-1">
                        <label htmlFor="ns-labels" style={{ fontSize: '0.8rem', color: 'var(--ink2)' }}>
                            Labels <span style={{ opacity: 0.7 }}>(optional, comma separated key=value)</span>
                        </label>
                        <InputText
                            id="ns-labels"
                            value={labelText}
                            onChange={(e) => setLabelText(e.target.value)}
                            placeholder="team=platform, env=dev"
                        />
                    </div>
                    {error && (
                        <span style={{ color: 'var(--red)', fontSize: '0.8rem', wordBreak: 'break-word' }}>{error}</span>
                    )}
                </div>
            </Dialog>
        </>
    );
}

export default function NamespaceListComponent({ clusterName, api }: { clusterName: string; api?: DockviewPanelApi }) {
    const { openYamlPanel } = useTabContext();
    const referencePanel = `namespaces:${clusterName}`;

    return (
        <ResourceListView<models.NamespaceInfo>
            title="Namespace List"
            clusterName={clusterName}
            api={api}
            fetcher={GetNamespaces}
            createFrom={models.NamespaceInfo.createFrom}
            deleter={DeleteNamespace}
            deleteLabel="namespace"
            pollInterval={10000}
            describeResource="namespaces"
            defaultFilters={defaultFilters}
            emptyMessage="No namespaces found"
            toolbarExtra={({ reload }) => <NewNamespaceButton clusterName={clusterName} reload={reload} />}
            onRowDoubleClick={(ns) => openYamlPanel({ clusterName, resourceKind: 'namespace', name: ns.name, namespace: '', referencePanel })}
            columns={({ buildInOptions }) => (
                <>
                    <Column field="name" header="Name" sortable filter filterField="name" filterPlaceholder="Search name" showFilterMenu={false} style={{ minWidth: '14rem' }} />
                    <Column field="status" header="Status" sortable filter filterField="status" showFilterMenu={false} style={{ minWidth: '9rem' }}
                        body={(row: models.NamespaceInfo) => <Tag value={row.status} severity={getStatusSeverity(row.status)} />}
                        filterElement={(options: ColumnFilterElementTemplateOptions) => (
                            <MultiSelect value={options.value} options={buildInOptions('status')} onChange={(e) => options.filterApplyCallback(e.value)} placeholder="All" filter maxSelectedLabels={1} style={{ minWidth: '8rem', maxWidth: '100%' }} />
                        )} />
                </>
            )}
        />
    );
}
