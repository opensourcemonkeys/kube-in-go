import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeId = 'monolith' | 'last-samurai' | 'god-of-war';

export const THEMES: { id: ThemeId; label: string }[] = [
    { id: 'monolith', label: 'Monolith' },
    { id: 'last-samurai', label: 'Last Samurai' },
    { id: 'god-of-war', label: 'God of War' },
];

const STORE_KEY = 'kube-ins-theme';

// Apply a theme by setting (or clearing) data-theme on <html>. The default
// "monolith" palette lives in :root, so it uses no attribute.
function applyTheme(theme: ThemeId) {
    const el = document.documentElement;
    if (theme === 'monolith') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
}

// A theme that has been removed (or a hand-edited localStorage value) must not
// reach applyTheme: it would stamp a data-theme with no CSS block behind it,
// leaving the app on the :root palette with nothing selected in the picker.
function coerceTheme(theme: unknown): ThemeId {
    return THEMES.some((t) => t.id === theme) ? (theme as ThemeId) : 'monolith';
}

// Apply the persisted theme synchronously at module load, before React renders,
// to avoid a flash of the default palette.
(function bootstrap() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        const t = raw ? JSON.parse(raw)?.state?.theme : undefined;
        if (t) applyTheme(coerceTheme(t));
    } catch { /* ignore */ }
})();

interface ThemeStore {
    theme: ThemeId;
    setTheme: (t: ThemeId) => void;
}

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: 'monolith',
            setTheme: (theme) => { applyTheme(theme); set({ theme }); },
        }),
        {
            name: STORE_KEY,
            storage: createJSONStorage(() => localStorage),
            version: 2,
            migrate: (persisted: any) => ({ ...persisted, theme: coerceTheme(persisted?.theme) }),
            onRehydrateStorage: () => (state) => {
                if (!state) return;
                state.theme = coerceTheme(state.theme);
                applyTheme(state.theme);
            },
        },
    ),
);
