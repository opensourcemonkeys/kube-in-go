import SideMenu from '../../components/menu/menu';
import TitleBar from '../../components/titlebar/TitleBar';
import DockviewContainer from '../../components/workspace/DockviewContainer';
import ClusterBar from '../../components/cluster/ClusterBar';
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
                        <div
                            className="flex-shrink-0 overflow-y-auto overflow-x-hidden"
                            style={{
                                width: '240px',
                                background: 'var(--monolith-container-low)',
                                borderRight: '1px solid var(--surface-border)',
                            }}
                        >
                            <SideMenu />
                        </div>
                        <div className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
                            <DockviewContainer />
                        </div>
                    </div>
                </div>
            </TabProvider>
        </ClusterProvider>
    );
}

export default Appmain;
