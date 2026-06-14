import { useEffect, useRef, useState } from 'react';

/**
 * Defers rendering of a flex/virtual-scroll DataTable until its container has a
 * measurable, non-zero size.
 *
 * PrimeReact's `scrollHeight="flex"` + virtual scroller measure the container on
 * first paint; inside a Dockview panel that mounts hidden (or before layout has
 * settled) that measurement can be 0, leaving the table collapsed. Attach `ref`
 * to the scroll container and only mount the table when `ready` is true.
 */
export function useTableViewport() {
    const ref = useRef<HTMLDivElement | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const check = () => {
            if (el.clientHeight > 0 && el.clientWidth > 0) setReady(true);
        };

        check();
        const observer = new ResizeObserver(check);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return { ref, ready };
}
