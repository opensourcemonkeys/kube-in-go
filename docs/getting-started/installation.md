# Installation

kube-ins ships as a single self-contained binary. No runtime dependencies are required.

## Download

Go to the [Releases page](https://github.com/hakanyorulmaz/kube-ins/releases) and download the archive for your platform.

| Platform | File |
|---|---|
| Linux (amd64) | `kube-ins-linux-amd64.zip` |
| Windows (amd64) | `kube-ins-windows-amd64.zip` |

Extract the archive and run the binary directly — no installation wizard or package manager needed.

## Linux

```bash
unzip kube-ins-linux-amd64.zip
chmod +x kube-ins
./kube-ins
```

If you want the binary available system-wide:

```bash
sudo mv kube-ins /usr/local/bin/
```

## Windows

Extract `kube-ins-windows-amd64.zip` and double-click `kube-ins.exe`.

!!! note "Windows SmartScreen"
    Windows may show a SmartScreen warning for unsigned binaries. Click **More info → Run anyway** to proceed.

## Requirements

- A valid kubeconfig file with at least one cluster configured (`~/.kube/config` or a custom path)
- Network access to the target Kubernetes API server

kube-ins does **not** require `kubectl` to be installed — it communicates directly with the Kubernetes API using client-go.

## First Launch

On first launch, kube-ins checks `~/.kube/config` automatically. If you already have clusters configured there, they will be importable from the cluster manager. See [Adding Clusters](cluster-setup.md) for details.
