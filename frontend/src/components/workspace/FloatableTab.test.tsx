import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import FloatableTab from './FloatableTab';
import { useClusterColorStore } from '../../stores/clusterColorStore';
import { hexForId } from '../../lib/clusterColors';

vi.mock('../../contexts/InstanceContext', () => ({
    useInstanceContext: () => ({
        instances: [],
        selfInfo: null,
        transferTab: vi.fn(),
        onPanelReceived: null,
        setOnPanelReceived: vi.fn(),
    }),
}));

// Minimal stand-in for dockview's Emitter: `event` registers and returns a
// disposable, `fire` notifies — enough to drive the panel/container apis.
function emitter<T>() {
    const listeners = new Set<(e: T) => void>();
    return {
        event: (fn: (e: T) => void) => {
            listeners.add(fn);
            return { dispose: () => listeners.delete(fn) };
        },
        fire: (e: T) => [...listeners].forEach(l => l(e)),
    };
}

/**
 * dockview renders a tab as `.dv-tab > <our react root>`, and moving a panel
 * builds a *brand new* `.dv-tab` before re-parenting the very same react root
 * into it (dockview-core Tabs.openPanel → Tab.setContent). This mirrors that
 * shape so the accent can be asserted on the wrapper the app actually styles.
 */
function mountTab(clusterName: string) {
    const wrapper = document.createElement('div');
    wrapper.className = 'dv-tab';
    const part = document.createElement('div');
    part.className = 'dv-react-part';
    wrapper.appendChild(part);
    document.body.appendChild(wrapper);

    const groupChange = emitter<object>();
    const movePanel = emitter<{ panel: { id: string } }>();

    const api = {
        id: `pods:${clusterName}`,
        title: `Pods • ${clusterName}`,
        close: vi.fn(),
        onDidGroupChange: groupChange.event,
    };
    const containerApi = {
        totalPanels: 2,
        getPanel: () => ({ params: { clusterName } }),
        onDidMovePanel: movePanel.event,
    };

    const view = render(
        <FloatableTab
            api={api as any}
            containerApi={containerApi as any}
            params={{ clusterName } as any}
            tabLocation="header"
        />,
        { container: part },
    );

    // Stands in for Tab.setContent: a new wrapper adopts the existing react
    // part, so React's own container never changes and the component is never
    // remounted — which is exactly why the accent goes stale.
    const reparent = () => {
        const next = document.createElement('div');
        next.className = 'dv-tab';
        document.body.appendChild(next);
        next.appendChild(part);
        return next;
    };

    return { wrapper, api, groupChange, movePanel, reparent, view };
}

beforeEach(() => {
    document.body.innerHTML = '';
    useClusterColorStore.setState({ overrides: {} });
});

describe('FloatableTab cluster accent', () => {
    it('paints the chosen colour on the tab wrapper', () => {
        useClusterColorStore.getState().setColor('prod', 'magenta');
        const { wrapper } = mountTab('prod');

        expect(wrapper.style.getPropertyValue('--tab-accent')).toBe(hexForId('magenta'));
    });

    it('repaints the new wrapper when the panel is moved into another group', async () => {
        useClusterColorStore.getState().setColor('prod', 'magenta');
        const { wrapper, movePanel, api, reparent } = mountTab('prod');

        // A split/reorder: dockview re-parents first, then announces the move.
        const moved = reparent();
        await act(async () => { movePanel.fire({ panel: { id: api.id } }); });

        expect(moved.style.getPropertyValue('--tab-accent')).toBe(hexForId('magenta'));
        expect(wrapper.style.getPropertyValue('--tab-accent')).toBe('');
    });

    it('repaints when the panel changes group without a move event', async () => {
        useClusterColorStore.getState().setColor('prod', 'magenta');
        const { groupChange, reparent } = mountTab('prod');

        // Floating a panel announces the group change *before* the re-parent,
        // so a synchronous repaint would still find the old wrapper.
        await act(async () => {
            groupChange.fire({});
            const floated = reparent();
            await Promise.resolve();
            expect(floated.style.getPropertyValue('--tab-accent')).toBe(hexForId('magenta'));
        });
    });
});
