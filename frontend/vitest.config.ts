import { defineConfig } from 'vitest/config';

// Deliberately standalone rather than merged with vite.config.ts: the project
// still builds on Vite 3, while Vitest 2 carries its own Vite 5. Importing the
// app's config here would drag the Vite 3 plugin pipeline into a Vite 5 runtime.
// Revisit once the Vite upgrade in beta-plan S14f lands.
export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        // Nothing here should reach the network or a cluster: these are unit
        // tests over pure helpers and hooks. Cluster-facing coverage is the
        // e2e_tests/ suite's job.
        restoreMocks: true,
    },
});
