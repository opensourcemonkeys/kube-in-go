// Per-cluster colour identity.
//
// Every cluster gets a colour derived from its name, so it is stable across
// machines and windows without anyone configuring anything. The user can
// override it (see stores/clusterColorStore.ts); only overrides are persisted.

export interface ClusterColor {
    id: string;
    hex: string;
    label: string;
}

// Mid-tone hues picked to stay readable both on the dark panels of the default
// palettes and on the light "hello-kitty" theme.
export const CLUSTER_PALETTE: ClusterColor[] = [
    { id: 'teal', hex: '#3fc8b4', label: 'Teal' },
    { id: 'cyan', hex: '#5fc2d6', label: 'Cyan' },
    { id: 'blue', hex: '#6ea8e6', label: 'Blue' },
    { id: 'indigo', hex: '#7f8ce8', label: 'Indigo' },
    { id: 'violet', hex: '#a78bd6', label: 'Violet' },
    { id: 'magenta', hex: '#e07db4', label: 'Magenta' },
    { id: 'rose', hex: '#e8768c', label: 'Rose' },
    { id: 'red', hex: '#e07d6e', label: 'Red' },
    { id: 'orange', hex: '#e2a85a', label: 'Orange' },
    { id: 'amber', hex: '#d7c05a', label: 'Amber' },
    { id: 'lime', hex: '#9ec95f', label: 'Lime' },
    { id: 'green', hex: '#5fc98a', label: 'Green' },
];

// FNV-1a, kept deterministic and dependency-free so the same cluster name maps
// to the same colour in every process.
function hash(name: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < name.length; i++) {
        h ^= name.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export function defaultColorId(clusterName: string): string {
    return CLUSTER_PALETTE[hash(clusterName) % CLUSTER_PALETTE.length].id;
}

// A stored colour is either a palette id ('teal') or a raw '#rrggbb' picked
// with the colour picker, so custom colours need no separate storage key.
const HEX_RE = /^#[0-9a-f]{6}$/i;

export function isCustomHex(id: string | undefined): boolean {
    return !!id && HEX_RE.test(id);
}

// Accepts what the PrimeReact picker emits ('3fc8b4'), plus '#abc' shorthand.
export function normalizeHex(raw: string | undefined): string | null {
    if (!raw) return null;
    let v = raw.trim().toLowerCase();
    if (!v.startsWith('#')) v = `#${v}`;
    if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    return HEX_RE.test(v) ? v : null;
}

// Falls back to the first entry so persisted overrides never break if the
// palette is reshuffled later.
export function hexForId(id: string | undefined): string {
    if (isCustomHex(id)) return (id as string).toLowerCase();
    return CLUSTER_PALETTE.find(c => c.id === id)?.hex ?? CLUSTER_PALETTE[0].hex;
}
