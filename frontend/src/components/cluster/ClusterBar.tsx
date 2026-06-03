import { useState, useEffect, useRef } from 'react';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
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
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="3" width="12" height="10" rx="1.5"/>
                        <path d="M6 3v10"/>
                    </svg>
                </button>
                <div className="cluster-bar__ws-separator" />
                {/* Split chip: CLUSTER label + dropdown */}
                <div id="tour-cluster-area" className="cluster-bar__chip">
                    <div className="cluster-bar__chip-label">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                            <rect x="2" y="2.5" width="12" height="11" rx="1.5"/>
                            <path d="M2 6h12M5.5 2.5v11"/>
                        </svg>
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
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10"/></svg>
                </button>
                {activeCluster && (
                    <>
                        <button className="cluster-bar__icon-btn" onClick={openEdit} title="Edit cluster">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 13.5h2L13 5l-2-2-8.5 8.5z"/></svg>
                        </button>
                        <button className="cluster-bar__icon-btn" onClick={openClusterResourceView} title="Resource Graph">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="3.5" cy="8" r="1.6"/><circle cx="12.5" cy="4" r="1.6"/><circle cx="12.5" cy="12" r="1.6"/><path d="M5 7.3l6-2.6M5 8.7l6 2.6"/></svg>
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
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2L14.5 14H1.5z"/><path d="M8 7v3M8 12v.4"/></svg>
                        </button>
                        <OverlayPanel ref={errorPanelRef} className="cluster-error-panel">
                            <div className="cluster-error-panel__header">
                                <WarningAmberOutlined className="cluster-error-panel__icon" style={{ fontSize: '1rem' }} />
                                <span>Connection Error</span>
                            </div>
                            <pre className="cluster-error-panel__detail">{connectionError}</pre>
                        </OverlayPanel>
                    </>
                )}

                {/* Right workspace buttons */}
                <div className="cluster-bar__workspace-btns">
                    <button id="tour-yaml-btn" className="cluster-bar__ws-btn" onClick={openApplyYaml} title="YAML Editor">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#3fc8b4" strokeWidth="1.5"><path d="M8 11V3M4.5 6.5L8 3l3.5 3.5M3 13h10"/></svg>
                        <span>YAML Editor</span>
                    </button>
                    <button id="tour-terminal-btn" className="cluster-bar__ws-btn" onClick={openTerminal} title="Terminal">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#3fc8b4" strokeWidth="1.5"><rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="M4 7l2 2-2 2M8.5 11H11"/></svg>
                        <span>Terminal</span>
                    </button>
                    <div className="cluster-bar__ws-separator" />
                    <button className="cluster-bar__ws-btn cluster-bar__ws-btn--ghost" onClick={() => startNextStep('main')} title="Tutorial">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="6"/><path d="M6.4 6.4a1.7 1.7 0 1 1 2 2.4V10M8 12v.4"/></svg>
                        <span>Tutorial</span>
                    </button>
                    <button className="cluster-bar__ws-btn cluster-bar__ws-btn--ghost" onClick={() => setAboutOpen(true)} title="About">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.4"/></svg>
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
