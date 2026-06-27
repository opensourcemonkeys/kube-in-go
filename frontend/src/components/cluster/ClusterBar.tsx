import { useState, useEffect, useRef } from 'react';
import {
    VscAdd, VscEdit,
    VscTypeHierarchySub, VscWarning,
} from 'react-icons/vsc';
import { Dropdown } from 'primereact/dropdown';
import { OverlayPanel } from 'primereact/overlaypanel';
import { useClusterContext } from '../../contexts/ClusterContext';
import { useTabContext } from '../../contexts/TabContext';
import ClusterModal from './ClusterModal';

export default function ClusterBar() {
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
            <div id="tour-cluster-area" className="cluster-header">
                <Dropdown
                    value={activeCluster || null}
                    options={clusters}
                    onChange={e => selectCluster(e.value)}
                    placeholder="Select cluster…"
                    className="cluster-header__dropdown"
                    emptyMessage="No clusters yet"
                    valueTemplate={clusterValueTemplate}
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
