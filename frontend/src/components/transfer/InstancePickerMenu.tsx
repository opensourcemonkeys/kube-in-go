import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { VscDesktopDownload, VscMultipleWindows, VscLinkExternal } from 'react-icons/vsc';
import './InstancePickerMenu.css';
import { useT } from '../../i18n/useT';

/**
 * Where a dragged/right-clicked tab can go.
 *
 * - `undock`   a new window of this process (id unused)
 * - `window`   another window of this process — moved over Electron IPC
 * - `instance` another running process — moved over the ipc hub (TransferTab)
 */
export type TabTarget =
    | { kind: 'undock' }
    | { kind: 'window'; id: number; label: string }
    | { kind: 'instance'; id: string; label: string };

interface Props {
    targets: TabTarget[];
    position: { x: number; y: number };
    onSelect: (target: TabTarget) => void;
    onClose: () => void;
}

const ICONS = {
    undock: VscLinkExternal,
    window: VscMultipleWindows,
    instance: VscDesktopDownload,
};

const keyOf = (t: TabTarget) => (t.kind === 'undock' ? 'undock' : `${t.kind}:${t.id}`);

export default function InstancePickerMenu({ targets, position, onSelect, onClose }: Props) {
    const t = useT();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick, true);
        return () => document.removeEventListener('mousedown', handleClick, true);
    }, [onClose]);

    if (targets.length === 0) return null;

    const windows = targets.filter(t => t.kind === 'window');
    const instances = targets.filter(t => t.kind === 'instance');

    const item = (target: TabTarget, label: string) => {
        const Icon = ICONS[target.kind];
        return (
            <button
                key={keyOf(target)}
                className="instance-picker-item"
                onClick={() => { onSelect(target); onClose(); }}
            >
                <Icon size={13} />
                <span>{label}</span>
            </button>
        );
    };

    return createPortal(
        <div
            className="instance-picker-menu"
            ref={menuRef}
            style={{ position: 'fixed', top: position.y, left: position.x }}
        >
            {targets.some(t => t.kind === 'undock') &&
                item({ kind: 'undock' }, t('panels:tabMenu.undock'))}

            {windows.length > 0 && <div className="instance-picker-header">{t('panels:tabMenu.toWindow')}</div>}
            {windows.map(t => item(t, (t as any).label))}

            {instances.length > 0 && <div className="instance-picker-header">{t('panels:tabMenu.toInstance')}</div>}
            {instances.map(t => item(t, (t as any).label))}
        </div>,
        document.body,
    );
}
