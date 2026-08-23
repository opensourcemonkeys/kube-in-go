import { create } from 'zustand';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { ListPortForwards } from '../../wailsjs/go/controller_app/App';
import { models } from '../../wailsjs/go/models';

/**
 * Mirror of the backend's process-wide port-forward registry.
 *
 * It is a mirror, not the owner: tunnels live in Go and survive every panel
 * that shows them, so this store never creates or destroys one — it only
 * reflects what the backend reports. Not persisted (same reasoning as
 * `metricsStore`): a forward cannot outlive the process that binds its port,
 * so restoring a list of them on the next launch would be a list of lies.
 *
 * There is one subscription per window, started by `TitleBar` rather than by
 * the panel, because the title-bar indicator has to keep working while the
 * panel is closed — which is the whole point of a forward outliving its panel.
 */

export type PortForward = models.PortForwardInfo;

interface PortForwardStore {
    forwards: PortForward[];
    /** Idempotent: safe to call from every mount. */
    startSync: () => void;
    refresh: () => Promise<void>;
    apply: (info: PortForward) => void;
}

// Poll interval for the safety net behind the events. ListPortForwards is a
// pure in-memory snapshot on the Go side, so this costs nothing.
const POLL_MS = 5000;

let syncing = false;

export const usePortForwardStore = create<PortForwardStore>((set, get) => ({
    forwards: [],

    apply: (info) =>
        set((state) => {
            // A closed forward is gone from the backend registry too; a failed
            // one is deliberately kept so the user can read the error and
            // restart it.
            if (info.status === 'closed') {
                return { forwards: state.forwards.filter((f) => f.id !== info.id) };
            }
            const i = state.forwards.findIndex((f) => f.id === info.id);
            if (i === -1) return { forwards: [...state.forwards, info] };
            const next = state.forwards.slice();
            next[i] = info;
            return { forwards: next };
        }),

    refresh: async () => {
        try {
            const list = await ListPortForwards();
            set({ forwards: (list ?? []).map(models.PortForwardInfo.createFrom) });
        } catch {
            // A backend that cannot answer is already surfacing elsewhere; the
            // indicator going stale for one tick is not worth a toast.
        }
    },

    startSync: () => {
        if (syncing) return;
        syncing = true;
        EventsOn('portforward:update', (info: PortForward) => {
            get().apply(models.PortForwardInfo.createFrom(info));
        });
        void get().refresh();
        setInterval(() => void get().refresh(), POLL_MS);
    },
}));

/**
 * True when a forward is live and its port looks like something a browser can
 * render. Pointing a browser at a Postgres tunnel helps nobody, so the button
 * is hidden rather than shown and broken; Copy address always works.
 */
export const isWebForward = (f: PortForward): boolean =>
    f.status === 'ready' && (f.hint === 'http' || f.hint === 'https');

export const forwardUrl = (f: PortForward): string =>
    `${f.hint === 'https' ? 'https' : 'http'}://${f.address}:${f.local_port}`;

export const forwardAddress = (f: PortForward): string => `${f.address}:${f.local_port}`;
