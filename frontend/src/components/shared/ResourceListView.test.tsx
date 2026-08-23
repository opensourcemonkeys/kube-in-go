import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { Column } from 'primereact/column';
import ResourceListView from './ResourceListView';

// The bug this file exists to prevent: on a panel's first load the DataTable was
// mounted at scrollHeight="flex", painted, and only *then* handed its measured
// pixel height — which flips the `key` and tears the whole table down and back
// up. On screen that reads as the table appearing, vanishing for a frame, and
// appearing again. The fix is to measure the wrapper before the table ever
// mounts, so the key never flips once rows are on screen.

vi.mock('../../contexts/TabContext', () => ({
    useTabContext: () => ({ openDescribePanel: vi.fn() }),
}));

interface Row {
    name: string;
    namespace?: string;
}

// jsdom has no layout: every element measures 0 and ResizeObserver does not
// exist. Both are precisely what the component keys its DataTable on, so a test
// that does not fake them cannot tell the bug from the fix.
const PANEL_HEIGHT = 600;
let resizeCallbacks: ResizeObserverCallback[] = [];

class FakeResizeObserver implements ResizeObserver {
    constructor(private cb: ResizeObserverCallback) {
        resizeCallbacks.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {
        resizeCallbacks = resizeCallbacks.filter((c) => c !== this.cb);
    }
}

/** Delivers the first ResizeObserver callback the way a browser does: a frame late. */
function fireResize(height = PANEL_HEIGHT) {
    for (const cb of [...resizeCallbacks]) {
        cb([{ contentRect: { height } } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    }
}

const datatableEl = () => document.querySelector('[data-pc-name="datatable"]');

let clientHeightSpy: PropertyDescriptor | undefined;

beforeEach(() => {
    resizeCallbacks = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    clientHeightSpy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get: () => PANEL_HEIGHT,
    });
});

afterEach(() => {
    if (clientHeightSpy) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeightSpy);
    vi.unstubAllGlobals();
});

function renderList(fetcher: (clusterName: string) => Promise<any[]>) {
    return render(
        <ResourceListView<Row>
            title="Pod List"
            clusterName="test-cluster"
            fetcher={fetcher}
            createFrom={(raw: any) => ({ name: raw.name, namespace: raw.namespace })}
            defaultFilters={{}}
            emptyMessage="No pods found"
            pollInterval={1_000_000}
            columns={() => (
                <>
                    <Column field="name" header="Name" />
                </>
            )}
        />,
    );
}

describe('ResourceListView first load', () => {
    it('does not remount the DataTable once it is on screen', async () => {
        let resolveFetch: (rows: any[]) => void = () => {};
        const fetcher = vi.fn(
            () => new Promise<any[]>((resolve) => { resolveFetch = resolve; }),
        );

        renderList(fetcher);

        // While the first fetch is in flight the spinner is shown — but the
        // measurable wrapper must already be mounted, which is what lets the
        // table mount at its final height.
        expect(document.querySelector('.p-progress-spinner')).not.toBeNull();
        expect(datatableEl()).toBeNull();
        expect(document.querySelector('.ktable-fill')).not.toBeNull();

        await act(async () => {
            resolveFetch([{ name: 'pod-a', namespace: 'default' }]);
        });

        await waitFor(() => expect(datatableEl()).not.toBeNull());
        const firstMount = datatableEl();

        // The browser delivers this a frame after the table has painted. Before
        // the fix it is what flipped the key and remounted the table.
        await act(async () => {
            fireResize();
        });
        expect(datatableEl()).toBe(firstMount);

        // A genuine resize (splitter drag, window resize) must also be absorbed
        // as a prop change, never as a remount.
        await act(async () => {
            fireResize(PANEL_HEIGHT - 120);
        });
        expect(datatableEl()).toBe(firstMount);
    });
});
