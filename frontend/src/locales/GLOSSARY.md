# Glossary — terms that stay English in every locale

Kubernetes proper nouns and product names are **not** translated. A user
searching the Kubernetes docs, running `kubectl`, or reading a cluster error
must see the same word in the app as everywhere else.

The fenced block below is **machine-read** by `frontend/scripts/i18n-check.mjs`
(terms are split on runs of two-or-more spaces, so `Kube Inspector` stays one
term). Keep it a plain column layout — reflowing it into prose disables the
checker's untranslated-copy warning.

```
Pod              Deployment        StatefulSet      ReplicaSet
DaemonSet        Job               CronJob          Namespace
ConfigMap        Secret            Ingress          Service
Node             PersistentVolume  StorageClass     ServiceAccount
Role             RoleBinding       CRD              YAML
kubectl          kubeconfig        Kube Inspector   Trivy
Ollama           Wails             Go               React
```

## CamelCase kinds stay; spaced prose does not

The block above is the list of Kubernetes **proper nouns**. A label is only one
of them when it is written the way the API writes it — `NetworkPolicy`,
`ServiceAccount`, `StorageClass` — or is that word's bare plural (`Pods`,
`Endpoints`, `Events`). Those stay English in every locale, because that is the
string the user will type into `kubectl` and search for in the Kubernetes docs.

The sidebar's *spaced* renderings are prose about the kind, not the kind's name,
and they **are** translated: `Network Policies` → `Ağ Politikaları` /
`Netzwerkrichtlinien` / `Сетевые политики`, and likewise `Service Accounts`,
`Role Bindings`, `Persistent Volumes`, `Volume Claims`, `Storage Classes`,
`Ingress Classes`, `Resource Quotas`, `Limit Ranges`. Same rule inside a
sentence: `Pod List` becomes `Pod Listesi` — the noun survives, the English
around it does not.

Without this line the boundary drifts per translator, and the parity checker
cannot see the difference: it only knows whether a value is byte-identical to
English, not whether it should be.

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
