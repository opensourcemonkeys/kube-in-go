import { useEffect, useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import Editor, { OnMount } from '@monaco-editor/react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import type * as monaco from 'monaco-editor';
import { GetPodYaml, GetDeploymentYaml, UpdateDeploymentYaml } from '../../../wailsjs/go/controller_app/App';

interface YamlEditorPanelParams {
    resourceKind: 'pod' | 'deployment';
    name: string;
    namespace: string;
}

const editable = (kind: string) => kind === 'deployment';

export default function YamlEditorPanel({ params, api }: IDockviewPanelProps<YamlEditorPanelParams>) {
    const { resourceKind, name, namespace } = params;
    const [yaml, setYaml] = useState('Loading...');
    const [originalYaml, setOriginalYaml] = useState('');
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const toast = useRef<Toast | null>(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                let result = '';
                if (resourceKind === 'pod') {
                    result = await GetPodYaml(name, namespace);
                } else if (resourceKind === 'deployment') {
                    result = await GetDeploymentYaml(name, namespace);
                }
                const content = result || 'No YAML available';
                setYaml(content);
                setOriginalYaml(content);
            } catch {
                setYaml('Failed to load YAML.');
            }
        };
        fetch();
    }, [resourceKind, name, namespace]);

    const handleMount: OnMount = (editor) => {
        editorRef.current = editor;
        requestAnimationFrame(() => editor.layout());
    };

    const handleChange = (value: string | undefined) => {
        setDirty((value ?? '') !== originalYaml);
    };

    const handleSave = async () => {
        const value = editorRef.current?.getValue() ?? yaml;
        setSaving(true);
        try {
            if (resourceKind === 'deployment') {
                await UpdateDeploymentYaml(name, namespace, value);
            }
            setOriginalYaml(value);
            setYaml(value);
            setDirty(false);
            toast.current?.show({
                severity: 'success',
                summary: 'Updated',
                detail: `${namespace}/${name} updated`,
                life: 2500,
            });
        } catch {
            toast.current?.show({
                severity: 'error',
                summary: 'Update failed',
                detail: `${namespace}/${name} could not be updated`,
                life: 3500,
            });
        } finally {
            setSaving(false);
        }
    };

    const handleRevert = () => {
        editorRef.current?.setValue(originalYaml);
        setDirty(false);
    };

    const handleClose = () => {
        api.close();
    };

    return (
        <div className="yaml-editor-panel">
            <Toast ref={toast} position="top-right" />

            <div className="yaml-editor-toolbar">
                <span className="yaml-editor-toolbar__label">
                    <i className="pi pi-file-edit" style={{ marginRight: 6 }} />
                    {namespace}/{name}
                </span>
                <div className="yaml-editor-toolbar__actions">
                    {editable(resourceKind) && (
                        <>
                            <Button
                                label="Revert"
                                icon="pi pi-undo"
                                text
                                size="small"
                                disabled={!dirty || saving}
                                onClick={handleRevert}
                            />
                            <Button
                                label="Save"
                                icon="pi pi-check"
                                size="small"
                                loading={saving}
                                disabled={!dirty}
                                onClick={handleSave}
                            />
                        </>
                    )}
                    <Button
                        icon="pi pi-times"
                        text
                        size="small"
                        severity="secondary"
                        onClick={handleClose}
                        style={{ marginLeft: 4 }}
                    />
                </div>
            </div>

            <div className="yaml-editor-content">
                <Editor
                    height="100%"
                    defaultLanguage="yaml"
                    language="yaml"
                    value={yaml}
                    theme="vs-dark"
                    onMount={handleMount}
                    onChange={handleChange}
                    options={{
                        readOnly: !editable(resourceKind),
                        minimap: { enabled: true },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                        lineNumbers: 'on',
                        folding: true,
                        renderLineHighlight: 'all',
                    }}
                />
            </div>
        </div>
    );
}
