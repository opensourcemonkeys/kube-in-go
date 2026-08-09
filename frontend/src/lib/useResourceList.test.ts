import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useResourceList } from './useResourceList';

// The three-way distinction this hook exists to make (beta-plan S8): still
// loading, failed, or genuinely empty. Before S8 a failed fetch called
// setItems([]), so an RBAC 403 and an empty namespace rendered identically.

interface Row {
    name: string;
    namespace?: string;
}

const createFrom = (raw: any): Row => ({ name: raw.name, namespace: raw.namespace });

const defaultFilters = {};

function setup(fetcher: (clusterName: string) => Promise<any[]>) {
    return renderHook(() =>
        useResourceList<Row>({
            clusterName: 'test-cluster',
            fetcher,
            createFrom,
            defaultFilters,
            // Long enough that no test sees a second poll it did not ask for.
            pollInterval: 1_000_000,
        }),
    );
}

beforeEach(() => {
    // The hook logs failures; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useResourceList', () => {
    it('keeps the previous rows and reports the error when a poll fails', async () => {
        const fetcher = vi
            .fn<(clusterName: string) => Promise<any[]>>()
            .mockResolvedValueOnce([{ name: 'pod-a', namespace: 'default' }])
            .mockRejectedValueOnce(new Error('list pods in cluster "test-cluster": forbidden'));

        const { result } = setup(fetcher);

        await waitFor(() => expect(result.current.items).toHaveLength(1));
        expect(result.current.error).toBeNull();

        await act(async () => {
            await result.current.reload();
        });

        // The rows a user was reading must survive a transient failure.
        expect(result.current.items.map((r) => r.name)).toEqual(['pod-a']);
        expect(result.current.error).toBe('list pods in cluster "test-cluster": forbidden');
    });

    it('clears the error once a fetch succeeds again', async () => {
        const fetcher = vi
            .fn<(clusterName: string) => Promise<any[]>>()
            .mockRejectedValueOnce(new Error('connect to cluster "test-cluster": no such file'))
            .mockResolvedValueOnce([{ name: 'pod-b', namespace: 'kube-system' }]);

        const { result } = setup(fetcher);

        await waitFor(() => expect(result.current.error).toBe('connect to cluster "test-cluster": no such file'));
        expect(result.current.items).toEqual([]);

        await act(async () => {
            await result.current.reload();
        });

        expect(result.current.error).toBeNull();
        expect(result.current.items.map((r) => r.name)).toEqual(['pod-b']);
    });

    it('reports loading only until the first fetch settles', async () => {
        let release: (rows: any[]) => void = () => {};
        const first = new Promise<any[]>((resolve) => { release = resolve; });
        const fetcher = vi.fn<(clusterName: string) => Promise<any[]>>().mockReturnValueOnce(first).mockResolvedValue([]);

        const { result } = setup(fetcher);

        expect(result.current.loading).toBe(true);

        await act(async () => {
            release([{ name: 'pod-c' }]);
            await first;
        });

        expect(result.current.loading).toBe(false);

        // A later failure is an error, not a return to the loading state — that
        // is what keeps the spinner from replacing rows the user can still read.
        fetcher.mockRejectedValueOnce(new Error('boom'));
        await act(async () => {
            await result.current.reload();
        });
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('boom');
    });

    it('hands back the identical options array while the values are unchanged', async () => {
        const rows = [
            { name: 'pod-a', namespace: 'default' },
            { name: 'pod-b', namespace: 'kube-system' },
        ];
        // A new array of new objects each call, exactly as a poll produces.
        const fetcher = vi.fn<(clusterName: string) => Promise<any[]>>(async () => rows.map((r) => ({ ...r })));

        const { result } = setup(fetcher);
        await waitFor(() => expect(result.current.items).toHaveLength(2));

        const before = result.current.buildInOptions('namespace');
        await act(async () => {
            await result.current.reload();
        });
        const after = result.current.buildInOptions('namespace');

        expect(after).toBe(before);
        expect(before.map((o) => o.value)).toEqual(['default', 'kube-system']);
    });
});
