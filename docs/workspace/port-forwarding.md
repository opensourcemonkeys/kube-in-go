---
description: Forward a cluster port to 127.0.0.1 from Kube Inspector — pick the remote port by name, keep the tunnel across a rolling restart, and manage every forward in one panel.
---

# Port forwarding

Port forwarding opens a tunnel from a port on your machine to a port inside the
cluster, so a Service or Pod that has no external address becomes reachable at
`127.0.0.1:<port>` — a database client, a browser, `curl`, anything local.

It is `kubectl port-forward` with the parts you have to remember filled in for
you, and a panel that keeps track of what is running.

## Starting a forward

1. Open a **Pods**, **Deployments**, **StatefulSets**, **ReplicaSets** or
   **Services** list.
2. Click the **⋮** at the end of a row and choose **Port forward**.
3. Pick the **remote port**. The dropdown lists the ports the target actually
   declares, by name — `http · 8080/TCP · web` — so there is no need to go
   looking them up. A single declared port is selected for you.
4. Accept or change the **local port**. It is pre-filled with the remote port
   when that is free, and with the next free port when it is not.
5. Click **Start**.

The forward appears in the Port Forwards panel and in the title-bar pill.

!!! tip "Ports that are not declared"
    A container can listen on a port it never declared in its manifest. Choose
    **Custom…** in the dropdown and type the port number.

    UDP ports are shown but not selectable — port forwarding is a TCP stream.

## The Port Forwards panel

**Open ▸ Port Forwards**, or click the pill in the title bar.

The panel lists every tunnel this application process is running, **across all
clusters** — unlike every other list, it describes what the app is doing rather
than what one cluster contains.

| Column | |
|---|---|
| Status | `ready`, `starting`, `reconnecting` (with the attempt number) or `error` |
| Address | `127.0.0.1:<local> → <remote>`, plus the pod port when it differs from the service port |
| Target | The kind and name you started it from |
| Namespace, Pod, Cluster | Where the tunnel actually landed |
| Age | How long it has been up |

Each row has up to four buttons:

| | |
|---|---|
| 🌐 **Open in browser** | Appears when the port looks like a web port. Opens `http://127.0.0.1:<port>` in your default browser. |
| ⧉ **Copy address** | Copies `127.0.0.1:<port>`. Always available. |
| ⟳ **Restart** | Tears the tunnel down and rebuilds it, re-resolving the target — the right button after a pod was replaced. It keeps the same local port, so an address you already pasted somewhere still works. |
| ✕ **Stop / Dismiss** | Stops the tunnel. On a row that already failed, this just clears it. |

A row in `error` prints its reason underneath the table and stays there until
you dismiss it — a tunnel that broke is something to act on, not something to
make disappear.

## Lifetime: the process owns the tunnel, not the panel

This is the one behaviour worth internalising.

**Closing the Port Forwards tab stops nothing.** Neither does closing the list
you started the forward from. You open a tunnel, close the tab, and go and work
in your browser — tearing the tunnel down at that moment would be
indistinguishable from a fault.

A forward ends when you stop it, or when the application quits. The title-bar
pill keeps counting while every related panel is closed.

## Reconnection

When the pod behind a tunnel disappears — a rolling restart, an eviction, a node
drain — what happens depends on what you forwarded:

- **A Deployment, StatefulSet, ReplicaSet or Service** re-resolves to a new pod
  and reconnects, keeping the same local port. The status shows `reconnecting`
  with an attempt counter. This is what lets a tunnel survive a deploy.
- **A Pod** does not. Moving your tunnel to a different pod would answer a
  question you did not ask. The row goes to `error`; **Restart** rebuilds it.

Reconnection gives up after **five attempts** and leaves the row in `error`.

## Security

- **Forwards bind `127.0.0.1` only**, and there is no setting that changes it.
  A forwarded port is unauthenticated access to a cluster workload; exposing one
  on your network is deliberately not offered.
- Ports below 1024 need privileges the app does not have. Use 8080 rather
  than 80.
- The tunnel uses the same credentials as the panel you started it from, and it
  needs the `pods/portforward` create permission in that namespace.

## In the terminal UI

`kube-inspector-cli` has the same feature with different keys:

| Key | |
|---|---|
| `F` | Start a forward on the selected row (type `local:remote`) |
| — | The **Port Forwards** view lists them |
| `X` | Stop the selected forward |

**The CLI is a separate process with its own tunnels.** They do not appear in
the desktop app's panel, and the desktop app's do not appear there. The same
applies to CLI Mode inside the GUI — closing that overlay ends the process
behind it and its forwards with it.

## Troubleshooting

| Symptom | See |
|---|---|
| `address already in use` | [Troubleshooting](../troubleshooting.md#port-forward-address-already-in-use) |
| Status stuck in `error` | [Troubleshooting](../troubleshooting.md#a-port-forward-stopped-working) |
| No **Open in browser** button on a web port | The hint is derived from the port number alone — see [Known limitations](../known-limitations.md#port-forwarding) |

## Related

- [Services](../networking/services.md)
- [Pods](../workloads/pods.md)
- [Terminal](terminal.md)
