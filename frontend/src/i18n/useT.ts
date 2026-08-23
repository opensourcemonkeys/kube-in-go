import { useTranslation } from 'react-i18next';
import { NAMESPACES } from './index';

/**
 * `t` bound to every namespace at once.
 *
 * Plain `useTranslation()` types its `t` against `defaultNS` only, so the
 * `ns:key` form that the rest of the app uses (`t('nav:item.pods')`) is a type
 * error at every call site. Declaring the full namespace list once here keeps
 * the typed-key safety from i18next.d.ts without making 80-odd components spell
 * out which namespaces they touch.
 */
export function useT() {
    return useTranslation(NAMESPACES).t;
}

export type TFn = ReturnType<typeof useT>;
export type TKey = Parameters<TFn>[0];
