import { useState, useEffect, useRef } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { OverlayPanel } from 'primereact/overlaypanel';
import { useClusterContext } from '../../contexts/ClusterContext';
import { useTabContext } from '../../contexts/TabContext';
import ClusterModal from './ClusterModal';

export default function ClusterBar() {
    const { clusters, activeCluster, loaded, connectionError, refreshClusters, selectCluster } = useClusterContext();
    const { openTerminal, openApplyYaml, openClusterResourceView } = useTabContext();
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

    const openAdd = () => {
        setEditingCluster(null);
        setModalOpen(true);
    };

    const openEdit = () => {
        if (!activeCluster) return;
        setEditingCluster(activeCluster);
        setModalOpen(true);
    };

    const handleClose = () => {
        setModalOpen(false);
        setEditingCluster(null);
    };

    const handleSaved = async (name: string) => {
        await refreshClusters();
        await selectCluster(name);
        handleClose();
    };

    return (
        <>
            <div className="cluster-bar">
                <i className="pi pi-server cluster-bar__icon" />
                <span className="cluster-bar__label">Cluster</span>

                <div className="cluster-bar__select-group">
                    <Dropdown
                        value={activeCluster || null}
                        options={clusters}
                        onChange={e => selectCluster(e.value)}
                        placeholder="Select cluster..."
                        className="cluster-bar__dropdown"
                        emptyMessage="No clusters yet"
                    />
                    <button
                        className="cluster-bar__edit-btn"
                        onClick={openAdd}
                        title="Add Cluster"
                    >
                        <i className="pi pi-plus" />
                    </button>
                    {activeCluster && (
                        <>
                            <button
                                className="cluster-bar__edit-btn"
                                onClick={openEdit}
                                title="Edit cluster"
                            >
                                <i className="pi pi-pencil" />
                            </button>
                            <button
                                className="cluster-bar__edit-btn"
                                onClick={openClusterResourceView}
                                title="Resource Graph"
                            >
                                <i className="pi pi-sitemap" />
                            </button>
                        </>
                    )}
                    {connectionError && (
                        <>
                            <button
                                className="cluster-bar__warn-btn"
                                onClick={e => errorPanelRef.current?.toggle(e)}
                                title="Connection error"
                            >
                                <i className="pi pi-exclamation-triangle" />
                            </button>
                            <OverlayPanel ref={errorPanelRef} className="cluster-error-panel">
                                <div className="cluster-error-panel__header">
                                    <i className="pi pi-exclamation-triangle cluster-error-panel__icon" />
                                    <span>Connection Error</span>
                                </div>
                                <pre className="cluster-error-panel__detail">{connectionError}</pre>
                            </OverlayPanel>
                        </>
                    )}
                </div>

                <div className="cluster-bar__workspace-btns">
                    <button className="cluster-bar__ws-btn" onClick={openApplyYaml} title="YAML Editor">
                        <i className="pi pi-upload" />
                        <span>YAML Editor</span>
                    </button>
                    <button className="cluster-bar__ws-btn" onClick={openTerminal} title="Terminal">
                        <i className="pi pi-terminal" />
                        <span>Terminal</span>
                    </button>
                </div>
            </div>

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
