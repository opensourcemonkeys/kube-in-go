import { describe, it, expect, vi, beforeEach } from 'vitest';

// The store subscribes to a Wails event and calls a binding on first sync;
// neither exists in jsdom. Mock both so the reducer can be tested on its own.
const listMock = vi.fn();
vi.mock('../../wailsjs/runtime/runtime', () => ({ EventsOn: vi.fn() }));
vi.mock('../../wailsjs/go/controller_app/App', () => ({ ListPortForwards: () => listMock() }));

import { usePortForwardStore, isWebForward, forwardUrl, forwardAddress } from './portForwardStore';
import { models } from '../../wailsjs/go/models';

const forward = (over: Partial<models.PortForwardInfo>): models.PortForwardInfo =>
    models.PortForwardInfo.createFrom({
        id: 'a',
        cluster_name: 'kind',
        namespace: 'default',
        resource_kind: 'service',
        resource_name: 'nginx',
        pod_name: 'nginx-1',
        local_port: 8080,
        remote_port: 80,
        target_port: 80,
        address: '127.0.0.1',
        status: 'ready',
        error: '',
        started_at: '2024-01-01T00:00:00Z',
        attempts: 0,
        hint: 'http',
        reconnect: true,
        ...over,
    });

describe('portForwardStore', () => {
    beforeEach(() => {
        usePortForwardStore.setState({ forwards: [] });
        listMock.mockReset();
    });

    it('inserts an unknown forward', () => {
        usePortForwardStore.getState().apply(forward({ id: 'a' }));
        expect(usePortForwardStore.getState().forwards.map((f) => f.id)).toEqual(['a']);
    });

    it('updates by id rather than appending a duplicate', () => {
        const { apply } = usePortForwardStore.getState();
        apply(forward({ id: 'a', status: 'starting' }));
        apply(forward({ id: 'b', status: 'ready' }));
        apply(forward({ id: 'a', status: 'ready', local_port: 9090 }));

        const rows = usePortForwardStore.getState().forwards;
        expect(rows).toHaveLength(2);
        expect(rows.find((f) => f.id === 'a')?.status).toBe('ready');
        expect(rows.find((f) => f.id === 'a')?.local_port).toBe(9090);
        // Order is stable, so a status change does not make rows jump around.
        expect(rows.map((f) => f.id)).toEqual(['a', 'b']);
    });

    it('drops a closed forward but keeps a failed one', () => {
        const { apply } = usePortForwardStore.getState();
        apply(forward({ id: 'a' }));
        apply(forward({ id: 'b' }));

        // A failed tunnel stays: it is the thing the user has to see and act on.
        apply(forward({ id: 'b', status: 'error', error: 'pod deleted' }));
        expect(usePortForwardStore.getState().forwards).toHaveLength(2);

        apply(forward({ id: 'a', status: 'closed' }));
        expect(usePortForwardStore.getState().forwards.map((f) => f.id)).toEqual(['b']);
    });

    it('refresh replaces the list with the backend snapshot', async () => {
        listMock.mockResolvedValue([forward({ id: 'z' })]);
        await usePortForwardStore.getState().refresh();
        expect(usePortForwardStore.getState().forwards.map((f) => f.id)).toEqual(['z']);
    });

    it('refresh keeps the last list when the backend is unreachable', async () => {
        usePortForwardStore.getState().apply(forward({ id: 'a' }));
        listMock.mockRejectedValue(new Error('backend gone'));
        await usePortForwardStore.getState().refresh();
        expect(usePortForwardStore.getState().forwards.map((f) => f.id)).toEqual(['a']);
    });
});

describe('forward helpers', () => {
    it('offers a browser button only for a live, web-looking port', () => {
        expect(isWebForward(forward({ hint: 'http' }))).toBe(true);
        expect(isWebForward(forward({ hint: 'https' }))).toBe(true);
        // Pointing a browser at a Postgres tunnel helps nobody.
        expect(isWebForward(forward({ hint: '' }))).toBe(false);
        // Nor at one that is not up yet.
        expect(isWebForward(forward({ hint: 'http', status: 'reconnecting' }))).toBe(false);
    });

    it('builds the url from the hint and the bound local port', () => {
        expect(forwardUrl(forward({ hint: 'http', local_port: 8080 }))).toBe('http://127.0.0.1:8080');
        expect(forwardUrl(forward({ hint: 'https', local_port: 8443 }))).toBe('https://127.0.0.1:8443');
        expect(forwardAddress(forward({ local_port: 5432 }))).toBe('127.0.0.1:5432');
    });
});
