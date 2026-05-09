import { useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import Editor, { OnMount } from '@monaco-editor/react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import type * as monaco from 'monaco-editor';
import { ApplyYaml } from '../../../wailsjs/go/controller_app/App';
import { MONOLITH_THEME, registerMonolithTheme } from '../../lib/monacoTheme';

export default function ApplyYamlPanel(_props: IDockviewPanelProps<Record<string, never>>) {
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const toast = useRef<Toast | null>(null);
    const [applying, setApplying] = useState(false);
    const [output, setOutput] = useState('');

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

    return (
        <div className="yaml-editor-panel flex flex-column h-full">
            <Toast ref={toast} position="top-right" />

            <div className="yaml-editor-toolbar flex align-items-center justify-content-between">
                <span className="yaml-editor-toolbar__label flex align-items-center gap-1">
                    <i className="pi pi-upload" />
                    YAML Editor
                </span>
                <div className="flex align-items-center gap-1 flex-shrink-0">
                    <Button
                        label="Clear"
                        icon="pi pi-trash"
                        text
                        size="small"
                        severity="secondary"
                        disabled={applying}
                        onClick={handleClear}
                    />
                    <Button
                        label="Apply"
                        icon="pi pi-send"
                        size="small"
                        loading={applying}
                        onClick={handleApply}
                    />
                </div>
            </div>

            <div className="flex flex-column flex-1 overflow-hidden min-h-0">
                <div style={{ flex: output ? '0 0 60%' : '1', minHeight: 0 }}>
                    <Editor
                        height="100%"
                        defaultLanguage="yaml"
                        language="yaml"
                        defaultValue=""
                        theme={MONOLITH_THEME}
                        beforeMount={registerMonolithTheme}
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
                    <div
                        style={{
                            flex: '0 0 40%',
                            borderTop: '1px solid rgba(64,72,93,0.3)',
                            background: '#060e20',
                            padding: '10px 14px',
                            fontFamily: '"Cascadia Code", "Fira Code", monospace',
                            fontSize: 12,
                            color: '#9bffce',
                            whiteSpace: 'pre-wrap',
                            overflowY: 'auto',
                        }}
                    >
                        {output}
                    </div>
                )}
            </div>
        </div>
    );
}
