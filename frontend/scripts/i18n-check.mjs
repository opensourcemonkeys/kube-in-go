#!/usr/bin/env node
/**
 * Locale catalog parity checker.
 *
 * The third anti-rot barrier. The other two fire earlier but cannot see this
 * problem: `i18next.d.ts` types the key space off the statically-bundled `en`
 * catalog (so a typo'd key is a tsc error) and `i18next/no-literal-string`
 * stops a new hardcoded UI string from skipping the catalogs entirely. Neither
 * knows anything about the five translated catalogs — the moment 628 keys are
 * copied into five locales they start drifting, silently:
 *
 *   - a key added to `en` is simply missing elsewhere and falls back forever;
 *   - a key deleted from `en` lives on as dead weight in five files;
 *   - machine translation drops a `{{count}}` and produces a broken sentence
 *     at runtime, which nothing type-checks;
 *   - a `<Trans>` markup index gets renumbered and the <strong> disappears.
 *
 * Dependency-free on purpose: `node scripts/i18n-check.mjs` must run in CI
 * before `npm ci` if it ever needs to, and `Intl.PluralRules` — the one piece
 * of real intelligence here — is built into Node.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = join(ROOT, 'src', 'locales');
const REFERENCE = 'en';

/** Values >this fraction identical to English mark a copied-but-untranslated file. */
const UNTRANSLATED_WARN_RATIO = 0.2;

const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const PLURAL_RE = new RegExp(`_(${PLURAL_SUFFIXES.join('|')})$`);

const failures = [];
const warnings = [];
const fail = (locale, msg) => failures.push(`${locale}: ${msg}`);
const warn = (locale, msg) => warnings.push(`${locale}: ${msg}`);

// ---------------------------------------------------------------- helpers

/** `{a:{b:'x'}}` -> Map('a.b' => 'x'). Throws on a non-string leaf. */
function flatten(obj, file, prefix = '', out = new Map()) {
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, file, key, out);
        else if (typeof v === 'string') out.set(key, v);
        else throw new Error(`${file}: ${key} is ${Array.isArray(v) ? 'an array' : typeof v}, expected a string`);
    }
    return out;
}

/** Interpolation names, as a set: `Delete {{count}} {{label}}?` -> {count,label}. */
const placeholders = (s) => new Set([...s.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]));

/**
 * <Trans> child indices, as a set. Compared as a set rather than a sequence on
 * purpose: German and Japanese reorder clauses, so `<1>x</1> then <3>y</3>`
 * legitimately becomes `<3>y</3> then <1>x</1>`. Dropping or renumbering a tag
 * is the failure worth catching, and a set catches exactly that.
 */
function transTags(s) {
    const open = new Set(), close = new Set(), all = new Set();
    for (const m of s.matchAll(/<(\/?)(\d+)(\/?)>/g)) {
        const [, slash, idx, selfClose] = m;
        all.add(idx);
        if (selfClose) { open.add(idx); close.add(idx); }
        else if (slash) close.add(idx);
        else open.add(idx);
    }
    return { all, balanced: [...all].every((i) => open.has(i) && close.has(i)) };
}

const setsEqual = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const show = (s) => (s.size ? [...s].sort().join(', ') : '(none)');

// ------------------------------------------------------- glossary (for the warn)

/**
 * Terms that stay English in every locale, read straight out of GLOSSARY.md so
 * there is one source of truth. The fenced block is column-formatted, so split
 * on runs of two-or-more spaces — that keeps `Kube Inspector` a single term.
 */
function readGlossary() {
    const md = readFileSync(join(LOCALES_DIR, 'GLOSSARY.md'), 'utf8');
    const fence = md.match(/```[^\n]*\n([\s\S]*?)```/);
    if (!fence) {
        warn('glossary', 'GLOSSARY.md has no fenced term block — the untranslated-copy warning is disabled');
        return new Set();
    }
    const tokens = new Set();
    for (const term of fence[1].split('\n').flatMap((l) => l.split(/\s{2,}/))) {
        const t = term.trim();
        if (!t) continue;
        // Multi-word terms also contribute their words, since the check below
        // works token by token.
        for (const w of t.toLowerCase().split(/\s+/)) tokens.add(w);
    }
    return tokens;
}

/**
 * True when a value carries no translatable prose — every word is a Kubernetes
 * proper noun or a number. Without this exemption `nav.json` (Pods, Nodes,
 * ConfigMaps, …) would trip the untranslated-copy warning in every locale, for
 * being correct.
 */
function isGlossaryOnly(value, glossary) {
    const bare = value
        .replace(/\{\{[^}]*\}\}/g, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
    if (!bare) return true;
    return bare.split(/\s+/).every((tok) => {
        const t = tok.toLowerCase();
        return /^\d+$/.test(t) || glossary.has(t) || glossary.has(t.replace(/s$/, ''));
    });
}

// ------------------------------------------------------------------ plurals

/**
 * Group the flat keys into plural families and singletons.
 *
 * A key only counts as a plural form when stripping its suffix leaves a base
 * that carries at least one *other* suffix too — otherwise an ordinary key
 * that happens to end in `_one` would be mistaken for one.
 */
function partition(keys) {
    const bases = new Map();
    for (const key of keys) {
        const m = key.match(PLURAL_RE);
        if (!m) continue;
        const base = key.slice(0, -m[0].length);
        (bases.get(base) ?? bases.set(base, new Set()).get(base)).add(m[1]);
    }
    const plural = new Map();
    for (const [base, suffixes] of bases) if (suffixes.size > 1) plural.set(base, suffixes);

    const singular = new Set();
    for (const key of keys) {
        const m = key.match(PLURAL_RE);
        if (m && plural.has(key.slice(0, -m[0].length))) continue;
        singular.add(key);
    }
    return { singular, plural };
}

/** CLDR categories for a locale: en/tr/de -> one,other · ru -> one,few,many,other · zh/ja -> other */
function pluralCategories(locale) {
    try {
        return new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
    } catch {
        return null;
    }
}

// --------------------------------------------------------------------- main

const glossary = readGlossary();

if (!existsSync(join(LOCALES_DIR, REFERENCE))) {
    console.error(`✗ reference catalog ${LOCALES_DIR}/${REFERENCE} is missing`);
    process.exit(1);
}

const namespaces = readdirSync(join(LOCALES_DIR, REFERENCE))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();

// The runtime only preloads the namespaces listed in i18n/index.ts. A catalog
// file nobody registers is never fetched, which looks exactly like a missing
// translation.
{
    const src = readFileSync(join(ROOT, 'src', 'i18n', 'index.ts'), 'utf8');
    const block = src.match(/NAMESPACES\s*=\s*\[([\s\S]*?)\]/);
    const registered = block ? [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort() : [];
    if (registered.length && registered.join() !== namespaces.join()) {
        fail('en', `namespace files ${namespaces.join(', ')} do not match NAMESPACES in i18n/index.ts (${registered.join(', ')})`);
    }
}

// Registered locales, read out of the store that actually offers them.
const registeredLocales = (() => {
    const src = readFileSync(join(ROOT, 'src', 'stores', 'localeStore.ts'), 'utf8');
    const block = src.match(/LOCALES[^=]*=\s*\[([\s\S]*?)\];/);
    if (!block) {
        fail('localeStore', 'could not find the LOCALES array in stores/localeStore.ts');
        return [];
    }
    return [...block[1].matchAll(/id:\s*'([A-Za-z-]+)'/g)].map((m) => m[1]);
})();

const onDisk = readdirSync(LOCALES_DIR).filter((e) => statSync(join(LOCALES_DIR, e)).isDirectory());

for (const dir of onDisk) {
    if (!registeredLocales.includes(dir)) {
        fail(dir, `catalog directory exists but ${dir} is not in LOCALES (stores/localeStore.ts) — it can never be loaded`);
    }
}

// Reference catalog, flattened per namespace.
const reference = new Map();
for (const ns of namespaces) {
    reference.set(ns, flatten(JSON.parse(readFileSync(join(LOCALES_DIR, REFERENCE, `${ns}.json`), 'utf8')), `${REFERENCE}/${ns}.json`));
}
const totalKeys = [...reference.values()].reduce((n, m) => n + m.size, 0);

let translated = 1; // en

for (const locale of registeredLocales) {
    if (locale === REFERENCE) continue;

    const dir = join(LOCALES_DIR, locale);
    if (!existsSync(dir)) {
        // The documented S12->S13b intermediate state: the picker offers the
        // language and every string falls back to English. Not an error.
        warn(locale, 'no catalog on disk yet — the locale falls back to English');
        continue;
    }

    const present = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
    const missingFiles = namespaces.filter((ns) => !present.includes(ns));
    const extraFiles = present.filter((ns) => !namespaces.includes(ns));
    if (missingFiles.length) fail(locale, `missing namespace file(s): ${missingFiles.join(', ')}`);
    if (extraFiles.length) fail(locale, `unknown namespace file(s): ${extraFiles.join(', ')}`);

    const categories = pluralCategories(locale);
    if (!categories) fail(locale, `Intl.PluralRules does not recognise "${locale}"`);
    translated += 1;

    for (const ns of namespaces) {
        if (!present.includes(ns)) continue;
        const file = `${locale}/${ns}.json`;

        let flat;
        try {
            flat = flatten(JSON.parse(readFileSync(join(dir, `${ns}.json`), 'utf8')), file);
        } catch (e) {
            fail(locale, `${file}: ${e.message}`);
            continue;
        }

        const ref = reference.get(ns);
        const refParts = partition([...ref.keys()]);
        const locParts = partition([...flat.keys()]);

        // Non-plural keys must match exactly, in both directions.
        for (const key of refParts.singular) {
            if (!flat.has(key)) fail(locale, `${file}: missing key "${key}"`);
        }
        for (const key of locParts.singular) {
            if (!ref.has(key)) fail(locale, `${file}: unknown key "${key}" (not in ${REFERENCE})`);
        }

        // Plural families are judged against the locale's CLDR categories, not
        // against English. `ru` owes four forms where `en` has two; `zh` and
        // `ja` owe one. Copying English's _one/_other into either is wrong.
        for (const [base, refSuffixes] of refParts.plural) {
            const have = locParts.plural.get(base) ?? new Set(
                [...flat.keys()].filter((k) => k.startsWith(`${base}_`)).map((k) => k.slice(base.length + 1)),
            );
            if (!categories) continue;
            const missing = [...categories].filter((c) => !have.has(c));
            const extra = [...have].filter((c) => !categories.has(c));
            if (missing.length) fail(locale, `${file}: plural "${base}" is missing ${missing.map((c) => `_${c}`).join(', ')} (${locale} needs ${[...categories].join('/')}; ${REFERENCE} has ${[...refSuffixes].join('/')})`);
            if (extra.length) fail(locale, `${file}: plural "${base}" has ${extra.map((c) => `_${c}`).join(', ')}, which is not a plural category of ${locale}`);
        }
        for (const base of locParts.plural.keys()) {
            if (!refParts.plural.has(base)) fail(locale, `${file}: unknown plural "${base}" (not in ${REFERENCE})`);
        }

        // Placeholders and <Trans> markup must survive translation intact.
        // This is the check that earns the script: neither tsc nor ESLint can
        // see a dropped {{count}}, and it only shows up as a broken sentence in
        // front of a user who reads the language nobody on the team does.
        let identical = 0, comparable = 0;
        for (const [key, refValue] of ref) {
            const value = flat.get(key);
            if (value === undefined) continue;

            const rp = placeholders(refValue), lp = placeholders(value);
            if (!setsEqual(rp, lp)) fail(locale, `${file}: "${key}" placeholders ${show(lp)} do not match ${REFERENCE} ${show(rp)}`);

            const rt = transTags(refValue), lt = transTags(value);
            if (!setsEqual(rt.all, lt.all)) fail(locale, `${file}: "${key}" <Trans> tags ${show(lt.all)} do not match ${REFERENCE} ${show(rt.all)}`);
            else if (rt.balanced && !lt.balanced) fail(locale, `${file}: "${key}" has an unclosed <Trans> tag`);

            if (isGlossaryOnly(refValue, glossary)) continue;
            comparable += 1;
            if (value === refValue) identical += 1;
        }

        if (comparable >= 10 && identical / comparable > UNTRANSLATED_WARN_RATIO) {
            const pct = Math.round((identical / comparable) * 100);
            warn(locale, `${file}: ${pct}% of translatable values (${identical}/${comparable}) are still identical to ${REFERENCE}`);
        }
    }
}

// ------------------------------------------------------------------- report

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const f of failures) console.error(`✗ ${f}`);

if (failures.length) {
    console.error(`\n✗ i18n parity: ${failures.length} problem(s) across ${registeredLocales.length} locales.`);
    process.exit(1);
}
console.log(`✓ i18n parity: ${translated}/${registeredLocales.length} locales translated, ${totalKeys} keys, ${namespaces.length} namespaces, ${warnings.length} warning(s).`);
