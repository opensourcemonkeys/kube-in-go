import { ProgressSpinner } from 'primereact/progressspinner';

/**
 * What a lazily-loaded panel shows while its chunk is downloading.
 *
 * Deliberately tiny and dependency-free beyond PrimeReact (already in the
 * entry chunk): a fallback that pulled in anything heavy would defeat the code
 * splitting it exists to serve. Matches the in-panel loading state the list
 * views use, so a first open and a slow refresh look the same.
 */
export default function PanelSkeleton() {
    return (
        <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--app)',
        }}>
            <ProgressSpinner style={{ width: 40, height: 40 }} strokeWidth="4" />
        </div>
    );
}
