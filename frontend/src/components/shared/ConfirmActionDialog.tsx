import { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { VscClose, VscCheck } from 'react-icons/vsc';
import { errText } from '../../lib/errText';
import { useT } from '../../i18n/useT';

/**
 * Confirmation dialog for a single mutating row action.
 *
 * PrimeReact ships a `ConfirmDialog`, but it is a global service needing a
 * mount point and an imperative `confirmDialog()` call — nothing in this app
 * uses it. Every existing confirmation (delete in `ResourceListView`, create in
 * `namespace/main.tsx`) is a plain `<Dialog>` with a footer, so this follows
 * the same shape and stays consistent with the theme overrides.
 *
 * The error stays inside the dialog rather than going to the list's toast: the
 * user is looking at the dialog when the call fails, and keeping it open lets
 * them read the API server's rejection and retry.
 */
export default function ConfirmActionDialog({
    visible,
    header,
    message,
    warning,
    confirmLabel = 'Confirm',
    severity,
    onHide,
    onConfirm,
}: {
    visible: boolean;
    header: string;
    message: React.ReactNode;
    /** Extra emphasised note shown under the message (e.g. a destructive consequence). */
    warning?: React.ReactNode;
    confirmLabel?: string;
    severity?: 'danger' | 'warning';
    onHide: () => void;
    /** Performs the action. Throwing keeps the dialog open with the message shown. */
    onConfirm: () => Promise<void>;
}) {
    const t = useT();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const close = () => {
        if (busy) return;
        setError(null);
        onHide();
    };

    const run = async () => {
        setBusy(true);
        setError(null);
        try {
            await onConfirm();
            onHide();
        } catch (e) {
            setError(errText(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            header={header}
            visible={visible}
            style={{ width: '30rem' }}
            modal
            onHide={close}
            footer={
                <div className="flex justify-content-end gap-2">
                    <Button label={t('action.cancel')} icon={<VscClose size={16} />} text onClick={close} disabled={busy} />
                    <Button
                        label={confirmLabel}
                        icon={<VscCheck size={16} />}
                        severity={severity === 'danger' ? 'danger' : undefined}
                        onClick={run}
                        loading={busy}
                    />
                </div>
            }
        >
            <div className="flex flex-column gap-2">
                <span>{message}</span>
                {warning && (
                    <span style={{ color: 'var(--amber)', fontSize: '0.85rem' }}>{warning}</span>
                )}
                {error && (
                    <span style={{ color: 'var(--red)', fontSize: '0.8rem', wordBreak: 'break-word' }}>{error}</span>
                )}
            </div>
        </Dialog>
    );
}
