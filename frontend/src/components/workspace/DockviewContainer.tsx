import { DockviewReact, DockviewReadyEvent } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { useTabContext } from '../../contexts/TabContext';
import ViewPanel from './ViewPanel';
import YamlEditorPanel from './YamlEditorPanel';
import TerminalPanel from '../terminal/TerminalPanel';
import ApplyYamlPanel from './ApplyYamlPanel';

const components = {
    view: ViewPanel,
    yamlEditor: YamlEditorPanel,
    terminal: TerminalPanel,
    applyYaml: ApplyYamlPanel,
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
