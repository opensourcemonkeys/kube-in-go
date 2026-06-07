import { useEffect, useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import Editor, { OnMount } from '@monaco-editor/react';


import { VscNote, VscDiscard, VscCheck } from 'react-icons/vsc';
import * as monacoEditor from 'monaco-editor';
import { MONOLITH_THEME } from '../../lib/monacoTheme';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import {
    GetK8sSchema,
    GetPodYaml,
    GetDeploymentYaml, UpdateDeploymentYaml,
    GetStatefulSetYaml, UpdateStatefulSetYaml,
    GetReplicaSetYaml, UpdateReplicaSetYaml,
    GetDaemonSetYaml, UpdateDaemonSetYaml,
    GetJobYaml,
    GetCronJobYaml, UpdateCronJobYaml,
    GetConfigMapYaml, UpdateConfigMapYaml,
    GetSecretYaml, UpdateSecretYaml,
    GetNodeYaml, UpdateNodeYaml,
    GetNamespaceYaml,
    GetResourceQuotaYaml, UpdateResourceQuotaYaml,
    GetServiceYaml, UpdateServiceYaml,
    GetIngressYaml, UpdateIngressYaml,
    GetIngressClassYaml,
    GetEndpointYaml,
    GetLimitRangeYaml, UpdateLimitRangeYaml,
    GetPersistentVolumeYaml,
    GetPersistentVolumeClaimYaml,
    GetStorageClassYaml,
    GetServiceAccountYaml, UpdateServiceAccountYaml,
    GetRoleYaml, UpdateRoleYaml,
    GetRoleBindingYaml, UpdateRoleBindingYaml,
} from '../../../wailsjs/go/controller_app/App';

interface YamlEditorPanelParams {
    clusterName: string;
    resourceKind: 'pod' | 'deployment' | 'statefulset' | 'replicaset' | 'daemonset' | 'job' | 'cronjob' | 'service' | 'ingress' | 'ingressclass' | 'endpoint' | 'configmap' | 'secret' | 'node' | 'namespace' | 'resourcequota' | 'limitrange' | 'persistentvolume' | 'persistentvolumeclaim' | 'storageclass' | 'serviceaccount' | 'role' | 'rolebinding';
    name: string;
    namespace: string;
}

const editable = (kind: string) => ['deployment', 'statefulset', 'replicaset', 'daemonset', 'cronjob', 'service', 'ingress', 'configmap', 'secret', 'node', 'resourcequota', 'limitrange', 'serviceaccount', 'role', 'rolebinding'].includes(kind);

export default function YamlEditorPanel({ params }: IDockviewPanelProps<YamlEditorPanelParams>) {
    const { clusterName, resourceKind, name, namespace } = params;
    const [yaml, setYaml] = useState('Loading...');
    const [originalYaml, setOriginalYaml] = useState('');
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
    const toast = useRef<Toast | null>(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                let result = '';
                if (resourceKind === 'pod') {
                    result = await GetPodYaml(clusterName, name, namespace);
                } else if (resourceKind === 'deployment') {
                    result = await GetDeploymentYaml(clusterName, name, namespace);
                } else if (resourceKind === 'statefulset') {
                    result = await GetStatefulSetYaml(clusterName, name, namespace);
                } else if (resourceKind === 'replicaset') {
                    result = await GetReplicaSetYaml(clusterName, name, namespace);
                } else if (resourceKind === 'daemonset') {
                    result = await GetDaemonSetYaml(clusterName, name, namespace);
                } else if (resourceKind === 'job') {
                    result = await GetJobYaml(clusterName, name, namespace);
                } else if (resourceKind === 'cronjob') {
                    result = await GetCronJobYaml(clusterName, name, namespace);
                } else if (resourceKind === 'configmap') {
                    result = await GetConfigMapYaml(clusterName, name, namespace);
                } else if (resourceKind === 'secret') {
                    result = await GetSecretYaml(clusterName, name, namespace);
                } else if (resourceKind === 'node') {
                    result = await GetNodeYaml(clusterName, name);
                } else if (resourceKind === 'namespace') {
                    result = await GetNamespaceYaml(clusterName, name);
                } else if (resourceKind === 'resourcequota') {
                    result = await GetResourceQuotaYaml(clusterName, name, namespace);
                } else if (resourceKind === 'service') {
                    result = await GetServiceYaml(clusterName, name, namespace);
                } else if (resourceKind === 'ingress') {
                    result = await GetIngressYaml(clusterName, name, namespace);
                } else if (resourceKind === 'ingressclass') {
                    result = await GetIngressClassYaml(clusterName, name);
                } else if (resourceKind === 'endpoint') {
                    result = await GetEndpointYaml(clusterName, name, namespace);
                } else if (resourceKind === 'limitrange') {
                    result = await GetLimitRangeYaml(clusterName, name, namespace);
                } else if (resourceKind === 'persistentvolume') {
                    result = await GetPersistentVolumeYaml(clusterName, name);
                } else if (resourceKind === 'persistentvolumeclaim') {
                    result = await GetPersistentVolumeClaimYaml(clusterName, name, namespace);
                } else if (resourceKind === 'storageclass') {
                    result = await GetStorageClassYaml(clusterName, name);
                } else if (resourceKind === 'serviceaccount') {
                    result = await GetServiceAccountYaml(clusterName, name, namespace);
                } else if (resourceKind === 'role') {
                    result = await GetRoleYaml(clusterName, name, namespace);
                } else if (resourceKind === 'rolebinding') {
                    result = await GetRoleBindingYaml(clusterName, name, namespace);
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

    const handleMount: OnMount = async (editor, monaco) => {
        editorRef.current = editor;
        requestAnimationFrame(() => editor.layout());

        let schema: Record<string, unknown> = {};
        try {
            const raw = await GetK8sSchema();
            schema = JSON.parse(raw);
        } catch {
            return;
        }

        type SchemaDef = {
            description?: string;
            properties?: Record<string, { description?: string; $ref?: string }>;
            items?: { $ref?: string };
            $ref?: string;
        };
        const defs = schema.definitions as Record<string, SchemaDef>;
        if (!defs) return;

        // Build kind -> definition key map from x-kubernetes-group-version-kind
        const kindToDefKey = new Map<string, string>();
        for (const [key, def] of Object.entries(defs)) {
            const gvk = (def as any)['x-kubernetes-group-version-kind'];
            if (Array.isArray(gvk)) {
                for (const entry of gvk) {
                    if (entry.kind) kindToDefKey.set(entry.kind as string, key);
                }
            }
        }

        const resolveRef = (ref: string): SchemaDef | undefined => {
            const key = ref.replace('#/definitions/', '');
            return defs[key];
        };

        const getPropsForDef = (def: SchemaDef): Array<{ key: string; desc: string; hasChildren: boolean }> => {
            if (!def.properties) return [];
            return Object.entries(def.properties).map(([key, val]) => ({
                key,
                desc: val.description ?? '',
                hasChildren: !!(val.$ref || (val as any).type === 'object' || (val as any).type === 'array'),
            }));
        };

        // Parse YAML lines to find the definition at cursor's indent level
        const resolveDefAtCursor = (lines: string[], lineIndex: number): SchemaDef | null => {
            const cursorIndent = lines[lineIndex].match(/^(\s*)/)?.[1].length ?? 0;

            // Find kind in document
            let docKind = '';
            for (const l of lines) {
                const m = l.match(/^kind:\s*(\S+)/);
                if (m) { docKind = m[1]; break; }
            }
            const rootDefKey = kindToDefKey.get(docKind);
            if (!rootDefKey) return null;

            // Walk parent keys from root definition to cursor indent
            interface Frame { def: SchemaDef; indent: number }
            const stack: Frame[] = [{ def: defs[rootDefKey], indent: -1 }];

            for (let i = 0; i < lineIndex; i++) {
                const line = lines[i];
                if (!line.trim() || line.trim().startsWith('#')) continue;
                const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
                const keyMatch = line.match(/^\s*(\w[\w-]*):/);
                if (!keyMatch) continue;
                const key = keyMatch[1];
                if (indent >= cursorIndent) continue;

                // Pop stack frames that are at same or deeper indent
                while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();

                const parentDef = stack[stack.length - 1].def;
                const propSchema = parentDef.properties?.[key];
                if (!propSchema) continue;

                let childDef: SchemaDef | undefined;
                if (propSchema.$ref) {
                    childDef = resolveRef(propSchema.$ref);
                } else if ((propSchema as any).items?.$ref) {
                    childDef = resolveRef((propSchema as any).items.$ref);
                }
                if (childDef) stack.push({ def: childDef, indent });
            }

            return stack[stack.length - 1].def;
        };

        const disposables: monacoEditor.IDisposable[] = [];

        disposables.push(monaco.languages.registerCompletionItemProvider('yaml', {
            triggerCharacters: ['\n'],
            provideCompletionItems(model, position) {
                const lines = model.getLinesContent();
                const lineIndex = position.lineNumber - 1;
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };

                const def = resolveDefAtCursor(lines, lineIndex);
                const props = def ? getPropsForDef(def) : [];

                const suggestions: monacoEditor.languages.CompletionItem[] = props.map(({ key, desc, hasChildren }) => ({
                    label: key,
                    kind: monaco.languages.CompletionItemKind.Field,
                    documentation: desc,
                    insertText: hasChildren ? key + ':\n' : key + ': ',
                    range,
                }));
                return { suggestions };
            },
        }));

        disposables.push(monaco.languages.registerHoverProvider('yaml', {
            provideHover(model, position) {
                const word = model.getWordAtPosition(position);
                if (!word) return null;
                const lines = model.getLinesContent();
                const lineIndex = position.lineNumber - 1;
                const def = resolveDefAtCursor(lines, lineIndex);
                if (!def?.properties) return null;
                const prop = def.properties[word.word];
                if (!prop?.description) return null;
                return {
                    contents: [
                        { value: `**${word.word}**` },
                        { value: prop.description },
                    ],
                };
            },
        }));

        editor.onDidDispose(() => disposables.forEach(d => d.dispose()));
    };

    const handleChange = (value: string | undefined) => {
        setDirty((value ?? '') !== originalYaml);
    };

    const handleSave = async () => {
        const value = editorRef.current?.getValue() ?? yaml;
        setSaving(true);
        try {
            if (resourceKind === 'deployment') {
                await UpdateDeploymentYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'statefulset') {
                await UpdateStatefulSetYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'replicaset') {
                await UpdateReplicaSetYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'daemonset') {
                await UpdateDaemonSetYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'cronjob') {
                await UpdateCronJobYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'configmap') {
                await UpdateConfigMapYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'secret') {
                await UpdateSecretYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'node') {
                await UpdateNodeYaml(clusterName, name, value);
            } else if (resourceKind === 'resourcequota') {
                await UpdateResourceQuotaYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'service') {
                await UpdateServiceYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'ingress') {
                await UpdateIngressYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'limitrange') {
                await UpdateLimitRangeYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'serviceaccount') {
                await UpdateServiceAccountYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'role') {
                await UpdateRoleYaml(clusterName, name, namespace, value);
            } else if (resourceKind === 'rolebinding') {
                await UpdateRoleBindingYaml(clusterName, name, namespace, value);
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
                    <VscNote size={14} />
                    {namespace}/{name}
                </span>
                <div className="flex align-items-center gap-1 flex-shrink-0">
                    {editable(resourceKind) && (
                        <>
                            <Button
                                label="Revert"
                                icon={<VscDiscard size={16} />}
                                text
                                size="small"
                                disabled={!dirty || saving}
                                onClick={handleRevert}
                            />
                            <Button
                                label="Save"
                                icon={<VscCheck size={16} />}
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
