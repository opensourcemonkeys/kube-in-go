import { useState, useRef } from 'react';
import { NextStepProvider, NextStepReact } from 'nextstepjs';
import SideMenu from '../../components/menu/menu';
import TitleBar from '../../components/titlebar/TitleBar';
import DockviewContainer from '../../components/workspace/DockviewContainer';
import ClusterBar from '../../components/cluster/ClusterBar';
import { TabProvider } from '../../contexts/TabContext';
import { ClusterProvider } from '../../contexts/ClusterContext';
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
                    <TabProvider>
                        <div className="flex flex-column h-full overflow-hidden">
                            <TitleBar />
                            <ClusterBar onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
                            <div className="flex flex-1 overflow-hidden min-h-0" style={{ position: 'relative' }}>

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

                                {/* Resource Explorer Sidebar */}
                                <div
                                    className="overflow-hidden flex-shrink-0"
                                    style={sidebarOpen ? {
                                        width: '240px',
                                        transition: 'width 0.2s ease',
                                        background: 'var(--panel)',
                                        borderRight: '1px solid var(--line)',
                                    } : {
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        height: '100%',
                                        zIndex: 100,
                                        width: hovered ? '240px' : '0',
                                        transition: 'width 0.2s ease',
                                        background: 'var(--panel)',
                                        borderRight: '1px solid var(--line)',
                                        boxShadow: hovered ? '4px 0 16px rgba(0,0,0,0.4)' : 'none',
                                    }}
                                    onMouseEnter={onEnter}
                                    onMouseLeave={onLeave}
                                >
                                    <div style={{ width: '240px', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
                                        <SideMenu />
                                    </div>
                                </div>

                                {/* Main Workspace */}
                                <div id="tour-workspace" className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
                                    <DockviewContainer />
                                </div>
                            </div>
                        </div>
                    </TabProvider>
                </ClusterProvider>
            </NextStepReact>
        </NextStepProvider>
    );
}

export default Appmain;
