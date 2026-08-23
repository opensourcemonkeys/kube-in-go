import { describe, it, expect } from 'vitest';
import i18n, { changeLocale, NAMESPACES } from './index';

// A locale with no catalog on disk must switch cleanly and fall back to English
// rather than throwing out of the glob loader or blanking the UI.
//
// The id is deliberately one that will never exist. This test used to say 'de',
// which was true between S12 and S13 and then quietly stopped testing anything:
// once de/ shipped, the assertion kept passing for the wrong reason — the value
// it checks is a glossary term that is 'Pods' in every language. A test that
// silently stops meaning something is worse than one that breaks.
describe('changeLocale', () => {
    it('switches to a locale with no catalog and keeps English text', async () => {
        await changeLocale('xx');
        expect(i18n.language).toBe('xx');
        expect(i18n.t('nav:item.pods')).toBe('Pods');
        expect(i18n.t('common:action.delete')).toBe('Delete');
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

// S13b shipped five real catalogs. The parity checker proves every key and
// plural form *exists*; only i18next can prove the right form is *chosen*, and
// the Russian four-form family is the part most likely to be wrong.
describe('translated catalogs', () => {
    it('loads a code-split catalog and returns its text', async () => {
        await changeLocale('de');
        expect(i18n.t('common:action.delete')).toBe('Löschen');
        // A glossary term stays English in every locale — that is the rule the
        // untranslated-copy warning is exempted for, so pin it.
        expect(i18n.t('nav:item.pods')).toBe('Pods');
    });

    it('picks the Russian plural category, not English’s two', async () => {
        await changeLocale('ru');
        const pill = (count: number) => i18n.t('panels:portForward.pill', { count });
        expect(pill(1)).toBe('1 проброс');    // one
        expect(pill(3)).toBe('3 проброса');   // few
        expect(pill(5)).toBe('5 пробросов');  // many
        expect(pill(21)).toBe('21 проброс');  // one again — the trap English hides
    });

    it('resolves a Chinese plural that has only _other', async () => {
        await changeLocale('zh');
        // zh has no _one category, so count:1 must still land on _other rather
        // than falling back to English.
        expect(i18n.t('panels:crd.deleteBody', { count: 1, label: 'Widget' }))
            .toBe('要删除以下 1 条 Widget 记录吗？');
    });

    it('leaves the interpolation intact after translation', async () => {
        await changeLocale('ja');
        expect(i18n.t('resources:delete.header', { kind: 'Pod' })).toBe('Pod の削除確認');
        await changeLocale('en');
    });
});
