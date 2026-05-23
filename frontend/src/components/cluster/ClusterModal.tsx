import { useEffect, useRef, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { SaveCluster, GetClusterContent } from '../../../wailsjs/go/controller_app/App';

interface Props {
    editingName: string | null;
    onClose: () => void;
    onSaved: (name: string) => void;
}

export default function ClusterModal({ editingName, onClose, onSaved }: Props) {
    const [name, setName] = useState('');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);
    const toast = useRef<Toast | null>(null);

    useEffect(() => {
        if (editingName) {
            setName(editingName);
            GetClusterContent(editingName)
                .then(setContent)
                .catch(() => {});
        } else {
            setName('');
            setContent('');
        }
    }, [editingName]);

    const handleSave = async () => {
        if (!name.trim()) {
            toast.current?.show({ severity: 'warn', summary: 'Error', detail: 'Config name is required', life: 2500 });
            return;
        }
        if (!content.trim()) {
            toast.current?.show({ severity: 'warn', summary: 'Error', detail: 'Kubeconfig content is required', life: 2500 });
            return;
        }
        setSaving(true);
        try {
            await SaveCluster(name.trim(), content);
            onSaved(name.trim());
        } catch (err: unknown) {
            toast.current?.show({
                severity: 'error',
                summary: 'Save failed',
                detail: String(err),
                life: 4000,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="cluster-modal-overlay">
            <button
                type="button"
                className="cluster-modal-overlay__backdrop"
                aria-label="Close modal"
                onClick={onClose}
            />
            <Toast ref={toast} position="bottom-right" />
            <dialog
                className="cluster-modal"
                aria-label={editingName ? 'Edit Cluster' : 'Add Cluster'}
                open
                onCancel={onClose}
            >
                <div className="cluster-modal__header">
                    <div className="cluster-modal__header-title">
                        <i className="pi pi-server" style={{ color: 'var(--monolith-primary)', fontSize: 16 }} />
                        <span>{editingName ? 'Edit Cluster' : 'Add Cluster'}</span>
                    </div>
                    <button className="cluster-modal__close" onClick={onClose} title="Close">
                        <i className="pi pi-times" />
                    </button>
                </div>

                <div className="cluster-modal__body">
                    <div className="cluster-modal__field">
                        <label htmlFor="cluster-config-name" className="cluster-modal__label">Config Name</label>
                        <InputText
                            id="cluster-config-name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. production, staging, local"
                            disabled={!!editingName}
                            className="w-full"
                            autoFocus={!editingName}
                        />
                        {editingName && (
                            <small style={{ color: 'var(--monolith-on-surface-var)', fontSize: 11 }}>
                                Config name cannot be changed
                            </small>
                        )}
                    </div>

                    <div className="cluster-modal__field cluster-modal__field--grow">
                        <label htmlFor="cluster-kubeconfig-content" className="cluster-modal__label">Kubeconfig Content</label>
                        <textarea
                            id="cluster-kubeconfig-content"
                            className="cluster-modal__textarea"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Paste your kubeconfig YAML content here..."
                            spellCheck={false}
                            autoFocus={!!editingName}
                        />
                    </div>
                </div>

                <div className="cluster-modal__footer">
                    <Button
                        label="Cancel"
                        icon="pi pi-times"
                        text
                        severity="secondary"
                        onClick={onClose}
                        disabled={saving}
                    />
                    <Button
                        label="Save"
                        icon="pi pi-check"
                        loading={saving}
                        onClick={handleSave}
                    />
                </div>
            </dialog>
        </div>
    );
}
