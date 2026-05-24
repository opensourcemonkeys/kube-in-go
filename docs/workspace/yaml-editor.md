# YAML Editor

The YAML Editor workspace panel lets you apply arbitrary YAML to the active cluster — equivalent to running `kubectl apply -f`.

## Opening the Editor

Click **YAML Editor** (or **Apply YAML**) in the sidebar under the Workspace section. The panel opens with an empty Monaco editor.

## Applying YAML

1. Paste or type a valid Kubernetes manifest in the editor.
2. Click **Apply**.
3. The result (success message or error output from the API server) appears below the editor.

You can apply multi-document YAML by separating manifests with `---`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  key: value
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  ...
```

## Inline YAML Edit (from Resource Screens)

Most resource screens open a YAML editor panel when you double-click a row (or click the edit button). This is a **pre-loaded** editor — the resource's current YAML is fetched from the cluster and shown in the editor. After making changes, click **Apply** to push the update.

The panel title shows the resource kind and name (e.g., `deployment / my-app`).

## Editor Features

The Monaco editor provides:

- YAML syntax highlighting
- Bracket matching
- Multi-cursor editing (`Alt+Click`)
- Find & Replace (`Ctrl+H`)
- Format document (`Shift+Alt+F`)

!!! tip
    Use **Ctrl+Z** / **Cmd+Z** to undo changes within the editor session before applying.
