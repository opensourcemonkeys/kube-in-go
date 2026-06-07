import { useState } from 'react';
import { VscClose } from 'react-icons/vsc';
import { IDockviewPanelHeaderProps } from 'dockview';
import { useInstanceContext } from '../../contexts/InstanceContext';
import InstancePickerMenu from '../transfer/InstancePickerMenu';

const NON_TRANSFERABLE = new Set(['terminal', 'podExec']);

function getComponentType(panelId: string): string {
    if (panelId.startsWith('yaml:')) return 'yamlEditor';
    if (panelId.startsWith('log:')) return 'logViewer';
    if (panelId.startsWith('exec:')) return 'podExec';
    if (panelId.startsWith('terminal-')) return 'terminal';
    if (panelId.startsWith('apply-yaml-')) return 'applyYaml';
    if (panelId.startsWith('policy:')) return 'policyViewer';
    if (panelId.startsWith('configmap-editor:')) return 'configMapEditor';
    if (panelId.startsWith('secret-editor:')) return 'secretEditor';
    if (panelId.startsWith('role-editor:')) return 'roleEditor';
    if (panelId.startsWith('rolebinding-editor:')) return 'roleBindingEditor';
    if (panelId === 'cluster-resource-view') return 'clusterResource';
    return 'view';
}

export default function FloatableTab({ api, containerApi }: IDockviewPanelHeaderProps) {
    const { instances, selfInfo, transferTab } = useInstanceContext();
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

    const componentType = getComponentType(api.id);
    const canTransfer = !NON_TRANSFERABLE.has(componentType);
    const otherInstances = instances.filter(i => i.id !== selfInfo?.id);

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!canTransfer || otherInstances.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        setMenuPos({ x: e.clientX, y: e.clientY });
    };

    const handleTransfer = async (targetId: string) => {
        const panel = containerApi.getPanel(api.id);
        const panelState = (panel as any)?.toJSON?.();
        const params = panel?.params ?? panelState?.params ?? {};

        await transferTab(targetId, {
            componentType,
            title: api.title ?? '',
            params: params as Record<string, any>,
        });

        api.close();
    };

    return (
        <div
            onContextMenu={handleContextMenu}
            style={{
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                padding: '0 2px 0 8px',
                gap: 4,
                userSelect: 'none',
                cursor: 'default',
            }}
        >
            <span
                style={{
                    fontSize: 12,
                    color: 'var(--dv-tab-color, inherit)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 180,
                    flex: 1,
                }}
            >
                {api.title}
            </span>

            <button
                title="Kapat"
                onClick={e => { e.stopPropagation(); api.close(); }}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 3px',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--dv-tab-color, #8a99b3)',
                    opacity: 0,
                    flexShrink: 0,
                    transition: 'opacity 0.15s',
                }}
                className="tab-close-btn"
            >
                <VscClose size={13} />
            </button>

            {menuPos && (
                <InstancePickerMenu
                    instances={otherInstances}
                    position={menuPos}
                    onSelect={handleTransfer}
                    onClose={() => setMenuPos(null)}
                />
            )}
        </div>
    );
}
