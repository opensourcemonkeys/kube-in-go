
import { useEffect, useState } from 'react';
import { PanelMenu } from 'primereact/panelmenu';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMenuItems, viewGroupMap } from './menuItems';

const MENU_STATE_KEY = 'kube-panelmenu-state';

export default function SideMenu() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const activeView = searchParams.get('view') ?? 'pods';
    const items = getMenuItems(navigate, activeView);
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

        