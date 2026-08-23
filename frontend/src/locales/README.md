# Locale catalogs

Six namespaces per locale, one JSON file each:

| Namespace   | Holds                                                              |
|-------------|--------------------------------------------------------------------|
| `common`    | Verbs and filter chrome reused everywhere: `action.delete`, `filter.all` |
| `nav`       | Sidebar groups/items, the title-bar menu, window controls          |
| `resources` | Table column headers, list titles, empty states, the delete flow    |
| `panels`    | Panel titles, About/Update modals, the onboarding tour              |
| `errors`    | The error banner and the crash boundary — **frame text only**       |
| `settings`  | Theme and language pickers                                          |

`defaultNS` is `common`; anything else needs the `ns:key` form (`t('nav:item.pods')`).

## Status

| Locale | | Provenance |
|---|---|---|
| `en` | English  | **Source of truth.** Hand-written; every other catalog is translated from it. |
| `tr` | Türkçe   | **Reviewed** by a native speaker (the maintainer). |
| `de` | Deutsch  | Machine-translated, corrections welcome. |
| `ru` | Русский  | Machine-translated, corrections welcome. |
| `zh` | 中文      | Machine-translated, corrections welcome. |
| `ja` | 日本語    | Machine-translated, corrections welcome. |

Machine-translated means exactly that: produced from `en` a namespace at a time
with `GLOSSARY.md` as the do-not-translate list, checked by
`npm run i18n:check`, and **not** read by anyone who speaks the language. The
placeholders and `<Trans>` markup are verified mechanically; the *wording* is
not. The app says so where it matters — the language submenu carries a
`settings:language.mtNote` line linking to
<https://kubeinspector.com/contributing/translations/> — so a user who sees a
wrong string knows it is expected and knows where to report it.

A correction to one of those four needs no ceremony: change the value, keep the
key, run `npm run i18n:check`. Moving a locale to *reviewed* means someone
fluent read all six files, not that the obvious mistakes were fixed.

## Key naming

```
common:    action.delete, action.cancel, action.retry, filter.all
nav:       group.workloads, item.pods, menu.open, window.minimise
resources: column.name, column.namespace, column.status        <- SHARED across views
           filter.searchName                                   <- SHARED filter placeholders
           pod.title, pod.empty, delete.header                 <- per view, keyed by DIRECTORY
panels:    title.logs, about.author, update.stepInstall, tour.welcome.title
errors:    banner.stale, boundary.panelTitle
settings:  language.label, theme.label
```

**Per-view sections are keyed by the component's directory** (`resources.pod.*`
for `components/pod/main.tsx`), not by the sidebar's plural view key. The
directory is where the string physically lives, so there is never a question of
which section a new string belongs in.

**Column headers are shared.** 203 `header=` call sites collapse to 98 unique
strings — `Name` appears 25 times, `Namespace` 24, `Status` 12. They live under
`resources.column.*` and are reused by every view. Only a header that is
genuinely specific to one resource (`Schedule`, `RoleRef`, `Reclaim Policy`)
gets its own key. This halves the catalog and keeps the same word from drifting
between views across five machine-translated locales.

## Plurals

Use i18next's suffixes: `_one` / `_other`. **`en` defines only those two.**
Every other locale owes exactly the forms its own CLDR plural rules define —
which is not always what English has:

| | forms owed |
|---|---|
| `en`, `tr`, `de` | `_one`, `_other` |
| `ru`             | `_one`, `_few`, `_many`, `_other` |
| `zh`, `ja`       | `_other` **only** |

The parity checker derives this from `Intl.PluralRules`, so it fails a Russian
file that stopped at English's two forms *and* a Chinese file that copied an
`_one` Chinese has no category for. Do not hand-copy `en`'s suffixes.

## What is never translated

See `GLOSSARY.md`. In short: anything the cluster said, and anything that is a
Kubernetes proper noun.

## Adding a locale

1. Copy `en/` to `<lang>/` and translate the values (never the keys), keeping
   `en`'s key order so the diff stays readable.
2. Add the entry to `LOCALES` in `../stores/localeStore.ts`.
3. `npm run i18n:check` must pass. Do all six namespaces in one go — a
   half-copied directory is a failure, on purpose.

A locale that is registered in `LOCALES` but has **no** directory is not an
error: the picker offers it and every string falls back to English. That is the
documented state a language sits in before anyone has translated it. (All six
have catalogs now, so the checker's "no catalog on disk yet" warning should stay
silent — if it fires, a directory went missing.)

## The parity checker

`npm run i18n:check` (`../../scripts/i18n-check.mjs`, dependency-free, also run
by `make check` and CI). It **fails** on:

1. a namespace file `en` has and a locale does not, or vice versa;
2. a catalog directory for a locale that is not registered in `LOCALES` — it
   could never be loaded;
3. a key in `en` that a locale is missing (silent fallback);
4. a key in a locale that `en` does not have (dead weight nobody will notice);
5. a plural family whose suffixes are not exactly that locale's CLDR categories
   (see the table above);
6. an interpolation placeholder set that differs from `en` — a dropped
   `{{count}}` is the single most common machine-translation defect and nothing
   else in the toolchain can see it;
7. a `<Trans>` markup index that was dropped or renumbered. Indices are compared
   as a *set*, not a sequence, because German and Japanese legitimately reorder
   the clauses around them.

It **warns** when more than 20% of a file's translatable values are still
byte-identical to English — the signature of a copied-but-untranslated file.
Values made up entirely of glossary terms and numbers are excluded, or `nav`
(`Pods`, `Nodes`, `ConfigMaps`) would trip it in every locale for being correct.

## The rule that keeps this honest

`i18next/no-literal-string` runs as an **error** over `src/components/**` and
`src/pages/**` (see `../../eslint.config.js`). A new hardcoded UI string fails
`npm run lint`. Its `jsx-attributes` list is *exclude*-based on purpose: an
include list also skips the JSX nested inside every unlisted attribute, and this
app declares all of its table columns inside a `columns={...}` render prop —
which hid all 203 `header=` strings until it was switched.

Genuine exceptions carry an `eslint-disable-next-line` **with a reason** (a
diagnostics id, a person's name). If you find yourself adding one for prose,
add a key instead.

`en` is imported statically (`en/index.ts`); the others are code-split and
fetched on demand by `../i18n/index.ts`.
