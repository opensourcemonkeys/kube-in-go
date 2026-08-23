import { useEffect, useRef } from 'react';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Button } from 'primereact/button';
import { VscArrowSwap, VscGlobe, VscCopy, VscClose } from 'react-icons/vsc';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import { StopPortForward } from '../../../wailsjs/go/controller_app/App';
import {
    usePortForwardStore,
    isWebForward,
    forwardUrl,
    forwardAddress,
} from '../../stores/portForwardStore';
import { writeClipboard } from '../../lib/clipboard';

/**
 * Live tunnel count in the title bar.
 *
 * A port forward outlives the panel that opened it — that is the whole point —
 * which means the panel cannot be the thing that tells you one is running. This
 * pill is the only always-visible answer to "did I leave a tunnel open?", so it
 * subscribes to the store directly rather than through the panel.
 *
 * It appears only when there is something to report; an empty pill would be
 * permanent title-bar furniture that says nothing.
 */
export default function PortForwardPill({ onOpenPanel }: { onOpenPanel: () => void }) {
    const forwards = usePortForwardStore((s) => s.forwards);
    const startSync = usePortForwardStore((s) => s.startSync);
    const refresh = usePortForwardStore((s) => s.refresh);
    const overlay = useRef<OverlayPanel>(null);

    // One subscription per window, started here rather than in the panel so the
    // count keeps updating while the panel is closed. startSync is idempotent.
    useEffect(() => startSync(), [startSync]);

    if (forwards.length === 0) return null;

    const failed = forwards.some((f) => f.status === 'error');
    const unsettled = forwards.some((f) => f.status === 'reconnecting' || f.status === 'starting');
    const tone = failed ? 'tb-pf--error' : unsettled ? 'tb-pf--warn' : '';

    const stop = async (id: string) => {
        try {
            await StopPortForward(id);
        } finally {
            await refresh();
        }
    };

    return (
        <>
            <button
                className={`tb-pf ${tone}`}
                title="Active port forwards"
                onClick={(e) => overlay.current?.toggle(e)}
                onDoubleClick={onOpenPanel}
            >
                <VscArrowSwap size={12} />
                {forwards.length} {forwards.length === 1 ? 'forward' : 'forwards'}
            </button>

            <OverlayPanel ref={overlay} className="pf-overlay">
                <div className="pf-overlay__list">
                    {forwards.map((f) => (
                        <div key={f.id} className="pf-overlay__row">
                            <span className={`pf-overlay__dot pf-overlay__dot--${f.status}`} />
                            <span className="pf-overlay__addr">{forwardAddress(f)}</span>
                            <span className="pf-overlay__target">
                                {f.resource_kind}/{f.resource_name}
                            </span>
                            <span className="pf-overlay__actions">
                                {isWebForward(f) && (
                                    <Button
                                        icon={<VscGlobe size={13} />}
                                        text
                                        size="small"
                                        severity="secondary"
                                        style={{ padding: '0.15rem' }}
                                        aria-label="Open in browser"
                                        onClick={() => BrowserOpenURL(forwardUrl(f))}
                                    />
                                )}
                                <Button
                                    icon={<VscCopy size={13} />}
                                    text
                                    size="small"
                                    severity="secondary"
                                    style={{ padding: '0.15rem' }}
                                    aria-label="Copy address"
                                    onClick={() => void writeClipboard(forwardAddress(f))}
                                />
                                <Button
                                    icon={<VscClose size={13} />}
                                    text
                                    size="small"
                                    severity="danger"
                                    style={{ padding: '0.15rem' }}
                                    aria-label="Stop"
                                    onClick={() => void stop(f.id)}
                                />
                            </span>
                        </div>
                    ))}
                </div>
                <button
                    className="pf-overlay__more"
                    onClick={(e) => {
                        overlay.current?.toggle(e);
                        onOpenPanel();
                    }}
                >
                    Open Port Forwards panel
                </button>
            </OverlayPanel>
        </>
    );
}
