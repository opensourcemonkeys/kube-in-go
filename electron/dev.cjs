// Single-command development loop: Go backend + Vite + Electron.
//
//   make dev  ->  node electron/dev.cjs
//
// Runs the same Electron shell that ships, against a hot-reloading Vite server
// and a dev-tagged Go server. Replaces the old three-terminal dance; the
// individual pieces are still available as make electron-dev-{go,vite} for
// debugging one of them in isolation.
//
// Nothing here is Kubernetes-aware, and none of it is reachable from a release
// build — the kubeinsdev tag appears in no build-* or pkg-* target.

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const isWindows = process.platform === 'win32';

// Pinned, not ephemeral: frontend/vite.config.ts needs a fixed proxy target and
// internal/controller/dev_on.go reads the same variable to decide where to
// bind, so this stays changeable from one place.
const DEV_PORT = process.env.KUBE_INS_DEV_PORT || '34567';

const VERSION = process.env.VERSION || '0.0.0';

// go run has to compile Trivy's dependency tree on a cold cache, which is far
// past the 30s the packaged shell allows its prebuilt sidecar.
const GO_TIMEOUT_MS = 180000;
const VITE_TIMEOUT_MS = 60000;

const children = [];
let shuttingDown = false;

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

function preflight() {
  const missing = [];
  if (!fs.existsSync(path.join(ROOT, 'frontend', 'node_modules'))) {
    missing.push('frontend/node_modules');
  }
  if (!fs.existsSync(path.join(ROOT, 'electron', 'node_modules'))) {
    missing.push('electron/node_modules');
  }
  if (missing.length) {
    fail(`missing ${missing.join(' and ')} — run: make deps`);
  }

  // frontend/wailsjs is generated and gitignored; npm run dev resolves imports
  // from it. The `bindings` make target creates it.
  if (!fs.existsSync(path.join(ROOT, 'frontend', 'wailsjs'))) {
    fail('missing frontend/wailsjs — run: make bindings');
  }
}

function fail(message) {
  console.error(`[dev] ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------

const ANSI = /\x1b\[[0-9;]*m/g;

function start(name, command, args, opts = {}) {
  const env = { ...process.env, ...(opts.env || {}) };
  for (const key of opts.unsetEnv || []) delete env[key];

  const child = spawn(command, args, {
    cwd: opts.cwd || ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so shutdown can take the whole tree. `go run` execs
    // the compiled binary as a child: signalling only go run leaves that
    // binary holding the port, and the next `make dev` fails to bind.
    detached: !isWindows,
    windowsHide: true,
  });

  children.push({ name, child });

  child.on('error', (err) => {
    if (shuttingDown) return;
    shutdown(1, `${name} failed to start: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const why = signal ? `signal ${signal}` : `code ${code}`;
    // Any one of the three dying makes the setup useless — take the rest down
    // rather than leaving half a dev environment running.
    shutdown(code === 0 ? 0 : 1, `${name} exited (${why})`);
  });

  return child;
}

// Pipes a child's output through with a prefix, and resolves as soon as a line
// matches `ready` (returning its first capture group).
function watch(child, name, ready, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${name} was not ready within ${timeoutMs / 1000}s`));
    }, timeoutMs);

    const onData = (chunk) => {
      for (const raw of String(chunk).split('\n')) {
        const line = raw.replace(ANSI, '').trimEnd();
        if (!line) continue;
        console.log(`[${name}] ${line}`);

        if (settled) continue;
        const m = line.match(ready);
        if (m) {
          settled = true;
          clearTimeout(timer);
          resolve(m[1]);
        }
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
  });
}

function killTree({ child }) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (isWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
      });
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {}
}

function shutdown(code, reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (reason) console.log(`[dev] ${reason} — shutting down`);

  for (const entry of children) killTree(entry);

  const force = setTimeout(() => {
    for (const { child } of children) {
      try {
        if (!isWindows) process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }
    process.exit(code);
  }, 3000);
  force.unref();

  // Give the children a moment to unwind (the Go side closes its WS clients so
  // log/exec goroutines finish) before we go.
  setTimeout(() => {
    clearTimeout(force);
    process.exit(code);
  }, 500).unref();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  preflight();

  console.log('[dev] starting Go backend (this compiles on a cold cache)…');
  const go = start('go', 'go', [
    'run',
    '-tags',
    'kubeinsdev',
    '-ldflags',
    `-X 'kube-ins/internal/business.appVersion=${VERSION}-dev'`,
    '.',
    '--serve',
    '--shell-channel',
  ], { env: { KUBE_INS_DEV_PORT: DEV_PORT } });

  const rpcURL = await watch(go, 'go', /kube-ins serving at (\S+)/, GO_TIMEOUT_MS);
  console.log(`[dev] backend ready at ${rpcURL}`);

  const vite = start('vite', 'npm', ['run', 'dev'], {
    cwd: path.join(ROOT, 'frontend'),
    env: { KUBE_INS_DEV_PORT: DEV_PORT },
  });

  // Read the URL rather than assuming 5173 — Vite silently moves up a port
  // when that one is taken.
  const viteURL = await watch(
    vite,
    'vite',
    /Local:\s+(http:\/\/\S+)/,
    VITE_TIMEOUT_MS,
  );
  console.log(`[dev] frontend ready at ${viteURL}`);

  console.log('[dev] launching Electron');
  start('electron', 'npm', ['start'], {
    cwd: path.join(ROOT, 'electron'),
    env: { KUBE_INS_DEV_URL: viteURL, KUBE_INS_DEV_RPC: rpcURL },
    // ELECTRON_RUN_AS_NODE makes require('electron') return a path string
    // instead of the API, so every electron call comes back undefined. VS
    // Code's integrated terminal exports it, so drop it here rather than
    // relying on the caller to do it.
    unsetEnv: ['ELECTRON_RUN_AS_NODE'],
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => shutdown(0, `received ${sig}`));
}

main().catch((err) => shutdown(1, err.message));
