[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=opensourcemonkeys_kube-in-go&metric=code_smells&token=9517aa0dd09f9e60df2e574263790002b60845f6)](https://sonarcloud.io/summary/new_code?id=opensourcemonkeys_kube-in-go)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=opensourcemonkeys_kube-in-go&metric=reliability_rating&token=9517aa0dd09f9e60df2e574263790002b60845f6)](https://sonarcloud.io/summary/new_code?id=opensourcemonkeys_kube-in-go)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=opensourcemonkeys_kube-in-go&metric=security_rating&token=9517aa0dd09f9e60df2e574263790002b60845f6)](https://sonarcloud.io/summary/new_code?id=opensourcemonkeys_kube-in-go)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=opensourcemonkeys_kube-in-go&metric=vulnerabilities&token=9517aa0dd09f9e60df2e574263790002b60845f6)](https://sonarcloud.io/summary/new_code?id=opensourcemonkeys_kube-in-go)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=opensourcemonkeys_kube-in-go&metric=sqale_rating&token=9517aa0dd09f9e60df2e574263790002b60845f6)](https://sonarcloud.io/summary/new_code?id=opensourcemonkeys_kube-in-go)

# Kube Inspector

A visual desktop client for managing Kubernetes clusters. Built with Go, Wails, and React.

> Full documentation: [opensourcemonkeys.github.io/kube-in-go](https://opensourcemonkeys.github.io/kube-in-go)

## Installation

Download the latest release for your platform from the [Releases page](https://github.com/opensourcemonkeys/kube-in-go/releases).

| Platform | File |
|---|---|
| Linux — Debian / Ubuntu | `kube-ins-<version>-debian-amd64.deb` |
| Linux — RHEL / Fedora | `kube-ins-<version>-rhel-x86_64.rpm` |
| macOS (Universal) | `kube-ins-<version>-macos-universal.dmg` |
| Windows | `kube-ins-<version>-windows-amd64.exe` |

**Linux** requires WebKitGTK at runtime. Install it before running the app:

```bash
# Debian / Ubuntu 22.04
sudo apt-get install -y libwebkit2gtk-4.0-37

# Debian 12 / Ubuntu 24.04
sudo apt-get install -y libwebkit2gtk-4.1-0

# Fedora 38 and older
sudo dnf install webkit2gtk4.0

# Fedora 39+
sudo dnf install webkit2gtk4.1

# RHEL / AlmaLinux / Rocky Linux
sudo dnf install webkit2gtk3
```

For a full list of supported distributions and versions see the [Installation guide](https://github.com/opensourcemonkeys/kube-in-go/blob/main/docs/getting-started/installation.md).

## Building from Source

### Prerequisites

| Tool | Version |
|---|---|
| Go | 1.24+ |
| Node.js | 20+ |
| Wails CLI | latest |

Install the Wails CLI:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

**Linux** also requires the following build-time libraries:

```bash
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev
```

### Development

```bash
wails dev
# or with version injection:
make dev
```

### Production Build

```bash
# Current platform
make build

# Specific platform
make build-linux
make build-windows
make build-mac
```

### Package (installer / deb / rpm / dmg)

```bash
make pkg-deb        # .deb (Debian / Ubuntu)
make pkg-rpm        # .rpm (RHEL / Fedora)
make pkg-windows    # NSIS installer (.exe)
make pkg-mac        # DMG (.dmg)
make pkg-all        # all platforms
```

Output goes to `dist/`.

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.
