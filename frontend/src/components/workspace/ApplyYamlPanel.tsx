import { useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import Editor, { OnMount } from '@monaco-editor/react';
import { Button } from 'primereact/button';



import { VscCloudUpload, VscTrash, VscOutput, VscClose } from 'react-icons/vsc';
import { Toast } from 'primereact/toast';
import type * as monaco from 'monaco-editor';
import { ApplyYaml } from '../../../wailsjs/go/controller_app/App';
import { MONOLITH_THEME } from '../../lib/monacoTheme';

export default function ApplyYamlPanel(_props: IDockviewPanelProps<Record<string, never>>) {
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const toast = useRef<Toast | null>(null);
    const [applying, setApplying] = useState(false);
    const [output, setOutput] = useState('');
    const [outputHeight, setOutputHeight] = useState(200);

    const handleMount: OnMount = (editor) => {
        editorRef.current = editor;
        requestAnimationFrame(() => editor.layout());
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

        setApplying(true);
        setOutput('');
        try {
            const result = await ApplyYaml(yaml);
            setOutput(result);
            toast.current?.show({
                severity: 'success',
                summary: 'Applied',
                detail: 'Resources applied successfully.',
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
                    YAML Editor
                </span>
                <div className="flex align-items-center gap-1 flex-shrink-0">
                    <Button
                        label="Clear"
                        icon={<VscTrash size={16} />}
                        text
                        size="small"
                        severity="secondary"
                        disabled={applying}
                        onClick={handleClear}
                    />
                    <Button
                        label="Apply"
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
                                    Output
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
