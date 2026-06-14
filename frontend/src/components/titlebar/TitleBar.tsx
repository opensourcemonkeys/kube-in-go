import { useState } from 'react';
import { VscChromeMinimize, VscChromeMaximize, VscChromeRestore, VscChromeClose, VscCloudUpload, VscTerminal, VscQuestion, VscInfo } from 'react-icons/vsc';
import { Menubar } from 'primereact/menubar';
import { MenuItem } from 'primereact/menuitem';
import {
    WindowMinimise,
    WindowToggleMaximise,
    Quit,
} from '../../../wailsjs/runtime/runtime';
import { useInstanceContext } from '../../contexts/InstanceContext';
import { useTabContext } from '../../contexts/TabContext';
import { useNextStep } from 'nextstepjs';
import AboutModal from '../cluster/AboutModal';

function TitleBar() {
    const [maximised, setMaximised] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const { selfInfo } = useInstanceContext();
    const { openTerminal, openApplyYaml } = useTabContext();
    const { startNextStep } = useNextStep();

    const handleMaximise = () => {
        WindowToggleMaximise();
        setMaximised(m => !m);
    };

    const menuModel: MenuItem[] = [
        {
            label: 'Open',
            items: [
                { label: 'YAML Editor', icon: <VscCloudUpload size={13} />, command: () => openApplyYaml() },
                { label: 'Terminal',    icon: <VscTerminal size={13} />,    command: () => openTerminal() },
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
                {/* Logo + title (fixed left) */}
                <div className="tb-brand">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z" stroke="#3fc8b4" strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M12 12 V21.5 M4 7 L12 12 L20 7" stroke="#3fc8b4" strokeWidth="1.3" strokeLinejoin="round" opacity="0.7"/>
                        <circle cx="12" cy="8.6" r="1.7" fill="#3fc8b4"/>
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
