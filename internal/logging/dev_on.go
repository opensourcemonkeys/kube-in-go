//go:build kubeinsdev

package logging

// Development builds (`go build -tags kubeinsdev`) also tee records to stderr,
// so `make dev` shows them in the terminal without anyone having to tail a
// file. Stderr, never stdout: stdout is the Electron sidecar protocol.
//
// Init forces this off for RoleCLI regardless — the terminal UI owns the
// screen. No build-* or pkg-* Makefile target passes this tag.
const devTeeStderr = true
