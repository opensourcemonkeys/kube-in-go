# Terminal

The Terminal panel provides an integrated `kubectl` terminal directly inside kube-ins. It is powered by xterm.js and a server-side pseudo-terminal (pty).

## Opening the Terminal

Click **Terminal** in the sidebar under the Workspace section. A terminal panel opens, already connected to a shell with `kubectl` available and configured against the active cluster.

## Usage

The terminal behaves like a standard terminal emulator:

- Run any `kubectl` command directly
- Use tab completion, history (`↑`/`↓`), and keyboard shortcuts
- Open multiple terminal panels by clicking the Terminal sidebar item again

```bash
# Examples
kubectl get pods -n production
kubectl describe node worker-1
kubectl exec -it my-pod -- /bin/sh
kubectl rollout status deployment/my-app
```

## Active Cluster Context

The terminal session is pre-configured with the kubeconfig of the currently active cluster. Switching clusters in the cluster manager does not automatically update already-open terminal sessions. Close and reopen the terminal after switching clusters to use the new context.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+C` | Interrupt current command |
| `Ctrl+L` | Clear the terminal screen |
| `↑` / `↓` | Navigate command history |
| `Tab` | Autocomplete (if shell supports it) |

## Notes

- The terminal runs a shell process on your local machine; it is not an in-cluster exec session.
- Shell configuration (`.bashrc`, `.zshrc`) is sourced on startup, so aliases and functions you have defined locally are available.
