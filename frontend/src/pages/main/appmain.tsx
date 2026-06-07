import { useState, useRef } from 'react';
import { NextStepProvider, NextStepReact } from 'nextstepjs';
import SideMenu from '../../components/menu/menu';
import TitleBar from '../../components/titlebar/TitleBar';
import DockviewContainer from '../../components/workspace/DockviewContainer';
import TabInstanceBridge from '../../components/workspace/TabInstanceBridge';
import ClusterBar from '../../components/cluster/ClusterBar';
import { TabProvider } from '../../contexts/TabContext';
import { ClusterProvider } from '../../contexts/ClusterContext';
import { InstanceProvider } from '../../contexts/InstanceContext';
import { appTour } from '../../lib/tourSteps';
import TourCard from '../../components/tour/TourCard';

const SIDEBAR_OPEN_KEY = 'kube-sidebar-open';

function Appmain() {
    const [sidebarOpen, setSidebarOpen] = useState(() =>
        localStorage.getItem(SIDEBAR_OPEN_KEY) !== 'false'
    );
    const [hovered, setHovered] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const toggleSidebar = () => {
        setSidebarOpen(prev => {
            localStorage.setItem(SIDEBAR_OPEN_KEY, String(!prev));
            return !prev;
        });
    };

    const onEnter = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setHovered(true);
    };

    const onLeave = () => {
        closeTimer.current = setTimeout(() => setHovered(false), 250);
    };

    return (
        <NextStepProvider>
            <NextStepReact
                steps={appTour}
                shadowRgb="0, 0, 0"
                shadowOpacity="0.55"
                cardTransition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 20
                }}
                cardComponent={TourCard}
                scrollToTop={false}
                disableConsoleLogs
            >
                <ClusterProvider>
                    <InstanceProvider>
                    <TabProvider>
                        <TabInstanceBridge />
                        <div className="flex flex-column overflow-hidden" style={{ height: '100vh' }}>
                            <TitleBar />
                            <ClusterBar onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
                            <div className="flex-1 min-h-0" style={{ position: 'relative', overflow: 'hidden' }}>

                                {/* Hover trigger zone — only active when sidebar is collapsed */}
                                {!sidebarOpen && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            width: '6px',
                                            height: '100%',
                                            zIndex: 200,
                                        }}
                                        onMouseEnter={onEnter}
                                    />
                                )}

                                {/* Resource Explorer Sidebar — always absolute so it never affects workspace layout */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        height: '100%',
                                        zIndex: sidebarOpen ? 1 : 100,
                                        width: sidebarOpen ? '240px' : (hovered ? '240px' : '0'),
                                        overflowY: 'auto',
                                        overflowX: 'hidden',
                                        transition: 'width 0.2s ease',
                                        background: 'var(--panel)',
                                        borderRight: '1px solid var(--line)',
                                        boxShadow: !sidebarOpen && hovered ? '4px 0 16px rgba(0,0,0,0.4)' : 'none',
                                    }}
                                    onMouseEnter={onEnter}
                                    onMouseLeave={onLeave}
                                >
                                    <SideMenu />
                                </div>

                                {/* Main Workspace — shifts right only when sidebar is open */}
                                <div
                                    id="tour-workspace"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: sidebarOpen ? '240px' : '0',
                                        right: 0,
                                        bottom: 0,
                                        overflow: 'hidden',
                                        transition: 'left 0.2s ease',
                                    }}
                                >
                                    <DockviewContainer />
                                </div>
                            </div>
                        </div>
                    </TabProvider>
                    </InstanceProvider>
                </ClusterProvider>
            </NextStepReact>
        </NextStepProvider>
    );
}

export default Appmain;
