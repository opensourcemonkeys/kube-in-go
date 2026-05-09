import SideMenu from '../../components/menu/menu';
import TitleBar from '../../components/titlebar/TitleBar';
import DockviewContainer from '../../components/workspace/DockviewContainer';
import { TabProvider } from '../../contexts/TabContext';

function Appmain() {
    return (
        <TabProvider>
            <div className="flex flex-column h-full overflow-hidden">
                <TitleBar />
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
    );
}

export default Appmain;
