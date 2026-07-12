---
description: Keyboard shortcuts and usage for Kube Inspector CLI — navigate resources, view and edit YAML, delete, stream logs, and exec into pods from the terminal.
---

# CLI Usage & Shortcuts

Launch the CLI by running `kube-inspector-cli` (or **Open ▸ CLI Mode** in the desktop app). You start on the **Clusters** screen and navigate inward; each screen replaces the previous one. The top bar always shows a breadcrumb on the left and the available shortcuts for the current screen on the right.

## Navigating

The interface is a stack of screens:

```
Clusters → Resource menu → Resource list → ( YAML view · YAML edit · Logs · Exec )
```

Press `q` or `Esc` to go **back** one level. On the Clusters screen, `q` / `Esc` **quits** the app.

## Global keys

These work on every screen (except while typing in a text field):

| Key | Action |
|---|---|
| `↑` / `↓` or `j` / `k` | Move selection |
| `g` / `G` | Jump to top / bottom |
| `Enter` | Open / select |
| `q` or `Esc` | Back one screen (quit on the Clusters screen) |
| `c` | Jump to the cluster selector |
| `?` | Toggle the help overlay |

!!! tip "Cross-platform shortcuts"
    All shortcuts are plain single keys (no `Ctrl`/`Alt` combos that terminals intercept), so they behave the same on Linux, macOS and Windows. The current screen's keys are always shown in the top-right.

## Clusters screen

The landing screen lists the clusters configured in `~/.kube-ins/` (shared with the desktop app).

| Key | Action |
|---|---|
| `Enter` | Set the selected cluster active and open the resource menu |
| `a` | Add a cluster — enter a **name** and a path to a **kubeconfig** file |
| `d` | Delete the selected cluster config (with confirmation) |
| `v` | View the selected cluster's kubeconfig |

## Resource menu

A grouped list (Workloads, Networking, Config & Secrets, Security, Storage, Cluster) mirroring the desktop sidebar. Use the arrow keys to move, `Enter` to open a resource type, and `Enter` on a group header to collapse/expand it.

## Resource list

Each resource type opens as a table pinned to the active cluster. The header shows the resource title and the current item count.

| Key | Action |
|---|---|
| `/` | Filter rows (matches name & namespace); `Esc` clears the filter |
| `r` | Refresh the list |
| `y` or `Enter` | View the object's YAML |
| `e` | Edit the object's YAML *(where supported)* |
| `d` | Delete the selected object (with confirmation) |
| `l` | Stream **logs** *(pods only)* |
| `s` | Open a **shell** in the pod *(pods only)* |
| `c` | Switch cluster |
| `q` / `Esc` | Back to the menu |

**Nodes** additionally support node operations, shown in the hint bar: `C` cordon, `U` uncordon, `D` drain (with confirmation).

!!! note "Editable resources"
    Resources without a backing update operation (e.g. Pods, Events) are view-only — pressing `e` shows a notice. Editable kinds (Deployments, Services, ConfigMaps, Secrets, RBAC, Nodes, …) open the YAML editor.

## YAML view & edit

- **View** (`y` / `Enter`): a read-only, scrollable YAML pane. Press `g` / `G` to jump to the top / bottom, `e` to switch to editing, `q` / `Esc` to go back.
- **Edit** (`e`): an editable buffer seeded with the live YAML.
    - **`F2`** — save changes (applies the update to the cluster)
    - **`Esc`** — cancel without saving

## Logs

Press `l` on a pod to stream its logs. If the pod has more than one container you'll be prompted to pick one first.

| Key | Action |
|---|---|
| `f` | Toggle follow (auto-scroll) |
| `g` / `G` | Jump to top / bottom |
| `q` / `Esc` | Stop streaming and go back |

## Exec (pod shell)

Press `s` on a pod to open an interactive shell (`/bin/sh`) in the selected container. The terminal UI steps aside and hands the raw terminal to the remote shell.

!!! warning "Disconnecting"
    To leave the shell and return to the table, press **`Ctrl-]`** (the TUI cannot embed a terminal, so it uses this telnet-style escape). Typing `exit` in the shell ends the remote process; press `Ctrl-]` afterwards to return.

## CLI Mode inside the desktop app

You don't need a separate install to try the CLI from the desktop app: choose **Open ▸ CLI Mode** in the title bar. The graphical workspace is replaced by a fullscreen terminal running the same TUI; click **Exit CLI Mode** (or quit the TUI with `q`) to return to the dockview workspace with your panels intact.

!!! note "Shared active cluster"
    The active cluster is stored on disk (`~/.kube-ins/.active`) and shared between the CLI and the desktop app — switching clusters in one affects the other.
