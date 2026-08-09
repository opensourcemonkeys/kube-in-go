import { GetDiagnostics, RunHealthChecks } from '../../wailsjs/go/controller_app/App';
import { models } from '../../wailsjs/go/models';
import { useAiChatStore } from '../stores/aiChatStore';
import { useDiagnosticsStore, UiError } from '../stores/diagnosticsStore';
import { writeClipboard } from './clipboard';
import { errText } from './errText';

/**
 * Renders the plain-text diagnostics report.
 *
 * Everything the Go side contributes is already redacted there (home paths,
 * cluster names, tokens, API server addresses) — see business/redact.go. The
 * two client-side additions below are the failure the user is looking at and
 * any React crash stacks; neither passes through the Go redactor, so keep them
 * to messages and stacks and never add anything cluster-identifying here.
 */
export function renderReport(
    rep: models.DiagnosticsReport,
    checks: models.HealthCheck[],
    context?: string,
    uiErrors: UiError[] = [],
): string {
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

    if (context) {
        lines.push('', 'reported from the UI', `  ${context}`);
    }

    if (uiErrors.length > 0) {
        lines.push('', 'recent UI errors');
        for (const e of uiErrors) {
            lines.push(`  ${e.at} [${e.where}] ${e.message}`);
            if (e.stack) lines.push(...e.stack.split('\n').map((l) => `      ${l.trim()}`));
        }
    }

    // Empty entries are the optional lines (commit, buildDate) plus the section
    // separators; dropping both is how this report has always been formatted.
    return lines.filter((l) => l !== '').join('\n');
}

/**
 * Builds the report and puts it on the clipboard. Resolves to whether the copy
 * is believed to have worked, so the caller can pick a toast.
 *
 * `context` is the one-line description of what the user was looking at — for
 * an error banner, the failing call's message.
 *
 * Reads the Ollama host and the recorded UI errors straight from their stores
 * rather than taking them as arguments: this is called from an error banner
 * that can appear in any of ~25 panels, and none of them should have to know
 * what goes into a diagnostics report.
 */
export async function copyDiagnostics(context?: string): Promise<boolean> {
    const host = useAiChatStore.getState().host;
    const uiErrors = useDiagnosticsStore.getState().uiErrors;
    try {
        const [rep, checks] = await Promise.all([GetDiagnostics(), RunHealthChecks(host)]);
        return await writeClipboard(renderReport(rep, checks, context, uiErrors));
    } catch (e) {
        // The backend is the thing that is broken often enough that a report
        // which cannot be built is exactly when one is wanted. Fall back to the
        // context and the crash stacks, which are entirely client-side.
        const fallback = [
            'Kube Inspector diagnostics (partial — the backend report could not be built)',
            `generated       ${new Date().toISOString()}`,
            `report error    ${errText(e)}`,
            context ? `\nreported from the UI\n  ${context}` : '',
            ...uiErrors.map((u) => `\n${u.at} [${u.where}] ${u.message}${u.stack ? `\n${u.stack}` : ''}`),
        ].join('\n');
        return writeClipboard(fallback);
    }
}
