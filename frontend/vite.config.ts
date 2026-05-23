import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

const nm = (pkg: string) => new URL(`node_modules/${pkg}`, import.meta.url).pathname

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@fontsource/geist/400.css': nm('@fontsource/geist/400.css'),
      '@fontsource/geist/600.css': nm('@fontsource/geist/600.css'),
      '@fontsource/geist/700.css': nm('@fontsource/geist/700.css'),
      '@fontsource/jetbrains-mono/400.css': nm('@fontsource/jetbrains-mono/400.css'),
    }
  }
})
