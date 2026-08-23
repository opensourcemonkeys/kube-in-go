import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { renderPanelTitle } from './TabContext';
import { useT } from '../i18n/useT';

// renderPanelTitle is the single place a Dockview tab title is produced — at
// addPanel time, when a retargetable panel changes cluster, and again for every
// open panel when the language changes. Its contract is what makes those three
// agree.
describe('renderPanelTitle', () => {
    const t = () => renderHook(() => useT()).result.current;

    it('translates the key and appends the • qualifier', () => {
        expect(renderPanelTitle(t(), {
            titleKey: 'nav:item.pods',
            titleVars: { suffix: 'prod' },
        })).toBe('Pods • prod');
    });

    it('omits the qualifier when there is no suffix', () => {
        expect(renderPanelTitle(t(), { titleKey: 'panels:title.diagnostics' }))
            .toBe('Diagnostics');
    });

    it('interpolates other vars but keeps them out of the qualifier', () => {
        expect(renderPanelTitle(t(), {
            titleKey: 'panels:title.terminal',
            titleVars: { n: 2, suffix: 'staging' },
        })).toBe('Terminal 2 • staging');
    });

    it('falls back to the raw key rather than rendering blank', () => {
        // A view added without its nav:item.* entry, or a panel transferred
        // from a newer build, must still show something readable.
        expect(renderPanelTitle(t(), {
            titleKey: 'nav:item.somethingnew',
            titleVars: { suffix: 'prod' },
        })).toBe('nav:item.somethingnew • prod');
    });

    it('returns empty for a panel that carries no key', () => {
        expect(renderPanelTitle(t(), {})).toBe('');
    });
});
