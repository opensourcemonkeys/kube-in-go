import { describe, it, expect } from 'vitest';
import i18n, { changeLocale, NAMESPACES } from './index';

// Between S12 and S13 only `en` exists. A locale with no catalog on disk must
// switch cleanly and fall back to English rather than throwing out of the glob
// loader or blanking the UI — that intermediate state is what ships until the
// translations land.
describe('changeLocale', () => {
    it('switches to a locale with no catalog and keeps English text', async () => {
        await changeLocale('de');
        expect(i18n.language).toBe('de');
        expect(i18n.t('nav:item.pods')).toBe('Pods');
    });

    it('switches back to en', async () => {
        await changeLocale('en');
        expect(i18n.language).toBe('en');
        expect(i18n.t('common:action.delete')).toBe('Delete');
    });

    it('resolves every namespace from the bundled English catalog', () => {
        for (const ns of NAMESPACES) {
            expect(i18n.hasResourceBundle('en', ns)).toBe(true);
        }
    });
});
