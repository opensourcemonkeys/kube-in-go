/**
 * Human-readable text for a rejected backend call.
 *
 * The two shells reject differently: Wails hands the raw Go error *string* to
 * the promise, while the RPC bridge (`lib/wailsBridge.ts`) wraps it in an
 * `Error`. Both land here, so no call site has to know which shell it runs
 * under.
 *
 * Since beta-plan S7 the Go side wraps every list error as
 * `verb object in cluster "name": <cause>`, so the string this returns is
 * already the sentence the user should read — do not prefix it further.
 */
export function errText(e: unknown): string {
    if (e == null) return 'Unknown error';
    if (typeof e === 'string') return e.trim() || 'Unknown error';

    const message = (e as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();

    const s = String(e);
    return s === '[object Object]' ? 'Unknown error' : s;
}
