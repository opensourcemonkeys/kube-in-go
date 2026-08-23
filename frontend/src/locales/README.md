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
Locales whose plural rules need more (`ru` wants `_few`, `_many`) add them in
their own file; i18next picks the right form from the locale's CLDR rules. The
parity checker allows extra plural suffixes for exactly this reason.

## What is never translated

See `GLOSSARY.md`. In short: anything the cluster said, and anything that is a
Kubernetes proper noun.

## Adding a locale

1. Copy `en/` to `<lang>/` and translate the values (never the keys).
2. Add the entry to `LOCALES` in `../stores/localeStore.ts`.
3. `npm run i18n:check` (added in S13) must pass.

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
