---
description: Stream and search Kubernetes pod logs in real time with the Kube Inspector log viewer.
---

# Log Viewer

The Log Viewer streams pod logs in real time inside Kube Inspector. It works for both individual pods and workload-level resources (Deployments, StatefulSets, etc.).

## Opening the Log Viewer

- **From a Pod row** — Click the **Logs** button on the pod row.
- **From a workload row** — Click the **Logs** button on a Deployment, StatefulSet, DaemonSet, ReplicaSet, or CronJob row.

A log panel opens in the panel area. Each log session opens as a separate tab, so you can stream logs from multiple pods simultaneously.

## Pod Selector

When opening logs from a workload (not a pod directly), a **pod selector** dropdown appears at the top of the log panel. It lists all pods managed by that workload. Select a pod to switch the log stream to that pod.

## Log Streaming

Logs are streamed in real time using the Kubernetes log API (`follow=true`). New lines appear at the bottom as they are written by the container.

## Filtering and Search

The log viewer supports in-panel text search. Use `Ctrl+F` to open the search bar and filter visible log lines.

## Scrolling

- The viewer auto-scrolls to the bottom as new lines arrive.
- Scroll up manually to pause auto-scroll and review earlier output.
- Scroll back to the bottom to resume auto-scroll.

## Closing

Close the log panel tab to stop the log stream. The stream is stopped server-side; no background processes are left running.

## Tips

- Open multiple log panels side-by-side by dragging tabs to split the view — useful for comparing logs across pods.
- Logs older than what the Kubernetes API returns (controlled by `--tail` and retention settings on the node) are not available through this viewer. Use a log aggregation system for historical logs.
