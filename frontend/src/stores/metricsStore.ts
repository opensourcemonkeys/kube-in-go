import { create } from 'zustand';

// Rolling time-series buffer for the Monitoring dashboard. Kept in memory only
// (metrics history is ephemeral); not persisted. Keyed by `metrics:${cluster}`
// so each cluster keeps its own buffer while the app runs.

export interface ClusterPoint {
    t: number; // unix millis
    cpu: number; // used millicores
    mem: number; // used MiB
    cpuCap: number; // capacity millicores
    memCap: number; // capacity MiB
}

export interface EntityPoint {
    t: number;
    cpu: number; // millicores
    mem: number; // MiB
}

export interface MetricsTabState {
    cluster: ClusterPoint[];
    series: Record<string, EntityPoint[]>; // per selected entity id
}

// Rolling-window length, in samples. At the dashboard's 4s poll interval this is
// ~2 hours of history (1800 × 4s). Kept in memory only, so it resets on app
// restart; raise/lower this to trade history depth for memory/chart-render cost.
const MAX_POINTS = 1800;

const emptyTab = (): MetricsTabState => ({ cluster: [], series: {} });

const cap = <T>(arr: T[]): T[] => (arr.length > MAX_POINTS ? arr.slice(arr.length - MAX_POINTS) : arr);

interface MetricsStore {
    tabs: Record<string, MetricsTabState>;
    // Append the latest cluster point and (optionally) the selected entity's point.
    record: (key: string, cluster: ClusterPoint, entityId: string | null, entity: EntityPoint | null) => void;
}

export const useMetricsStore = create<MetricsStore>((set) => ({
    tabs: {},
    record: (key, cluster, entityId, entity) =>
        set((state) => {
            const prev = state.tabs[key] ?? emptyTab();
            const series = { ...prev.series };
            if (entityId && entity) {
                series[entityId] = cap([...(prev.series[entityId] ?? []), entity]);
            }
            return {
                tabs: {
                    ...state.tabs,
                    [key]: { cluster: cap([...prev.cluster, cluster]), series },
                },
            };
        }),
}));
