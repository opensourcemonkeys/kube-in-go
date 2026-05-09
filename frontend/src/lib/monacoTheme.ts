import type { Monaco } from '@monaco-editor/react';

export const MONOLITH_THEME = 'monolith';

export function registerMonolithTheme(monaco: Monaco) {
    monaco.editor.defineTheme(MONOLITH_THEME, {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment',           foreground: '6d758c', fontStyle: 'italic' },
            { token: 'string',            foreground: '9bffce' },
            { token: 'string.yaml',       foreground: '9bffce' },
            { token: 'number',            foreground: '699cff' },
            { token: 'number.yaml',       foreground: '699cff' },
            { token: 'keyword',           foreground: '69daff' },
            { token: 'keyword.yaml',      foreground: '69daff' },
            { token: 'type',              foreground: '69daff' },
            { token: 'type.yaml',         foreground: 'a3aac4' },
            { token: 'tag',               foreground: '69daff' },
            { token: 'operators',         foreground: 'a3aac4' },
            { token: 'delimiter',         foreground: 'a3aac4' },
        ],
        colors: {
            'editor.background':                    '#060e20',
            'editor.foreground':                    '#dee5ff',
            'editor.lineHighlightBackground':       '#0f193080',
            'editor.selectionBackground':           '#69daff26',
            'editor.inactiveSelectionBackground':   '#69daff15',
            'editorLineNumber.foreground':          '#40485d',
            'editorLineNumber.activeForeground':    '#a3aac4',
            'editorCursor.foreground':              '#69daff',
            'editorIndentGuide.background1':        '#40485d',
            'editorIndentGuide.activeBackground1':  '#6d758c',
            'editorWidget.background':              '#0f1930',
            'editorWidget.border':                  '#40485d',
            'input.background':                     '#091328',
            'input.foreground':                     '#dee5ff',
            'input.border':                         '#40485d',
            'scrollbarSlider.background':           '#40485d40',
            'scrollbarSlider.hoverBackground':      '#6d758c60',
            'scrollbarSlider.activeBackground':     '#6d758c80',
            'minimap.background':                   '#060e20',
            'editorGutter.background':              '#060e20',
        },
    });
}
