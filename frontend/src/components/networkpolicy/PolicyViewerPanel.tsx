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
// Configures @monaco-editor/react to use the bundled Monaco. Side-effect
// import: this panel is lazily loaded, so Monaco arrives with it.
import '../../lib/monacoBootstrap';
import { themeAlpha, themeColor, useThemeVersion } from '../../lib/themeColors';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import type * as monaco from 'monaco-editor';
import { GetNetworkPolicyDetail, GetNetworkPolicyYaml, ParseNetworkPolicyYaml, UpdateNetworkPolicyYaml } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { MONOLITH_THEME } from '../../lib/monacoTheme';
import { useT, type TFn } from '../../i18n/useT';

interface PolicyViewerPanelParams {
    clusterName: string;
    name: string;
    namespace: string;
}

// ── Node styles ───────────────────────────────────────────────────────────────
//
// Built per call rather than as module constants, and resolved through
// `themeColor`/`themeAlpha` rather than written as `var(--x)`: reactflow passes
// some of these straight through to SVG *attributes* (edge markers, the minimap,
// the dot background), and a CSS variable never resolves in an attribute. The
// graph builder runs on every render and the panel subscribes to the theme, so
// switching palettes repaints it.

const nodePolicy = (): React.CSSProperties => ({
    background: 'var(--panel2)',
    border: `2px solid ${themeColor('--violet')}`,
    borderRadius: 10,
    padding: '10px 16px',
    color: 'var(--ink)',
    fontFamily: 'var(--font-family)',
    width: 220,
    textAlign: 'center',
});

const nodeIngress = (): React.CSSProperties => ({
    background: themeAlpha('--blue', 0.18),
    border: `1.5px solid ${themeColor('--blue')}`,
    borderRadius: 8,
    padding: '8px 14px',
    color: themeColor('--blue'),
    fontFamily: 'var(--font-family)',
    minWidth: 180,
    fontSize: 12,
});

const nodeEgress = (): React.CSSProperties => ({
    background: themeAlpha('--amber', 0.18),
    border: `1.5px solid ${themeColor('--amber')}`,
    borderRadius: 8,
    padding: '8px 14px',
    color: themeColor('--amber'),
    fontFamily: 'var(--font-family)',
    minWidth: 180,
    fontSize: 12,
});

const nodeDeny = (): React.CSSProperties => ({
    background: themeAlpha('--red', 0.18),
    border: `2px solid ${themeColor('--red')}`,
    borderRadius: 8,
    padding: '8px 14px',
    color: themeColor('--red'),
    fontFamily: 'var(--font-family)',
    minWidth: 180,
    fontSize: 12,
    textAlign: 'center',
});

const nodePods = (): React.CSSProperties => ({
    background: themeAlpha('--green', 0.18),
    border: `1.5px solid ${themeColor('--green')}`,
    borderRadius: 8,
    padding: '8px 14px',
    color: themeColor('--green'),
    fontFamily: 'var(--font-family)',
    width: 220,
    textAlign: 'center',
    fontSize: 12,
});

// ── Custom policy node (left target + right source + bottom source) ───────────

function PolicyNodeComponent({ data }: NodeProps) {
    return (
        <>
            <Handle type="target" position={Position.Left} id="left" style={{ background: 'var(--violet)', borderColor: 'var(--violet)' }} />
            {data.label}
            <Handle type="source" position={Position.Right} id="right" style={{ background: 'var(--violet)', borderColor: 'var(--violet)' }} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} />
        </>
    );
}

const NODE_TYPES = { policyNode: PolicyNodeComponent };

// ── Graph builder ─────────────────────────────────────────────────────────────

// `t` is a parameter, not a hook call: this is a plain graph builder, not a
// component, so it cannot use useT() — and it must still re-run when the
// language changes, which the caller's useMemo dependency handles.
function buildGraph(detail: models.NetworkPolicyDetail, t: TFn): { nodes: Node[]; edges: Edge[] } {
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
                                        background: t === 'Ingress' ? themeAlpha('--blue', 0.3) : themeAlpha('--amber', 0.3),
                                        color: t === 'Ingress' ? themeColor('--blue') : themeColor('--amber'),
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
        style: nodePolicy(),
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
                        {t('panels:policy.affectedPods')}
                    </div>
                    <div style={{ fontSize: 11 }}>{detail.pod_selector || t('panels:policy.allPods')}</div>
                </div>
            ),
        },
        style: nodePods(),
    });

    edges.push({
        id: 'policy-pods',
        source: 'policy',
        target: 'pods',
        sourceHandle: 'bottom',
        type: 'straight',
        animated: true,
        style: { stroke: themeColor('--green'), strokeDasharray: '4 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: themeColor('--green') },
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
                            <VscCircleSlash size={13} color="var(--red)" style={{ marginRight: 6, verticalAlign: 'middle' }} />{' '}
                            {t('panels:policy.denyAllIngress')}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.8 }}>{t('panels:policy.denyAllIngressHint')}</div>
                    </div>
                ),
            },
            style: nodeDeny(),
        });
        edges.push({
            id: 'deny-ingress-edge',
            source: 'deny-ingress',
            target: 'policy',
            targetHandle: 'left',
            animated: false,
            style: { stroke: themeColor('--red'), strokeDasharray: '6 3' },
            markerEnd: { type: MarkerType.ArrowClosed, color: themeColor('--red') },
            label: '✕ blocked',
            labelStyle: { fill: themeColor('--red'), fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: themeAlpha('--red', 0.18), opacity: 0.9 },
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
                            <VscCircleSlash size={13} color="var(--red)" style={{ marginRight: 6, verticalAlign: 'middle' }} />{' '}
                            {t('panels:policy.denyAllEgress')}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.8 }}>{t('panels:policy.denyAllEgressHint')}</div>
                    </div>
                ),
            },
            style: nodeDeny(),
        });
        edges.push({
            id: 'deny-egress-edge',
            source: 'policy',
            target: 'deny-egress',
            sourceHandle: 'right',
            animated: false,
            style: { stroke: themeColor('--red'), strokeDasharray: '6 3' },
            markerEnd: { type: MarkerType.ArrowClosed, color: themeColor('--red') },
            label: '✕ blocked',
            labelStyle: { fill: themeColor('--red'), fontSize: 10, fontWeight: 700 },
            labelBgStyle: { fill: themeAlpha('--red', 0.18), opacity: 0.9 },
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
                            {t('panels:policy.ingressRule', { n: i + 1 })}
                        </div>
                        <div style={{ fontSize: 11, marginBottom: 3, opacity: 0.9 }}>{t('panels:policy.ports', { ports })}</div>
                        {(rule.peers ?? []).map((p, pi) => (
                            <div key={pi} style={{ marginTop: 3 }}>
                                {p.namespace_selector && <div style={{ fontSize: 10, opacity: 0.75 }}>{t('panels:policy.namespaceSelector', { selector: p.namespace_selector })}</div>}
                                {p.pod_selector && <div style={{ fontSize: 10, opacity: 0.75 }}>{t('panels:policy.podSelector', { selector: p.pod_selector })}</div>}
                                {p.ip_block && <div style={{ fontSize: 10, opacity: 0.75 }}>{t('panels:policy.ipBlock', { block: p.ip_block })}</div>}
                                {(p.ip_block_except ?? []).map((exc, ei) => (
                                    <div key={ei} style={{ fontSize: 10, color: 'var(--red)', marginTop: 1 }}>
                                        <VscCircleSlash size={9} style={{ marginRight: 3, verticalAlign: 'middle' }} />{' '}
                                        {t('panels:policy.except', { value: exc })}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ),
            },
            style: nodeIngress(),
        });

        edges.push({
            id: `ingress-edge-${i}`,
            source: nodeId,
            target: 'policy',
            targetHandle: 'left',
            animated: true,
            style: { stroke: themeColor('--blue') },
            markerEnd: { type: MarkerType.ArrowClosed, color: themeColor('--blue') },
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
                            {t('panels:policy.egressRule', { n: i + 1 })}
                        </div>
                        <div style={{ fontSize: 11, marginBottom: 3, opacity: 0.9 }}>{t('panels:policy.ports', { ports })}</div>
                        {(rule.peers ?? []).map((p, pi) => (
                            <div key={pi} style={{ marginTop: 3 }}>
                                {p.namespace_selector && <div style={{ fontSize: 10, opacity: 0.75 }}>{t('panels:policy.namespaceSelector', { selector: p.namespace_selector })}</div>}
                                {p.pod_selector && <div style={{ fontSize: 10, opacity: 0.75 }}>{t('panels:policy.podSelector', { selector: p.pod_selector })}</div>}
                                {p.ip_block && <div style={{ fontSize: 10, opacity: 0.75 }}>{t('panels:policy.ipBlock', { block: p.ip_block })}</div>}
                                {(p.ip_block_except ?? []).map((exc, ei) => (
                                    <div key={ei} style={{ fontSize: 10, color: 'var(--red)', marginTop: 1 }}>
                                        <VscCircleSlash size={9} style={{ marginRight: 3, verticalAlign: 'middle' }} />{' '}
                                        {t('panels:policy.except', { value: exc })}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ),
            },
            style: nodeEgress(),
        });

        edges.push({
            id: `egress-edge-${i}`,
            source: 'policy',
            target: nodeId,
            sourceHandle: 'right',
            animated: true,
            style: { stroke: themeColor('--amber') },
            markerEnd: { type: MarkerType.ArrowClosed, color: themeColor('--amber') },
        });
    });

    return { nodes, edges };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PolicyViewerPanel({ params }: IDockviewPanelProps<PolicyViewerPanelParams>) {
    const t = useT();
    // The graph's colors are resolved values (reactflow puts several of them in
    // SVG attributes), so a re-render is what repaints it after a theme switch.
    useThemeVersion();
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
                const { nodes: n, edges: e } = buildGraph(detail, t);
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
                const { nodes: n, edges: e } = buildGraph(detail, t);
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
                const { nodes: n, edges: e } = buildGraph(detail, t);
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
                        label={t('panels:yaml.revert')}
                        icon={<VscDiscard size={16} />}
                        text
                        size="small"
                        disabled={!dirty || saving}
                        onClick={handleRevert}
                    />
                    <Button
                        label={t('panels:yaml.save')}
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
                        onlyRenderVisibleElements
                        style={{ background: 'var(--app)' }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={themeColor('--line')} />
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
                            nodeColor={themeColor('--violet')}
                        />
                    </ReactFlow>
                )}
            </div>

            {/* Divider */}
            <button
                type="button"
                aria-label={t('panels:policy.resizeDivider')}
                onMouseDown={handleDividerMouseDown}
                onKeyDown={handleDividerKeyDown}
                style={{
                    flexShrink: 0,
                    height: 6,
                    cursor: 'row-resize',
                    background: 'var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none',
                    border: 'none',
                    padding: 0,
                    width: '100%',
                }}
            >
                <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--ink3)' }} />
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
