import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DataTableFilterMeta } from 'primereact/datatable';
import { FilterMatchMode } from 'primereact/api';
import type { models } from '../../wailsjs/go/models';

/**
 * localStorage that degrades instead of throwing.
 *
 * `persist` calls `setItem` from inside the store write, so a
 * QuotaExceededError propagates out of `patchTab` and breaks the render that
 * triggered it — the events tab dies because the *cache* is full. MAX_EVENTS
 * makes that unlikely; this makes it survivable. Dropping our own key is the
 * right retry: the snapshot is a convenience, and the next poll refills it.
 */
const quotaSafeStorage: Storage = {
    get length() {
        return localStorage.length;
    },
    key: (index) => localStorage.key(index),
    clear: () => localStorage.clear(),
    getItem: (key) => {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    removeItem: (key) => {
        try {
            localStorage.removeItem(key);
        } catch {
            /* nothing useful to do: the snapshot is best-effort */
        }
    },
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch {
            // Full (or blocked). Free our own key and try once more; if that
            // still fails, this run simply goes unpersisted.
            try {
                localStorage.removeItem(key);
                localStorage.setItem(key, value);
            } catch {
                console.warn('events store: dropping persisted snapshot, localStorage is full');
            }
        }
    },
};

// Default filter config for the events table. Kept here so both the store and
// the component reference the exact same shape (used for the "clear filters" reset).
export const defaultEventFilters = (): DataTableFilterMeta => ({
    namespace:   { value: null, matchMode: FilterMatchMode.IN },
    type:        { value: null, matchMode: FilterMatchMode.IN },
    reason:      { value: null, matchMode: FilterMatchMode.IN },
    object_kind: { value: null, matchMode: FilterMatchMode.IN },
    object:      { value: null, matchMode: FilterMatchMode.IN },
    message:     { value: null, matchMode: FilterMatchMode.CONTAINS },
});

/**
 * Most events a tab keeps, in memory and on disk.
 *
 * A busy cluster can hold tens of thousands of events, and every 5s poll wrote
 * all of them back through `persist` — which throws `QuotaExceededError`
 * *inside* the store write once localStorage fills up, so the failure surfaces
 * as a broken events tab rather than as a storage error. The newest
 * MAX_EVENTS by `last_timestamp` are also exactly what the table shows (it
 * sorts on that field, descending), so nothing visible is lost.
 */
export const MAX_EVENTS = 1000;

/**
 * Keeps the newest MAX_EVENTS. The API server returns events in no meaningful
 * order, so "newest" has to be derived rather than assumed to be one end of
 * the slice. Returns the input untouched when it already fits, so a poll that
 * changes nothing does not hand the table a fresh array identity.
 */
export function capEvents(events: models.EventInfo[]): models.EventInfo[] {
    if (events.length <= MAX_EVENTS) return events;
    const ts = (e: models.EventInfo) => {
        const parsed = Date.parse(e.last_timestamp);
        return Number.isNaN(parsed) ? 0 : parsed;
    };
    return [...events].sort((a, b) => ts(b) - ts(a)).slice(0, MAX_EVENTS);
}

// Per-tab snapshot that is persisted to disk (localStorage in the Wails webview,
// which the OS persists across app restarts). This is what lets a reopened
// events tab continue exactly where it left off.
export interface EventsTabState {
    events: models.EventInfo[];
    filters: DataTableFilterMeta;
    warningOnly: boolean;
}

const emptyTab = (): EventsTabState => ({
    events: [],
    filters: defaultEventFilters(),
    warningOnly: false,
});

interface EventsStore {
    // Keyed by `events:${clusterName}` so each cluster's events tab is isolated.
    tabs: Record<string, EventsTabState>;
    patchTab: (key: string, patch: Partial<EventsTabState>) => void;
}

export const useEventsStore = create<EventsStore>()(
    persist(
        (set) => ({
            tabs: {},
            patchTab: (key, patch) =>
                set((state) => {
                    const next = { ...emptyTab(), ...state.tabs[key], ...patch };
                    // Capped here rather than only in `partialize` so the bound
                    // covers memory as well as disk: the array the table renders
                    // is this one.
                    next.events = capEvents(next.events);
                    return { tabs: { ...state.tabs, [key]: next } };
                }),
        }),
        {
            name: 'kube-ins-events-store',
            storage: createJSONStorage(() => quotaSafeStorage),
            version: 2,
            // Persist the tab snapshot explicitly. Anything added to the store
            // later has to be opted in here, which is what keeps a future
            // non-serializable field (a Toast ref, a React element) from
            // quietly ending up in localStorage.
            partialize: (state) => ({
                tabs: Object.fromEntries(
                    Object.entries(state.tabs).map(([key, tab]) => [
                        key,
                        {
                            events: capEvents(tab.events),
                            filters: tab.filters,
                            warningOnly: tab.warningOnly,
                        },
                    ]),
                ),
            }),
            // Kayıtlı `filters` nesnesi patchTab tarafından tab seviyesinde
            // birleştirildiği için varsayılanları bütünüyle eziyor — eski
            // sürümlerde yeni filtre anahtarları (message) eksik kalır.
            // PrimeReact'ın ColumnFilter'ı `filters[field].value = …` yaptığından
            // eksik anahtar kullanıcı filtreye dokunduğu anda TypeError fırlatır,
            // o yüzden kayıtlı değerleri koruyup eksikleri tamamlıyoruz.
            migrate: (persisted: any) => {
                if (!persisted?.tabs) return persisted;
                for (const tab of Object.values<any>(persisted.tabs)) {
                    tab.filters = { ...defaultEventFilters(), ...(tab.filters ?? {}) };
                }
                return persisted;
            },
        },
    ),
);
