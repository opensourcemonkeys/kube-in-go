//go:build !kubeinsdev

package controller_app

// Release builds: the RPC server binds an ephemeral loopback port and always
// enforces the per-process token.
//
// The relaxed development variant lives in dev_on.go behind the `kubeinsdev`
// build tag, so none of it is compiled into a shipped binary. No build-* or
// pkg-* Makefile target passes that tag.

const devShell = false

// devListenAddr is the address NewServer binds. Port 0 => the OS picks a free
// port; never hardcode one, it would clash with internal/ipc's hub (34200) and
// break multi-instance usage.
func devListenAddr() string { return "127.0.0.1:0" }
