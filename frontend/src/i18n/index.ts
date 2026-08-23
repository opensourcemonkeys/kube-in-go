import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from '../locales/en';

export const NAMESPACES = ['common', 'nav', 'resources', 'panels', 'errors', 'settings'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_LOCALE = 'en';

// The five non-default catalogs are code-split: switching to `de` fetches six
// small JSON chunks, and a user who never leaves English downloads none of them.
// `en` is *not* loaded through here — it is bundled statically (see
// ../locales/en/index.ts) because it is the fallback and must resolve
// synchronously.
const loaders = import.meta.glob('../locales/*/*.json');

async function loadCatalog(lng: string): Promise<void> {
    if (lng === DEFAULT_LOCALE) return;
    // addResourceBundle is idempotent but the network round-trip is not.
    if (i18n.hasResourceBundle(lng, NAMESPACES[0])) return;

    await Promise.all(
        NAMESPACES.map(async (ns) => {
            const load = loaders[`../locales/${lng}/${ns}.json`];
            // A locale listed in LOCALES but not yet translated (the state
            // between S12 and S13) simply keeps falling back to English.
            if (!load) return;
            const mod = (await load()) as { default: Record<string, unknown> };
            i18n.addResourceBundle(lng, ns, mod.default, true, true);
        }),
    );
}

/** Fetch the catalog if needed, then switch. Safe to call with 'en'. */
export async function changeLocale(lng: string): Promise<void> {
    await loadCatalog(lng);
    if (i18n.language !== lng) await i18n.changeLanguage(lng);
}

/**
 * Must be awaited before the tree renders — see main.tsx.
 *
 * Awaiting rather than wrapping the app in <Suspense> keeps every `t()` call
 * synchronous for the whole life of the app: no component ever suspends on a
 * translation, and a non-English user never sees an English frame first.
 */
export async function initI18n(lng: string): Promise<void> {
    await i18n.use(initReactI18next).init({
        lng: DEFAULT_LOCALE,
        fallbackLng: DEFAULT_LOCALE,
        ns: [...NAMESPACES],
        defaultNS: 'common',
        resources: { en },
        interpolation: { escapeValue: false },
        returnNull: false,
        saveMissing: import.meta.env.DEV,
        missingKeyHandler: import.meta.env.DEV
            ? (lngs, ns, key) => console.warn(`[i18n] missing key ${ns}:${key} for ${lngs.join(',')}`)
            : undefined,
    });
    await changeLocale(lng);
}

export default i18n;
