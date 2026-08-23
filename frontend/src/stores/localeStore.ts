import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { changeLocale, DEFAULT_LOCALE } from '../i18n';

export type LocaleId = 'en' | 'tr' | 'de' | 'ru' | 'zh' | 'ja';

// Endonyms: a language is always listed in its own language, so someone who
// landed in a locale they cannot read can still find their way out.
export const LOCALES: { id: LocaleId; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'tr', label: 'Türkçe' },
    { id: 'de', label: 'Deutsch' },
    { id: 'ru', label: 'Русский' },
    { id: 'zh', label: '中文' },
    { id: 'ja', label: '日本語' },
];

const STORE_KEY = 'kube-ins-locale';

function isLocale(v: unknown): v is LocaleId {
    return typeof v === 'string' && LOCALES.some((l) => l.id === v);
}

/**
 * The persisted choice, read straight out of localStorage.
 *
 * main.tsx needs this *before* the store module has finished hydrating, because
 * initI18n() has to be awaited before the first render — so the read is exposed
 * as a plain function rather than going through the store.
 */
export function storedLocale(): LocaleId {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        const l = raw ? JSON.parse(raw)?.state?.locale : undefined;
        if (isLocale(l)) return l;
    } catch { /* ignore */ }
    return DEFAULT_LOCALE as LocaleId;
}

// index.html hardcodes lang="en"; keeping the attribute honest is what lets the
// browser pick the right hyphenation, quotes and font fallbacks.
function applyLang(locale: LocaleId) {
    document.documentElement.lang = locale;
}

// Set the attribute at module load, like themeStore does for data-theme, so the
// document is never briefly mislabelled.
applyLang(storedLocale());

interface LocaleStore {
    locale: LocaleId;
    setLocale: (l: LocaleId) => void;
}

export const useLocaleStore = create<LocaleStore>()(
    persist(
        (set) => ({
            locale: storedLocale(),
            setLocale: (locale) => {
                applyLang(locale);
                set({ locale });
                // Fire-and-forget: the catalog chunk resolves in a moment and
                // react-i18next re-renders then. Until it does, the fallback
                // keeps every string readable rather than blanking the UI.
                void changeLocale(locale);
            },
        }),
        {
            name: STORE_KEY,
            storage: createJSONStorage(() => localStorage),
            version: 1,
            onRehydrateStorage: () => (state) => { if (state) applyLang(state.locale); },
        },
    ),
);
