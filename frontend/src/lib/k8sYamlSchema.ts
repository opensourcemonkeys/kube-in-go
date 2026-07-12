import { parseAllDocuments, isAlias, isMap, isScalar, isSeq } from 'yaml';
import type { YAMLMap } from 'yaml';

// Pure (monaco-free) core of the k8s YAML intellisense: schema indexing,
// cursor context resolution and schema validation. Kept free of monaco and
// wails imports so it can be exercised directly under node.

export type SchemaProp = {
    description?: string;
    type?: string;
    $ref?: string;
    enum?: unknown[];
    items?: { $ref?: string; type?: string };
    additionalProperties?: { $ref?: string; type?: string } | boolean;
};

export type SchemaDef = {
    description?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, SchemaProp>;
};

export interface SchemaIndex {
    defs: Record<string, SchemaDef>;
    kindToDefKey: Map<string, string>;
    kindToApiVersions: Map<string, string[]>;
    resolveRef(ref: string): SchemaDef | undefined;
}

export function buildSchemaIndex(defs: Record<string, SchemaDef>): SchemaIndex {
    const kindToDefKey = new Map<string, string>();
    const kindToApiVersions = new Map<string, string[]>();
    for (const [key, def] of Object.entries(defs)) {
        const gvk = (def as Record<string, unknown>)['x-kubernetes-group-version-kind'];
        if (!Array.isArray(gvk)) continue;
        for (const entry of gvk as Array<{ group?: string; version?: string; kind?: string }>) {
            if (!entry.kind) continue;
            kindToDefKey.set(entry.kind, key);
            const gv = entry.group ? `${entry.group}/${entry.version}` : entry.version ?? '';
            const list = kindToApiVersions.get(entry.kind) ?? [];
            if (gv && !list.includes(gv)) list.push(gv);
            kindToApiVersions.set(entry.kind, list);
        }
    }
    return {
        defs,
        kindToDefKey,
        kindToApiVersions,
        resolveRef: ref => defs[ref.replace('#/definitions/', '')],
    };
}

// ---------------------------------------------------------------------------
// Cursor context (completion / hover)
// ---------------------------------------------------------------------------

// Sentinel for keys whose children have no schema (labels, annotations, data,
// scalar values, block scalars): deeper lines resolve to this and get no
// suggestions instead of leaking the parent's properties.
const FREE_FORM: SchemaDef = {};

// A `- key:` line's properties live 2 columns right of the dash.
const keyOfLine = (line: string): { indent: number; key: string; dash: boolean } | null => {
    const dm = line.match(/^(\s*)-\s+([\w.-]+):/);
    if (dm) return { indent: dm[1].length + 2, key: dm[2], dash: true };
    const km = line.match(/^(\s*)([\w.-]+):/);
    if (km) return { indent: km[1].length, key: km[2], dash: false };
    return null;
};

// Narrow `lines` to the `---`-delimited document containing `lineIndex`.
export function currentDocSegment(lines: string[], lineIndex: number): { segLines: string[]; segIndex: number } {
    let start = 0;
    for (let i = lineIndex; i >= 0; i--) {
        if (/^---/.test(lines[i])) { start = i + 1; break; }
    }
    let end = lines.length;
    for (let i = lineIndex + 1; i < lines.length; i++) {
        if (/^---/.test(lines[i])) { end = i; break; }
    }
    return { segLines: lines.slice(start, end), segIndex: lineIndex - start };
}

export function docKindOf(segLines: string[]): string {
    for (const l of segLines) {
        const m = l.match(/^kind:\s*(\S+)/);
        if (m) return m[1];
    }
    return '';
}

export function resolveDefAtCursor(
    index: SchemaIndex,
    segLines: string[],
    segIndex: number,
    cursorIndent: number,
): SchemaDef | null {
    const rootDefKey = index.kindToDefKey.get(docKindOf(segLines));
    if (!rootDefKey) return null;

    interface Frame { def: SchemaDef; indent: number }
    const stack: Frame[] = [{ def: index.defs[rootDefKey], indent: -1 }];

    for (let i = 0; i < segIndex; i++) {
        const line = segLines[i];
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const info = keyOfLine(line);
        if (!info || info.indent >= cursorIndent) continue;

        while (stack.length > 1 && stack[stack.length - 1].indent >= info.indent) stack.pop();

        const parentDef = stack[stack.length - 1].def;
        const propSchema = parentDef.properties?.[info.key];
        if (!propSchema) continue;

        let childDef: SchemaDef | undefined;
        if (propSchema.$ref) {
            childDef = index.resolveRef(propSchema.$ref);
        } else if (propSchema.items?.$ref) {
            childDef = index.resolveRef(propSchema.items.$ref);
        }
        stack.push({ def: childDef ?? FREE_FORM, indent: info.indent });
    }

    return stack[stack.length - 1].def;
}

// Keys already present in the block the cursor is in, at the same effective
// indent — used to drop already-written siblings from the suggestions.
export function collectSiblingKeys(segLines: string[], segIndex: number, cursorIndent: number): Set<string> {
    const used = new Set<string>();
    for (const dir of [-1, 1] as const) {
        for (let i = segIndex + dir; i >= 0 && i < segLines.length; i += dir) {
            const line = segLines[i];
            if (!line.trim() || line.trim().startsWith('#')) continue;
            const info = keyOfLine(line);
            if (!info) {
                const raw = line.match(/^(\s*)/)![1].length;
                if (raw < cursorIndent) break;
                continue;
            }
            if (info.indent > cursorIndent) continue;
            if (info.indent < cursorIndent) break;
            if (info.dash) {
                // Same-level dash above = start of the item the cursor is in
                // (its inline key is a sibling); below = the next item.
                if (dir === -1) used.add(info.key);
                break;
            }
            used.add(info.key);
        }
    }
    return used;
}

// ---------------------------------------------------------------------------
// Schema validation (markers)
// ---------------------------------------------------------------------------

export type OffsetMarker = {
    severity: 'error' | 'warning';
    message: string;
    start: number;
    end: number;
};

export function collectSchemaMarkers(text: string, index: SchemaIndex): OffsetMarker[] {
    const markers: OffsetMarker[] = [];
    const mark = (severity: 'error' | 'warning', message: string, start: number, end: number) => {
        markers.push({ severity, message, start, end: Math.max(end, start + 1) });
    };
    const rangeOf = (node: unknown, fallback: [number, number] = [0, 1]): [number, number] => {
        const r = (node as { range?: [number, number, number] } | null)?.range;
        return r ? [r[0], r[1]] : fallback;
    };

    const checkScalarType = (value: unknown, type: string, keyName: string, at: [number, number]) => {
        if (!isScalar(value) || value.value == null) return;
        const v = value.value;
        let ok = true;
        if (type === 'integer') ok = typeof v === 'number' && Number.isInteger(v);
        else if (type === 'number') ok = typeof v === 'number';
        else if (type === 'boolean') ok = typeof v === 'boolean';
        if (!ok) mark('error', `Incorrect type for "${keyName}". Expected ${type}.`, at[0], at[1]);
    };

    const validateValue = (value: unknown, prop: SchemaProp, keyName: string, keyRange: [number, number]) => {
        if (value == null || isAlias(value)) return;
        if (isScalar(value) && value.value == null) return; // empty value while typing / explicit null
        const vr = rangeOf(value, keyRange);

        if (prop.enum) {
            if (isMap(value) || isSeq(value)) {
                mark('error', `Incorrect type for "${keyName}". Expected ${prop.type ?? 'string'}.`, vr[0], vr[1]);
            } else if (isScalar(value) && !prop.enum.includes(value.value)) {
                mark('error', `Value must be one of: ${prop.enum.join(', ')}.`, vr[0], vr[1]);
            }
            return;
        }

        if (prop.$ref) {
            const target = index.resolveRef(prop.$ref);
            if (!target) return;
            if (target.properties) {
                if (isMap(value)) validateMap(value, target);
                else mark('error', `"${keyName}" expects an object (key: value pairs).`, vr[0], vr[1]);
            } else if (target.type && target.type !== 'object' && (isMap(value) || isSeq(value))) {
                // Scalar-ish refs (Time, Duration...). Quantity/IntOrString use
                // oneOf (no plain type) and are deliberately left unchecked.
                mark('error', `"${keyName}" expects a ${target.type} value.`, vr[0], vr[1]);
            }
            return;
        }

        switch (prop.type) {
            case 'array': {
                if (!isSeq(value)) {
                    mark('error', `"${keyName}" expects a list (use "- " items).`, vr[0], vr[1]);
                    return;
                }
                const itemDef = prop.items?.$ref ? index.resolveRef(prop.items.$ref) : undefined;
                for (const item of value.items) {
                    if (item == null || isAlias(item)) continue;
                    if (isScalar(item) && item.value == null) continue;
                    const ir = rangeOf(item, vr);
                    if (itemDef?.properties) {
                        if (isMap(item)) validateMap(item, itemDef);
                        else mark('error', `List items of "${keyName}" must be objects.`, ir[0], ir[1]);
                    } else if (prop.items?.type && prop.items.type !== 'object') {
                        if (isMap(item) || isSeq(item)) {
                            mark('error', `List items of "${keyName}" must be ${prop.items.type} values.`, ir[0], ir[1]);
                        } else {
                            checkScalarType(item, prop.items.type, keyName, ir);
                        }
                    }
                }
                return;
            }
            case 'object': {
                if (isSeq(value) || isScalar(value)) {
                    mark('error', `"${keyName}" expects an object (key: value pairs).`, vr[0], vr[1]);
                    return;
                }
                const ap = prop.additionalProperties;
                if (isMap(value) && ap && typeof ap === 'object' && ap.type && ap.type !== 'object' && !ap.$ref) {
                    for (const p of value.items) {
                        if (isMap(p.value) || isSeq(p.value)) {
                            const r = rangeOf(p.value, vr);
                            mark('error', `Values under "${keyName}" must be ${ap.type} values.`, r[0], r[1]);
                        }
                    }
                }
                return;
            }
            case 'string':
                // No scalar coercion check: quoted numbers, timestamps etc.
                // are all valid strings; only structural mismatches are wrong.
                if (isMap(value) || isSeq(value)) {
                    mark('error', `Incorrect type for "${keyName}". Expected string.`, vr[0], vr[1]);
                }
                return;
            case 'integer':
            case 'number':
            case 'boolean':
                if (isMap(value) || isSeq(value)) {
                    mark('error', `Incorrect type for "${keyName}". Expected ${prop.type}.`, vr[0], vr[1]);
                } else {
                    checkScalarType(value, prop.type, keyName, vr);
                }
                return;
        }
    };

    const validateMap = (map: YAMLMap, def: SchemaDef) => {
        if (!def.properties) return; // free-form object — nothing to check
        const present = new Set<string>();
        for (const pair of map.items) {
            if (!isScalar(pair.key)) continue;
            const keyName = String(pair.key.value);
            present.add(keyName);
            const kr = rangeOf(pair.key);
            const prop = def.properties[keyName];
            if (!prop) {
                mark('error', `Property "${keyName}" is not allowed.`, kr[0], kr[1]);
                continue;
            }
            validateValue(pair.value, prop, keyName, kr);
        }
        for (const req of def.required ?? []) {
            if (present.has(req)) continue;
            const first = map.items.find(p => isScalar(p.key));
            const anchor = first ? rangeOf(first.key) : rangeOf(map);
            mark('warning', `Missing required property "${req}".`, anchor[0], anchor[1]);
        }
    };

    for (const doc of parseAllDocuments(text)) {
        for (const err of doc.errors) {
            mark('error', err.message.split('\n')[0], err.pos[0], err.pos[1]);
        }
        const root = doc.contents;
        if (!isMap(root)) continue;
        let kind = '';
        for (const pair of root.items) {
            if (isScalar(pair.key) && pair.key.value === 'kind' && isScalar(pair.value)) {
                kind = String(pair.value.value);
                break;
            }
        }
        const defKey = index.kindToDefKey.get(kind);
        if (!defKey) continue; // unknown kind (CRDs, partial docs): syntax check only
        validateMap(root, index.defs[defKey]);
    }

    return markers;
}
