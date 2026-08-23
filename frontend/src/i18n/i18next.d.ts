import type { en } from '../locales/en';

// Types the whole key space off the statically-bundled English catalog, so a
// typo'd or renamed key is a `tsc --noEmit` error rather than a raw key shown
// to a user. This is the cheapest of the three anti-rot barriers (the other two
// being the ESLint rule here and the parity checker in S13) and the only one
// that fires before the code is even saved.
declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'common';
        resources: typeof en;
        returnNull: false;
    }
}

export {};
