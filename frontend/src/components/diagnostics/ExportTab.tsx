import { useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { models } from '../../../wailsjs/go/models';
import {
    ExportDiagnostics,
    GetDiagnostics,
    GetLogDir,
    OpenLogFolder,
    RunHealthChecks,
} from '../../../wailsjs/go/controller_app/App';
import { useAiChatStore } from '../../stores/aiChatStore';
import { writeClipboard } from '../../lib/clipboard';

function humanBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let v = n / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v.toFixed(1)} ${units[i]}`;
}

function renderReport(rep: models.DiagnosticsReport, checks: models.HealthCheck[]): string {
    const lines = [
        'Kube Inspector diagnostics',
        `generated       ${rep.generatedAt}`,
        '',
        `version         ${rep.appVersion}`,
        rep.commit ? `commit          ${rep.commit}` : '',
        rep.buildDate ? `built           ${rep.buildDate}` : '',
        `go              ${rep.goVersion}`,
        `platform        ${rep.goos}/${rep.goarch}`,
        `os              ${rep.osRelease}`,
        `shell           ${rep.shell || '-'}`,
        '',
        `log level       ${rep.logLevel}`,
        `clusters        ${rep.clusterCount} configured (names redacted)`,
        `active cluster  ${rep.activeCluster || '-'}`,
        `instance hub    ${rep.hub?.role || '-'}`,
        '',
        'health checks',
        ...checks.map((c) => `  [${c.status.padEnd(4)}] ${c.label} — ${c.detail}`),
    ];
    return lines.filter((l) => l !== '').join('\n');
}

/**
 * The export tab. Everything it produces is redacted on the Go side before it
 * reaches a file or the clipboard — there is no unredacted path out of the app.
 */
export default function ExportTab({ report }: { report: models.DiagnosticsReport | null }) {
    const toast = useRef<Toast | null>(null);
    const [busy, setBusy] = useState(false);
    const ollamaHost = useAiChatStore((s) => s.host);

    const saveZip = () => {
        setBusy(true);
        ExportDiagnostics(ollamaHost)
            .then((path) => {
                // An empty path with no error means the user cancelled the
                // dialog; that is not something to announce.
                if (!path) return;
                toast.current?.show({
                    severity: 'success',
                    summary: 'Diagnostics saved',
                    detail: path,
                    life: 4000,
                });
            })
            .catch((e) =>
                toast.current?.show({
                    severity: 'error',
                    summary: 'Export failed',
                    detail: String(e),
                    life: 5000,
                }),
            )
            .finally(() => setBusy(false));
    };

    const copyReport = async () => {
        setBusy(true);
        try {
            const [rep, checks] = await Promise.all([
                GetDiagnostics(),
                RunHealthChecks(ollamaHost),
            ]);
            const ok = await writeClipboard(renderReport(rep, checks));
            toast.current?.show({
                severity: ok ? 'success' : 'error',
                summary: ok ? 'Copied' : 'Could not copy',
                detail: ok ? 'The report is on your clipboard.' : 'The clipboard is unavailable here.',
                life: 2500,
            });
        } catch (e) {
            toast.current?.show({
                severity: 'error',
                summary: 'Could not build the report',
                detail: String(e),
                life: 5000,
            });
        } finally {
            setBusy(false);
        }
    };

    const openFolder = () => {
        OpenLogFolder().catch(async () => {
            // Browser mode has no file manager to reach. Hand over the path
            // instead of failing silently.
            const dir = await GetLogDir().catch(() => '');
            const ok = dir ? await writeClipboard(dir) : false;
            toast.current?.show({
                severity: 'warn',
                summary: 'Cannot open a folder here',
                detail: ok ? `Path copied: ${dir}` : dir || 'Log directory unknown.',
                life: 5000,
            });
        });
    };

    const files = report?.logFiles ?? [];
    const total = files.reduce((sum, f) => sum + f.sizeBytes, 0);

    return (
        <div className="diag-tab">
            <Toast ref={toast} position="bottom-right" />

            <section className="diag-section">
                <h3 className="diag-section__title">What gets exported</h3>
                <p className="diag-note">
                    A zip containing this report, the health-check results and the log files
                    below. Home directory paths, cluster names, bearer tokens and API server
                    addresses are removed first. Nothing is sent anywhere — the file is written
                    where you choose and it is yours to share or not.
                </p>
            </section>

            <section className="diag-section">
                <div className="diag-section__head">
                    <h3 className="diag-section__title">Log files</h3>
                    <span className="diag-row__value">{humanBytes(total)} total</span>
                </div>
                {files.length === 0 && <div className="diag-empty">No log files yet.</div>}
                {files.map((f) => (
                    <div className="diag-row" key={f.name}>
                        <span className="diag-row__label">{f.name}</span>
                        <span className="diag-row__value">
                            {humanBytes(f.sizeBytes)} · {f.modifiedAt}
                        </span>
                    </div>
                ))}
                <p className="diag-note">Log files older than 7 days are deleted automatically.</p>
            </section>

            <section className="diag-section diag-actions">
                <Button
                    label="Save diagnostics.zip"
                    icon="pi pi-download"
                    disabled={busy}
                    onClick={saveZip}
                />
                <Button
                    label="Copy report"
                    icon="pi pi-copy"
                    outlined
                    disabled={busy}
                    onClick={copyReport}
                />
                <Button
                    label="Open log folder"
                    icon="pi pi-folder-open"
                    outlined
                    onClick={openFolder}
                />
            </section>
        </div>
    );
}
