# Installation

kube-ins ships as a single self-contained binary. On Linux, one system library is required at runtime (see below).

## Download

Go to the [Releases page](https://github.com/opensourcemonkeys/kube-in-go/releases) and download the archive for your platform.

| Platform | File |
|---|---|
| Linux (amd64) | `kube-ins-linux-amd64.zip` |
| Windows (amd64) | `kube-ins-windows-amd64.zip` |

Extract the archive and run the binary directly — no installation wizard or package manager needed.

## Linux

### Dependency: webkit2gtk-4.0

kube-ins uses a WebKit-based webview (via [Wails](https://wails.io)). The `webkit2gtk-4.0` library must be present on the host system.

Install it with your distro's package manager before running the app:

=== "Debian / Ubuntu"
    ```bash
    sudo apt-get install -y libwebkit2gtk-4.0-dev
    ```

=== "Fedora"
    ```bash
    sudo dnf install webkit2gtk4.0
    ```

=== "Arch Linux"
    ```bash
    sudo pacman -S webkit2gtk
    ```

=== "openSUSE"
    ```bash
    sudo zypper install libwebkit2gtk-4_0-37
    ```

### Running the binary

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
- **Linux only**: `webkit2gtk-4.0` system library (see above)

kube-ins does **not** require `kubectl` to be installed — it communicates directly with the Kubernetes API using client-go.

## First Launch

On first launch, kube-ins checks `~/.kube/config` automatically. If you already have clusters configured there, they will be importable from the cluster manager. See [Adding Clusters](cluster-setup.md) for details.
