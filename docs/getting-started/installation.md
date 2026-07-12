---
description: Install Kube Inspector, the free visual desktop client for Kubernetes, on Linux, macOS, or Windows.
---

# Installation

Kube Inspector ships as a self-contained binary for **Linux, macOS and Windows**. On Linux, one system library (WebKitGTK) is required at runtime; macOS and Windows need no extra dependency.

## Download

Get the package for your platform from the [Downloads](../downloads.md) page:

| Platform | File |
|---|---|
| Linux — Debian / Ubuntu 22.04 | `kube-inspector-<version>-debian-amd64-ubuntu-22.04-amd64.deb` |
| Linux — Debian / Ubuntu 24.04 | `kube-inspector-<version>-debian-amd64-ubuntu-24.04-amd64.deb` |
| Linux — RHEL 9 / Fedora | `kube-inspector-<version>-rhel9-x86_64.rpm` |
| Linux — RHEL 10 / Fedora | `kube-inspector-<version>-rhel10-x86_64.rpm` |
| macOS (Universal) | `kube-inspector-<version>-macos-universal.dmg` |
| Windows | `kube-inspector-<version>-windows-amd64.exe` |

!!! note "Two Linux builds"
    The **22.04 / rhel9** packages link against WebKitGTK **4.0**; the **24.04 / rhel10** packages against WebKitGTK **4.1**. Pick the one that matches your distribution's WebKitGTK version (see below).

## Linux

### Dependency: WebKitGTK

Kube Inspector uses a WebKit-based webview (via [Wails](https://wails.io)). A WebKitGTK runtime library must be present. Install it before running the app:

=== "Debian 11 / Ubuntu 22.04 (4.0)"
    ```bash
    sudo apt-get install -y libwebkit2gtk-4.0-37
    ```

=== "Debian 12 / Ubuntu 24.04 (4.1)"
    ```bash
    sudo apt-get install -y libwebkit2gtk-4.1-0
    ```

=== "Fedora 38 (4.0)"
    ```bash
    sudo dnf install webkit2gtk4.0
    ```

=== "Fedora 39+ (4.1)"
    ```bash
    sudo dnf install webkit2gtk4.1
    ```

=== "RHEL / AlmaLinux / Rocky"
    ```bash
    sudo dnf install webkit2gtk3
    ```

### Installing the package

=== "Debian / Ubuntu"
    ```bash
    # 22.04 (WebKitGTK 4.0)
    sudo dpkg -i kube-inspector-<version>-debian-amd64-ubuntu-22.04-amd64.deb
    # 24.04 (WebKitGTK 4.1)
    sudo dpkg -i kube-inspector-<version>-debian-amd64-ubuntu-24.04-amd64.deb
    ```

=== "RHEL / Fedora"
    ```bash
    # RHEL 9 / older Fedora (WebKitGTK 4.0)
    sudo rpm -i kube-inspector-<version>-rhel9-x86_64.rpm
    # RHEL 10 / newer Fedora (WebKitGTK 4.1)
    sudo rpm -i kube-inspector-<version>-rhel10-x86_64.rpm
    ```

## macOS

Open `kube-inspector-<version>-macos-universal.dmg` and drag **Kube Inspector** into your Applications folder. The build is a universal binary (Apple Silicon and Intel) and needs no extra runtime library.

!!! note "Gatekeeper"
    The app is unsigned, so macOS may block the first launch. Right-click the app → **Open** and confirm, or allow it under **System Settings → Privacy & Security**.

## Windows

Run `kube-inspector-<version>-windows-amd64.exe` and follow the installation wizard.

!!! note "Windows SmartScreen"
    Windows may show a SmartScreen warning for unsigned binaries. Click **More info → Run anyway** to proceed.

## Requirements

- A valid kubeconfig with at least one cluster configured (`~/.kube/config` or a custom path)
- Network access to the target Kubernetes API server
- **Linux only**: WebKitGTK 4.0 or 4.1 system library (see above). macOS and Windows need no extra runtime dependency.

Kube Inspector does **not** require `kubectl` to be installed — it communicates directly with the Kubernetes API using client-go.

## Supported Operating Systems

We build and test the platforms below. Other distributions may work if you can satisfy the WebKitGTK dependency and install one of the provided `.deb` / `.rpm` packages, but they are not officially supported.

### macOS

| Version | Notes |
|---|---|
| macOS 11 (Big Sur) and later | Universal binary — Apple Silicon and Intel |

### Windows

| Version | Notes |
|---|---|
| Windows 11 (all builds) | Fully supported |
| Windows 10 (build 1803+) | Requires the WebView2 Runtime — included by default since build 1803 |

### Linux

`.deb` packages target the Debian/Ubuntu family; `.rpm` packages target the RHEL/Fedora family. Choose the build matching your WebKitGTK version.

| Distribution | Versions | WebKitGTK | Package |
|---|---|---|---|
| Ubuntu | 22.04 LTS | 4.0 | `.deb` (22.04) |
| Ubuntu | 24.04 LTS | 4.1 | `.deb` (24.04) |
| Debian | 11 (Bullseye) | 4.0 | `.deb` (22.04) |
| Debian | 12 (Bookworm) | 4.1 | `.deb` (24.04) |
| Ubuntu derivatives (Mint, Pop!\_OS, elementary) | based on 22.04 / 24.04 | 4.0 / 4.1 | `.deb` |
| Fedora | 38 | 4.0 | `.rpm` (rhel9) |
| Fedora | 39, 40, 41 | 4.1 | `.rpm` (rhel10) |
| RHEL / AlmaLinux / Rocky Linux | 9.x | webkit2gtk3 | `.rpm` (rhel9) |

## First Launch

On first launch, Kube Inspector checks `~/.kube/config` automatically. If you already have clusters configured there, they will be importable from the cluster manager. See [Adding Clusters](cluster-setup.md) for details.
