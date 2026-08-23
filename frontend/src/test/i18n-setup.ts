import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from '../locales/en';
import { NAMESPACES } from '../i18n';

// Component tests assert on the English strings the app actually ships. Without
// this, `t()` returns the raw key in jsdom (i18next is never initialised there)
// and every such assertion fails for a reason that has nothing to do with the
// component under test.
//
// Deliberately synchronous and resources-only: no glob loader, no network, and
// no locale but `en` — matching what the assertions expect.
i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    ns: [...NAMESPACES],
    defaultNS: 'common',
    resources: { en },
    interpolation: { escapeValue: false },
    returnNull: false,
});

export default i18n;
