// Electron shell for Kube Inspector.
//
// The Go binary is the application; this process only supplies a Chromium
// window and the few things a web page cannot do itself. It spawns the binary
// with --serve, which starts the same controller Wails drives (see
// internal/controller/rpcserver.go), then loads the URL it prints.
//
// Nothing here is Kubernetes-aware. Adding a backend feature does not touch
// this file.

const electron = require('electron');

// With ELECTRON_RUN_AS_NODE set, require('electron') returns a path string
// instead of the API, and every destructured name below would be undefined —
// surfacing much later as "Cannot read properties of undefined". Some editors
// (VS Code's integrated terminal) export it, so say what is wrong up front.
if (typeof electron === 'string') {
  console.error(
    'ELECTRON_RUN_AS_NODE is set, so Electron started as plain Node.\n' +
      'Run with: env -u ELECTRON_RUN_AS_NODE npm start',
  );
  process.exit(1);
}

const { app, BrowserWindow, dialog, shell, ipcMain, protocol, net } = electron;
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const isWindows = process.platform === 'win32';

// The page is served under this fixed origin rather than the sidecar's
// http://127.0.0.1:<port>. The sidecar binds an ephemeral port (it must: a fixed
// one would clash between instances), and localStorage/IndexedDB/cookies are
// keyed by origin — so loading the port URL directly meant every launch looked
// like a brand new site and all persisted UI state was silently lost.
const APP_SCHEME = 'app';
const APP_ORIGIN = `${APP_SCHEME}://kube-inspector`;

// Must be called before app.whenReady().
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true, // gives it a real origin, which is the whole point
      secure: true, // counts as a secure context (needed by some web APIs)
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let sidecar = null;
let win = null;
let serverURL = null;
let shellToken = null;
let quitting = false;

// Set by electron/dev.cjs to the address of the Go server it already started
// (go run -tags kubeinsdev, pinned port). When present we attach to that one
// instead of spawning our own — otherwise dev would run two backends, and the
// renderer would be handed the wrong one's address.
const devRPC = process.env.KUBE_INS_DEV_RPC || '';

// Last lines of sidecar output, shown if it dies before we get a URL.
const logTail = [];
const rememberLog = (stream, text) => {
  for (const line of String(text).split('\n')) {
    if (!line) continue;
    logTail.push(`[${stream}] ${line}`);
    if (logTail.length > 50) logTail.shift();
    if (!app.isPackaged) console.log(`[sidecar:${stream}]`, line);
  }
};

// ---------------------------------------------------------------------------
// Sidecar
// ---------------------------------------------------------------------------

function resolveSidecar() {
  if (process.env.KUBE_INS_BIN) return process.env.KUBE_INS_BIN;
  const name = 'kube-inspector' + (isWindows ? '.exe' : '');
  return app.isPackaged
    ? path.join(process.resourcesPath, name)
    : path.join(__dirname, '..', 'build', 'bin', name);
}

function startSidecar() {
  return new Promise((resolve, reject) => {
    const bin = resolveSidecar();

    // stdin stays piped and open: closing it is how the Go side learns we died
    // even when we are SIGKILLed and no signal reaches it.
    sidecar = spawn(bin, ['--serve', '--shell-channel'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const timer = setTimeout(
      () => reject(new Error('backend did not start within 30s')),
      30000,
    );

    let buf = '';
    sidecar.stdout.on('data', (chunk) => {
      rememberLog('out', chunk);
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);

        let m;
        if ((m = line.match(/kube-ins serving at (\S+)/))) serverURL = m[1];
        if ((m = line.match(/kube-ins shell token (\S+)/))) shellToken = m[1];
        if (serverURL && shellToken) {
          clearTimeout(timer);
          resolve();
        }
      }
    });

    sidecar.stderr.on('data', (chunk) => rememberLog('err', chunk));

    // Missing/unreadable binary — a broken package.
    sidecar.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`could not start backend (${bin}): ${err.message}`));
    });

    sidecar.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (quitting) return;
      const why = signal ? `signal ${signal}` : `code ${code}`;
      // Before the window exists this rejects startup; after, it is a crash.
      if (!serverURL) {
        reject(new Error(`backend exited early (${why})`));
      } else {
        fatal('Backend stopped', `The Kube Inspector backend exited (${why}).`);
      }
    });
  });
}

function stopSidecar() {
  if (!sidecar || sidecar.exitCode !== null) return Promise.resolve();

  const done = new Promise((resolve) => sidecar.once('exit', resolve));

  try {
    sidecar.stdin.end(); // orphan guard in main.go picks this up
  } catch {}

  if (isWindows) {
    // Windows has no process groups; taskkill takes the tree.
    spawn('taskkill', ['/pid', String(sidecar.pid), '/T', '/F']);
  } else {
    // SIGTERM unwinds serve(): srv.Close() drops WS clients so log/exec
    // goroutines finish instead of leaving a zombie holding a watch.
    sidecar.kill('SIGTERM');
  }

  const force = setTimeout(() => {
    try {
      sidecar.kill('SIGKILL');
    } catch {}
  }, 3000);

  return Promise.race([done, new Promise((r) => setTimeout(r, 4000))]).then(
    () => clearTimeout(force),
  );
}

function fatal(title, message) {
  dialog.showErrorBox(title, `${message}\n\n${logTail.slice(-20).join('\n')}`);
  quitting = true;
  stopSidecar().finally(() => app.exit(1));
}

// ---------------------------------------------------------------------------
// Shell channel: native dialogs requested by the Go side
// ---------------------------------------------------------------------------

// "PNG Image (*.png)" + "*.png;*.jpg" -> [{name, extensions:['png','jpg']}]
function toFilters(opts) {
  const exts = String(opts.Pattern || '')
    .split(';')
    .map((p) => p.trim().replace(/^\*\./, ''))
    .filter((e) => e && e !== '*');
  if (!exts.length) return [];
  return [{ name: opts.FilterName || 'File', extensions: exts }];
}

function connectShellChannel() {
  if (!serverURL || !shellToken) return;

  const host = new URL(serverURL).host;
  const ws = new WebSocket(
    `ws://${host}/shell?token=${encodeURIComponent(shellToken)}`,
  );
  let backoff = 250;

  ws.on('open', () => {
    backoff = 250;
  });

  ws.on('message', async (raw) => {
    let req;
    try {
      req = JSON.parse(raw);
    } catch {
      return;
    }
    if (req.type !== 'saveFile') return;

    const opts = req.opts || {};
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: opts.Title || 'Save',
        defaultPath: opts.DefaultName || undefined,
        filters: toFilters(opts),
      });
      // Empty path means cancelled — same contract as Wails' SaveFileDialog.
      ws.send(JSON.stringify({ id: req.id, path: canceled ? '' : filePath }));
    } catch (err) {
      ws.send(JSON.stringify({ id: req.id, path: '', error: String(err) }));
    }
  });

  ws.on('close', () => {
    if (quitting) return;
    setTimeout(connectShellChannel, backoff);
    backoff = Math.min(backoff * 2, 5000);
  });

  ws.on('error', () => {}); // 'close' handles the retry
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

// Forwards every app:// request to the sidecar, so the page (and its /rpc
// calls) stay same-origin under a stable origin while the backend keeps its
// ephemeral port. The token injected into index.html rides along untouched.
function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, serverURL);

    // Forward only what the backend actually needs. Passing the renderer's own
    // headers through (Accept-Encoding, Range, Sec-Fetch-*) made Chromium
    // reject the proxied module scripts with net::ERR_UNEXPECTED, even though
    // a manual fetch() of the same URL succeeded.
    const headers = new Headers();
    for (const name of ['content-type', 'x-kube-ins-token']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const init = { method: request.method, headers };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer();
    }

    const upstream = await net.fetch(target.toString(), init);

    // Buffer rather than stream the response: everything here is local and
    // small, and handing back a fresh Response keeps any content-length or
    // encoding mismatch from reaching the renderer.
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/octet-stream',
      },
    });
  });
}

function createWindow() {
  // Dev uses the Vite server directly (its origin is already stable).
  const target = process.env.KUBE_INS_DEV_URL || `${APP_ORIGIN}/`;

  win = new BrowserWindow({
    width: 1024,
    height: 768,
    frame: false, // custom titlebar, see components/titlebar/TitleBar.tsx
    backgroundColor: '#060e20',
    show: false, // avoid a white flash before React mounts
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The renderer needs the sidecar's real address for the event
      // WebSocket: ws:// cannot travel through the app:// handler, so that one
      // connection is made directly and is therefore cross-origin.
      //
      // Not in dev: the page comes from Vite, whose dev server already proxies
      // /events (ws: true, changeOrigin) to the Go server. Passing the address
      // here would make wailsBridge.ts open the socket straight at the Go port
      // with Origin: http://localhost:5173, which originAllowed rejects.
      additionalArguments: devRPC ? [] : [`--kube-ins-rpc-url=${serverURL}`],
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    win = null;
  });

  // Keep the app pinned to its own origin; anything else opens in the browser.
  const allowedOrigin = new URL(target).origin;
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== allowedOrigin) {
      event.preventDefault();
      openExternal(url);
    }
  });

  // Real window state, so the titlebar's restore icon cannot desync from the
  // OS (snap, double-click, keyboard shortcuts).
  const pushMaximised = () =>
    win?.webContents.send('kube-ins:maximised', win.isMaximized());
  for (const ev of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) {
    win.on(ev, pushMaximised);
  }

  win.loadURL(target);
}

function openExternal(url) {
  // Never hand an unvalidated renderer string to the OS.
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') shell.openExternal(url);
  } catch {}
}

ipcMain.on('shell:openURL', (_e, url) => openExternal(url));
ipcMain.on('shell:minimise', () => win?.minimize());
ipcMain.on('shell:toggleMaximise', () =>
  win?.isMaximized() ? win.unmaximize() : win?.maximize(),
);
ipcMain.on('shell:quit', () => app.quit());
ipcMain.handle('shell:isMaximised', () => win?.isMaximized() ?? false);

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

// Deliberately NO requestSingleInstanceLock: running several instances and
// transferring tabs between them is a product feature (internal/ipc).

app.whenReady().then(async () => {
  if (devRPC) {
    // dev.cjs owns the Go process; we only attach. The dev build skips the
    // token check (devShell in internal/controller/dev_on.go), so any non-empty
    // token gets the shell channel connected — SaveSnapshot's native dialog
    // then works in dev too. No app:// handler: the page is served by Vite.
    serverURL = devRPC;
    shellToken = 'dev';
  } else {
    try {
      await startSidecar();
    } catch (err) {
      fatal('Kube Inspector failed to start', err.message);
      return;
    }
    registerAppProtocol();
  }
  connectShellChannel();
  createWindow();
});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  stopSidecar().finally(() => app.exit(0));
});

// Belt and braces for the paths before-quit never sees.
process.on('exit', () => {
  if (sidecar && sidecar.exitCode === null) sidecar.kill('SIGKILL');
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    quitting = true;
    stopSidecar().finally(() => app.exit(0));
  });
}
