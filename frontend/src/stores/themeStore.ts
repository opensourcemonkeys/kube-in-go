import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeId = 'monolith' | 'last-samurai' | 'god-of-war' | 'hello-kitty';

export const THEMES: { id: ThemeId; label: string }[] = [
    { id: 'monolith', label: 'Monolith' },
    { id: 'last-samurai', label: 'Last Samurai' },
    { id: 'god-of-war', label: 'God of War' },
    { id: 'hello-kitty', label: 'Hello Kitty' },
];

const STORE_KEY = 'kube-ins-theme';

// Apply a theme by setting (or clearing) data-theme on <html>. The default
// "monolith" palette lives in :root, so it uses no attribute.
function applyTheme(theme: ThemeId) {
    const el = document.documentElement;
    if (theme === 'monolith') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
}

// Apply the persisted theme synchronously at module load, before React renders,
// to avoid a flash of the default palette.
(function bootstrap() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        const t = raw ? JSON.parse(raw)?.state?.theme : undefined;
        if (t) applyTheme(t as ThemeId);
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
            version: 1,
            onRehydrateStorage: () => (state) => { if (state) applyTheme(state.theme); },
        },
    ),
);
