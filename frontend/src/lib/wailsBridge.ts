/**
 * Shell-agnostic bridge for the generated Wails bindings.
 *
 * Every file in frontend/wailsjs is a thin wrapper over two globals:
 *
 *   window.go.controller_app.App.<Method>(...args)   // RPC
 *   window.runtime.<Fn>(...)                         // events, window, browser
 *
 * Under Wails those globals are installed by the injected runtime. Under a
 * Chromium shell (plain browser tab, Energy/CEF) nothing installs them, so we
 * do it here over the loopback HTTP/WebSocket server in internal/controller.
 *
 * Because we supply the globals rather than the modules, all ~50 call sites and
 * the generated App.js / runtime.js keep working untouched.
 *
 * Import this FIRST in main.tsx, before anything that touches the bindings.
 */

declare global {
  interface Window {
    go?: Record<string, unknown>;
    runtime?: Record<string, unknown>;
    __KUBE_INS_RPC__?: string;
  }
}

type Listener = { callback: (...data: any[]) => void; remaining: number };

const TOKEN = window.__KUBE_INS_RPC__;

/** Wails is already in charge — leave everything alone. */
const underWails = typeof window.go !== 'undefined';

if (!underWails && TOKEN) {
  installBridge(TOKEN);
}

function installBridge(token: string) {
  // Native shells inject this (see electron/preload.cjs); absent in a browser.
  const shell = (window as any).__KUBE_INS_SHELL__ ?? {};

  const base = `${location.protocol}//${location.host}`;

  // -- RPC ------------------------------------------------------------------
  //
  // A Proxy means we never enumerate the ~150 App methods: any property access
  // becomes a call. Mirrors Wails' promise semantics — a trailing Go `error`
  // rejects, whatever remains resolves.
  const call = async (method: string, args: any[]) => {
    const res = await fetch(`${base}/rpc/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kube-Ins-Token': token,
      },
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      throw new Error(`${method}: ${res.status} ${res.statusText}`);
    }

    const body = await res.json();
    if (!body.ok) {
      throw new Error(body.error || `${method} failed`);
    }
    return body.result;
  };

  const appProxy = new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => (...args: any[]) => call(prop, args),
  });

  window.go = { controller_app: { App: appProxy } };

  // -- Events ---------------------------------------------------------------

  const listeners = new Map<string, Listener[]>();
  let socket: WebSocket | null = null;
  let backoff = 250;

  const connect = () => {
    // Under a shell that serves the page from its own scheme (Electron's
    // app://), location.host is not a real host and ws:// cannot travel
    // through the custom protocol handler — so the shell hands us the
    // sidecar's actual address. Everywhere else the page origin is the server.
    const rpcUrl: string | undefined = shell.rpcUrl;
    const wsBase = rpcUrl
      ? rpcUrl.replace(/^http/, 'ws').replace(/\/$/, '')
      : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;

    socket = new WebSocket(`${wsBase}/events?token=${encodeURIComponent(token)}`);

    socket.onopen = () => {
      backoff = 250;
    };

    socket.onmessage = (ev) => {
      let frame: { event: string; data: any[] };
      try {
        frame = JSON.parse(ev.data);
      } catch {
        return;
      }
      dispatch(frame.event, frame.data ?? []);
    };

    // The Go side outlives any single socket (streams keep running), so
    // reconnect rather than dropping events permanently.
    socket.onclose = () => {
      socket = null;
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 5000);
    };
  };

  const dispatch = (event: string, data: any[]) => {
    const bucket = listeners.get(event);
    if (!bucket) return;

    // Copy: a callback may unsubscribe while we iterate.
    for (const l of [...bucket]) {
      l.callback(...data);
      if (l.remaining > 0 && --l.remaining === 0) {
        const idx = bucket.indexOf(l);
        if (idx !== -1) bucket.splice(idx, 1);
      }
    }
    if (bucket.length === 0) listeners.delete(event);
  };

  connect();

  // EventsOn/EventsOnce in the generated runtime.js both delegate here, so this
  // is the only registration function we need to provide.
  const EventsOnMultiple = (
    event: string,
    callback: (...data: any[]) => void,
    maxCallbacks: number,
  ) => {
    const l: Listener = { callback, remaining: maxCallbacks };
    const bucket = listeners.get(event) ?? [];
    bucket.push(l);
    listeners.set(event, bucket);

    return () => {
      const b = listeners.get(event);
      if (!b) return;
      const idx = b.indexOf(l);
      if (idx !== -1) b.splice(idx, 1);
      if (b.length === 0) listeners.delete(event);
    };
  };

  const EventsOff = (event: string, ...more: string[]) => {
    for (const name of [event, ...more]) listeners.delete(name);
  };

  // -- Window / browser -----------------------------------------------------
  //
  // A native shell fills these in via window.__KUBE_INS_SHELL__ (see `shell`
  // above). In a plain browser tab they degrade to the closest sensible
  // behaviour.
  const noop = () => {};

  window.runtime = {
    EventsOnMultiple,
    EventsOff,
    EventsOffAll: () => listeners.clear(),
    EventsEmit: (event: string, ...data: any[]) => dispatch(event, data),

    BrowserOpenURL: shell.openURL ?? ((url: string) => window.open(url, '_blank')),
    WindowMinimise: shell.minimise ?? noop,
    WindowToggleMaximise: shell.toggleMaximise ?? noop,
    Quit: shell.quit ?? (() => window.close()),
  };
}

export {};
