import { NextStepProvider, NextStepReact } from 'nextstepjs';
import SideMenu from '../../components/menu/menu';
import TitleBar from '../../components/titlebar/TitleBar';
import DockviewContainer from '../../components/workspace/DockviewContainer';
import ClusterBar from '../../components/cluster/ClusterBar';
import { TabProvider } from '../../contexts/TabContext';
import { ClusterProvider } from '../../contexts/ClusterContext';
import { appTour } from '../../lib/tourSteps';
import TourCard from '../../components/tour/TourCard';

function Appmain() {
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
                            <ClusterBar />
                            <div className="flex flex-1 overflow-hidden min-h-0">
                                {/* Resource Explorer Sidebar */}
                                <div
                                    className="flex-shrink-0 overflow-y-auto overflow-x-hidden"
                                    style={{
                                        width: '240px',
                                        background: 'var(--panel)',
                                        borderRight: '1px solid var(--line)',
                                    }}
                                >
                                    <SideMenu />
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
