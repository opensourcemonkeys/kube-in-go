import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { defaultColorId, hexForId } from '../lib/clusterColors';

// Only user *overrides* live here — the default is derived from the cluster
// name (lib/clusterColors.ts), so entries for deleted clusters never pile up
// and nothing needs pruning.
interface ClusterColorStore {
    overrides: Record<string, string>;
    setColor: (cluster: string, id: string) => void;
    resetColor: (cluster: string) => void;
}

export const useClusterColorStore = create<ClusterColorStore>()(
    persist(
        (set) => ({
            overrides: {},
            setColor: (cluster, id) =>
                set((s) => ({ overrides: { ...s.overrides, [cluster]: id } })),
            resetColor: (cluster) =>
                set((s) => {
                    const next = { ...s.overrides };
                    delete next[cluster];
                    return { overrides: next };
                }),
        }),
        {
            name: 'kube-ins-cluster-colors',
            storage: createJSONStorage(() => localStorage),
            version: 1,
        },
    ),
);

// Resolved colour for a cluster, or null when there is no cluster to colour
// (e.g. terminal panels carry no clusterName in their params).
export function useClusterColor(clusterName?: string): string | null {
    const override = useClusterColorStore(s => (clusterName ? s.overrides[clusterName] : undefined));
    if (!clusterName) return null;
    return hexForId(override ?? defaultColorId(clusterName));
}
