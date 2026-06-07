import { useCallback, useEffect, useRef, useState } from 'react';






import { VscShield, VscPackage, VscCircleSlash, VscArrowRight, VscArrowLeft, VscDiscard, VscCheck } from 'react-icons/vsc';
import { CircularProgress } from '@mui/material';
import { IDockviewPanelProps } from 'dockview';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Node,
    Edge,
    MarkerType,
    BackgroundVariant,
    Handle,
    Position,
    NodeProps,
    useNodesState,
    useEdgesState,
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
    clusterName: string;
    name: string;
    namespace: string;
}

// ── Node styles ───────────────────────────────────────────────────────────────

const NODE_POLICY: React.CSSProperties = {
    background: 'var(--panel2)',
    border: '2px solid var(--p-primary-color, #6366f1)',
    borderRadius: 10,
    padding: '10px 16px',
    color: 'var(--text-color, #e2e8f0)',
    fontFamily: 'var(--font-family)',
    width: 220,
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
    width: 220,
    textAlign: 'center',
    fontSize: 12,
};

// ── Custom policy node (left target + right source + bottom source) ───────────

function PolicyNodeComponent({ data }: NodeProps) {
    return (
        <>
            <Handle type="target" position={Position.Left} id="left" style={{ background: '#6366f1', borderColor: '#6366f1' }} />
            {data.label}
            <Handle type="source" position={Position.Right} id="right" style={{ background: '#6366f1', borderColor: '#6366f1' }} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#22c55e', borderColor: '#22c55e' }} />
        </>
    );
}

const NODE_TYPES = { policyNode: PolicyNodeComponent };

// ── Graph builder ─────────────────────────────────────────────────────────────

function buildGraph(detail: models.NetworkPolicyDetail): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const cx = 450;
    const cy = 220;

    nodes.push({
        id: 'policy',
        type: 'policyNode',
        position: { x: cx, y: cy },
        data: {
            label: (
                <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        <VscShield size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
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
        type: 'output',
        targetPosition: Position.Top,
        position: { x: cx, y: cy + 180 },
        data: {
            label: (
                <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        <VscPackage size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />{' '}
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
        sourceHandle: 'bottom',
        type: 'straight',
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
            type: 'input',
            sourcePosition: Position.Right,
            position: { x: cx - 370, y: cy },
            data: {
                label: (
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            <VscCircleSlash size={13} color="#ef4444" style={{ marginRight: 6, verticalAlign: 'middle' }} />{' '}
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
            targetHandle: 'left',
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
            type: 'output',
            targetPosition: Position.Left,
            position: { x: cx + 410, y: cy },
            data: {
                label: (
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            <VscCircleSlash size={13} color="#ef4444" style={{ marginRight: 6, verticalAlign: 'middle' }} />{' '}
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
            sourceHandle: 'right',
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
            type: 'input',
            sourcePosition: Position.Right,
            position: { x: cx - 370, y: ingressStartY + i * 130 },
            data: {
                label: (
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            <VscArrowRight size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />{' '}
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
                                        <VscCircleSlash size={9} style={{ marginRight: 3, verticalAlign: 'middle' }} />{' '}
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
            targetHandle: 'left',
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
            type: 'output',
            targetPosition: Position.Left,
            position: { x: cx + 410, y: egressStartY + i * 130 },
            data: {
                label: (
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            <VscArrowLeft size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />{' '}
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
                                        <VscCircleSlash size={9} style={{ marginRight: 3, verticalAlign: 'middle' }} />{' '}
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
            sourceHandle: 'right',
            animated: true,
            style: { stroke: '#f59e0b' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
        });
    });

    return { nodes, edges };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PolicyViewerPanel({ params }: IDockviewPanelProps<PolicyViewerPanelParams>) {
    const { clusterName, name, namespace } = params;
    const cn = clusterName ?? '';

    const [splitPct, setSplitPct] = useState(55);
    const isDragging = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
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
        GetNetworkPolicyDetail(cn, name, namespace)
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
        GetNetworkPolicyYaml(cn, name, namespace)
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

    const handleDividerKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSplitPct((prev) => Math.max(prev - 2, 20));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSplitPct((prev) => Math.min(prev + 2, 80));
        }
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
            await UpdateNetworkPolicyYaml(cn, name, namespace, value);
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
        GetNetworkPolicyDetail(cn, name, namespace)
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
            style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--app)' }}
        >
            <Toast ref={toast} position="bottom-right" />

            {/* Toolbar */}
            <div className="yaml-editor-toolbar flex align-items-center justify-content-between" style={{ flexShrink: 0 }}>
                <span className="yaml-editor-toolbar__label flex align-items-center gap-1">
                    <VscShield size={14} />
                    {namespace}/{name}
                </span>
                <div className="flex align-items-center gap-1">
                    <Button
                        label="Revert"
                        icon={<VscDiscard size={16} />}
                        text
                        size="small"
                        disabled={!dirty || saving}
                        onClick={handleRevert}
                    />
                    <Button
                        label="Save"
                        icon={<VscCheck size={16} />}
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
                        <CircularProgress size={24} />
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={NODE_TYPES}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        nodesDraggable
                        nodesConnectable={false}
                        elementsSelectable
                        style={{ background: 'var(--app)' }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
                        <Controls
                            style={{
                                background: 'var(--panel2)',
                                border: '1px solid var(--surface-border)',
                                borderRadius: 8,
                            }}
                        />
                        <MiniMap
                            style={{
                                background: 'var(--panel2)',
                                border: '1px solid var(--surface-border)',
                            }}
                            nodeColor="#6366f1"
                        />
                    </ReactFlow>
                )}
            </div>

            {/* Divider */}
            <button
                type="button"
                aria-label="Resize divider"
                onMouseDown={handleDividerMouseDown}
                onKeyDown={handleDividerKeyDown}
                style={{
                    flexShrink: 0,
                    height: 6,
                    cursor: 'row-resize',
                    background: 'var(--surface-border, #2a3042)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none',
                    border: 'none',
                    padding: 0,
                    width: '100%',
                }}
            >
                <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--surface-400, #4a5568)' }} />
            </button>

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
