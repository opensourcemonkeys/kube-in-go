//go:build kubeinsdev

package controller_app

import (
	"net/url"
	"os"
)

// Development builds (`go build -tags kubeinsdev`).
//
// The Vite dev server serves index.html itself, so it cannot receive the token
// the asset handler normally injects, and it needs to reach the Go server at a
// known port. All three relaxations live here and are absent from release
// binaries.
//
// Still enforced in dev: the listener is loopback-only, so nothing off this
// machine can reach the server whatever Origin it claims.

const devShell = true

// devListenAddr uses a fixed port so vite.config.ts can proxy to it. Override
// with KUBE_INS_DEV_PORT when two developers share a machine.
func devListenAddr() string {
	if p := os.Getenv("KUBE_INS_DEV_PORT"); p != "" {
		return "127.0.0.1:" + p
	}
	return "127.0.0.1:34567"
}

// devOriginAllowed accepts the Vite dev server as an origin.
//
// The page is served by Vite on its own port, so requests carry
// Origin: http://localhost:5173 — both the ones proxied through Vite and the
// /events WebSocket. `changeOrigin` in the proxy config does not help: it
// rewrites the Host header, not Origin. Without this every call from a
// Vite-served page is rejected.
//
// Loopback hosts only, and only ever compiled into a dev build.
func devOriginAllowed(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != "http" {
		return false
	}
	return u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1"
}
