# Glossary — terms that stay English in every locale

Kubernetes proper nouns and product names are **not** translated. A user
searching the Kubernetes docs, running `kubectl`, or reading a cluster error
must see the same word in the app as everywhere else.

```
Pod              Deployment        StatefulSet      ReplicaSet
DaemonSet        Job               CronJob          Namespace
ConfigMap        Secret            Ingress          Service
Node             PersistentVolume  StorageClass     ServiceAccount
Role             RoleBinding       CRD              YAML
kubectl          kubeconfig        Kube Inspector   Trivy
Ollama           Wails             Go               React
```

## Also never translated (not glossary terms — *data*)

- **Values the cluster returned**: phases (`Running`, `Pending`, `Succeeded`),
  kinds, event `reason`s, RBAC verbs, condition types, Trivy severities
  (`CRITICAL`, `HIGH`), Ollama model names.
- **Backend error text.** `ErrorBanner`'s `message` prop is passed through
  verbatim. Since beta-plan S7 the backend produces
  `list pods in cluster "prod": pods is forbidden: …`; translating that would
  break the one thing it is for — being searchable.
- YAML and log output, resource and namespace names.
- `deleteLabel` values on `ResourceListView` (`"pod"`, `"network policy"`, …).
  They are kind nouns, interpolated into `resources:delete.*` as-is.

## Translated

Menu and nav labels, panel titles, column headers, buttons, dialogs, toasts,
empty states, the *frame* of the error banner (Retry / Copy diagnostics /
"showing last known data"), settings, About, and the onboarding tour.
