import { useCallback, useEffect, useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import { VscInfo, VscRefresh, VscCopy, VscCheck } from 'react-icons/vsc';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { GetObjectDescribe } from '../../../wailsjs/go/controller_app/App';
import { errText } from '../../lib/errText';
import ErrorBanner from '../shared/ErrorBanner';

export interface DescribePanelParams {
    clusterName: string;
    /** Plural resource name, e.g. "pods" — the same strings the sidebar uses. */
    resource: string;
    name: string;
    namespace: string;
}

/**
 * Read-only `kubectl describe` output for one object.
 *
 * Deliberately NOT Monaco: this is a plain text dump with no editing, no
 * language and no schema, and Monaco is the heaviest import in the bundle —
 * paying for it here would slow every panel's first paint for a <pre> block.
 */
export default function DescribePanel({ params }: IDockviewPanelProps<DescribePanelParams>) {
    const { clusterName, resource, name, namespace } = params;
    const [text, setText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    // Describe output can be long; keep the scroll position across a refresh.
    const preRef = useRef<HTMLPreElement>(null);

    const load = useCallback(async () => {
        setBusy(true);
        const keepScroll = preRef.current?.scrollTop ?? 0;
        try {
            const result = await GetObjectDescribe(clusterName, resource, namespace, name);
            setText(result);
            setError(null);
            requestAnimationFrame(() => {
                if (preRef.current) preRef.current.scrollTop = keepScroll;
            });
        } catch (e) {
            // Same rule as the list views: the last good text stays on screen and
            // the banner says it is stale, rather than blanking what someone reads.
            setError(errText(e));
        } finally {
            setLoaded(true);
            setBusy(false);
        }
    }, [clusterName, resource, namespace, name]);

    useEffect(() => {
        load();
    }, [load]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard unavailable — the text is selectable either way */
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="yaml-editor-toolbar flex align-items-center justify-content-between">
                <span className="yaml-editor-toolbar__label flex align-items-center gap-1">
                    <VscInfo size={14} />
                    {namespace ? `${namespace}/${name}` : name}
                </span>
                <div className="flex align-items-center gap-1 flex-shrink-0">
                    <Button
                        label="Refresh"
                        icon={<VscRefresh size={16} />}
                        text
                        size="small"
                        loading={busy}
                        onClick={load}
                    />
                    <Button
                        label={copied ? 'Copied' : 'Copy'}
                        icon={copied ? <VscCheck size={16} /> : <VscCopy size={16} />}
                        text
                        size="small"
                        disabled={!text}
                        onClick={copy}
                    />
                </div>
            </div>

            <ErrorBanner
                message={error}
                onRetry={load}
                busy={busy}
                stale={text.length > 0}
                context={`describe ${resource} ${namespace ? `${namespace}/` : ''}${name} (${clusterName})`}
            />

            {!loaded ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ProgressSpinner style={{ width: 40, height: 40 }} strokeWidth="4" />
                </div>
            ) : (
                <pre
                    ref={preRef}
                    style={{
                        flex: 1,
                        minHeight: 0,
                        margin: 0,
                        padding: '0.75rem 1rem',
                        overflow: 'auto',
                        whiteSpace: 'pre',
                        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: 'var(--ink)',
                        background: 'var(--panel)',
                        userSelect: 'text',
                    }}
                >
                    {text}
                </pre>
            )}
        </div>
    );
}
