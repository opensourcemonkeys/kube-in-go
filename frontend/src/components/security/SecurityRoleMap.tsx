import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import { CircularProgress } from '@mui/material';
import { VscAccount, VscLink, VscLock, VscShield, VscDatabase, VscFile, VscRefresh, VscWarning, VscTypeHierarchySub } from 'react-icons/vsc';
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
    ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { useTabContext } from '../../contexts/TabContext';
import { GetSecurityGraph } from '../../../wailsjs/go/controller_app/App';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SecurityNodeData {
    id: string;
    kind: string;       // ServiceAccount | RoleBinding | Role | ClusterRole | Resource | Object
    name: string;
    namespace: string;
    verbs?: string;     // Resource nodes: comma-separated permission set, shown in the box
    group?: string;     // backing object's API group (for YAML view/edit)
    resource?: string;  // backing object's resource (plural); set => has YAML
}

interface SecurityGraph {
    nodes: SecurityNodeData[];
    edges: Array<{ id: string; source: string; target: string; kind: string; label?: string }>;
}

// ── Kind config (column = left→right position) ──────────────────────────────────

const KIND_CONFIG: Record<string, { color: string; Icon: React.ComponentType<{ style?: React.CSSProperties }> }> = {
    ServiceAccount: { color: '#3b82f6', Icon: VscAccount },
    RoleBinding:    { color: '#f59e0b', Icon: VscLink },
    Role:           { color: '#10b981', Icon: VscLock },
    ClusterRole:    { color: '#8b5cf6', Icon: VscShield },
    Resource:       { color: '#06b6d4', Icon: VscDatabase },
    Object:         { color: '#94a3b8', Icon: VscFile },
};

const NODE_W = 210;
const NODE_H = 64;

// ── Edge styling per relationship kind ─────────────────────────────────────────

const EDGE_STYLE: Record<string, { stroke: string; dashed: boolean }> = {
    subject:  { stroke: '#3b82f6', dashed: false },
    roleref:  { stroke: '#f59e0b', dashed: false },
    grants:   { stroke: '#06b6d4', dashed: false },
    instance: { stroke: '#64748b', dashed: false },
};

// ── Custom node ─────────────────────────────────────────────────────────────────

function SecNode({ data }: NodeProps<SecurityNodeData>) {
    const cfg = KIND_CONFIG[data.kind] ?? { color: '#6b7280', Icon: VscTypeHierarchySub };

    return (
        <div style={{
            border: `2px solid ${cfg.color}`,
            borderRadius: 8,
            background: '#131c2e',
            padding: '6px 11px',
            width: NODE_W,
            minHeight: NODE_H,
            fontFamily: 'var(--font-family)',
            boxSizing: 'border-box',
        }}>
            <Handle type="target" position={Position.Left}
                style={{ background: cfg.color, width: 8, height: 8 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <cfg.Icon style={{ color: cfg.color, fontSize: 11 }} />
                <span style={{ color: cfg.color, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {data.kind}
                </span>
            </div>
            <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data.name}
            </div>
            {data.namespace && (
                <div style={{ color: '#475569', fontSize: 11, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {data.namespace}
                </div>
            )}
            {data.verbs && (
                <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {data.verbs.split(', ').map(v => (
                        <span key={v} style={{
                            fontSize: 9, lineHeight: 1.4, padding: '0 5px', borderRadius: 4,
                            background: 'rgba(6,182,212,0.16)', color: '#67e8f9',
                            fontFamily: 'var(--font-family-mono)',
                        }}>
                            {v}
                        </span>
                    ))}
                </div>
            )}

            <Handle type="source" position={Position.Right}
                style={{ background: cfg.color, width: 8, height: 8 }} />
        </div>
    );
}

const nodeTypes = { secNode: SecNode };

// ── Layered left→right layout (dagre) ───────────────────────────────────────────
// Dagre assigns ranks from the edge structure (SA→RB→Role→Resource naturally land
// in successive columns) and orders nodes within each rank to minimise edge
// crossings, so arrows no longer pile on top of each other.

// Resource nodes carry verb chips inside the box, so they need extra height for
// dagre to reserve enough vertical room (≈4 chips per line).
function nodeHeight(n: SecurityNodeData): number {
    if (!n.verbs) return NODE_H;
    const lines = Math.ceil(n.verbs.split(', ').length / 4);
    return NODE_H + lines * 15 + 6;
}

function buildFlow(graph: SecurityGraph): { nodes: Node[]; edges: Edge[] } {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: 'LR',
        nodesep: 22,     // gap between nodes in the same rank
        ranksep: 140,    // gap between ranks
        edgesep: 14,
        marginx: 24,
        marginy: 24,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const n of graph.nodes) {
        g.setNode(n.id, { width: NODE_W, height: nodeHeight(n) });
    }
    for (const e of graph.edges) {
        // Only lay out edges whose endpoints exist as nodes.
        if (g.hasNode(e.source) && g.hasNode(e.target)) {
            g.setEdge(e.source, e.target);
        }
    }

    dagre.layout(g);

    const nodes: Node[] = graph.nodes.map(n => {
        // dagre returns the node centre; ReactFlow positions from the top-left.
        const p = g.node(n.id);
        const h = nodeHeight(n);
        return {
            id: n.id,
            type: 'secNode',
            position: p ? { x: p.x - NODE_W / 2, y: p.y - h / 2 } : { x: 0, y: 0 },
            data: n,
        };
    });

    const edges: Edge[] = graph.edges.map(e => {
        const st = EDGE_STYLE[e.kind] ?? { stroke: '#475569', dashed: false };
        return {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label || undefined,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: st.stroke },
            style: { stroke: st.stroke, strokeWidth: 1.5, strokeDasharray: st.dashed ? '5 4' : undefined },
            labelStyle: { fill: '#cbd5e1', fontSize: 10, fontFamily: 'var(--font-family-mono)' },
            labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
            labelBgPadding: [4, 2] as [number, number],
        };
    });

    return { nodes, edges };
}

// ── Detail (double-click) ────────────────────────────────────────────────────────
// Builds a relationship/permission summary for one object purely from the
// in-memory graph (no extra backend call).

interface DetailItem { label: string; sub?: string }
interface DetailSection { title: string; items: DetailItem[] }
interface NodeDetail { node: SecurityNodeData; sections: DetailSection[] }

function computeDetail(graph: SecurityGraph, nodeId: string): NodeDetail | null {
    const byId = new Map(graph.nodes.map(n => [n.id, n]));
    const node = byId.get(nodeId);
    if (!node) return null;

    const out = graph.edges.filter(e => e.source === nodeId);
    const inc = graph.edges.filter(e => e.target === nodeId);
    const name = (id: string) => byId.get(id)?.name ?? id;
    const ns = (id: string) => byId.get(id)?.namespace ?? '';

    // resource → verbs that a given role/clusterrole grants (verbs live on the
    // resource node now, not on the grant edge)
    const permsOf = (roleId: string): DetailItem[] =>
        graph.edges
            .filter(e => e.source === roleId && e.kind === 'grants')
            .map(e => ({ label: name(e.target), sub: byId.get(e.target)?.verbs }))
            .sort((a, b) => a.label.localeCompare(b.label));

    const sections: DetailSection[] = [];

    if (node.kind === 'ServiceAccount') {
        const items = out.filter(e => e.kind === 'subject').map(e => {
            const roleref = graph.edges.find(x => x.source === e.target && x.kind === 'roleref');
            const role = roleref ? byId.get(roleref.target) : undefined;
            return { label: name(e.target), sub: role ? `→ ${role.kind}: ${role.name}` : undefined };
        });
        sections.push({ title: `Bound via RoleBindings (${items.length})`, items });
    } else if (node.kind === 'RoleBinding') {
        sections.push({
            title: 'Subjects',
            items: inc.filter(e => e.kind === 'subject').map(e => ({ label: name(e.source), sub: ns(e.source) })),
        });
        const roleref = out.find(e => e.kind === 'roleref');
        const role = roleref ? byId.get(roleref.target) : undefined;
        if (role) {
            sections.push({ title: 'Role reference', items: [{ label: role.name, sub: role.kind }] });
            sections.push({ title: `Permissions (${permsOf(role.id).length})`, items: permsOf(role.id) });
        }
    } else if (node.kind === 'Role' || node.kind === 'ClusterRole') {
        sections.push({ title: `Permissions — resource → verbs (${permsOf(nodeId).length})`, items: permsOf(nodeId) });
        sections.push({
            title: 'Used by RoleBindings',
            items: inc.filter(e => e.kind === 'roleref').map(e => ({ label: name(e.source), sub: ns(e.source) })),
        });
    } else if (node.kind === 'Resource') {
        if (node.verbs) {
            sections.push({ title: 'Verbs', items: [{ label: node.verbs }] });
        }
        sections.push({
            title: 'Granted by',
            items: inc.filter(e => e.kind === 'grants').map(e => ({ label: name(e.source), sub: ns(e.source) })),
        });
        const objs = out.filter(e => e.kind === 'instance').map(e => ({ label: name(e.target), sub: ns(e.target) || undefined }));
        sections.push({ title: `Accessible objects (${objs.length})`, items: objs });
    } else if (node.kind === 'Object') {
        const inst = inc.find(e => e.kind === 'instance');
        const resId = inst?.source;
        if (resId) {
            sections.push({ title: 'Resource type', items: [{ label: name(resId), sub: byId.get(resId)?.namespace }] });
            const grant = graph.edges.find(e => e.target === resId && e.kind === 'grants');
            const role = grant ? byId.get(grant.source) : undefined;
            if (role) {
                sections.push({ title: 'Granted by role', items: [{ label: role.name, sub: `${role.kind}${grant?.label ? ' · ' + grant.label : ''}` }] });
            }
        }
    }

    return { node, sections };
}

// ── Panel ───────────────────────────────────────────────────────────────────────

export default function SecurityRoleMap({ clusterName }: { clusterName: string }) {
    const cn = clusterName ?? '';
    const [graph, setGraph] = useState<SecurityGraph | null>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // The object (node) the user clicked. Everything connected to it (its whole
    // RBAC chain) is highlighted so the relationships can be traced.
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    // The object double-clicked, shown in a detail modal.
    const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
    const rfRef = useRef<ReactFlowInstance | null>(null);
    const { openObjectYaml } = useTabContext();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const raw: any = await GetSecurityGraph(cn);
            const g = raw as SecurityGraph;
            const { nodes: n, edges: e } = buildFlow(g);
            setGraph(g);
            setNodes(n);
            setEdges(e);
            setSelectedNodeId(null);
            setDetailNodeId(null);
            setTimeout(() => rfRef.current?.fitView({ padding: 0.15 }), 120);
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setLoading(false);
        }
    }, [cn]);

    useEffect(() => { load(); }, [load]);

    const openDetail = useCallback((nodeId: string) => setDetailNodeId(nodeId), []);
    const closeDetail = useCallback(() => setDetailNodeId(null), []);

    // Open the object's YAML in a dockview panel (beside this map), not a popup.
    const openYaml = useCallback((node: SecurityNodeData) => {
        if (!node.resource) return;
        openObjectYaml({
            clusterName: cn,
            kind: node.kind,
            group: node.group ?? '',
            resource: node.resource,
            namespace: node.namespace ?? '',
            name: node.name,
            referencePanel: cn ? `securityrolemap:${cn}` : 'securityrolemap',
        });
        closeDetail();
    }, [cn, openObjectYaml, closeDetail]);

    // Reachable set (connected component) from the clicked node, walking edges
    // in both directions so the full chain — e.g. ServiceAccount → RoleBinding →
    // Role → Resource — lights up regardless of which object was clicked.
    const { highlightNodes, highlightEdges } = useMemo(() => {
        if (!selectedNodeId) {
            return { highlightNodes: null as Set<string> | null, highlightEdges: null as Set<string> | null };
        }
        const adj = new Map<string, Array<{ edgeId: string; other: string }>>();
        const push = (k: string, v: { edgeId: string; other: string }) => {
            const arr = adj.get(k);
            if (arr) arr.push(v); else adj.set(k, [v]);
        };
        for (const e of edges) {
            push(e.source, { edgeId: e.id, other: e.target });
            push(e.target, { edgeId: e.id, other: e.source });
        }
        const nodeSet = new Set<string>([selectedNodeId]);
        const edgeSet = new Set<string>();
        const queue = [selectedNodeId];
        while (queue.length) {
            const cur = queue.shift()!;
            for (const { edgeId, other } of adj.get(cur) ?? []) {
                edgeSet.add(edgeId);
                if (!nodeSet.has(other)) { nodeSet.add(other); queue.push(other); }
            }
        }
        return { highlightNodes: nodeSet, highlightEdges: edgeSet };
    }, [edges, selectedNodeId]);

    const displayEdges = useMemo<Edge[]>(() => {
        if (!highlightEdges) return edges;
        return edges.map(e => highlightEdges.has(e.id)
            ? { ...e, animated: true, zIndex: 1000, style: { ...e.style, strokeWidth: 2.5, opacity: 1, filter: `drop-shadow(0 0 4px ${e.style?.stroke ?? '#e2e8f0'})` } }
            : { ...e, animated: false, style: { ...e.style, opacity: 0.07 } });
    }, [edges, highlightEdges]);

    const displayNodes = useMemo<Node[]>(() => {
        if (!highlightNodes) return nodes;
        return nodes.map(n => {
            if (!highlightNodes.has(n.id)) {
                return { ...n, style: { ...n.style, opacity: 0.18 } };
            }
            const color = KIND_CONFIG[(n.data as SecurityNodeData).kind]?.color ?? '#38bdf8';
            const clicked = n.id === selectedNodeId;
            return {
                ...n,
                style: {
                    ...n.style,
                    opacity: 1,
                    zIndex: 1000,
                    borderRadius: 8,
                    boxShadow: clicked ? `0 0 0 3px ${color}, 0 0 20px ${color}` : `0 0 0 2px ${color}, 0 0 11px ${color}`,
                },
            };
        });
    }, [nodes, highlightNodes, selectedNodeId]);

    const detail = detailNodeId && graph ? computeDetail(graph, detailNodeId) : null;
    const detailCfg = detail ? (KIND_CONFIG[detail.node.kind] ?? { color: '#6b7280', Icon: VscTypeHierarchySub }) : null;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--app)' }}>

            {/* Toolbar */}
            <div className="yaml-editor-toolbar flex align-items-center justify-content-between" style={{ flexShrink: 0 }}>
                <span className="yaml-editor-toolbar__label flex align-items-center gap-2">
                    <VscShield style={{ fontSize: 14 }} />{' '}
                    Security Role Map
                </span>
                <div className="flex align-items-center gap-2">
                    {loading && <CircularProgress size={14} style={{ color: 'var(--text-color-secondary)' }} />}
                    <button className="cluster-bar__edit-btn" onClick={load} disabled={loading} title="Refresh">
                        <VscRefresh style={{ fontSize: 14 }} />
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div style={{
                display: 'flex', gap: 16, padding: '5px 14px', flexShrink: 0,
                flexWrap: 'wrap', borderBottom: '1px solid var(--surface-border)',
                background: 'var(--panel2)',
            }}>
                {Object.entries(KIND_CONFIG).map(([kind, cfg]) => (
                    <span key={kind} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: cfg.color }}>
                        <cfg.Icon style={{ fontSize: 11 }} />{' '}
                        {kind}
                    </span>
                ))}
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#64748b' }}>
                    <span style={{ fontStyle: 'italic' }}>tip: click to highlight connections · double-click for details</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 24, height: 2, background: '#06b6d4', display: 'inline-block' }} />{' '}
                        grants
                    </span>
                </span>
            </div>

            {/* Flow canvas */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {error ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: '#ef4444' }}>
                        <VscWarning style={{ fontSize: 32 }} />
                        <span style={{ fontSize: 13 }}>{error}</span>
                        <button className="cluster-bar__edit-btn" onClick={load} style={{ marginTop: 4 }}>
                            <VscRefresh style={{ fontSize: 14 }} /> Retry
                        </button>
                    </div>
                ) : (
                    <ReactFlow
                        nodes={displayNodes}
                        edges={displayEdges}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.15 }}
                        nodesDraggable
                        nodesConnectable={false}
                        elementsSelectable
                        onNodeClick={(_, node) => setSelectedNodeId(prev => prev === node.id ? null : node.id)}
                        onNodeDoubleClick={(_, node) => openDetail(node.id)}
                        onPaneClick={() => setSelectedNodeId(null)}
                        onInit={inst => { rfRef.current = inst; }}
                        style={{ background: 'var(--app)' }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
                        <Controls style={{
                            background: 'var(--panel2)',
                            border: '1px solid var(--surface-border)',
                            borderRadius: 8,
                        }} />
                        <MiniMap
                            style={{
                                background: 'var(--panel2)',
                                border: '1px solid var(--surface-border)',
                            }}
                            nodeColor={n => KIND_CONFIG[(n.data as SecurityNodeData)?.kind]?.color ?? '#6b7280'}
                        />
                    </ReactFlow>
                )}
            </div>

            {/* Detail modal (double-click an object) */}
            <Dialog
                visible={!!detail}
                onHide={closeDetail}
                dismissableMask
                style={{ width: '34rem', maxWidth: '94vw' }}
                header={detail && detailCfg ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <detailCfg.Icon style={{ color: detailCfg.color, fontSize: 16 }} />
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <span style={{ color: detailCfg.color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {detail.node.kind}
                            </span>
                            <span style={{ fontSize: 15, fontWeight: 600 }}>
                                {detail.node.name}
                                {detail.node.namespace && (
                                    <span style={{ color: 'var(--text-color-secondary)', fontWeight: 400 }}>{' '}· {detail.node.namespace}</span>
                                )}
                            </span>
                        </span>
                    </span>
                ) : undefined}
            >
                {detail && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {detail.sections.map((section, si) => (
                            <div key={si}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-color-secondary)', marginBottom: 6 }}>
                                    {section.title}
                                </div>
                                {section.items.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--text-color-secondary)', fontStyle: 'italic' }}>none</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {section.items.map((it, ii) => (
                                            <div key={ii} style={{
                                                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
                                                padding: '5px 9px', background: 'var(--panel2)', border: '1px solid var(--surface-border)', borderRadius: 6,
                                            }}>
                                                <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0', wordBreak: 'break-all' }}>{it.label}</span>
                                                {it.sub && (
                                                    <span style={{ fontSize: 11, color: 'var(--text-color-secondary)', fontFamily: 'var(--font-family-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                        {it.sub}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* YAML action — only for nodes backed by a real object */}
                        {detail.node.resource && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--surface-border)', paddingTop: 12 }}>
                                <Button
                                    label="View / Edit YAML"
                                    icon="pi pi-file-edit"
                                    size="small"
                                    onClick={() => openYaml(detail.node)}
                                />
                            </div>
                        )}
                    </div>
                )}
            </Dialog>
        </div>
    );
}
