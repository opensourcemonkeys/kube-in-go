import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { VscDesktopDownload } from 'react-icons/vsc';
import { InstanceInfo } from '../../contexts/InstanceContext';
import './InstancePickerMenu.css';

interface Props {
    instances: InstanceInfo[];
    position: { x: number; y: number };
    onSelect: (instanceId: string) => void;
    onClose: () => void;
}

export default function InstancePickerMenu({ instances, position, onSelect, onClose }: Props) {
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

    if (instances.length === 0) return null;

    return createPortal(
        <div
            className="instance-picker-menu"
            ref={menuRef}
            style={{ position: 'fixed', top: position.y, left: position.x }}
        >
            <div className="instance-picker-header">Instance'a Taşı</div>
            {instances.map(inst => (
                <button
                    key={inst.id}
                    className="instance-picker-item"
                    onClick={() => { onSelect(inst.id); onClose(); }}
                >
                    <VscDesktopDownload size={13} />
                    <span>{inst.name}</span>
                </button>
            ))}
        </div>,
        document.body
    );
}
