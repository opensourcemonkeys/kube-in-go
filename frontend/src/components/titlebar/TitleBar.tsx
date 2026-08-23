import { useEffect, useState } from 'react';
import { VscChromeMinimize, VscChromeMaximize, VscChromeRestore, VscChromeClose, VscCloudUpload, VscCloudDownload, VscTerminal, VscQuestion, VscInfo, VscHubot, VscLayoutSidebarLeft, VscCheck, VscSymbolColor, VscScreenFull, VscPulse, VscArrowSwap, VscGlobe } from 'react-icons/vsc';
import { Menubar } from 'primereact/menubar';
import { MenuItem } from 'primereact/menuitem';
import {
    WindowMinimise,
    WindowToggleMaximise,
    Quit,
} from '../../../wailsjs/runtime/runtime';
import { CheckForUpdate } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import { useClusterContext } from '../../contexts/ClusterContext';
import { useAiChatStore } from '../../stores/aiChatStore';
import { useThemeStore, THEMES } from '../../stores/themeStore';
import { useLocaleStore, LOCALES } from '../../stores/localeStore';
import { useT } from '../../i18n/useT';
import { useNextStep } from 'nextstepjs';
import AboutModal from '../cluster/AboutModal';
import UpdateModal from './UpdateModal';
import PortForwardPill from './PortForwardPill';

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
    const [updateOpen, setUpdateOpen] = useState(false);
    const [update, setUpdate] = useState<models.UpdateInfo | null>(null);
    const { openTerminal, openApplyYaml, openDiagnostics, openPortForwards } = useTabContext();
    const { activeCluster } = useClusterContext();
    const { startNextStep } = useNextStep();
    const toggleAi = useAiChatStore((s) => s.toggle);
    const aiOpen = useAiChatStore((s) => s.open);
    const theme = useThemeStore((s) => s.theme);
    const setTheme = useThemeStore((s) => s.setTheme);
    const locale = useLocaleStore((s) => s.locale);
    const setLocale = useLocaleStore((s) => s.setLocale);
    const t = useT();

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
            label: t('nav:menu.open'),
            items: [
                { label: t('nav:menu.yamlEditor'), icon: <VscCloudUpload size={13} />, command: () => openApplyYaml(activeCluster) },
                { label: t('nav:menu.terminal'),   icon: <VscTerminal size={13} />,    command: () => openTerminal(activeCluster) },
                { label: t('nav:menu.cliMode'),    icon: <VscScreenFull size={13} />,  command: () => onToggleCli?.() },
                { label: t('nav:menu.portForwards'), icon: <VscArrowSwap size={13} />, command: () => openPortForwards() },
                { separator: true },
                {
                    label: t('nav:menu.aiAssistant'),
                    icon: <VscHubot size={13} />,
                    className: aiOpen ? 'tb-menu-active' : undefined,
                    command: () => toggleAi(),
                },
                {
                    label: t('settings:theme.label'),
                    icon: <VscSymbolColor size={13} />,
                    // Theme and locale names are proper nouns / endonyms — they
                    // are the same in every catalog and stay out of i18n.
                    items: THEMES.map((th) => ({
                        label: th.label,
                        icon: th.id === theme ? <VscCheck size={13} /> : undefined,
                        command: () => setTheme(th.id),
                    })),
                },
                {
                    label: t('settings:language.label'),
                    icon: <VscGlobe size={13} />,
                    items: LOCALES.map((l) => ({
                        label: l.label,
                        icon: l.id === locale ? <VscCheck size={13} /> : undefined,
                        command: () => setLocale(l.id),
                    })),
                },
            ],
        },
        {
            label: t('nav:menu.help'),
            items: [
                { label: t('nav:menu.tutorial'),    icon: <VscQuestion size={13} />, command: () => startNextStep('main') },
                { label: t('nav:menu.diagnostics'), icon: <VscPulse size={13} />,    command: () => openDiagnostics() },
                { label: t('nav:menu.about'),       icon: <VscInfo size={13} />,     command: () => setAboutOpen(true) },
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
                    title={sidebarOpen ? t('nav:window.collapseSidebar') : t('nav:window.expandSidebar')}
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
                </div>

                {/* Menu bar (left, after logo). PrimeReact 10.9.7 has no
                    `breakpoint` prop; its theme collapses this to a hamburger
                    below a 960px viewport. The tb-actions rules in
                    theme-monolith.css neutralise that so the two-item bar stays
                    horizontal at any width. */}
                <div className="tb-actions">
                    <Menubar model={menuModel} />
                </div>

                {/* Draggable spacer */}
                <div
                    className="tb-drag"
                    role="button"
                    aria-label={t('nav:window.dragHint')}
                    tabIndex={0}
                    onDoubleClick={handleMaximise}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMaximise(); } }}
                />

                {/* Active tunnels (top-right, left of the update pill). Renders
                    nothing when there are none. */}
                <PortForwardPill onOpenPanel={openPortForwards} />

                {/* Update available (top-right, before window controls) */}
                {update?.available && (
                    <button
                        className="tb-update"
                        title={t('nav:window.updateTooltip', { version: update.latestVersion })}
                        onClick={() => setUpdateOpen(true)}
                    >
                        <VscCloudDownload size={12} />
                        {t('nav:window.updateAvailable')}
                    </button>
                )}

                {/* Window controls */}
                <div className="tb-controls">
                    <button className="tb-btn tb-btn--min" onClick={WindowMinimise} title={t('nav:window.minimise')}>
                        <VscChromeMinimize size={12} />
                    </button>

                    <button className="tb-btn tb-btn--max" onClick={handleMaximise} title={maximised ? t('nav:window.restore') : t('nav:window.maximise')}>
                        {maximised ? <VscChromeRestore size={12} /> : <VscChromeMaximize size={12} />}
                    </button>

                    <button className="tb-btn tb-btn--close" onClick={Quit} title={t('nav:window.close')}>
                        <VscChromeClose size={12} />
                    </button>
                </div>
            </div>

            <AboutModal visible={aboutOpen} onHide={() => setAboutOpen(false)} onDiagnostics={openDiagnostics} />

            {update?.available && (
                <UpdateModal visible={updateOpen} onHide={() => setUpdateOpen(false)} info={update} />
            )}
        </>
    );
}

export default TitleBar;
