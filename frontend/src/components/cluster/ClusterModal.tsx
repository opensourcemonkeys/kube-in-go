import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { ColorPicker } from 'primereact/colorpicker';
import { Toast } from 'primereact/toast';
import { parse as parseYaml } from 'yaml';

import {
    VscServer, VscClose, VscCheck, VscCloudUpload, VscFileCode,
    VscPass, VscError, VscGlobe, VscListTree, VscAccount, VscArrowRight,
} from 'react-icons/vsc';
import { SaveCluster, GetClusterContent } from '../../../wailsjs/go/controller_app/App';
import { CLUSTER_PALETTE, defaultColorId, hexForId, isCustomHex, normalizeHex } from '../../lib/clusterColors';
import { useClusterColorStore } from '../../stores/clusterColorStore';

interface Props {
    editingName: string | null;
    onClose: () => void;
    onSaved: (name: string) => void;
    /** When false, the modal cannot be dismissed (no close button, no backdrop/escape close). */
    dismissible?: boolean;
}

interface ParsedConfig {
    currentContext?: string;
    clusters: { name: string; server: string }[];
    contexts: { name: string; cluster: string; user: string; namespace?: string }[];
    users: string[];
}

type ParseResult =
    | { state: 'empty' }
    | { state: 'error'; message: string }
    | { state: 'ok'; data: ParsedConfig };

function parseKubeconfig(text: string): ParseResult {
    if (!text.trim()) return { state: 'empty' };
    try {
        const doc = parseYaml(text) as Record<string, any>;
        if (!doc || typeof doc !== 'object') return { state: 'error', message: 'Not a valid YAML document' };
        const clusters = Array.isArray(doc.clusters)
            ? doc.clusters.map((c: any) => ({ name: c?.name ?? '—', server: c?.cluster?.server ?? '' }))
            : [];
        const contexts = Array.isArray(doc.contexts)
            ? doc.contexts.map((c: any) => ({
                name: c?.name ?? '—',
                cluster: c?.context?.cluster ?? '',
                user: c?.context?.user ?? '',
                namespace: c?.context?.namespace,
            }))
            : [];
        const users = Array.isArray(doc.users) ? doc.users.map((u: any) => u?.name ?? '—') : [];
        const currentContext = typeof doc['current-context'] === 'string' ? doc['current-context'] : undefined;
        if (clusters.length === 0 && contexts.length === 0) {
            return { state: 'error', message: 'No clusters or contexts found in this config' };
        }
        return { state: 'ok', data: { currentContext, clusters, contexts, users } };
    } catch (e: any) {
        const msg = e?.message ? String(e.message).split('\n')[0] : 'Invalid YAML';
        return { state: 'error', message: msg };
    }
}

function sanitizeName(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

function suggestName(data: ParsedConfig): string {
    const base = data.currentContext || data.contexts[0]?.name || data.clusters[0]?.name || '';
    return sanitizeName(base);
}

export default function ClusterModal({ editingName, onClose, onSaved, dismissible = true }: Props) {
    const [name, setName] = useState('');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [dragging, setDragging] = useState(false);
    const toast = useRef<Toast | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // null means "auto": follow the colour derived from the cluster name, so a
    // user who never touches this still gets a stable identity colour.
    const [colorId, setColorId] = useState<string | null>(null);
    const overrides = useClusterColorStore(s => s.overrides);
    const setStoredColor = useClusterColorStore(s => s.setColor);
    const resetStoredColor = useClusterColorStore(s => s.resetColor);

    const effectiveColorId = colorId ?? defaultColorId(name.trim());
    const effectiveHex = hexForId(effectiveColorId);
    const customPicked = isCustomHex(colorId ?? undefined);

    useEffect(() => {
        if (editingName) {
            setName(editingName);
            setColorId(overrides[editingName] ?? null);
            GetClusterContent(editingName)
                .then(setContent)
                .catch(() => {});
        } else {
            setName('');
            setContent('');
            setColorId(null);
        }
        // `overrides` is intentionally not a dependency: this seeds the picker
        // once per opened cluster and must not clobber an in-progress choice.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingName]);

    const parsed = useMemo(() => parseKubeconfig(content), [content]);
    const suggested = parsed.state === 'ok' ? suggestName(parsed.data) : '';

    const loadFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result ?? '');
            setContent(text);
            const res = parseKubeconfig(text);
            if (!editingName && res.state === 'ok') {
                const s = suggestName(res.data);
                if (s) setName(prev => (prev.trim() ? prev : s));
            }
        };
        reader.onerror = () => {
            toast.current?.show({ severity: 'error', summary: 'Read failed', detail: 'Could not read the file', life: 3000 });
        };
        reader.readAsText(file);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) loadFile(file);
    };

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
            const finalName = name.trim();
            await SaveCluster(finalName, content);
            // Store only a real override — a pick that matches the name-derived
            // default stays "auto" so the map keeps just what the user changed.
            if (colorId && colorId !== defaultColorId(finalName)) setStoredColor(finalName, colorId);
            else resetStoredColor(finalName);
            onSaved(finalName);
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

    return createPortal(
        <div className="cluster-modal-overlay">
            <button
                type="button"
                className="cluster-modal-overlay__backdrop"
                aria-label="Close modal"
                onClick={dismissible ? onClose : undefined}
                disabled={!dismissible}
            />
            <Toast ref={toast} position="bottom-right" />
            <dialog
                className="cluster-modal"
                aria-label={editingName ? 'Edit Cluster' : 'Add Cluster'}
                open
                onCancel={dismissible ? onClose : (e) => e.preventDefault()}
            >
                <div className="cluster-modal__header">
                    <div className="cluster-modal__header-title">
                        <VscServer size={16} color={effectiveHex} />
                        <span>{editingName ? 'Edit Cluster' : 'Add Cluster'}</span>
                    </div>
                    {dismissible && (
                        <button className="cluster-modal__close" onClick={onClose} title="Close">
                            <VscClose size={14} />
                        </button>
                    )}
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
                        {editingName ? (
                            <small style={{ color: 'var(--ink2)', fontSize: 11 }}>
                                Config name cannot be changed
                            </small>
                        ) : suggested && sanitizeName(name) !== suggested ? (
                            <button
                                type="button"
                                className="cluster-modal__suggest"
                                onClick={() => setName(suggested)}
                                title="Use detected name"
                            >
                                Suggested: <span>{suggested}</span> <VscArrowRight size={11} />
                            </button>
                        ) : null}
                    </div>

                    <div className="cluster-modal__field">
                        <span className="cluster-modal__label">Color</span>
                        <div className="cluster-modal__colors">
                            {CLUSTER_PALETTE.map(c => (
                                <button
                                    type="button"
                                    key={c.id}
                                    title={c.label}
                                    aria-label={c.label}
                                    aria-pressed={c.id === effectiveColorId}
                                    className={`cluster-swatch${c.id === effectiveColorId ? ' cluster-swatch--on' : ''}`}
                                    style={{ background: c.hex }}
                                    onClick={() => setColorId(c.id)}
                                />
                            ))}

                            <span className="cluster-modal__colors-sep" aria-hidden="true" />

                            {/* Anything outside the palette. The picker panel is
                                appended to itself so it stacks above the modal. */}
                            <span
                                className={`cluster-modal__custom${customPicked ? ' is-on' : ''}`}
                                title="Pick a custom color"
                            >
                                <ColorPicker
                                    format="hex"
                                    appendTo="self"
                                    value={effectiveHex.slice(1)}
                                    onChange={e => {
                                        const hex = normalizeHex(typeof e.value === 'string' ? e.value : undefined);
                                        if (hex) setColorId(hex);
                                    }}
                                    aria-label="Custom color"
                                />
                                <span className="cluster-modal__custom-label">
                                    {customPicked ? effectiveHex.toUpperCase() : 'Custom'}
                                </span>
                            </span>

                            <button
                                type="button"
                                className={`cluster-modal__auto${colorId === null ? ' is-on' : ''}`}
                                title="Derive the color from the cluster name"
                                onClick={() => setColorId(null)}
                            >
                                Auto
                            </button>
                        </div>
                        <small style={{ color: 'var(--ink2)', fontSize: 11 }}>
                            Shown next to this cluster in the selector, the sidebar and its tabs.
                        </small>
                    </div>

                    <div className="cluster-modal__split">
                        {/* Editor / drop zone */}
                        <div
                            className={`cluster-modal__editor${dragging ? ' is-dragging' : ''}`}
                            onDragEnter={e => { e.preventDefault(); setDragging(true); }}
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={e => { e.preventDefault(); setDragging(false); }}
                            onDrop={onDrop}
                        >
                            <div className="cluster-modal__editor-bar">
                                <label htmlFor="cluster-kubeconfig-content" className="cluster-modal__label">
                                    Kubeconfig Content
                                </label>
                                <button
                                    type="button"
                                    className="cluster-modal__file-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <VscFileCode size={13} /> Browse file
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".yaml,.yml,.config,.kubeconfig,text/*"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) loadFile(f);
                                        e.target.value = '';
                                    }}
                                />
                            </div>
                            <textarea
                                id="cluster-kubeconfig-content"
                                className="cluster-modal__textarea"
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="Paste your kubeconfig YAML here, or drop a file…"
                                spellCheck={false}
                                autoFocus={!!editingName}
                            />
                            {dragging && (
                                <div className="cluster-modal__drop-overlay">
                                    <VscCloudUpload size={34} />
                                    <span>Drop kubeconfig to load</span>
                                </div>
                            )}
                        </div>

                        {/* Live preview */}
                        <div className="cluster-modal__preview">
                            <div className="cluster-modal__preview-head">
                                <span className="cluster-modal__label">Detected Configuration</span>
                                {parsed.state === 'ok' && (
                                    <span className="cluster-modal__badge cluster-modal__badge--ok">
                                        <VscPass size={12} /> Valid
                                    </span>
                                )}
                                {parsed.state === 'error' && (
                                    <span className="cluster-modal__badge cluster-modal__badge--err">
                                        <VscError size={12} /> Invalid
                                    </span>
                                )}
                            </div>

                            <div className="cluster-modal__preview-body">
                                {parsed.state === 'empty' && (
                                    <div className="cluster-modal__empty">
                                        <VscCloudUpload size={28} />
                                        <p>Paste or drop a kubeconfig to preview its clusters, contexts and endpoints here.</p>
                                    </div>
                                )}

                                {parsed.state === 'error' && (
                                    <div className="cluster-modal__empty cluster-modal__empty--err">
                                        <VscError size={26} />
                                        <p>{parsed.message}</p>
                                    </div>
                                )}

                                {parsed.state === 'ok' && (
                                    <>
                                        <div className="cluster-modal__stats">
                                            <div className="cluster-modal__stat">
                                                <VscGlobe size={14} />
                                                <b>{parsed.data.clusters.length}</b><span>clusters</span>
                                            </div>
                                            <div className="cluster-modal__stat">
                                                <VscListTree size={14} />
                                                <b>{parsed.data.contexts.length}</b><span>contexts</span>
                                            </div>
                                            <div className="cluster-modal__stat">
                                                <VscAccount size={14} />
                                                <b>{parsed.data.users.length}</b><span>users</span>
                                            </div>
                                        </div>

                                        {parsed.data.currentContext && (
                                            <div className="cluster-modal__current">
                                                <span className="cluster-modal__label">Current Context</span>
                                                <code>{parsed.data.currentContext}</code>
                                            </div>
                                        )}

                                        <div className="cluster-modal__list">
                                            {parsed.data.clusters.map((c, i) => (
                                                <div className="cluster-modal__cluster-row" key={`${c.name}-${i}`}>
                                                    <VscServer size={13} color="var(--teal)" />
                                                    <div className="cluster-modal__cluster-meta">
                                                        <span className="cluster-modal__cluster-name">{c.name}</span>
                                                        <span className="cluster-modal__cluster-server">{c.server || 'no server endpoint'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="cluster-modal__footer">
                    {dismissible && (
                        <Button
                            label="Cancel"
                            icon={<VscClose size={16} />}
                            text
                            severity="secondary"
                            onClick={onClose}
                            disabled={saving}
                        />
                    )}
                    <Button
                        label="Save"
                        icon={<VscCheck size={16} />}
                        loading={saving}
                        onClick={handleSave}
                    />
                </div>
            </dialog>
        </div>,
        document.body
    );
}
