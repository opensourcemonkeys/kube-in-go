import { useEffect, useState } from 'react';

/**
 * Tracks whether the document is currently visible (window not minimised and,
 * in a browser tab, the tab in the foreground).
 *
 * `usePanelActive` composes this in, so a panel that already gates on the
 * Dockview api gets window visibility for free and does not need this hook
 * directly. Use it on its own only for work that has no panel of its own.
 *
 * Do not write `usePanelActive(api) && useDocumentVisible()` at a call site:
 * `&&` short-circuits, so the second hook is skipped whenever the first
 * returns false, and hook order changes between renders.
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
