import { useEffect } from 'react';
import { VscPackage } from 'react-icons/vsc';
import { DockviewReact, DockviewReadyEvent } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { useTabContext } from '../../contexts/TabContext';
import { useClusterContext } from '../../contexts/ClusterContext';
import FloatableTab from './FloatableTab';
import ViewPanel from './ViewPanel';
import YamlEditorPanel from './YamlEditorPanel';
import TerminalPanel from '../terminal/TerminalPanel';
import ApplyYamlPanel from './ApplyYamlPanel';
import LogViewerPanel from '../logs/LogViewerPanel';
import PolicyViewerPanel from '../networkpolicy/PolicyViewerPanel';
import ClusterResourcePanel from '../clusterresource/ClusterResourcePanel';
import ConfigMapEditorPanel from '../configmap/ConfigMapEditorPanel';
import SecretEditorPanel from '../secret/SecretEditorPanel';
import PodExecPanel from '../pod/PodExecPanel';
import RoleEditorPanel from '../role/RoleEditorPanel';
import RoleBindingEditorPanel from '../rolebinding/RoleBindingEditorPanel';

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
    podExec: PodExecPanel,
    roleEditor: RoleEditorPanel,
    roleBindingEditor: RoleBindingEditorPanel,
};

export default function DockviewContainer() {
    const { registerApi, openTab } = useTabContext();
    const { activeCluster } = useClusterContext();

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
        openTab({ view: 'pods', title: 'Pods', clusterName: activeCluster, icon: <VscPackage size={16} /> });
    };

    return (
        <DockviewReact
            className="dockview-theme-monolith"
            // Prevent dockview from adding `dockview-theme-abyss` (its default) to the
            // inner dv-shell element, which would set --dv-separator-border to a blue color.
            theme={{ name: 'monolith', className: 'dockview-theme-monolith' } as any}
            components={components}
            defaultTabComponent={FloatableTab}
            floatingGroupBounds="boundedWithinViewport"
            onReady={onReady}
        />
    );
}
