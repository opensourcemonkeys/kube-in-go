import { useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';

interface YamlViewDialogProps {
    visible: boolean;
    title: string;
    yaml: string;
    language?: string;
    editable?: boolean;
    saving?: boolean;
    onSave?: (yaml: string) => void;
    onHide: () => void;
}

export default function YamlViewDialog({
    visible,
    title,
    yaml,
    language = 'yaml',
    editable = false,
    saving = false,
    onSave,
    onHide,
}: YamlViewDialogProps) {
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    const handleEditorMount: OnMount = (editor) => {
        editorRef.current = editor;
    };

    const handleDialogShow = () => {
        // Trigger a single layout pass after the open animation finishes
        requestAnimationFrame(() => editorRef.current?.layout());
    };

    const footer = editable && onSave ? (
        <div className="flex justify-content-end gap-2" style={{ padding: '0.75rem 1rem' }}>
            <Button label="Cancel" icon="pi pi-times" text onClick={onHide} disabled={saving} />
            <Button
                label="Update"
                icon="pi pi-check"
                onClick={() => onSave(editorRef.current?.getValue() ?? yaml)}
                loading={saving}
            />
        </div>
    ) : undefined;

    return (
        <Dialog
            header={title}
            visible={visible}
            position="right"
            modal
            footer={footer}
            style={{ width: '45vw', height: '100vh', margin: 0 }}
            contentStyle={{ padding: 0, overflow: 'hidden', flex: 1 }}
            onHide={onHide}
            onShow={handleDialogShow}
            transitionOptions={{ unmountOnExit: false, mountOnEnter: false, timeout: 300 }}
        >
            <Editor
                height="100%"
                defaultLanguage={language}
                language={language}
                value={yaml}
                theme="vs-dark"
                onMount={handleEditorMount}
                options={{
                    readOnly: !editable,
                    minimap: { enabled: true },
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: false,
                    lineNumbers: 'on',
                    folding: true,
                    renderLineHighlight: 'all',
                }}
            />
        </Dialog>
    );
}
