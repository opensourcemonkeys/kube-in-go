import { useEffect, useState } from 'react';
import { PanelMenu } from 'primereact/panelmenu';
import { getMenuItems, viewGroupMap } from './menuItems';
import { useTabContext } from '../../contexts/TabContext';

const MENU_STATE_KEY = 'kube-panelmenu-state';

export default function SideMenu() {
    const { openTab, openTerminal, openApplyYaml } = useTabContext();
    const [activeView, setActiveView] = useState('pods');
    const items = getMenuItems(openTab, setActiveView, activeView);

    const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>(() => {
        const defaultGroup = viewGroupMap[activeView] ?? 'workloads';
        try {
            const saved = JSON.parse(localStorage.getItem(MENU_STATE_KEY) ?? '{}');
            return Object.keys(saved).length > 0 ? saved : { [defaultGroup]: true };
        } catch {
            return { [defaultGroup]: true };
        }
    });

    useEffect(() => {
        const activeGroup = viewGroupMap[activeView] ?? 'workloads';
        setExpandedKeys((prev) => {
            const nextValue = { ...prev, [activeGroup]: true };
            localStorage.setItem(MENU_STATE_KEY, JSON.stringify(nextValue));
            return nextValue;
        });
    }, [activeView]);

    const handleExpandedKeysChange = (value: Record<string, boolean>) => {
        const nextValue = value ?? {};
        setExpandedKeys(nextValue);
        localStorage.setItem(MENU_STATE_KEY, JSON.stringify(nextValue));
    };

    return (
        <div className="card justify-content-center">
            <div className="menu-actions flex gap-2">
                <button className="menu-action-btn" onClick={openApplyYaml} title="YAML Editor">
                    <i className="pi pi-upload" />
                    <span>YAML Editor</span>
                </button>
                <button className="menu-action-btn" onClick={openTerminal} title="New Terminal">
                    <i className="pi pi-terminal" />
                    <span>Terminal</span>
                </button>
            </div>
            <PanelMenu
                model={items}
                className="w-full"
                multiple
                expandedKeys={expandedKeys}
                onExpandedKeysChange={handleExpandedKeysChange}
            />
        </div>
    );
}
