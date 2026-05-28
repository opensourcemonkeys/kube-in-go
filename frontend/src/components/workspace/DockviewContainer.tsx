import { useEffect } from 'react';
import { DockviewReact, DockviewReadyEvent } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { useTabContext } from '../../contexts/TabContext';
import ViewPanel from './ViewPanel';
import YamlEditorPanel from './YamlEditorPanel';
import TerminalPanel from '../terminal/TerminalPanel';
import ApplyYamlPanel from './ApplyYamlPanel';
import LogViewerPanel from '../logs/LogViewerPanel';
import PolicyViewerPanel from '../networkpolicy/PolicyViewerPanel';
import ClusterResourcePanel from '../clusterresource/ClusterResourcePanel';
import ConfigMapEditorPanel from '../configmap/ConfigMapEditorPanel';
import SecretEditorPanel from '../secret/SecretEditorPanel';

const components = {
    view: ViewPanel,
    yamlEditor: YamlEditorPanel,
    terminal: TerminalPanel,
    applyYaml: ApplyYamlPanel,
    logViewer: LogViewerPanel,
    policyViewer: PolicyViewerPanel,
    clusterResource: ClusterResourcePanel,
    configMapEditor: ConfigMapEditorPanel,
    secretEditor: SecretEditorPanel,
};

export default function DockviewContainer() {
    const { registerApi, openTab } = useTabContext();

    // Dockview adds `.dv-tab-ghost-drag` to DOM when a tab drag starts (pointer mode).
    // We toggle `body.dv-dragging` so CSS can apply `user-select: none !important`
    // across all elements, preventing text highlight-scanning during drag.
    useEffect(() => {
        const observer = new MutationObserver(() => {
            document.body.classList.toggle('dv-dragging', !!document.querySelector('.dv-tab-ghost-drag'));
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => {
            observer.disconnect();
            document.body.classList.remove('dv-dragging');
        };
    }, []);

    const onReady = (event: DockviewReadyEvent) => {
        registerApi(event.api);
        (event.api as any).updateOptions({ dndStrategy: 'pointer' });
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
