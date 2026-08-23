import { useEffect, useRef } from 'react';
import { VscDashboard } from 'react-icons/vsc';
import { DockviewReact, DockviewReadyEvent, DockviewApi } from 'dockview';
import 'dockview/dist/styles/dockview.css';
import { useTabContext } from '../../contexts/TabContext';
import { useClusterContext } from '../../contexts/ClusterContext';
import { initialPanel, onDragHover, onDragLeave, onPanelFromWindow } from '../../lib/shellWindows';
import {
    dragHover,
    dragLeave,
    dropPanel,
    isCrossWindowDragActive,
    takeDroppedPanel,
} from '../../lib/crossWindowDrop';
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
import ObjectYamlPanel from './ObjectYamlPanel';
import DescribePanel from './DescribePanel';
import DiagnosticsPanel from '../diagnostics/DiagnosticsPanel';
import PortForwardsPanel from '../portforward/PortForwardsPanel';
import { withBoundary } from '../shared/PanelErrorBoundary';

const rawComponents = {
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
    objectYaml: ObjectYamlPanel,
    describe: DescribePanel,
    diagnostics: DiagnosticsPanel,
    portforwards: PortForwardsPanel,
};

// Every panel type gets an error boundary, applied here in one place so a new
// entry above cannot forget one. Without it a single component that throws
// during render unmounts the whole tree — one bad panel whites out the window
// and takes every other open tab with it. Wrapped at module scope so the
// component identities stay stable across renders (a fresh wrapper per render
// would remount every panel).
const components = Object.fromEntries(
    Object.entries(rawComponents).map(([key, Component]) => [key, withBoundary(Component as any, key)]),
);

export default function DockviewContainer() {
    const { registerApi, openTab, openReceivedPanel } = useTabContext();
    const { activeCluster } = useClusterContext();
    const apiRef = useRef<DockviewApi | null>(null);

    // Place a panel dropped in from another window at the spot dockview's
    // overlay was showing. `takeDroppedPanel` is non-null only for our own
    // synthetic cross-window drop (crossWindowDrop.ts), so genuine external
    // drops are ignored. Create at the default position, then move onto the
    // resolved group — dockview gives us the group + edge, but no addPanel
    // position that reproduces a header/tab drop directly.
    const placeDrop = (event: any) => {
        const panel = takeDroppedPanel();
        if (!panel) return;
        const api = apiRef.current;
        if (!api) return;

        let addedId: string | null = null;
        const capture = api.onDidAddPanel(p => { addedId = p.id; });
        openReceivedPanel(panel);
        capture.dispose();

        if (addedId && event.group) {
            api.getPanel(addedId)?.api.moveTo({ group: event.group, position: event.position });
        }
    };

    // Cross-window drag wiring (Electron only; no-ops elsewhere). Main forwards
    // the cursor of a drag hovering this window so we can drive dockview's drop
    // overlay, and forwards the panel itself on release.
    useEffect(() => {
        const offHover = onDragHover((x, y) => dragHover(x, y));
        const offLeave = onDragLeave(() => dragLeave());
        const offPanel = onPanelFromWindow(panel => {
            // A drag landing here places via the live overlay; a plain
            // send-to-window (right-click menu) has no overlay, so default-place.
            if (!dropPanel(panel)) openReceivedPanel(panel);
        });
        return () => { offHover?.(); offLeave?.(); offPanel?.(); };
    }, [openReceivedPanel]);

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
        apiRef.current = event.api;
        registerApi(event.api);
        (event.api as any).updateOptions({ dndStrategy: 'pointer' });

        // dockview only shows overlays for a drag it recognises; a cross-window
        // drag is "external" (its PanelTransfer lives in the other renderer), so
        // it asks here whether to accept. Accept only while one is in flight.
        event.api.onUnhandledDragOverEvent(e => {
            if (isCrossWindowDragActive()) e.accept();
        });

        // A window created by dragging a tab out opens with that tab alone;
        // everything else starts on Overview.
        const seed = initialPanel();
        if (seed) openReceivedPanel(seed);
        else openTab({ view: 'overview', title: 'Overview', clusterName: activeCluster, icon: <VscDashboard size={16} /> });
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
            onDidDrop={placeDrop}
        />
    );
}
