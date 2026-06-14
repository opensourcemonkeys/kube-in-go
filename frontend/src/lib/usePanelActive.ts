import { useEffect, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';

/**
 * Tracks whether a Dockview panel is the active (foreground) tab in its group.
 *
 * Dockview keeps inactive panels mounted (hidden via CSS) rather than
 * unmounting them, so a component can use this to voluntarily tear down heavy
 * DOM / stop polling while backgrounded and rebuild from persisted state when
 * it returns to the foreground.
 *
 * Falls back to `true` when no api is supplied so components still work when
 * rendered outside Dockview.
 */
export function usePanelActive(api?: DockviewPanelApi): boolean {
    const [active, setActive] = useState(api?.isActive ?? true);

    useEffect(() => {
        if (!api) {
            setActive(true);
            return;
        }
        setActive(api.isActive);
        const disposable = api.onDidActiveChange((e) => setActive(e.isActive));
        return () => disposable.dispose();
    }, [api]);

    return active;
}
