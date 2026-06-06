import { useState, useEffect, useRef } from 'react';
import {
    VscLayoutSidebarLeft, VscTable, VscAdd, VscEdit,
    VscTypeHierarchySub, VscWarning, VscCloudUpload,
    VscTerminal, VscQuestion, VscInfo,
} from 'react-icons/vsc';
import { Dropdown } from 'primereact/dropdown';
import { OverlayPanel } from 'primereact/overlaypanel';
import { useClusterContext } from '../../contexts/ClusterContext';
import { useTabContext } from '../../contexts/TabContext';
import { useNextStep } from 'nextstepjs';
import ClusterModal from './ClusterModal';
import AboutModal from './AboutModal';

interface ClusterBarProps {
    onToggleSidebar?: () => void;
    sidebarOpen?: boolean;
}

export default function ClusterBar({ onToggleSidebar, sidebarOpen = true }: ClusterBarProps) {
    const { clusters, activeCluster, loaded, connectionError, refreshClusters, selectCluster } = useClusterContext();
    const { openTerminal, openApplyYaml, openClusterResourceView } = useTabContext();
    const { startNextStep } = useNextStep();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCluster, setEditingCluster] = useState<string | null>(null);
    const [aboutOpen, setAboutOpen] = useState(false);
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
                        <button className="cluster-bar__icon-btn" onClick={openClusterResourceView} title="Resource Graph">
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

                {/* Right workspace buttons */}
                <div className="cluster-bar__workspace-btns">
                    <button id="tour-yaml-btn" className="cluster-bar__ws-btn" onClick={openApplyYaml} title="YAML Editor">
                        <VscCloudUpload size={14} />
                        <span>YAML Editor</span>
                    </button>
                    <button id="tour-terminal-btn" className="cluster-bar__ws-btn" onClick={openTerminal} title="Terminal">
                        <VscTerminal size={14} />
                        <span>Terminal</span>
                    </button>
                    <div className="cluster-bar__ws-separator" />
                    <button className="cluster-bar__ws-btn cluster-bar__ws-btn--ghost" onClick={() => startNextStep('main')} title="Tutorial">
                        <VscQuestion size={14} />
                        <span>Tutorial</span>
                    </button>
                    <button className="cluster-bar__ws-btn cluster-bar__ws-btn--ghost" onClick={() => setAboutOpen(true)} title="About">
                        <VscInfo size={14} />
                        <span>About</span>
                    </button>
                </div>
            </div>

            <AboutModal visible={aboutOpen} onHide={() => setAboutOpen(false)} />

            {modalOpen && (
                <ClusterModal
                    editingName={editingCluster}
                    onClose={handleClose}
                    onSaved={handleSaved}
                />
            )}
        </>
    );
}
