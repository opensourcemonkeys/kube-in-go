import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { ITheme, Terminal } from '@xterm/xterm';
import { themeColor, useThemeVersion } from './themeColors';

/**
 * The terminal palette, derived from the app palette.
 *
 * xterm takes an `ITheme` of plain color strings and paints them itself, so
 * `var(--red)` never reaches it — the values have to be resolved. This is the
 * single definition; the terminal panel, the pod-exec panel and the CLI-mode
 * overlay all used to carry their own near-identical copy, which is why a theme
 * switch left them all looking like the default theme.
 *
 * The ANSI slots are mapped to the palette's semantic colors rather than to
 * literal ANSI hues: what matters is that a shell's red still reads as this
 * theme's "bad" and its green as this theme's "good".
 */
export function xtermTheme(): ITheme {
    const bg = themeColor('--panel2');
    const fg = themeColor('--ink');
    const accent = themeColor('--blue');
    return {
        background: bg,
        foreground: fg,
        cursor: accent,
        cursorAccent: bg,
        black: themeColor('--panel3'),
        red: themeColor('--red'),
        green: themeColor('--green'),
        yellow: themeColor('--amber'),
        blue: accent,
        magenta: themeColor('--violet'),
        cyan: themeColor('--teal'),
        white: themeColor('--ink2'),
        brightBlack: themeColor('--ink3'),
        brightRed: themeColor('--red'),
        brightGreen: themeColor('--green'),
        brightYellow: themeColor('--amber'),
        brightBlue: accent,
        brightMagenta: themeColor('--violet'),
        brightCyan: themeColor('--teal'),
        brightWhite: fg,
    };
}

/**
 * Repaints a live terminal when the user switches themes.
 *
 * A terminal is created once per session and deliberately survives everything
 * else (see the session-registry rules), so without this it would keep the
 * palette that was active when its shell started.
 */
export function useXtermTheme(termRef: RefObject<Terminal | null>): void {
    const theme = useThemeVersion();
    useEffect(() => {
        const term = termRef.current;
        if (term) term.options.theme = xtermTheme();
    }, [theme, termRef]);
}
