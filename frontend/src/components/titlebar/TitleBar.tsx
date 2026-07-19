import { useEffect, useState } from 'react';
import { VscChromeMinimize, VscChromeMaximize, VscChromeRestore, VscChromeClose, VscCloudUpload, VscCloudDownload, VscTerminal, VscQuestion, VscInfo, VscHubot, VscLayoutSidebarLeft, VscCheck, VscSymbolColor, VscScreenFull } from 'react-icons/vsc';
import { Menubar } from 'primereact/menubar';
import { MenuItem } from 'primereact/menuitem';
import {
    WindowMinimise,
    WindowToggleMaximise,
    Quit,
    BrowserOpenURL,
} from '../../../wailsjs/runtime/runtime';
import { CheckForUpdate } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useInstanceContext } from '../../contexts/InstanceContext';
import { useTabContext } from '../../contexts/TabContext';
import { useAiChatStore } from '../../stores/aiChatStore';
import { useThemeStore, THEMES } from '../../stores/themeStore';
import { useNextStep } from 'nextstepjs';
import AboutModal from '../cluster/AboutModal';

// Re-check for a newer release every 6 hours while the app stays open.
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface TitleBarProps {
    onToggleSidebar?: () => void;
    sidebarOpen?: boolean;
    onToggleCli?: () => void;
}

function TitleBar({ onToggleSidebar, sidebarOpen = true, onToggleCli }: TitleBarProps) {
    const [maximised, setMaximised] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [update, setUpdate] = useState<models.UpdateInfo | null>(null);
    const { selfInfo } = useInstanceContext();
    const { openTerminal, openApplyYaml } = useTabContext();
    const { startNextStep } = useNextStep();
    const toggleAi = useAiChatStore((s) => s.toggle);
    const aiOpen = useAiChatStore((s) => s.open);
    const theme = useThemeStore((s) => s.theme);
    const setTheme = useThemeStore((s) => s.setTheme);

    useEffect(() => {
        const check = () => CheckForUpdate().then(setUpdate).catch(() => { /* offline: ignore */ });
        check();
        const id = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, []);

    // Under a shell that reports real window state (Electron), subscribe to it
    // so the restore icon cannot desync from OS-initiated maximise/snap. Wails
    // and the browser have no such feed and keep the optimistic toggle below.
    const shell = (window as any).__KUBE_INS_SHELL__;
    useEffect(() => {
        if (!shell?.onMaximised) return;
        shell.isMaximised().then(setMaximised);
        return shell.onMaximised(setMaximised);
    }, []);

    const handleMaximise = () => {
        WindowToggleMaximise();
        if (!shell?.onMaximised) setMaximised(m => !m);
    };

    const menuModel: MenuItem[] = [
        {
            label: 'Open',
            items: [
                { label: 'YAML Editor', icon: <VscCloudUpload size={13} />, command: () => openApplyYaml() },
                { label: 'Terminal',    icon: <VscTerminal size={13} />,    command: () => openTerminal() },
                { label: 'CLI Mode',    icon: <VscScreenFull size={13} />,  command: () => onToggleCli?.() },
                { separator: true },
                {
                    label: 'AI Assistant (experimental)',
                    icon: <VscHubot size={13} />,
                    className: aiOpen ? 'tb-menu-active' : undefined,
                    command: () => toggleAi(),
                },
                {
                    label: 'Theme',
                    icon: <VscSymbolColor size={13} />,
                    items: THEMES.map((t) => ({
                        label: t.label,
                        icon: t.id === theme ? <VscCheck size={13} /> : undefined,
                        command: () => setTheme(t.id),
                    })),
                },
            ],
        },
        {
            label: 'Help',
            items: [
                { label: 'Tutorial', icon: <VscQuestion size={13} />, command: () => startNextStep('main') },
                { label: 'About',    icon: <VscInfo size={13} />,     command: () => setAboutOpen(true) },
            ],
        },
    ];

    return (
        <>
            <div className="tb-root">
                {/* Sidebar toggle (far left) */}
                <button
                    className="tb-sidebar-toggle"
                    onClick={onToggleSidebar}
                    title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                    <VscLayoutSidebarLeft size={14} />
                </button>

                {/* Logo + title (fixed left) */}
                <div className="tb-brand">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--teal)' }}>
                        <path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M12 12 V21.5 M4 7 L12 12 L20 7" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" opacity="0.7"/>
                        <circle cx="12" cy="8.6" r="1.7" fill="currentColor"/>
                    </svg>
                    <span className="tb-title">KUBE INSPECTOR</span>
                    {selfInfo && (
                        <span className="tb-instance-name">{selfInfo.name}</span>
                    )}
                </div>

                {/* Menu bar (left, after logo) */}
                <div className="tb-actions">
                    <Menubar model={menuModel} />
                </div>

                {/* Draggable spacer */}
                <div
                    className="tb-drag"
                    role="button"
                    aria-label="Title bar – press Enter to toggle maximise"
                    tabIndex={0}
                    onDoubleClick={handleMaximise}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMaximise(); } }}
                />

                {/* Update available (top-right, before window controls) */}
                {update?.available && (
                    <button
                        className="tb-update"
                        title={`Version ${update.latestVersion} is available — click to download`}
                        onClick={() => BrowserOpenURL(update.downloadUrl)}
                    >
                        <VscCloudDownload size={12} />
                        Update available
                    </button>
                )}

                {/* Window controls */}
                <div className="tb-controls">
                    <button className="tb-btn tb-btn--min" onClick={WindowMinimise} title="Minimise">
                        <VscChromeMinimize size={12} />
                    </button>

                    <button className="tb-btn tb-btn--max" onClick={handleMaximise} title={maximised ? 'Restore' : 'Maximise'}>
                        {maximised ? <VscChromeRestore size={12} /> : <VscChromeMaximize size={12} />}
                    </button>

                    <button className="tb-btn tb-btn--close" onClick={Quit} title="Close">
                        <VscChromeClose size={12} />
                    </button>
                </div>
            </div>

            <AboutModal visible={aboutOpen} onHide={() => setAboutOpen(false)} />
        </>
    );
}

export default TitleBar;
