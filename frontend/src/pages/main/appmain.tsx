import SideMenu from '../../components/menu/menu';
import TitleBar from '../../components/titlebar/TitleBar';
import DockviewContainer from '../../components/workspace/DockviewContainer';
import ClusterBar from '../../components/cluster/ClusterBar';
import AssistantPanel from '../../components/assistant/AssistantPanel';
import { TabProvider } from '../../contexts/TabContext';
import { ClusterProvider } from '../../contexts/ClusterContext';

function Appmain() {
    return (
        <ClusterProvider>
            <TabProvider>
                <div className="flex flex-column h-full overflow-hidden">
                    <TitleBar />
                    <ClusterBar />
                    <div className="flex flex-1 overflow-hidden min-h-0">
                        {/* Resource Explorer Sidebar */}
                        <div
                            className="flex-shrink-0 overflow-y-auto overflow-x-hidden"
                            style={{
                                width: '240px',
                                background: 'var(--monolith-container-low)',
                                borderRight: '1px solid var(--surface-border)',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <SideMenu />
                        </div>

                        {/* Main Workspace */}
                        <div className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
                            <DockviewContainer />
                        </div>
                    </div>

                    {/* Status Bar - TODO: implement as feature */}
                    {/* <footer className="app-footer">
                        <span className="app-footer__status">
                            kube-ins
                        </span>
                    </footer> */}
                </div>
                <AssistantPanel />
            </TabProvider>
        </ClusterProvider>
    );
}

export default Appmain;
