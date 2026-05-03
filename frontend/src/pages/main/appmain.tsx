import SideMenu from '../../components/menu/menu';
import TitleBar from '../../components/titlebar/TitleBar';
import DockviewContainer from '../../components/workspace/DockviewContainer';
import { TabProvider } from '../../contexts/TabContext';

function Appmain() {
    return (
        <TabProvider>
            <div id="appmain">
                <TitleBar />
                <div className="appmain-body">
                    <div className="appmain-sidebar">
                        <SideMenu />
                    </div>
                    <div className="appmain-workspace">
                        <DockviewContainer />
                    </div>
                </div>
            </div>
        </TabProvider>
    );
}

export default Appmain;
