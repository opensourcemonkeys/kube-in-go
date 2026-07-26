import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DataTableFilterMeta } from 'primereact/datatable';
import { FilterMatchMode } from 'primereact/api';
import type { models } from '../../wailsjs/go/models';

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
                set((state) => ({
                    tabs: {
                        ...state.tabs,
                        [key]: { ...emptyTab(), ...state.tabs[key], ...patch },
                    },
                })),
        }),
        {
            name: 'kube-ins-events-store',
            storage: createJSONStorage(() => localStorage),
            version: 2,
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
