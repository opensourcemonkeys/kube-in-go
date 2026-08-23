import { useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import Editor, { OnMount } from '@monaco-editor/react';
// Configures @monaco-editor/react to use the bundled Monaco. Side-effect
// import: this panel is lazily loaded, so Monaco arrives with it.
import '../../lib/monacoBootstrap';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { VscCloudUpload, VscTrash, VscOutput, VscClose } from 'react-icons/vsc';
import { Toast } from 'primereact/toast';
import type * as monaco from 'monaco-editor';
import { ApplyYaml } from '../../../wailsjs/go/controller_app/App';
import { MONOLITH_THEME } from '../../lib/monacoTheme';
import { ensureK8sYamlIntellisense, k8sYamlSuggestOptions } from '../../lib/k8sYamlIntellisense';
import { useClusterContext } from '../../contexts/ClusterContext';
import { renderPanelTitle } from '../../contexts/TabContext';
import { useT } from '../../i18n/useT';

interface ApplyYamlPanelParams {
    clusterName?: string;
    titleKey?: string;
    titleVars?: Record<string, string | number | undefined>;
}

export default function ApplyYamlPanel({ api, params }: IDockviewPanelProps<ApplyYamlPanelParams>) {
    const t = useT();
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const toast = useRef<Toast | null>(null);
    const [applying, setApplying] = useState(false);
    const [output, setOutput] = useState('');
    const [outputHeight, setOutputHeight] = useState(200);

    const { clusters, activeCluster } = useClusterContext();
    // This panel writes, so unlike the read-only views it is retargetable: the
    // seeded cluster is only a default, and the choice is mirrored back into
    // params so a panel moved to another window keeps its target.
    const [cluster, setCluster] = useState(params.clusterName || activeCluster || '');

    const handleClusterChange = (next: string) => {
        setCluster(next);
        // See TerminalPanel: retitle from the key so the tab survives a
        // language switch instead of freezing at the English string.
        const titleVars = { ...(params.titleVars ?? {}), suffix: next || undefined };
        api.updateParameters({ clusterName: next, titleVars });
        api.setTitle(renderPanelTitle(t, { titleKey: params.titleKey, titleVars }));
    };

    const handleMount: OnMount = (editor) => {
        editorRef.current = editor;
        // Expose the most-recently-mounted editor for E2E tests.
        // window.__kubeInsYamlEditor is overwritten each time a new panel opens,
        // so it always refers to the newest ApplyYamlPanel instance.
        (window as unknown as Record<string, unknown>).__kubeInsYamlEditor = editor;
        requestAnimationFrame(() => editor.layout());
        ensureK8sYamlIntellisense();
    };

    const handleApply = async () => {
        const yaml = editorRef.current?.getValue() ?? '';
        if (!yaml.trim()) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Empty',
                detail: 'Nothing to apply — editor is empty.',
                life: 2500,
            });
            return;
        }

        if (!cluster) {
            toast.current?.show({
                severity: 'warn',
                summary: 'No cluster',
                detail: 'Pick a target cluster before applying.',
                life: 2500,
            });
            return;
        }

        setApplying(true);
        setOutput('');
        try {
            const result = await ApplyYaml(cluster, yaml);
            setOutput(result);
            toast.current?.show({
                severity: 'success',
                summary: 'Applied',
                detail: `Applied to ${cluster}.`,
                life: 2500,
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setOutput(msg);
            toast.current?.show({
                severity: 'error',
                summary: 'Apply failed',
                detail: msg,
                life: 4000,
            });
        } finally {
            setApplying(false);
        }
    };

    const handleClear = () => {
        editorRef.current?.setValue('');
        setOutput('');
    };

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = outputHeight;

        const onMouseMove = (me: MouseEvent) => {
            const delta = startY - me.clientY;
            const containerH = containerRef.current?.clientHeight ?? 800;
            const next = Math.max(60, Math.min(startHeight + delta, containerH - 80));
            setOutputHeight(next);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <div className="yaml-editor-panel flex flex-column h-full">
            <Toast ref={toast} position="bottom-right" />

            <div className="yaml-editor-toolbar flex align-items-center justify-content-between">
                <span className="yaml-editor-toolbar__label flex align-items-center gap-1">
                    <VscCloudUpload size={14} />{' '}
                    {t('panels:applyYaml.label')}
                </span>
                <div className="flex align-items-center gap-2 flex-shrink-0">
                    <Dropdown
                        value={cluster || null}
                        options={clusters}
                        onChange={(e) => handleClusterChange(e.value ?? '')}
                        placeholder={t('panels:applyYaml.selectCluster')}
                        disabled={applying}
                        className="yaml-editor-toolbar__cluster"
                        style={{ minWidth: '11rem' }}
                        aria-label={t('panels:applyYaml.clusterAria')}
                    />
                    <Button
                        label={t('panels:applyYaml.clear')}
                        icon={<VscTrash size={16} />}
                        text
                        size="small"
                        severity="secondary"
                        disabled={applying}
                        onClick={handleClear}
                    />
                    <Button
                        label={t('panels:applyYaml.apply')}
                        icon={<VscOutput size={16} />}
                        size="small"
                        loading={applying}
                        onClick={handleApply}
                    />
                </div>
            </div>

            <div ref={containerRef} className="flex flex-column flex-1 overflow-hidden min-h-0">
                <div style={{ flex: 1, minHeight: 0 }}>
                    <Editor
                        height="100%"
                        defaultLanguage="yaml"
                        language="yaml"
                        defaultValue=""
                        theme={MONOLITH_THEME}
                        onMount={handleMount}
                        options={{
                            ...k8sYamlSuggestOptions,
                            minimap: { enabled: false },
                            fontSize: 13,
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            automaticLayout: true,
                            lineNumbers: 'on',
                            folding: true,
                        }}
                    />
                </div>

                {output && (
                    <>
                        <div
                            onMouseDown={handleResizeMouseDown}
                            style={{
                                height: '5px',
                                flexShrink: 0,
                                cursor: 'ns-resize',
                                background: 'var(--surface-border)',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-color)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-border)')}
                        />

                        <div
                            style={{
                                height: `${outputHeight}px`,
                                flexShrink: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                background: 'var(--panel)',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '2px 10px 2px 14px',
                                    borderBottom: '1px solid var(--line)',
                                    flexShrink: 0,
                                }}
                            >
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-color-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                    {t('panels:applyYaml.output')}
                                </span>
                                <Button
                                    icon={<VscClose size={14} />}
                                    text
                                    size="small"
                                    severity="secondary"
                                    style={{ padding: '0.15rem' }}
                                    onClick={() => setOutput('')}
                                />
                            </div>

                            <pre
                                style={{
                                    flex: 1,
                                    margin: 0,
                                    padding: '10px 14px',
                                    fontFamily: 'var(--font-family-mono)',
                                    fontSize: 12,
                                    color: 'var(--amber)',
                                    whiteSpace: 'pre-wrap',
                                    overflowY: 'auto',
                                }}
                            >
                                {output}
                            </pre>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
