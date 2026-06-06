import { useState } from 'react';
import { VscChromeMinimize, VscChromeMaximize, VscChromeRestore, VscChromeClose } from 'react-icons/vsc';
import {
    WindowMinimise,
    WindowToggleMaximise,
    Quit,
} from '../../../wailsjs/runtime/runtime';

function TitleBar() {
    const [maximised, setMaximised] = useState(false);

    const handleMaximise = () => {
        WindowToggleMaximise();
        setMaximised(m => !m);
    };

    return (
        <div className="tb-root">
            {/* Draggable region */}
            <div
                className="tb-drag"
                role="button"
                aria-label="Title bar – press Enter to toggle maximise"
                tabIndex={0}
                onDoubleClick={handleMaximise}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMaximise(); } }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z" stroke="#3fc8b4" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M12 12 V21.5 M4 7 L12 12 L20 7" stroke="#3fc8b4" strokeWidth="1.3" strokeLinejoin="round" opacity="0.7"/>
                    <circle cx="12" cy="8.6" r="1.7" fill="#3fc8b4"/>
                </svg>
                <span className="tb-title">KUBE-INS</span>
            </div>

            {/* Action buttons */}
            <div className="tb-actions">
            </div>

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
    );
}

export default TitleBar;
