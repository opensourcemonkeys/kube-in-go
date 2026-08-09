// Clipboard helpers.
//
// navigator.clipboard.writeText can be unavailable or silently blocked in the
// WebKitGTK webview Wails uses, so every copy falls back to the old
// hidden-textarea + execCommand trick. Extracted from CliModeOverlay so the
// three copy buttons in the Diagnostics panel cannot quietly reintroduce a bare
// navigator.clipboard call that works in Electron and fails under Wails.

function execCopy(text: string): boolean {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch {
        ok = false;
    }
    document.body.removeChild(ta);
    return ok;
}

/**
 * Copies text to the clipboard, falling back when the async API is unavailable.
 * Resolves to whether the copy is believed to have succeeded, so callers can
 * choose between a success and an error toast.
 *
 * onDone runs after the fallback path, for callers that need to restore focus
 * (an xterm instance, say) once the hidden textarea is gone.
 */
export async function writeClipboard(text: string, onDone?: () => void): Promise<boolean> {
    if (!text) return false;
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            /* blocked: fall through */
        }
    }
    const ok = execCopy(text);
    onDone?.();
    return ok;
}
