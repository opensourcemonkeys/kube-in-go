import { useEffect, useRef, useState } from 'react';
import { VscCloudDownload, VscDesktopDownload, VscCheck, VscWarning } from 'react-icons/vsc';
import { Dialog } from 'primereact/dialog';
import { ProgressBar } from 'primereact/progressbar';
import { StartSelfUpdate, CancelSelfUpdate } from '../../../wailsjs/go/controller_app/App';
import { EventsOn, EventsOff, BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import { models } from '../../../wailsjs/go/models';
import { relaunchApp, quitApp, supportsSelfRestart } from '../../lib/shellWindows';

interface Props {
    visible: boolean;
    onHide: () => void;
    info: models.UpdateInfo;
}

/** Mirrors models.UpdateProgress. It only travels over events, so Wails does not
 *  generate a binding for it. */
interface UpdateProgress {
    phase: 'download' | 'install';
    received: number;
    total: number;
    percent: number;
}

type Stage = 'idle' | 'downloading' | 'installing' | 'done' | 'error';

// Long enough for "Update complete" to register before the window disappears.
const RESTART_DELAY_MS = 1200;

const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    const units = ['KB', 'MB', 'GB'];
    let v = n / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${units[i]}`;
};

export default function UpdateModal({ visible, onHide, info }: Props) {
    const [stage, setStage] = useState<Stage>('idle');
    const [progress, setProgress] = useState<UpdateProgress | null>(null);
    const [error, setError] = useState('');
    const sessionRef = useRef<string>('');

    // The updater can only finish the job under a shell that can restart the
    // whole app. Everywhere else (Wails dev shell, browser tab) fall back to the
    // downloads page, which is what the pill did before this modal existed.
    const canInstall = info.installable && supportsSelfRestart();
    const busy = stage === 'downloading' || stage === 'installing';

    // Reset whenever the dialog is reopened, but never while an update is in
    // flight — reopening must not restart a running download.
    useEffect(() => {
        if (visible && !busy) {
            setStage('idle');
            setProgress(null);
            setError('');
        }
    }, [visible]);

    const start = () => {
        const id = `update-${Date.now()}`;
        sessionRef.current = id;
        setError('');
        setProgress(null);
        setStage('downloading');

        EventsOn(`update:progress:${id}`, (p: UpdateProgress) => {
            setProgress(p);
            setStage(p.phase === 'install' ? 'installing' : 'downloading');
        });
        EventsOn(`update:done:${id}`, (d: { restart: string }) => {
            setStage('done');
            window.setTimeout(
                () => (d.restart === 'relaunch' ? relaunchApp() : quitApp()),
                RESTART_DELAY_MS,
            );
        });
        EventsOn(`update:error:${id}`, (d: { message: string }) => {
            setError(d.message || 'The update could not be installed.');
            setStage('error');
        });

        StartSelfUpdate(id).catch((e) => {
            setError(String(e));
            setStage('error');
        });
    };

    const detach = (id: string) => {
        EventsOff(`update:progress:${id}`);
        EventsOff(`update:done:${id}`);
        EventsOff(`update:error:${id}`);
    };

    const cancel = () => {
        const id = sessionRef.current;
        if (id) {
            CancelSelfUpdate(id).catch(() => { /* already finished */ });
            detach(id);
            sessionRef.current = '';
        }
        setStage('idle');
        setProgress(null);
        onHide();
    };

    // Drop the listeners on unmount. The download itself is cancelled only from
    // the explicit Cancel button — closing this window should not abort an
    // install that is already talking to the package manager.
    useEffect(() => () => { if (sessionRef.current) detach(sessionRef.current); }, []);

    const stepClass = (step: 1 | 2) => {
        const active = step === 1 ? stage === 'downloading' : stage === 'installing';
        const done = step === 1
            ? stage === 'installing' || stage === 'done'
            : stage === 'done';
        if (active) return 'update-modal__step update-modal__step--active';
        if (done) return 'update-modal__step update-modal__step--done';
        return 'update-modal__step';
    };

    const downloadPercent = progress && progress.phase === 'download' ? progress.percent : 0;
    const indeterminateDownload = stage === 'downloading' && (progress?.total ?? -1) <= 0;

    return (
        <Dialog
            visible={visible}
            onHide={() => { if (!busy) onHide(); }}
            header={null}
            closable={false}
            closeOnEscape={!busy}
            modal
            className="update-modal"
            style={{ width: '460px' }}
        >
            <div className="update-modal__content">
                <div className="update-modal__logo">
                    {stage === 'done' ? <VscCheck className="update-modal__logo-icon" />
                        : stage === 'error' ? <VscWarning className="update-modal__logo-icon update-modal__logo-icon--warn" />
                        : <VscCloudDownload className="update-modal__logo-icon" />}
                </div>

                <h2 className="update-modal__title">
                    {stage === 'done' ? 'Update complete' : 'Update available'}
                </h2>

                <div className="update-modal__versions">
                    <span className="update-modal__ver">{info.currentVersion}</span>
                    <span className="update-modal__arrow">→</span>
                    <span className="update-modal__ver update-modal__ver--new">{info.latestVersion}</span>
                </div>

                {canInstall ? (
                    <>
                        <div className="update-modal__steps">
                            <div className={stepClass(1)}>
                                <span className="update-modal__step-no">1</span>
                                <span className="update-modal__step-label">Download</span>
                            </div>
                            <div className="update-modal__step-line" />
                            <div className={stepClass(2)}>
                                <span className="update-modal__step-no">2</span>
                                <span className="update-modal__step-label">Install</span>
                            </div>
                        </div>

                        <div className="update-modal__body">
                            {stage === 'idle' && (
                                <p className="update-modal__desc">
                                    Kube Inspector will download the new version, verify it, and install it.
                                    The app restarts when it is done.
                                </p>
                            )}

                            {stage === 'downloading' && (
                                <>
                                    <ProgressBar
                                        className="update-modal__bar"
                                        mode={indeterminateDownload ? 'indeterminate' : 'determinate'}
                                        value={Math.round(downloadPercent)}
                                        showValue={!indeterminateDownload}
                                    />
                                    <div className="update-modal__status">
                                        {progress && progress.total > 0
                                            ? `${formatBytes(progress.received)} of ${formatBytes(progress.total)}`
                                            : 'Downloading…'}
                                    </div>
                                </>
                            )}

                            {stage === 'installing' && (
                                <>
                                    <ProgressBar className="update-modal__bar" mode="indeterminate" />
                                    <div className="update-modal__status">
                                        Installing… {info.assetKind === 'deb' || info.assetKind === 'rpm'
                                            ? 'You may be asked for your password.'
                                            : 'This will only take a moment.'}
                                    </div>
                                    <div className="update-modal__hint">Please do not close the app.</div>
                                </>
                            )}

                            {stage === 'done' && (
                                <div className="update-modal__status">Restarting Kube Inspector…</div>
                            )}

                            {stage === 'error' && (
                                <div className="update-modal__error">{error}</div>
                            )}
                        </div>

                        <div className="update-modal__actions">
                            {stage === 'idle' && (
                                <>
                                    <button className="update-modal__btn" onClick={onHide}>Later</button>
                                    <button className="update-modal__btn update-modal__btn--primary" onClick={start}>
                                        <VscDesktopDownload size={13} /> Update now
                                    </button>
                                </>
                            )}
                            {stage === 'downloading' && (
                                <button className="update-modal__btn" onClick={cancel}>Cancel</button>
                            )}
                            {stage === 'error' && (
                                <>
                                    <button className="update-modal__btn" onClick={() => BrowserOpenURL(info.downloadUrl)}>
                                        Open downloads page
                                    </button>
                                    <button className="update-modal__btn update-modal__btn--primary" onClick={start}>
                                        Try again
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="update-modal__body">
                        <p className="update-modal__desc">
                            {info.notInstallableReason
                                ? `${info.notInstallableReason} Download the new version from the website instead.`
                                : 'Download the new version from the website.'}
                        </p>
                        <div className="update-modal__actions">
                            <button className="update-modal__btn" onClick={onHide}>Later</button>
                            <button
                                className="update-modal__btn update-modal__btn--primary"
                                onClick={() => { BrowserOpenURL(info.downloadUrl); onHide(); }}
                            >
                                <VscDesktopDownload size={13} /> Open downloads page
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
