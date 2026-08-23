import React, { Suspense } from 'react';
import { VscWarning, VscRefresh, VscCopy, VscCheck } from 'react-icons/vsc';
import { useDiagnosticsStore } from '../../stores/diagnosticsStore';
import { copyDiagnostics } from '../../lib/diagnosticsReport';
import { useT } from '../../i18n/useT';
import PanelSkeleton from './PanelSkeleton';

interface Props {
    /** Where the crash happened — a Dockview panel id, or "app" for the root. */
    label: string;
    /** Whole-window boundary: fills the viewport and offers no "reload panel". */
    root?: boolean;
    children: React.ReactNode;
}

interface State {
    error: Error | null;
    /** Bumped by "Reload panel" to remount the subtree from scratch. */
    attempt: number;
}

/**
 * React error boundary.
 *
 * Without one, a single component that throws during render unmounts the entire
 * tree — the app goes white and takes every other open panel with it. Wrapping
 * each Dockview panel keeps a crash inside the tab that caused it.
 *
 * `componentDidCatch` is also the only place a React crash can be recorded at
 * all: the Go log file cannot see a renderer stack, so the stack goes into
 * diagnosticsStore, where "Copy diagnostics" picks it up.
 */
export default class PanelErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null, attempt: 0 };

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(`[${this.props.label}] panel crashed:`, error, info.componentStack);
        useDiagnosticsStore
            .getState()
            .recordUiError(
                this.props.label,
                error?.message ?? String(error),
                [error?.stack, info?.componentStack].filter(Boolean).join('\n'),
            );
    }

    render() {
        const { error, attempt } = this.state;
        if (!error) {
            // The key is what makes "Reload panel" work: changing it discards the
            // crashed subtree's state instead of re-rendering it into the same throw.
            return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
        }
        return (
            <CrashCard
                label={this.props.label}
                error={error}
                root={this.props.root}
                onReload={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}
            />
        );
    }
}

function CrashCard({ label, error, root, onReload }: {
    label: string;
    error: Error;
    root?: boolean;
    onReload: () => void;
}) {
    const t = useT();
    const [copied, setCopied] = React.useState(false);

    const copy = async () => {
        const ok = await copyDiagnostics(`${label} crashed: ${error?.message ?? String(error)}`);
        setCopied(ok);
        window.setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="crash-card">
            <VscWarning className="crash-card__icon" />
            <div className="crash-card__title">{root ? t('errors:boundary.appTitle') : t('errors:boundary.panelTitle')}</div>
            <div className="crash-card__msg">{error?.message ?? String(error)}</div>
            <div className="crash-card__actions">
                <button type="button" className="crash-card__btn" onClick={root ? () => window.location.reload() : onReload}>
                    <VscRefresh /> {root ? t('errors:boundary.reloadWindow') : t('errors:boundary.reloadPanel')}
                </button>
                <button type="button" className="crash-card__btn" onClick={copy}>
                    {copied ? <VscCheck /> : <VscCopy />} {copied ? t('errors:boundary.copied') : t('errors:boundary.copyDiagnostics')}
                </button>
            </div>
            <div className="crash-card__hint">{t('errors:boundary.hint')}</div>
        </div>
    );
}

/**
 * Wraps a Dockview panel component in a boundary and a Suspense fallback.
 * Applied once to the whole `components` map in DockviewContainer, so every
 * panel type gets both and a new entry cannot forget to.
 *
 * Suspense sits *inside* the boundary on purpose: a chunk that fails to load
 * throws, and the crash card (with its Copy diagnostics button) is a far better
 * answer than an unmounted tree. Panels that are not lazy never suspend, so
 * wrapping all of them costs nothing and keeps the map uniform.
 */
export function withBoundary<P extends object>(Component: React.ComponentType<P>, name: string) {
    const Wrapped = (props: P) => (
        <PanelErrorBoundary label={(props as { api?: { id?: string } })?.api?.id ?? name}>
            <Suspense fallback={<PanelSkeleton />}>
                <Component {...props} />
            </Suspense>
        </PanelErrorBoundary>
    );
    Wrapped.displayName = `withBoundary(${name})`;
    return Wrapped;
}
