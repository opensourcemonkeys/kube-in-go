import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

const nm = (pkg: string) => new URL(`node_modules/${pkg}`, import.meta.url).pathname

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'next/navigation': new URL('src/lib/next-stub.ts', import.meta.url).pathname,
      'next/router': new URL('src/lib/next-stub.ts', import.meta.url).pathname,
      '@fontsource/inter/400.css': nm('@fontsource/inter/400.css'),
      '@fontsource/inter/500.css': nm('@fontsource/inter/500.css'),
      '@fontsource/inter/600.css': nm('@fontsource/inter/600.css'),
      '@fontsource/inter/700.css': nm('@fontsource/inter/700.css'),
      '@fontsource/jetbrains-mono/400.css': nm('@fontsource/jetbrains-mono/400.css'),
      '@fontsource/jetbrains-mono/500.css': nm('@fontsource/jetbrains-mono/500.css'),
      '@fontsource/jetbrains-mono/600.css': nm('@fontsource/jetbrains-mono/600.css'),
    }
  }
})
