import { useEffect, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import { useDocumentVisible } from './useDocumentVisible';

/**
 * Tracks whether a Dockview panel is the active (foreground) tab in its group
 * *and* the window showing it is visible.
 *
 * Dockview keeps inactive panels mounted (hidden via CSS) rather than
 * unmounting them, so a component can use this to voluntarily tear down heavy
 * DOM / stop polling while backgrounded and rebuild from persisted state when
 * it returns to the foreground.
 *
 * The window half matters just as much: the foreground tab of a minimised
 * window is still "active" as far as Dockview is concerned, so ~15 open panels
 * on a 2s poll kept making hundreds of cluster calls a minute at nobody. The
 * visibility check lives *inside* this hook rather than at the ~8 call sites
 * because the obvious way to combine them at a call site —
 * `usePanelActive(api) && useDocumentVisible()` — short-circuits, which skips
 * a hook and breaks hook order.
 *
 * Falls back to the window's visibility when no api is supplied, so components
 * still work when rendered outside Dockview.
 */
export function usePanelActive(api?: DockviewPanelApi): boolean {
    const [panelActive, setPanelActive] = useState(api?.isActive ?? true);
    const documentVisible = useDocumentVisible();

    useEffect(() => {
        if (!api) {
            setPanelActive(true);
            return;
        }
        setPanelActive(api.isActive);
        const disposable = api.onDidActiveChange((e) => setPanelActive(e.isActive));
        return () => disposable.dispose();
    }, [api]);

    return panelActive && documentVisible;
}
