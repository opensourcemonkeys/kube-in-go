import { DockviewReact, DockviewReadyEvent } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { useTabContext } from '../../contexts/TabContext';
import ViewPanel from './ViewPanel';
import YamlEditorPanel from './YamlEditorPanel';

const components = {
    view: ViewPanel,
    yamlEditor: YamlEditorPanel,
};

export default function DockviewContainer() {
    const { registerApi, openTab } = useTabContext();

    const onReady = (event: DockviewReadyEvent) => {
        registerApi(event.api);
        openTab({ view: 'pods', title: 'Pods', icon: 'pi pi-box' });
    };

    return (
        <DockviewReact
            className="dockview-theme-monolith"
            components={components}
            onReady={onReady}
        />
    );
}
