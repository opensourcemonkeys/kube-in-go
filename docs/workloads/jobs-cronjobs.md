---
description: Inspect Kubernetes Jobs and CronJobs, their schedules and completion status, in Kube Inspector.
---

# Jobs & CronJobs

## Jobs

Jobs run a workload to completion. Kube Inspector lists all Jobs across namespaces.

### Columns

| Column | Description |
|---|---|
| Name | Job name |
| Namespace | Namespace |
| Completions | Successful / desired completions |
| Status | Active, Complete, Failed |
| Duration | How long the job ran (or has been running) |
| Age | Time since creation |

### Actions

- **View YAML** — Double-click to open the Job manifest. Jobs are read-only in Kube Inspector; to re-run, delete the Job and recreate it (or trigger the parent CronJob).
- **Delete** — Removes the Job and its completed/failed pods.

---

## CronJobs

CronJobs create Jobs on a schedule defined by a cron expression.

### Columns

| Column | Description |
|---|---|
| Name | CronJob name |
| Namespace | Namespace |
| Schedule | Cron expression (e.g. `0 * * * *`) |
| Last Schedule | When the last Job was triggered |
| Active | Number of currently active Jobs |
| Status | Active / Suspended |
| Age | Time since creation |

### Actions

### Suspend / Resume

Click the **Suspend** button to prevent the CronJob from creating new Jobs. Click **Resume** to re-enable scheduling. The current status is reflected in the Status column.

### View / Edit YAML

Double-click a row to open the full CronJob manifest. You can change the schedule, image, environment variables, or any other spec field, then click **Apply**.

### Delete

Deletes the CronJob. Active Jobs that were created by it are not automatically deleted — use the Jobs screen to clean those up if needed.

### View Logs

Opens a log panel for the most recently active pod spawned by this CronJob.
