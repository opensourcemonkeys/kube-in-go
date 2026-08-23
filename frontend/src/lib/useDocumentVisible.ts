import { useEffect, useState } from 'react';

/**
 * Tracks whether the document is currently visible (window not minimised and,
 * in a browser tab, the tab in the foreground).
 *
 * `usePanelActive` only knows which Dockview tab is in front — it stays `true`
 * for the foreground panel of a minimised window, so every open panel keeps
 * polling the cluster while nobody is looking at it. Combine the two:
 *
 *     const active = usePanelActive(api) && useDocumentVisible();
 *
 * Both hooks are unconditional calls, so `&&` here does not short-circuit a
 * hook — it only combines their results.
 */
export function useDocumentVisible(): boolean {
    const [visible, setVisible] = useState(
        () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    );

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const onChange = () => setVisible(document.visibilityState !== 'hidden');
        onChange();
        document.addEventListener('visibilitychange', onChange);
        return () => document.removeEventListener('visibilitychange', onChange);
    }, []);

    return visible;
}
