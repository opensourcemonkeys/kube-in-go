import { useState, useEffect } from 'react';
import { VscChevronDown, VscTable, VscGlobe, VscSettings, VscFolder, VscExtensions } from 'react-icons/vsc';
import { useTabContext } from '../../contexts/TabContext';
import { NAV_GROUPS, VIEW_GROUP, NavItem } from './menuItems';

const SIDEBAR_STATE_KEY = 'kube-sidebar-state';

const GROUP_ICONS: Record<string, React.ReactNode> = {
    workloads:  <VscTable size={13} />,
    networking: <VscGlobe size={13} />,
    config:     <VscSettings size={13} />,
    storage:    <VscFolder size={13} />,
    cluster:    <VscExtensions size={13} />,
};

export default function SideMenu() {
    const { openTab } = useTabContext();
    const [activeView, setActiveView] = useState('pods');
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(SIDEBAR_STATE_KEY) ?? '{}');
            return Object.keys(saved).length > 0 ? saved : { workloads: true };
        } catch { return { workloads: true }; }
    });

    const navigate = (item: NavItem) => {
        setActiveView(item.view);
        openTab({ view: item.view, title: item.label, icon: item.icon });
    };

    const toggleGroup = (key: string) => {
        setExpanded(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(next));
            return next;
        });
    };

    useEffect(() => {
        const grp = VIEW_GROUP[activeView];
        if (!grp) return;
        setExpanded(prev => {
            if (prev[grp]) return prev;
            const next = { ...prev, [grp]: true };
            localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(next));
            return next;
        });
    }, [activeView]);

    return (
        <nav id="tour-sidebar" className="sidebar-nav">
            {NAV_GROUPS.map(group => (
                <div key={group.key} className="sidebar-section">
                    <button
                        className="sidebar-section__toggle"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={expanded[group.key]}
                    >
                        <VscChevronDown
                            className="sidebar-section__chevron"
                            style={{ transform: expanded[group.key] ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                            size={11}
                        />
                        <span className="sidebar-section__badge">
                            <span className="sidebar-section__badge-icon">{GROUP_ICONS[group.key]}</span>
                            <span className="sidebar-section__badge-label">{group.label}</span>
                        </span>
                    </button>
                    {expanded[group.key] && (
                        <div className="sidebar-section__items">
                            {group.items.map(item => (
                                <button
                                    key={item.view}
                                    className={`sidebar-item${activeView === item.view ? ' sidebar-item--active' : ''}`}
                                    onClick={() => navigate(item)}
                                >
                                    <span className="sidebar-item__icon">{item.icon}</span>
                                    <span className="sidebar-item__label">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </nav>
    );
}
