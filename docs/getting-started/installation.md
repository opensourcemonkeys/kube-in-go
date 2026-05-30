# Installation

kube-ins ships as a single self-contained binary. On Linux, one system library is required at runtime (see below).

## Download

Go to the [Releases page](https://github.com/opensourcemonkeys/kube-in-go/releases) and download the package for your platform.

| Platform | File |
|---|---|
| Linux — Debian / Ubuntu | `kube-ins-<version>-debian-amd64.deb` |
| Linux — RHEL / Fedora | `kube-ins-<version>-rhel-x86_64.rpm` |
| Windows | `kube-ins-<version>-windows-amd64.exe` |

## Linux

### Dependency: WebKitGTK

kube-ins uses a WebKit-based webview (via [Wails](https://wails.io)). A WebKitGTK runtime library must be present on the host system. Install it before running the app:

=== "Debian 11 / Ubuntu 22.04 and older"
    ```bash
    sudo apt-get install -y libwebkit2gtk-4.0-37
    ```

=== "Debian 12 / Ubuntu 24.04"
    ```bash
    sudo apt-get install -y libwebkit2gtk-4.1-0
    ```

=== "Fedora 38 and older"
    ```bash
    sudo dnf install webkit2gtk4.0
    ```

=== "Fedora 39+"
    ```bash
    sudo dnf install webkit2gtk4.1
    ```

=== "RHEL / AlmaLinux / Rocky"
    ```bash
    sudo dnf install webkit2gtk3
    ```

=== "openSUSE Leap"
    ```bash
    sudo zypper install libwebkit2gtk-4_0-37
    ```

=== "openSUSE Tumbleweed"
    ```bash
    sudo zypper install libwebkit2gtk-4_1-0
    ```

=== "Arch Linux / Manjaro"
    ```bash
    sudo pacman -S webkit2gtk-4.1
    ```

### Installing the package

=== "Debian / Ubuntu"
    ```bash
    sudo dpkg -i kube-ins-<version>-debian-amd64.deb
    ```

=== "RHEL / Fedora / openSUSE"
    ```bash
    sudo rpm -i kube-ins-<version>-rhel-x86_64.rpm
    ```

## Windows

Run `kube-ins-<version>-windows-amd64.exe` and follow the installation wizard.

!!! note "Windows SmartScreen"
    Windows may show a SmartScreen warning for unsigned binaries. Click **More info → Run anyway** to proceed.

## Requirements

- A valid kubeconfig file with at least one cluster configured (`~/.kube/config` or a custom path)
- Network access to the target Kubernetes API server
- **Linux only**: WebKitGTK 4.0 or 4.1 system library (see above)

kube-ins does **not** require `kubectl` to be installed — it communicates directly with the Kubernetes API using client-go.

## Supported Operating Systems

### Windows

| Version | Notes |
|---|---|
| Windows 11 (all builds) | Fully supported |
| Windows 10 (build 1803+) | Requires WebView2 Runtime — included by default since build 1803 |

### Linux

kube-ins requires **WebKitGTK 4.0** or **WebKitGTK 4.1** to be available as a system package.

| Distribution | Versions | WebKitGTK |
|---|---|---|
| Ubuntu | 22.04 LTS | 4.0 |
| Ubuntu | 24.04 LTS | 4.1 |
| Debian | 11 (Bullseye) | 4.0 |
| Debian | 12 (Bookworm) | 4.1 |
| Linux Mint | 21.x | 4.0 |
| Pop!\_OS | 22.04 | 4.0 |
| Elementary OS | 7.x (Horus) | 4.0 |
| Fedora | 38 | 4.0 |
| Fedora | 39, 40, 41 | 4.1 |
| RHEL / AlmaLinux / Rocky Linux | 8.x, 9.x | 4.0 |
| openSUSE Leap | 15.6 | 4.0 |
| openSUSE Tumbleweed | Rolling | 4.1 |
| Arch Linux | Rolling | 4.0 / 4.1 |
| Manjaro | Rolling | 4.0 / 4.1 |

## First Launch

On first launch, kube-ins checks `~/.kube/config` automatically. If you already have clusters configured there, they will be importable from the cluster manager. See [Adding Clusters](cluster-setup.md) for details.
