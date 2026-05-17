import { useEffect, useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import Editor, { OnMount } from '@monaco-editor/react';
import { MONOLITH_THEME } from '../../lib/monacoTheme';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import type * as monaco from 'monaco-editor';
import {
    GetPodYaml,
    GetDeploymentYaml, UpdateDeploymentYaml,
    GetStatefulSetYaml, UpdateStatefulSetYaml,
    GetReplicaSetYaml, UpdateReplicaSetYaml,
    GetDaemonSetYaml, UpdateDaemonSetYaml,
} from '../../../wailsjs/go/controller_app/App';

interface YamlEditorPanelParams {
    resourceKind: 'pod' | 'deployment' | 'statefulset' | 'replicaset' | 'daemonset';
    name: string;
    namespace: string;
}

const editable = (kind: string) => ['deployment', 'statefulset', 'replicaset', 'daemonset'].includes(kind);

export default function YamlEditorPanel({ params }: IDockviewPanelProps<YamlEditorPanelParams>) {
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
                } else if (resourceKind === 'statefulset') {
                    result = await GetStatefulSetYaml(name, namespace);
                } else if (resourceKind === 'replicaset') {
                    result = await GetReplicaSetYaml(name, namespace);
                } else if (resourceKind === 'daemonset') {
                    result = await GetDaemonSetYaml(name, namespace);
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
            } else if (resourceKind === 'statefulset') {
                await UpdateStatefulSetYaml(name, namespace, value);
            } else if (resourceKind === 'replicaset') {
                await UpdateReplicaSetYaml(name, namespace, value);
            } else if (resourceKind === 'daemonset') {
                await UpdateDaemonSetYaml(name, namespace, value);
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

    return (
        <div className="yaml-editor-panel flex flex-column h-full">
            <Toast ref={toast} position="bottom-right" />

            <div className="yaml-editor-toolbar flex align-items-center justify-content-between">
                <span className="yaml-editor-toolbar__label flex align-items-center gap-1">
                    <i className="pi pi-file-edit" />
                    {namespace}/{name}
                </span>
                <div className="flex align-items-center gap-1 flex-shrink-0">
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
                </div>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
                <Editor
                    height="100%"
                    defaultLanguage="yaml"
                    language="yaml"
                    value={yaml}
                    theme={MONOLITH_THEME}
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
