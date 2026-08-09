import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STORE_KEY = 'kube-ins-diagnostics';

export type LevelFilter = '' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface DiagnosticsStore {
    activeTab: number;
    levelFilter: LevelFilter;
    query: string;
    roleFilter: string[];
    thisProcessOnly: boolean;
    autoFollow: boolean;

    setActiveTab: (i: number) => void;
    setLevelFilter: (l: LevelFilter) => void;
    setQuery: (q: string) => void;
    setRoleFilter: (r: string[]) => void;
    setThisProcessOnly: (v: boolean) => void;
    setAutoFollow: (v: boolean) => void;
}

/**
 * View state for the Diagnostics panel, persisted so a closed-and-reopened tab
 * comes back where the user left it.
 *
 * Only preferences live here. Health-check results and log rows are ephemeral
 * and stay in component state — the same split metricsStore makes: rehydrating
 * a stale check result would show a green tick for a cluster that has been
 * unreachable since the app restarted.
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

            setActiveTab: (activeTab) => set({ activeTab }),
            setLevelFilter: (levelFilter) => set({ levelFilter }),
            setQuery: (query) => set({ query }),
            setRoleFilter: (roleFilter) => set({ roleFilter }),
            setThisProcessOnly: (thisProcessOnly) => set({ thisProcessOnly }),
            setAutoFollow: (autoFollow) => set({ autoFollow }),
        }),
        {
            name: STORE_KEY,
            storage: createJSONStorage(() => localStorage),
            version: 1,
        },
    ),
);
