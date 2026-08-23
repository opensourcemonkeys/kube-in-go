import { useThemeStore } from '../stores/themeStore';

/**
 * Palette variable names, as defined in theme-monolith.css. Every alternate
 * theme (`last-samurai`, `god-of-war`, `hello-kitty`) re-binds exactly these,
 * which is what makes reading them enough to re-skin anything.
 */
export type ThemeVar =
    | '--app' | '--panel' | '--panel2' | '--panel3' | '--hover' | '--line' | '--line2'
    | '--ink' | '--ink2' | '--ink3'
    | '--teal' | '--green' | '--amber' | '--red' | '--blue' | '--violet'
    | '--on-accent';

/**
 * The default (`monolith`) palette, mirrored from `:root` in
 * theme-monolith.css.
 *
 * Used only as the fallback when a variable cannot be read — a non-browser
 * environment (tests) or a stylesheet that has not applied yet. Keep in sync
 * with the CSS; being a little stale here is harmless, being absent is not,
 * because the alternative fallback is an unreadable black-on-black.
 */
const PALETTE_FALLBACK: Record<ThemeVar, string> = {
    '--app': '#080b11', '--panel': '#0c1017', '--panel2': '#11161f',
    '--panel3': '#151b26', '--hover': '#151b26', '--line': '#1a212e', '--line2': '#252e3f',
    '--ink': '#e7eaf0', '--ink2': '#98a1b3', '--ink3': '#5c6779',
    '--teal': '#3fc8b4', '--green': '#5fc98a', '--amber': '#e2a85a',
    '--red': '#e07d6e', '--blue': '#6ea8e6', '--violet': '#a78bd6',
    '--on-accent': '#06121a',
};

/**
 * Reads a palette variable as a concrete color string.
 *
 * Most of the UI should use `var(--x)` in CSS and never call this. It exists
 * for the two places a CSS variable cannot reach:
 *   - **canvas** — chart.js paints into a bitmap and takes real colors;
 *   - **xterm** — its `ITheme` is a plain object of color strings.
 *
 * Falls back to the argument when the variable is missing or the document is
 * not available (tests), so a caller always gets something paintable.
 */
export function themeColor(name: ThemeVar, fallback = PALETTE_FALLBACK[name]): string {
    if (typeof document === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

/**
 * Subscribes a component to theme changes so colors it resolved through
 * `themeColor` are re-read when the user switches palettes.
 *
 * Returns the active theme id: components that cache resolved colors should
 * put it in the dependency list of the `useMemo`/`useEffect` that does the
 * caching. Without it, switching themes leaves canvases and terminals painted
 * in the old palette until they happen to remount.
 */
export function useThemeVersion(): string {
    return useThemeStore((s) => s.theme);
}

/**
 * A palette color at partial opacity, as `rgba(...)`.
 *
 * For canvas fills (chart.js area series). CSS could do this with
 * `color-mix(in srgb, var(--teal) 15%, transparent)`, but chart.js hands the
 * string to the 2D context, which does not understand `color-mix` or `var`.
 * Handles the `#rgb` and `#rrggbb` forms the palettes use; anything else is
 * returned untouched, so a future `oklch()` palette degrades to opaque rather
 * than to an unpaintable string.
 */
export function themeAlpha(name: ThemeVar, alpha: number, fallback = PALETTE_FALLBACK[name]): string {
    const color = themeColor(name, fallback);
    const hex = color.startsWith('#') ? color.slice(1) : '';
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return color;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
