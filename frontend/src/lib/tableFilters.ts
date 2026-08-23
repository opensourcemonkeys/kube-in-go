import { FilterService } from 'primereact/api';
import type { DataTableFilterMeta } from 'primereact/datatable';

// PrimeReact types `matchMode` as a closed union of its built-in modes and does
// not know about registered custom ones (and it does not export
// DataTableFilterMetaData, hence deriving the type here). The cast is done once,
// in this file, so call sites stay clean.
type MatchMode = Extract<DataTableFilterMeta[string], { matchMode: unknown }>['matchMode'];

const ARRAY_IN_MODE: string = 'arrayIn';

/**
 * The IN filter's counterpart for array-valued row fields: matches when the
 * row's array intersects the selection.
 *
 * PrimeReact's built-in `in` mode treats the row value as a scalar
 * (`ObjectUtils.equals(value, filter[i])`), so it never matches an
 * array-valued field. `<Column filterFunction>` is not a way out either:
 * PrimeReact only registers it when no `filters` prop is supplied, and every
 * table here passes controlled `filters`. Hence registering the match mode
 * globally — `executeLocalFilter` resolves it straight from
 * `FilterService.filters[mode]`, so this path works unmodified.
 */
export const ARRAY_IN = ARRAY_IN_MODE as MatchMode;

FilterService.register(ARRAY_IN_MODE, (value: unknown, filter: unknown[] | null) => {
    // Same empty-value semantics as the built-in `in`: with nothing selected
    // (MultiSelect sends `[]` once everything is deselected) the filter is a
    // no-op.
    if (filter == null || filter.length === 0) return true;
    if (value == null) return false;
    const values = (Array.isArray(value) ? value : [value]).map(String);
    return filter.some((f) => values.includes(String(f)));
});
