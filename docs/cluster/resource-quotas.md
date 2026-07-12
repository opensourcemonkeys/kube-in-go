---
description: See Kubernetes ResourceQuota usage per namespace as clear used-vs-limit bars in Kube Inspector.
---

# Resource Quotas

The Resource Quotas screen shows all `ResourceQuota` objects grouped by namespace. Only namespaces that have at least one quota defined are shown.

## Layout

The screen uses a hierarchical card layout:

```
┌─────────────────────────────────────────────┐
│ 🔷 my-namespace                    Active   │
├─────────────────────────────────────────────┤
│ 📊 my-quota   [cpu chip] [memory chip] ...  │
│ 📊 dev-limits [cpu chip] [memory chip] ...  │
└─────────────────────────────────────────────┘
```

Each **namespace group** shows the namespace name and its status. Inside the group, each **quota row** lists the quota name followed by resource chips.

## Resource Chips

Each chip represents one resource limit within a quota:

- **Resource name** — top label (e.g., `requests.cpu`, `limits.memory`, `pods`)
- **Usage bar** — a mini progress bar showing used vs. hard limit, color-coded:
  - Green — below 60%
  - Amber — 60–80%
  - Red — above 80%
- **Values** — `used / hard` shown below the bar (e.g., `450m / 2`)

## Filtering by Namespace

Use the **Filter namespace** input in the toolbar to narrow the list to matching namespaces. Click the **×** button to clear the filter.

## Editing a Quota

Each quota row has an **Edit YAML** button (pencil icon). Clicking it opens the `ResourceQuota` manifest in a YAML editor panel. You can adjust hard limits and then click **Apply** to push the changes.

## Counters

The toolbar shows a summary tag: **`N quota · M namespace`** where N is the total number of quotas visible after filtering and M is the number of namespaces containing them.

## Refresh Rate

Resource quota data refreshes every **10 seconds**.
