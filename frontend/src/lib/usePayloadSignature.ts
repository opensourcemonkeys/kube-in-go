import { useCallback, useMemo, useRef } from 'react';

export interface PayloadSignature {
    /**
     * True when `data` differs from the last payload this hook accepted (and
     * records it). False means the caller can skip the state update entirely.
     */
    changed: (data: unknown) => boolean;
    /** Forget the recorded payload, so the next one always counts as changed. */
    reset: () => void;
}

/**
 * Guards a polling view against re-rendering on an unchanged payload.
 *
 * A cluster poll normally returns exactly what the previous one did. Feeding
 * that to `setState` still hands React a brand new array — and with it a new
 * identity for every row object, every derived `useMemo`, and every `options`
 * array below it — so the whole table re-renders twice a second whether or not
 * anything changed. With ~15 panels open that is the app's baseline CPU cost.
 *
 * The comparison is on the *raw* payload, before any `createFrom`: model class
 * instances are more expensive to compare and are rebuilt anyway. Go's
 * marshaller emits struct fields in declaration order, so equal payloads always
 * serialize equally — the check can miss a change (it cannot, for equal JSON)
 * but never invents one.
 */
export function usePayloadSignature(): PayloadSignature {
    const sigRef = useRef<string | null>(null);

    const changed = useCallback((data: unknown) => {
        const sig = JSON.stringify(data);
        if (sig === sigRef.current) return false;
        sigRef.current = sig;
        return true;
    }, []);

    const reset = useCallback(() => {
        sigRef.current = null;
    }, []);

    // Memoized: callers put this object in `useCallback`/`useEffect` deps, and a
    // fresh literal per render would make those deps change every render — for
    // a polling effect, that is an infinite reload loop.
    return useMemo(() => ({ changed, reset }), [changed, reset]);
}
