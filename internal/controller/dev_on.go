//go:build kubeinsdev

package controller_app

import "os"

// Development builds (`go build -tags kubeinsdev`).
//
// The Vite dev server serves index.html itself, so it cannot receive the token
// the asset handler normally injects, and it needs to reach the Go server at a
// known port. Both relaxations live here and are absent from release binaries.
//
// Still enforced in dev: the listener is loopback-only and the Origin check
// runs unchanged — Vite's proxy uses changeOrigin, so proxied requests arrive
// with our own origin and pass without any allowlist.

const devShell = true

// devListenAddr uses a fixed port so vite.config.ts can proxy to it. Override
// with KUBE_INS_DEV_PORT when two developers share a machine.
func devListenAddr() string {
	if p := os.Getenv("KUBE_INS_DEV_PORT"); p != "" {
		return "127.0.0.1:" + p
	}
	return "127.0.0.1:34567"
}
