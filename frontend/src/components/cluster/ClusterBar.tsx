import { useState, useEffect, useRef } from 'react';
import {
    VscLayoutSidebarLeft, VscTable, VscAdd, VscEdit,
    VscTypeHierarchySub, VscWarning,
} from 'react-icons/vsc';
import { Dropdown } from 'primereact/dropdown';
import { OverlayPanel } from 'primereact/overlaypanel';
import { useClusterContext } from '../../contexts/ClusterContext';
import { useTabContext } from '../../contexts/TabContext';
import ClusterModal from './ClusterModal';

interface ClusterBarProps {
    onToggleSidebar?: () => void;
    sidebarOpen?: boolean;
}

export default function ClusterBar({ onToggleSidebar, sidebarOpen = true }: ClusterBarProps) {
    const { clusters, activeCluster, loaded, connectionError, refreshClusters, selectCluster } = useClusterContext();
    const { openClusterResourceView } = useTabContext();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCluster, setEditingCluster] = useState<string | null>(null);
    const initialCheckDone = useRef(false);
    const errorPanelRef = useRef<OverlayPanel>(null);

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

    const clusterValueTemplate = (value: string) => {
        if (!value) return <span style={{ color: 'var(--ink3)', fontSize: '13px' }}>Select cluster…</span>;
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: isOk ? 'var(--green)' : 'var(--red)',
                    boxShadow: isOk ? '0 0 6px var(--green)' : '0 0 6px var(--red)',
                }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--ink)' }}>
                    {value}
                </span>
            </div>
        );
    };

    return (
        <>
            <div className="cluster-bar">
                {/* Sidebar toggle */}
                <button
                    className="cluster-bar__icon-btn"
                    onClick={onToggleSidebar}
                    title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                    <VscLayoutSidebarLeft size={14} />
                </button>
                <div className="cluster-bar__ws-separator" />
                {/* Split chip: CLUSTER label + dropdown */}
                <div id="tour-cluster-area" className="cluster-bar__chip">
                    <div className="cluster-bar__chip-label">
                        <VscTable size={13} />
                        <span>CLUSTER</span>
                    </div>
                    <Dropdown
                        value={activeCluster || null}
                        options={clusters}
                        onChange={e => selectCluster(e.value)}
                        placeholder="Select cluster…"
                        className="cluster-bar__dropdown"
                        emptyMessage="No clusters yet"
                        valueTemplate={clusterValueTemplate}
                    />
                </div>

                {/* Icon buttons */}
                <button className="cluster-bar__icon-btn" onClick={openAdd} title="Add Cluster">
                    <VscAdd size={14} />
                </button>
                {activeCluster && (
                    <>
                        <button className="cluster-bar__icon-btn" onClick={openEdit} title="Edit cluster">
                            <VscEdit size={14} />
                        </button>
                        <button className="cluster-bar__icon-btn" onClick={() => openClusterResourceView(activeCluster)} title="Resource Graph">
                            <VscTypeHierarchySub size={14} />
                        </button>
                    </>
                )}
                {connectionError && (
                    <>
                        <button
                            className="cluster-bar__icon-btn cluster-bar__icon-btn--warn"
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
