import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STORE_KEY = 'kube-ins-diagnostics';

export type LevelFilter = '' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/** A renderer-side failure worth carrying into a diagnostics report. */
export interface UiError {
    /** ISO timestamp. */
    at: string;
    /** Where it happened — a panel id, or "app" for the root boundary. */
    where: string;
    message: string;
    /** JS stack plus React's component stack, when the boundary supplied one. */
    stack?: string;
}

// The Go report covers the backend; nothing there can see a React render that
// threw. Keep the last few so "Copy diagnostics" after a crash carries the
// stack that caused it.
const MAX_UI_ERRORS = 20;

interface DiagnosticsStore {
    activeTab: number;
    levelFilter: LevelFilter;
    query: string;
    roleFilter: string[];
    thisProcessOnly: boolean;
    autoFollow: boolean;
    uiErrors: UiError[];

    setActiveTab: (i: number) => void;
    setLevelFilter: (l: LevelFilter) => void;
    setQuery: (q: string) => void;
    setRoleFilter: (r: string[]) => void;
    setThisProcessOnly: (v: boolean) => void;
    setAutoFollow: (v: boolean) => void;
    recordUiError: (where: string, message: string, stack?: string) => void;
}

/**
 * View state for the Diagnostics panel, persisted so a closed-and-reopened tab
 * comes back where the user left it.
 *
 * Only preferences are *persisted*. Health-check results and log rows are
 * ephemeral and stay in component state — the same split metricsStore makes:
 * rehydrating a stale check result would show a green tick for a cluster that
 * has been unreachable since the app restarted. `uiErrors` lives in the store
 * (several unrelated components write to it) but is excluded from persistence
 * by `partialize` for the same reason: a crash from a previous run must not
 * reappear in this run's report.
 */
export const useDiagnosticsStore = create<DiagnosticsStore>()(
    persist(
        (set) => ({
            activeTab: 0,
            levelFilter: '',
            query: '',
            roleFilter: [],
            thisProcessOnly: false,
            autoFollow: true,
            uiErrors: [],

            setActiveTab: (activeTab) => set({ activeTab }),
            setLevelFilter: (levelFilter) => set({ levelFilter }),
            setQuery: (query) => set({ query }),
            setRoleFilter: (roleFilter) => set({ roleFilter }),
            setThisProcessOnly: (thisProcessOnly) => set({ thisProcessOnly }),
            setAutoFollow: (autoFollow) => set({ autoFollow }),
            recordUiError: (where, message, stack) =>
                set((state) => ({
                    uiErrors: [
                        ...state.uiErrors.slice(-(MAX_UI_ERRORS - 1)),
                        { at: new Date().toISOString(), where, message, stack },
                    ],
                })),
        }),
        {
            name: STORE_KEY,
            storage: createJSONStorage(() => localStorage),
            version: 1,
            partialize: ({ activeTab, levelFilter, query, roleFilter, thisProcessOnly, autoFollow }) => ({
                activeTab,
                levelFilter,
                query,
                roleFilter,
                thisProcessOnly,
                autoFollow,
            }),
        },
    ),
);
