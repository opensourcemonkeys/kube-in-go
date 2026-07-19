// Fills in the shell hook that frontend/src/lib/wailsBridge.ts already reads:
//
//   const shell = window.__KUBE_INS_SHELL__ ?? {}
//   BrowserOpenURL: shell.openURL ?? ...
//   WindowMinimise: shell.minimise ?? noop
//   ...
//
// Preload runs before any page script, so the bridge sees these and TitleBar
// works unmodified. Nothing else is exposed — contextIsolation and sandbox stay
// on, and the renderer never gets Node.

const { contextBridge, ipcRenderer } = require('electron');

// The page is served from the stable app:// origin, but the event WebSocket has
// to reach the sidecar's real ephemeral port directly (ws:// cannot go through
// a custom protocol handler). main.cjs passes it in via additionalArguments.
const rpcUrlArg = process.argv.find((a) => a.startsWith('--kube-ins-rpc-url='));

contextBridge.exposeInMainWorld('__KUBE_INS_SHELL__', {
  rpcUrl: rpcUrlArg ? rpcUrlArg.slice('--kube-ins-rpc-url='.length) : undefined,

  openURL: (url) => ipcRenderer.send('shell:openURL', url),
  minimise: () => ipcRenderer.send('shell:minimise'),
  toggleMaximise: () => ipcRenderer.send('shell:toggleMaximise'),
  quit: () => ipcRenderer.send('shell:quit'),

  // Real window state, so the titlebar icon tracks OS-initiated changes.
  isMaximised: () => ipcRenderer.invoke('shell:isMaximised'),
  onMaximised: (cb) => {
    const handler = (_event, value) => cb(value);
    ipcRenderer.on('kube-ins:maximised', handler);
    return () => ipcRenderer.removeListener('kube-ins:maximised', handler);
  },
});

// Marks the document so the titlebar drag rules apply only under Electron.
// See the -webkit-app-region block in theme-monolith.css.
document.addEventListener('DOMContentLoaded', () =>
  document.documentElement.classList.add('electron-shell'),
);
