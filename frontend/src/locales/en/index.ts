// Statically bundled English catalog.
//
// `en` is imported eagerly, not through the `import.meta.glob` loader the other
// five locales use, for two reasons: it is the `fallbackLng`, so it must resolve
// synchronously or every missing key would flash a raw key first; and it is the
// source of the `CustomTypeOptions` key types in ../../i18n/i18next.d.ts, which
// only works on a static import.
import common from './common.json';
import nav from './nav.json';
import resources from './resources.json';
import panels from './panels.json';
import errors from './errors.json';
import settings from './settings.json';

export const en = { common, nav, resources, panels, errors, settings } as const;

export default en;
