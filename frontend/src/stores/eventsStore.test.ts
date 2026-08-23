import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { capEvents, MAX_EVENTS, useEventsStore } from './eventsStore';
import type { models } from '../../wailsjs/go/models';

// The two failure modes this store grew a bound for (beta-plan S14d): an
// unbounded row array in memory, and a persist write that throws
// QuotaExceededError from *inside* the store update.

const ev = (name: string, iso: string) =>
    ({ name, last_timestamp: iso } as unknown as models.EventInfo);

/** n events, oldest first, one minute apart. */
const series = (n: number) =>
    Array.from({ length: n }, (_, i) => ev(`e${i}`, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()));

beforeEach(() => {
    localStorage.clear();
    useEventsStore.setState({ tabs: {} });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('capEvents', () => {
    it('returns the same array when the list already fits', () => {
        const rows = series(3);
        expect(capEvents(rows)).toBe(rows);
    });

    it('keeps the newest MAX_EVENTS regardless of the order it was handed', () => {
        // Newest first, so a naive slice(0, MAX) would keep the oldest.
        const rows = [...series(MAX_EVENTS + 10)].reverse();
        const capped = capEvents(rows);
        expect(capped).toHaveLength(MAX_EVENTS);
        expect(capped[0].name).toBe(`e${MAX_EVENTS + 9}`);
        expect(capped.at(-1)!.name).toBe(`e10`);
    });

    it('does not drop events with an unparseable timestamp on the floor', () => {
        const rows = capEvents([...series(MAX_EVENTS), ev('broken', 'not-a-date')]);
        expect(rows).toHaveLength(MAX_EVENTS);
        // The undated one sorts last, so it is the one that goes.
        expect(rows.some((r) => r.name === 'broken')).toBe(false);
    });
});

describe('useEventsStore', () => {
    it('caps the rows it holds in memory, not only the ones it persists', () => {
        useEventsStore.getState().patchTab('events:c1', { events: series(MAX_EVENTS + 500) });
        expect(useEventsStore.getState().tabs['events:c1'].events).toHaveLength(MAX_EVENTS);
    });

    it('survives a localStorage that is out of quota', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('exceeded the quota', 'QuotaExceededError');
        });

        expect(() =>
            useEventsStore.getState().patchTab('events:c1', { events: series(5) }),
        ).not.toThrow();
        // The write is dropped, but the in-memory tab is intact — which is what
        // the table renders from.
        expect(useEventsStore.getState().tabs['events:c1'].events).toHaveLength(5);
    });
});
