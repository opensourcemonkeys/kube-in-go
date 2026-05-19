import { useCallback, useEffect, useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Node,
    Edge,
    MarkerType,
    BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Editor, { OnMount } from '@monaco-editor/react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import type * as monaco from 'monaco-editor';
import { GetNetworkPolicyDetail, GetNetworkPolicyYaml, ParseNetworkPolicyYaml, UpdateNetworkPolicyYaml } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { MONOLITH_THEME } from '../../lib/monacoTheme';

interface PolicyViewerPanelParams {
    name: string;
    namespace: string;
}

// ── Node styles ───────────────────────────────────────────────────────────────

const NODE_POLICY: React.CSSProperties = {
    background: 'var(--monolith-panel, #1a1f2e)',
    border: '2px solid var(--p-primary-color, #6366f1)',
    borderRadius: 10,
    padding: '10px 16px',
    color: 'var(--text-color, #e2e8f0)',
    fontFamily: 'var(--font-family)',
    minWidth: 200,
    textAlign: 'center',
};

const NODE_INGRESS: React.CSSProperties = {
    background: '#0f2d45',
    border: '1.5px solid #3b82f6',
    borderRadius: 8,
    padding: '8px 14px',
    color: '#93c5fd',
    fontFamily: 'var(--font-family)',
    minWidth: 180,
    fontSize: 12,
};

const NODE_EGRESS: React.CSSProperties = {
    background: '#2d1f00',
    border: '1.5px solid #f59e0b',
    borderRadius: 8,
    padding: '8px 14px',
    color: '#fcd34d',
    fontFamily: 'var(--font-family)',
    minWidth: 180,
    fontSize: 12,
};

const NODE_DENY: React.CSSProperties = {
    background: '#2d0a0a',
    border: '2px solid #ef4444',
    borderRadius: 8,
    padding: '8px 14px',
    color: '#fca5a5',
    fontFamily: 'var(--font-family)',
    minWidth: 180,
    fontSize: 12,
    textAlign: 'center',
};

const NODE_PODS: React.CSSProperties = {
    background: '#0f2d1a',
    border: '1.5px solid #22c55e',
    borderRadius: 8,
    padding: '8px 14px',
    color: '#86efac',
    fontFamily: 'var(--font-family)',
    minWidth: 180,
    textAlign: 'center',
    fontSize: 12,
};

// ── Graph builder ─────────────────────────────────────────────────────────────

function buildGraph(detail: models.NetworkPolicyDetail): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const cx = 450;
    const cy = 220;

    nodes.push({
        id: 'policy',
        position: { x: cx, y: cy },
        data: {
            label: (
                <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        <i className="pi pi-shield" style={{ marginRight: 6 }} />
                        {detail.name}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{detail.namespace}</div>
                    {(detail.policy_types ?? []).length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {detail.policy_types.map((t) => (
                                <span
                                    key={t}
                                    style={{
                                        background: t === 'Ingress' ? '#1e40af' : '#92400e',
                                        color: t === 'Ingress' ? '#bfdbfe' : '#fde68a',
                                        borderRadius: 4,
                                        padding: '1px 6px',
                                        fontSize: 10,
                                    }}
                                >
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        style: NODE_POLICY,
    });

    nodes.push({
        id: 'pods',
        position: { x: cx, y: cy + 180 },
        data: {
            label: (
                <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        <i className="pi pi-box" style={{ marginRight: 6 }} />
                        Affected Pods
                    </div>
                    <div style={{ fontSize: 11 }}>{detail.pod_selector || '<all pods>'}</div>
                </div>
            ),
        },
        style: NODE_PODS,
    });

    edges.push({
        id: 'policy-pods',
        source: 'policy',
        target: 'pods',
        animated: true,
        style: { stroke: '#22c55e', strokeDasharray: '4 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
    });

    const policyTypes = detail.policy_types ?? [];
    const ingress = detail.ingress_rules ?? [];
    const egress = detail.egress_rules ?? [];

    // Deny node for ingress: policyType includes Ingress but no rules defined
    if (policyTypes.includes('Ingress') && ingress.length === 0) {
        nodes.push({
            id: 'deny-ingress',
            position: { x: cx - 370, y: cy },
            data: {
                label: (
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            <i className="pi pi-ban" style={{ marginRight: 6, color: '#ef4444' }} />
                            Deny All Ingress
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.8 }}>All incoming traffic blocked</div>
                    </div>
                ),
            },
            style: NODE_DENY,
        });
        edges.push({
            id: 'deny-ingress-edge',
            source: 'deny-ingress',
            target: 'policy',
            animated: false,
            style: { stroke: '#ef4444', strokeDasharray: '6 3' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
            label: '✕ blocked',
            labelStyle: { fill: '#ef4444', fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: '#2d0a0a', opacity: 0.9 },
        });
    }

    // Deny node for egress: policyType includes Egress but no rules defined
    if (policyTypes.includes('Egress') && egress.length === 0) {
        nodes.push({
            id: 'deny-egress',
            position: { x: cx + 280, y: cy },
            data: {
                label: (
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            <i className="pi pi-ban" style={{ marginRight: 6, color: '#ef4444' }} />
                            Deny All Egress
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.8 }}>All outgoing traffic blocked</div>
                    </div>
                ),
            },
            style: NODE_DENY,
        });
        edges.push({
            id: 'deny-egress-edge',
            source: 'policy',
            target: 'deny-egress',
            animated: false,
            style: { stroke: '#ef4444', strokeDasharray: '6 3' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
            label: '✕ blocked',
            labelStyle: { fill: '#ef4444', fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: '#2d0a0a', opacity: 0.9 },
        });
    }

    const ingressStartY = cy - ((ingress.length - 1) * 130) / 2;

    ingress.forEach((rule, i) => {
        const nodeId = `ingress-${i}`;
        const ports = (rule.ports ?? []).join(', ') || 'all ports';
        nodes.push({
            id: nodeId,
            position: { x: cx - 370, y: ingressStartY + i * 130 },
            data: {
                label: (
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            <i className="pi pi-arrow-right" style={{ marginRight: 6 }} />
                            Ingress Rule {i + 1}
                        </div>
                        <div style={{ fontSize: 11, marginBottom: 3, opacity: 0.9 }}>Ports: {ports}</div>
                        {(rule.peers ?? []).map((p, pi) => (
                            <div key={pi} style={{ marginTop: 3 }}>
                                {p.namespace_selector && <div style={{ fontSize: 10, opacity: 0.75 }}>NS: {p.namespace_selector}</div>}
                                {p.pod_selector && <div style={{ fontSize: 10, opacity: 0.75 }}>Pod: {p.pod_selector}</div>}
                                {p.ip_block && <div style={{ fontSize: 10, opacity: 0.75 }}>IP: {p.ip_block}</div>}
                                {(p.ip_block_except ?? []).map((exc, ei) => (
                                    <div key={ei} style={{ fontSize: 10, color: '#ef4444', marginTop: 1 }}>
                                        <i className="pi pi-ban" style={{ marginRight: 3, fontSize: 9 }} />
                                        except: {exc}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ),
            },
            style: NODE_INGRESS,
        });

        edges.push({
            id: `ingress-edge-${i}`,
            source: nodeId,
            target: 'policy',
            label: ports !== 'all ports' ? ports : undefined,
            labelStyle: { fill: '#93c5fd', fontSize: 10 },
            labelBgStyle: { fill: '#0f172a', opacity: 0.8 },
            animated: true,
            style: { stroke: '#3b82f6' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
        });
    });

    const egressStartY = cy - ((egress.length - 1) * 130) / 2;

    egress.forEach((rule, i) => {
        const nodeId = `egress-${i}`;
        const ports = (rule.ports ?? []).join(', ') || 'all ports';
        nodes.push({
            id: nodeId,
            position: { x: cx + 280, y: egressStartY + i * 130 },
            data: {
                label: (
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            <i className="pi pi-arrow-left" style={{ marginRight: 6 }} />
                            Egress Rule {i + 1}
                        </div>
                        <div style={{ fontSize: 11, marginBottom: 3, opacity: 0.9 }}>Ports: {ports}</div>
                        {(rule.peers ?? []).map((p, pi) => (
                            <div key={pi} style={{ marginTop: 3 }}>
                                {p.namespace_selector && <div style={{ fontSize: 10, opacity: 0.75 }}>NS: {p.namespace_selector}</div>}
                                {p.pod_selector && <div style={{ fontSize: 10, opacity: 0.75 }}>Pod: {p.pod_selector}</div>}
                                {p.ip_block && <div style={{ fontSize: 10, opacity: 0.75 }}>IP: {p.ip_block}</div>}
                                {(p.ip_block_except ?? []).map((exc, ei) => (
                                    <div key={ei} style={{ fontSize: 10, color: '#ef4444', marginTop: 1 }}>
                                        <i className="pi pi-ban" style={{ marginRight: 3, fontSize: 9 }} />
                                        except: {exc}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ),
            },
            style: NODE_EGRESS,
        });

        edges.push({
            id: `egress-edge-${i}`,
            source: 'policy',
            target: nodeId,
            label: ports !== 'all ports' ? ports : undefined,
            labelStyle: { fill: '#fcd34d', fontSize: 10 },
            labelBgStyle: { fill: '#0f172a', opacity: 0.8 },
            animated: true,
            style: { stroke: '#f59e0b' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
        });
    });

    return { nodes, edges };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PolicyViewerPanel({ params }: IDockviewPanelProps<PolicyViewerPanelParams>) {
    const { name, namespace } = params;

    const [splitPct, setSplitPct] = useState(55);
    const isDragging = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [graphLoading, setGraphLoading] = useState(true);

    const [yaml, setYaml] = useState('Loading...');
    const [originalYaml, setOriginalYaml] = useState('');
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const toast = useRef<Toast | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initial graph load
    useEffect(() => {
        setGraphLoading(true);
        GetNetworkPolicyDetail(name, namespace)
            .then((raw: any) => {
                const detail = models.NetworkPolicyDetail.createFrom(raw);
                const { nodes: n, edges: e } = buildGraph(detail);
                setNodes(n);
                setEdges(e);
            })
            .catch((err) => console.error('Failed to load network policy detail:', err))
            .finally(() => setGraphLoading(false));
    }, [name, namespace]);

    // Initial YAML load
    useEffect(() => {
        GetNetworkPolicyYaml(name, namespace)
            .then((result: string) => {
                const content = result || 'No YAML available';
                setYaml(content);
                setOriginalYaml(content);
            })
            .catch(() => setYaml('Failed to load YAML.'));
    }, [name, namespace]);

    // ── Drag divider ──
    const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        e.preventDefault();
    }, []);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const pct = ((e.clientY - rect.top) / rect.height) * 100;
            setSplitPct(Math.min(Math.max(pct, 20), 80));
        };
        const onUp = () => { isDragging.current = false; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, []);

    // ── YAML editor handlers ──
    const handleMount: OnMount = (editor) => {
        editorRef.current = editor;
        requestAnimationFrame(() => editor.layout());
    };

    const handleChange = (value: string | undefined) => {
        const val = value ?? '';
        setDirty(val !== originalYaml);

        // Debounced graph refresh
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            if (!val.trim()) return;
            try {
                const raw: any = await ParseNetworkPolicyYaml(val);
                const detail = models.NetworkPolicyDetail.createFrom(raw);
                const { nodes: n, edges: e } = buildGraph(detail);
                setNodes(n);
                setEdges(e);
            } catch {
                // YAML not yet valid, skip graph update
            }
        }, 600);
    };

    const handleSave = async () => {
        const value = editorRef.current?.getValue() ?? yaml;
        setSaving(true);
        try {
            await UpdateNetworkPolicyYaml(name, namespace, value);
            setOriginalYaml(value);
            setYaml(value);
            setDirty(false);
            toast.current?.show({ severity: 'success', summary: 'Updated', detail: `${namespace}/${name} updated`, life: 2500 });
        } catch {
            toast.current?.show({ severity: 'error', summary: 'Update failed', detail: `${namespace}/${name} could not be updated`, life: 3500 });
        } finally {
            setSaving(false);
        }
    };

    const handleRevert = () => {
        editorRef.current?.setValue(originalYaml);
        setDirty(false);
        // Revert graph to original state
        GetNetworkPolicyDetail(name, namespace)
            .then((raw: any) => {
                const detail = models.NetworkPolicyDetail.createFrom(raw);
                const { nodes: n, edges: e } = buildGraph(detail);
                setNodes(n);
                setEdges(e);
            })
            .catch(() => {});
    };

    return (
        <div
            ref={containerRef}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--monolith-base, #0d1117)' }}
        >
            <Toast ref={toast} position="bottom-right" />

            {/* Toolbar */}
            <div className="yaml-editor-toolbar flex align-items-center justify-content-between" style={{ flexShrink: 0 }}>
                <span className="yaml-editor-toolbar__label flex align-items-center gap-1">
                    <i className="pi pi-shield" />
                    {namespace}/{name}
                </span>
                <div className="flex align-items-center gap-1">
                    <Button
                        label="Revert"
                        icon="pi pi-undo"
                        text
                        size="small"
                        disabled={!dirty || saving}
                        onClick={handleRevert}
                    />
                    <Button
                        label="Save"
                        icon="pi pi-check"
                        size="small"
                        loading={saving}
                        disabled={!dirty}
                        onClick={handleSave}
                    />
                </div>
            </div>

            {/* Top: ReactFlow */}
            <div style={{ flex: `0 0 ${splitPct}%`, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
                {graphLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-color-secondary)' }}>
                        <i className="pi pi-spin pi-spinner" style={{ fontSize: 24 }} />
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        nodesDraggable
                        nodesConnectable={false}
                        elementsSelectable
                        style={{ background: 'var(--monolith-base, #0d1117)' }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
                        <Controls
                            style={{
                                background: 'var(--monolith-panel, #1a1f2e)',
                                border: '1px solid var(--surface-border)',
                                borderRadius: 8,
                            }}
                        />
                        <MiniMap
                            style={{
                                background: 'var(--monolith-panel, #1a1f2e)',
                                border: '1px solid var(--surface-border)',
                            }}
                            nodeColor="#6366f1"
                        />
                    </ReactFlow>
                )}
            </div>

            {/* Divider */}
            <div
                onMouseDown={handleDividerMouseDown}
                style={{
                    flexShrink: 0,
                    height: 6,
                    cursor: 'row-resize',
                    background: 'var(--surface-border, #2a3042)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none',
                }}
            >
                <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--surface-400, #4a5568)' }} />
            </div>

            {/* Bottom: YAML Editor */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <Editor
                    height="100%"
                    defaultLanguage="yaml"
                    language="yaml"
                    value={yaml}
                    theme={MONOLITH_THEME}
                    onMount={handleMount}
                    onChange={handleChange}
                    options={{
                        minimap: { enabled: true },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                        lineNumbers: 'on',
                        folding: true,
                        renderLineHighlight: 'all',
                    }}
                />
            </div>
        </div>
    );
}
