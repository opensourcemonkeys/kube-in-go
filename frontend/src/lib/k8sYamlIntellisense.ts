import * as monaco from 'monaco-editor';
import { GetK8sSchema } from '../../wailsjs/go/controller_app/App';

// K8s YAML intellisense: completion + hover providers backed by the embedded
// OpenAPI schema (business/assets/k8s-schema.json via GetK8sSchema).
// Registered once globally — call ensureK8sYamlIntellisense() from any
// editor mount; repeated calls are no-ops.

type SchemaDef = {
    description?: string;
    properties?: Record<string, { description?: string; $ref?: string }>;
    items?: { $ref?: string };
    $ref?: string;
};

let registration: Promise<void> | null = null;

export function ensureK8sYamlIntellisense(): Promise<void> {
    if (!registration) {
        registration = register().catch(err => {
            // Allow a retry on the next editor mount if the schema fetch failed.
            registration = null;
            console.error('k8s yaml intellisense setup failed:', err);
        });
    }
    return registration;
}

async function register(): Promise<void> {
    const raw = await GetK8sSchema();
    const schema = JSON.parse(raw) as Record<string, unknown>;
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
            const keyMatch = line.match(/^\s*(?:-\s+)?(\w[\w-]*):/);
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

    monaco.languages.registerCompletionItemProvider('yaml', {
        triggerCharacters: ['\n', ' '],
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

            // Value completion for `kind:` — lists every known kind. This is
            // what makes an empty Apply YAML panel useful before a kind exists.
            const beforeCursor = lines[lineIndex].slice(0, position.column - 1);
            if (/^\s*kind:\s*[\w-]*$/.test(beforeCursor)) {
                return {
                    suggestions: [...kindToDefKey.keys()].sort().map(kind => ({
                        label: kind,
                        kind: monaco.languages.CompletionItemKind.Value,
                        documentation: defs[kindToDefKey.get(kind)!]?.description ?? '',
                        insertText: kind,
                        range,
                    })),
                };
            }

            const def = resolveDefAtCursor(lines, lineIndex);
            const props = def ? getPropsForDef(def) : [];

            const suggestions: monaco.languages.CompletionItem[] = props.map(({ key, desc, hasChildren }) => ({
                label: key,
                kind: monaco.languages.CompletionItemKind.Field,
                documentation: desc,
                insertText: hasChildren ? key + ':\n' : key + ': ',
                range,
            }));
            return { suggestions };
        },
    });

    monaco.languages.registerHoverProvider('yaml', {
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
    });
}

// Editor options that make the suggest widget actually appear in YAML:
// - monaco's yaml tokenizer marks bare words as strings until the `:` is
//   typed, and quickSuggestions defaults to strings:false — so typing a key
//   never triggered the popup. strings:true fixes that.
// - wordBasedSuggestions goes through the editor web worker, which is a
//   no-op stub in the Wails webview (see main.tsx) and never responds,
//   leaving the suggest widget hanging whenever our provider has no match.
export const k8sYamlSuggestOptions = {
    quickSuggestions: { other: true, comments: false, strings: true },
    wordBasedSuggestions: 'off',
} as const;
