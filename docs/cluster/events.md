---
description: Browse, filter, and follow Kubernetes events per namespace in Kube Inspector, with a persistent event stream for every connected cluster.
---

# Events

The Events screen streams cluster `Event` objects, refreshed every few seconds — the fastest way to see what Kubernetes is doing or complaining about.

## Columns

| Column | Description |
|---|---|
| Type | `Normal` or `Warning` |
| Reason | Short machine reason (e.g. `BackOff`, `Scheduled`) |
| Object | The involved object (kind + name) |
| Namespace | Namespace |
| Message | Event message (truncated; double-click for the full text) |
| Age | Time since the event was last seen |

## Actions

- **Warnings only** — toggle to hide `Normal` events and focus on problems.
- **Filter** by namespace, type, reason or object.
- **Double-click** a row to open a detail dialog with the full message.

!!! tip "State is remembered"
    Each cluster's Events tab keeps its rows, filters and the warnings-only toggle across app restarts, so you can reopen it and pick up where you left off.
