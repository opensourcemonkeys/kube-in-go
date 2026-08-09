//go:build !kubeinsdev

package logging

// Release builds write to the log file only. Set KUBE_INS_LOG_STDERR=1 to tee
// to stderr for a support session; there is no way to tee to stdout, which
// belongs to the Electron sidecar protocol.
const devTeeStderr = false
