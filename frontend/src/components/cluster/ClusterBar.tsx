import { useState, useEffect, useRef } from 'react';
import {
    VscAdd, VscEdit,
    VscTypeHierarchySub, VscWarning,
} from 'react-icons/vsc';
import { Dropdown } from 'primereact/dropdown';
import { OverlayPanel } from 'primereact/overlaypanel';
import { useClusterContext } from '../../contexts/ClusterContext';
import { useTabContext } from '../../contexts/TabContext';
import { defaultColorId, hexForId } from '../../lib/clusterColors';
import { useClusterColorStore } from '../../stores/clusterColorStore';
import ClusterModal from './ClusterModal';

export default function ClusterBar() {
    const { clusters, activeCluster, loaded, connectionError, refreshClusters, selectCluster } = useClusterContext();
    const { openClusterResourceView } = useTabContext();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCluster, setEditingCluster] = useState<string | null>(null);
    const initialCheckDone = useRef(false);
    const errorPanelRef = useRef<OverlayPanel>(null);

    const overrides = useClusterColorStore(s => s.overrides);

    const colorOf = (name: string) => hexForId(overrides[name] ?? defaultColorId(name));
    const activeColor = activeCluster ? colorOf(activeCluster) : null;

    // Publish the active cluster's colour app-wide so the sidebar accent can
    // pick it up. Deliberately a different variable from the tabs' --tab-accent
    // (FloatableTab), which is set per tab element — a shared name would leak
    // this colour into panels that carry no cluster.
    useEffect(() => {
        const el = document.documentElement;
        if (activeColor) el.style.setProperty('--cluster-accent', activeColor);
        else el.style.removeProperty('--cluster-accent');
    }, [activeColor]);

    useEffect(() => {
        if (!loaded || initialCheckDone.current) return;
        initialCheckDone.current = true;
        if (clusters.length === 0) {
            setEditingCluster(null);
            setModalOpen(true);
        }
    }, [loaded, clusters]);

    const openAdd = () => { setEditingCluster(null); setModalOpen(true); };
    const openEdit = () => { if (!activeCluster) return; setEditingCluster(activeCluster); setModalOpen(true); };
    const handleClose = () => { setModalOpen(false); setEditingCluster(null); };
    const handleSaved = async (name: string) => {
        await refreshClusters();
        await selectCluster(name);
        handleClose();
    };

    const isOk = !connectionError;

    // The dot carries the cluster's colour identity. Connection health is not
    // lost: on error the dot dims and gains a red ring, and the warning button
    // in the actions row appears alongside it.
    const clusterValueTemplate = (value: string) => {
        if (!value) return <span style={{ color: 'var(--ink3)', fontSize: '13px' }}>Select cluster…</span>;
        const color = colorOf(value);
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span style={{
                    width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                    background: color,
                    opacity: isOk ? 1 : 0.45,
                    boxShadow: isOk ? `0 0 6px ${color}` : '0 0 0 2px var(--red)',
                }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--ink)' }}>
                    {value}
                </span>
            </div>
        );
    };

    // Colours are edited in ClusterModal; the dropdown only displays them.
    const clusterItemTemplate = (value: string) => {
        const color = colorOf(value);
        return (
            <div className="cluster-option">
                <span className="cluster-option__bullet" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                <span className="cluster-option__name">{value}</span>
            </div>
        );
    };

    return (
        <>
            <div id="tour-cluster-area" className="cluster-header">
                <Dropdown
                    value={activeCluster || null}
                    options={clusters}
                    onChange={e => selectCluster(e.value)}
                    placeholder="Select cluster…"
                    className="cluster-header__dropdown"
                    emptyMessage="No clusters yet"
                    valueTemplate={clusterValueTemplate}
                    itemTemplate={clusterItemTemplate}
                />

                <div className="cluster-header__actions">
                    <button className="cluster-header__icon-btn" onClick={openAdd} title="Add Cluster">
                        <VscAdd size={14} />
                    </button>
                    {activeCluster && (
                        <>
                            <button className="cluster-header__icon-btn" onClick={openEdit} title="Edit cluster">
                                <VscEdit size={14} />
                            </button>
                            <button className="cluster-header__icon-btn" onClick={() => openClusterResourceView(activeCluster)} title="Resource Graph">
                                <VscTypeHierarchySub size={14} />
                            </button>
                        </>
                    )}
                    {connectionError && (
                        <>
                            <button
                                className="cluster-header__icon-btn cluster-header__icon-btn--warn"
                                onClick={e => errorPanelRef.current?.toggle(e)}
                                title="Connection error"
                            >
                                <VscWarning size={14} />
                            </button>
                            <OverlayPanel ref={errorPanelRef} className="cluster-error-panel">
                                <div className="cluster-error-panel__header">
                                    <VscWarning className="cluster-error-panel__icon" size={16} />
                                    <span>Connection Error</span>
                                </div>
                                <pre className="cluster-error-panel__detail">{connectionError}</pre>
                            </OverlayPanel>
                        </>
                    )}
                </div>
            </div>

            {modalOpen && (
                <ClusterModal
                    editingName={editingCluster}
                    onClose={handleClose}
                    onSaved={handleSaved}
                    dismissible={clusters.length > 0}
                />
            )}
        </>
    );
}
