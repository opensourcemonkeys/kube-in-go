import { useState } from 'react';
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
            <div className="tb-drag" onDoubleClick={handleMaximise}>
                <svg className="tb-logo" viewBox="0 0 16 16" fill="none">
                    <polygon
                        points="8,1 14.9,5 14.9,11 8,15 1.1,11 1.1,5"
                        stroke="#69daff"
                        strokeWidth="1.5"
                        fill="rgba(105,218,255,0.08)"
                    />
                    <circle cx="8" cy="8" r="2" fill="#69daff" />
                </svg>
                <span className="tb-title">kube-ins</span>
            </div>

            {/* Action buttons */}
            <div className="tb-actions">
            </div>

            {/* Window controls */}
            <div className="tb-controls">
                {/* Minimise */}
                <button className="tb-btn tb-btn--min" onClick={WindowMinimise} title="Minimise">
                    <svg viewBox="0 0 12 12" fill="none">
                        <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>

                {/* Maximise / Restore */}
                <button className="tb-btn tb-btn--max" onClick={handleMaximise} title={maximised ? 'Restore' : 'Maximise'}>
                    {maximised ? (
                        /* Restore: two overlapping squares */
                        <svg viewBox="0 0 12 12" fill="none">
                            <rect x="1" y="3" width="7" height="7" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
                            <path d="M4 3V2h7v7H10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    ) : (
                        /* Maximise: single square */
                        <svg viewBox="0 0 12 12" fill="none">
                            <rect x="2" y="2" width="8" height="8" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
                        </svg>
                    )}
                </button>

                {/* Close */}
                <button className="tb-btn tb-btn--close" onClick={Quit} title="Close">
                    <svg viewBox="0 0 12 12" fill="none">
                        <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default TitleBar;
