---
description: Open kubectl-style describe output for any resource in a Kube Inspector panel — events included, no kubectl installed, refresh and copy in place.
---

# Describe

Describe gives you the same human-readable summary `kubectl describe` prints —
labels, selectors, container state, conditions, volumes and **the object's
recent events** — in a panel next to the list you opened it from.

It is generated in-process by the same describer library `kubectl` uses, over
the API. No `kubectl` binary is involved and no subprocess is spawned.

## Opening it

1. In any resource list, click the **⋮** button at the end of a row.
2. Choose **Describe**.

The panel opens immediately to the right of the list it came from, titled with
the object's `namespace/name`, and stays pinned to that list's cluster.

Describe is available from every list view: Pods, Deployments, StatefulSets,
ReplicaSets, DaemonSets, Jobs, CronJobs, Services, Endpoints, Ingresses, Ingress
Classes, Network Policies, ConfigMaps, Secrets, Service Accounts, Roles, Role
Bindings, Persistent Volumes, Volume Claims, Storage Classes, Namespaces and
Limit Ranges.

## Reading it

Output is plain monospaced text with the original line breaks preserved, so it
matches `kubectl describe` line for line. The most useful part is usually at the
bottom: the **Events** section, which is where a pod tells you it cannot pull an
image, cannot be scheduled, or is failing its probes.

## Actions

| Button | What it does |
|---|---|
| **Refresh** | Re-runs the describe. Your scroll position is kept, so watching a section at the bottom does not throw you back to the top. |
| **Copy** | Copies the whole output to the clipboard — for an issue, a ticket, or a message to a colleague. |

If a refresh fails, a banner appears above the text and the **previous output
stays on screen**, marked stale, rather than the panel going blank. The banner
carries the API server's own message and has a retry button.

## Notes

- **Read-only.** To change something, use the YAML editor
  ([YAML Editor](yaml-editor.md)) or a dedicated action such as Scale.
- **Not live.** Describe is a snapshot. Use **Refresh** to re-read it; the
  [Events](../cluster/events.md) view is the place to watch a stream.
- **Custom resources** fall back to a generic table-style description when the
  kind has no dedicated describer. Open them from the CRD explorer.
- **Nodes are the one gap.** The Nodes view has its own card layout with cordon
  and drain, and no Describe entry in this release. `kubectl describe node` still
  has the detail.

## Related

- [YAML Editor](yaml-editor.md) — view and edit the manifest itself
- [Log Viewer](log-viewer.md)
- [Events](../cluster/events.md)
