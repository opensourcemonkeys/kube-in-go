import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

const nm = (pkg: string) => new URL(`node_modules/${pkg}`, import.meta.url).pathname

// Dev only (Electron shell). The Go backend runs on a fixed port under the
// `kubeinsdev` build tag (see internal/controller/dev_on.go); proxying keeps
// the page same-origin, so the server's Origin check passes untouched and
// wailsBridge.ts needs no changes. Must match KUBE_INS_DEV_PORT on both sides.
const DEV_GO = `http://127.0.0.1:${process.env.KUBE_INS_DEV_PORT ?? 34567}`

// Vite serves index.html itself, so the token the Go asset handler normally
// injects never gets there. Dev builds skip the token check, but the bridge
// still needs a value present to install itself.
const devToken = () => ({
  name: 'kube-ins-dev-token',
  apply: 'serve' as const,
  transformIndexHtml: (html: string) =>
    html.replace('<head>', '<head><script>window.__KUBE_INS_RPC__="dev";</script>'),
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), devToken()],
  server: {
    proxy: {
      '/rpc': { target: DEV_GO, changeOrigin: true },
      '/events': { target: DEV_GO, changeOrigin: true, ws: true },
    },
  },
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
