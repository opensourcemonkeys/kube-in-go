---
description: View and edit Kubernetes Secrets in Kube Inspector with an automatic base64 decode/encode key-value editor.
---

# Secrets

The Secrets screen lists all `Secret` resources across namespaces.

## Columns

| Column | Description |
|---|---|
| Name | Secret name |
| Namespace | Namespace |
| Type | Secret type (e.g., `Opaque`, `kubernetes.io/tls`, `kubernetes.io/dockerconfigjson`) |
| Data Keys | Number of keys stored in the secret |

## Actions

### View / Edit YAML

Double-click a row to open the full Secret YAML. Secret values are **base64-encoded** in YAML — this is how Kubernetes stores them, not encryption.

### Key-Value Editor

Click the **sliders** icon on a row to open the key-value editor. The panel decodes values from base64 and displays them as plain text for easier editing. When you save, values are re-encoded automatically before being written to the cluster.

!!! danger "Sensitive data"
    Secret values are shown decoded in the key-value editor. Be careful when working in shared environments or when screen sharing.

### Bulk Delete

Select one or more secrets and click **Delete Selected**. Confirm in the dialog.

!!! warning
    Deleting a secret that is referenced by a pod (as an environment variable or volume) will cause that pod to fail when it is next scheduled or restarted.

## Secret Types

Common Kubernetes secret types you may encounter:

| Type | Usage |
|---|---|
| `Opaque` | Arbitrary user-defined key-value data |
| `kubernetes.io/tls` | TLS certificates (`tls.crt`, `tls.key`) |
| `kubernetes.io/dockerconfigjson` | Container registry credentials |
| `kubernetes.io/service-account-token` | Auto-generated service account token |

## Filtering

Use the filter row to search by name, namespace, type, or data key count. The **Data Keys** column supports numeric filtering — enter a number to find secrets with exactly that many keys.
