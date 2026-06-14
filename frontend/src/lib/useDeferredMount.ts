import { useEffect, useState } from 'react';

/**
 * Defers mounting heavy content until a couple of animation frames after it
 * becomes enabled, so the triggering interaction (e.g. a Dockview tab switch)
 * can paint a lightweight placeholder first instead of janking on the heavy
 * synchronous render (large DataTable, charts, graphs, ...).
 *
 * Returns `false` immediately when disabled, then flips to `true` ~2 frames
 * after `enabled` becomes true.
 */
export function useDeferredMount(enabled: boolean): boolean {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setMounted(false);
            return;
        }
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setMounted(true));
        });
        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
        };
    }, [enabled]);

    return mounted;
}
