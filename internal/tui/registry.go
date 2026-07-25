package tui

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"kube-ins/internal/business"
)

// rowData is one table row: name/namespace identify the object for actions,
// cells are the display columns (aligned with resourceDef.headers). ref carries
// the source model for views whose rows drill down into a child list (CRDs).
type rowData struct {
	name      string
	namespace string
	cells     []string
	ref       any
}

// rowAction is an extra per-row verb beyond the standard yaml/edit/delete set
// (e.g. cordon/drain on nodes). Bound to a single key on the list screen.
type rowAction struct {
	key     rune
	label   string
	confirm bool
	run     func(cluster, name, namespace string) error
}

// resourceDef binds a menu view to the business functions that back it. The
// list screen is generic over this — adding a resource is just a new entry.
type resourceDef struct {
	view       string
	title      string
	namespaced bool
	isPods     bool
	headers    []string
	list       func(cluster string) ([]rowData, error)
	getYAML    func(cluster, name, namespace string) (string, error)
	updateYAML func(cluster, name, namespace, yaml string) error
	del        func(cluster, name, namespace string) error
	actions    []rowAction
	// drill, when set, makes Enter open a child list built from the row instead
	// of the describe pane (used by CRDs to open a kind's instances). The child
	// def is constructed on the fly and never registered.
	drill func(cluster string, row rowData) *resourceDef
	// parent names the registry view Esc/q returns to on a drilled-into child
	// list; empty on top-level views (where back just refocuses the menu).
	parent string
}

type menuItem struct {
	label string
	view  string
}

type menuGroup struct {
	label string
	items []menuItem
}

func i32(v int32) string { return strconv.FormatInt(int64(v), 10) }
func iN(v int) string    { return strconv.Itoa(v) }

func boolStr(b bool) string {
	if b {
		return "Yes"
	}
	return "No"
}

func join(ss []string) string {
	if len(ss) == 0 {
		return "-"
	}
	return strings.Join(ss, ",")
}

func dash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "-"
	}
	return s
}

// humanSince renders a compact age string (e.g. "5d", "3h", "12m") from an
// RFC3339 timestamp, matching internal/services/crdServices.go::humanAge so
// GUI and TUI agree. Empty or unparsable input yields "-".
func humanSince(iso string) string {
	if strings.TrimSpace(iso) == "" {
		return "-"
	}
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		return "-"
	}
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return fmt.Sprintf("%ds", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("%dm", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd", int(d.Hours()/24))
	}
}

// buildRegistry returns the menu groups (mirroring the GUI NAV_GROUPS) and a
// lookup of view -> resourceDef. "monitoring" and "applyyaml" are menu-only
// views dispatched to bespoke panes by loadResource (no registry entry); the
// security graph and trivy views are intentionally omitted for now.
func buildRegistry() ([]menuGroup, map[string]*resourceDef) {
	defs := []*resourceDef{
		{
			view: "pods", title: "Pods", namespaced: true, isPods: true,
			headers: []string{"NAMESPACE", "NAME", "STATUS", "CONTAINERS", "AGE", "LAST RESTART"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, p := range business.GetPods(c) {
					rows = append(rows, rowData{name: p.Name, namespace: p.Namespace,
						cells: []string{p.Namespace, p.Name, string(p.Status), iN(len(p.Containers)), humanSince(p.CreatedAt), humanSince(p.LastRestartAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetPodYaml,
			del:     business.DeletePod,
		},
		{
			view: "deployments", title: "Deployments", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "READY", "UPDATED", "AVAILABLE", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, d := range business.GetDeployments(c) {
					rows = append(rows, rowData{name: d.Name, namespace: d.Namespace,
						cells: []string{d.Namespace, d.Name, fmt.Sprintf("%d/%d", d.ReadyReplicas, d.Replicas), i32(d.UpdatedReplicas), i32(d.AvailableReplicas), dash(d.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetDeploymentYaml, updateYAML: business.UpdateDeploymentYaml, del: business.DeleteDeployment,
		},
		{
			view: "statefulsets", title: "StatefulSets", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "READY", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, s := range business.GetStatefulSets(c) {
					rows = append(rows, rowData{name: s.Name, namespace: s.Namespace,
						cells: []string{s.Namespace, s.Name, fmt.Sprintf("%d/%d", s.ReadyReplicas, s.Replicas), dash(s.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetStatefulSetYaml, updateYAML: business.UpdateStatefulSetYaml, del: business.DeleteStatefulSet,
		},
		{
			view: "replicasets", title: "ReplicaSets", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "READY", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, r := range business.GetReplicaSets(c) {
					rows = append(rows, rowData{name: r.Name, namespace: r.Namespace,
						cells: []string{r.Namespace, r.Name, fmt.Sprintf("%d/%d", r.ReadyReplicas, r.Replicas), dash(r.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetReplicaSetYaml, updateYAML: business.UpdateReplicaSetYaml, del: business.DeleteReplicaSet,
		},
		{
			view: "daemonsets", title: "DaemonSets", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "DESIRED", "READY", "AVAILABLE", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, d := range business.GetDaemonSets(c) {
					rows = append(rows, rowData{name: d.Name, namespace: d.Namespace,
						cells: []string{d.Namespace, d.Name, i32(d.DesiredNumberScheduled), i32(d.NumberReady), i32(d.NumberAvailable), dash(d.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetDaemonSetYaml, updateYAML: business.UpdateDaemonSetYaml, del: business.DeleteDaemonSet,
		},
		{
			view: "jobs", title: "Jobs", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "COMPLETIONS", "STATUS", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, j := range business.GetJobs(c) {
					rows = append(rows, rowData{name: j.Name, namespace: j.Namespace,
						cells: []string{j.Namespace, j.Name, fmt.Sprintf("%d/%d", j.Succeeded, j.Completions), dash(j.Status), dash(j.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetJobYaml, del: business.DeleteJob,
		},
		{
			view: "cronjobs", title: "CronJobs", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "SCHEDULE", "SUSPEND", "ACTIVE", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, cj := range business.GetCronJobs(c) {
					rows = append(rows, rowData{name: cj.Name, namespace: cj.Namespace,
						cells: []string{cj.Namespace, cj.Name, dash(cj.Schedule), boolStr(cj.Suspend), iN(cj.ActiveCount), dash(cj.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetCronJobYaml, updateYAML: business.UpdateCronJobYaml, del: business.DeleteCronJob,
		},
		{
			view: "services", title: "Services", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "TYPE", "CLUSTER-IP", "PORTS", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, s := range business.GetServices(c) {
					var ports []string
					for _, p := range s.Ports {
						ports = append(ports, fmt.Sprintf("%d/%s", p.Port, p.Protocol))
					}
					rows = append(rows, rowData{name: s.Name, namespace: s.Namespace,
						cells: []string{s.Namespace, s.Name, dash(s.Type), dash(s.ClusterIP), join(ports), dash(s.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetServiceYaml, updateYAML: business.UpdateServiceYaml, del: business.DeleteService,
		},
		{
			view: "ingresses", title: "Ingresses", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "CLASS", "HOSTS", "ADDRESS", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, ig := range business.GetIngresses(c) {
					var hosts []string
					for _, r := range ig.Rules {
						hosts = append(hosts, r.Host)
					}
					rows = append(rows, rowData{name: ig.Name, namespace: ig.Namespace,
						cells: []string{ig.Namespace, ig.Name, dash(ig.ClassName), join(hosts), dash(ig.Address), dash(ig.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetIngressYaml, updateYAML: business.UpdateIngressYaml, del: business.DeleteIngress,
		},
		{
			view: "ingressclasses", title: "Ingress Classes", namespaced: false,
			headers: []string{"NAME", "CONTROLLER", "DEFAULT", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, ic := range business.GetIngressClasses(c) {
					rows = append(rows, rowData{name: ic.Name, namespace: "",
						cells: []string{ic.Name, dash(ic.Controller), boolStr(ic.IsDefault), dash(ic.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: clusterScopedYAML(business.GetIngressClassYaml),
		},
		{
			view: "endpoints", title: "Endpoints", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "READY", "NOT-READY", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, e := range business.GetEndpoints(c) {
					rows = append(rows, rowData{name: e.Name, namespace: e.Namespace,
						cells: []string{e.Namespace, e.Name, iN(e.Ready), iN(e.NotReady), dash(e.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetEndpointYaml,
		},
		{
			view: "networkpolicies", title: "Network Policies", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "POD-SELECTOR", "TYPES", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, n := range business.GetNetworkPolicies(c) {
					rows = append(rows, rowData{name: n.Name, namespace: n.Namespace,
						cells: []string{n.Namespace, n.Name, dash(n.PodSelector), join(n.PolicyTypes), dash(n.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetNetworkPolicyYaml, updateYAML: business.UpdateNetworkPolicyYaml, del: business.DeleteNetworkPolicy,
		},
		{
			view: "configmaps", title: "ConfigMaps", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "DATA", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, cm := range business.GetConfigMaps(c) {
					rows = append(rows, rowData{name: cm.Name, namespace: cm.Namespace,
						cells: []string{cm.Namespace, cm.Name, iN(cm.DataCount), dash(cm.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetConfigMapYaml, updateYAML: business.UpdateConfigMapYaml, del: business.DeleteConfigMap,
		},
		{
			view: "secrets", title: "Secrets", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "TYPE", "DATA", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, s := range business.GetSecrets(c) {
					rows = append(rows, rowData{name: s.Name, namespace: s.Namespace,
						cells: []string{s.Namespace, s.Name, dash(s.Type), iN(s.DataCount), dash(s.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetSecretYaml, updateYAML: business.UpdateSecretYaml, del: business.DeleteSecret,
		},
		{
			view: "serviceaccounts", title: "Service Accounts", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "SECRETS", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, sa := range business.GetServiceAccounts(c) {
					rows = append(rows, rowData{name: sa.Name, namespace: sa.Namespace,
						cells: []string{sa.Namespace, sa.Name, iN(sa.Secrets), dash(sa.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetServiceAccountYaml, updateYAML: business.UpdateServiceAccountYaml,
		},
		{
			view: "roles", title: "Roles", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "RULES", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, r := range business.GetRoles(c) {
					rows = append(rows, rowData{name: r.Name, namespace: r.Namespace,
						cells: []string{r.Namespace, r.Name, iN(len(r.Rules)), dash(r.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetRoleYaml, updateYAML: business.UpdateRoleYaml,
		},
		{
			view: "rolebindings", title: "Role Bindings", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "ROLE", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, rb := range business.GetRoleBindings(c) {
					rows = append(rows, rowData{name: rb.Name, namespace: rb.Namespace,
						cells: []string{rb.Namespace, rb.Name, dash(rb.RoleRefName), dash(rb.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetRoleBindingYaml, updateYAML: business.UpdateRoleBindingYaml,
		},
		{
			view: "persistentvolumes", title: "Persistent Volumes", namespaced: false,
			headers: []string{"NAME", "STATUS", "CAPACITY", "RECLAIM", "STORAGECLASS", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, pv := range business.GetPersistentVolumes(c) {
					rows = append(rows, rowData{name: pv.Name, namespace: "",
						cells: []string{pv.Name, dash(pv.Status), dash(pv.Capacity), dash(pv.ReclaimPolicy), dash(pv.StorageClassName), dash(pv.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: clusterScopedYAML(business.GetPersistentVolumeYaml),
		},
		{
			view: "persistentvolumeclaims", title: "Volume Claims", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "STATUS", "VOLUME", "CAPACITY", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, pvc := range business.GetPersistentVolumeClaims(c) {
					rows = append(rows, rowData{name: pvc.Name, namespace: pvc.Namespace,
						cells: []string{pvc.Namespace, pvc.Name, dash(pvc.Status), dash(pvc.VolumeName), dash(pvc.Request), dash(pvc.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetPersistentVolumeClaimYaml, del: business.DeletePersistentVolumeClaim,
		},
		{
			view: "storageclasses", title: "Storage Classes", namespaced: false,
			headers: []string{"NAME", "PROVISIONER", "RECLAIM", "BINDING", "DEFAULT"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, sc := range business.GetStorageClasses(c) {
					rows = append(rows, rowData{name: sc.Name, namespace: "",
						cells: []string{sc.Name, dash(sc.Provisioner), dash(sc.ReclaimPolicy), dash(sc.VolumeBindingMode), boolStr(sc.IsDefault)}})
				}
				return rows, nil
			},
			getYAML: clusterScopedYAML(business.GetStorageClassYaml),
		},
		{
			view: "nodes", title: "Nodes", namespaced: false,
			headers: []string{"NAME", "STATUS", "INTERNAL-IP", "VERSION", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, n := range business.GetNodes(c) {
					status := n.Status
					if n.Unschedulable {
						status += ",SchedDisabled"
					}
					rows = append(rows, rowData{name: n.Name, namespace: "",
						cells: []string{n.Name, dash(status), dash(n.InternalIP), dash(n.KubeletVersion), dash(n.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML:    clusterScopedYAML(business.GetNodeYaml),
			updateYAML: func(c, name, _, yaml string) error { return business.UpdateNodeYaml(c, name, yaml) },
			actions: []rowAction{
				{key: 'C', label: "cordon", run: func(c, name, _ string) error { return business.CordonNode(c, name) }},
				{key: 'U', label: "uncordon", run: func(c, name, _ string) error { return business.UncordonNode(c, name) }},
				{key: 'D', label: "drain", confirm: true, run: func(c, name, _ string) error { return business.DrainNode(c, name) }},
			},
		},
		{
			view: "namespaces", title: "Namespaces", namespaced: false,
			headers: []string{"NAME", "STATUS"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, ns := range business.GetNamespaces(c) {
					rows = append(rows, rowData{name: ns.Name, namespace: "", cells: []string{ns.Name, dash(ns.Status)}})
				}
				return rows, nil
			},
			getYAML: clusterScopedYAML(business.GetNamespaceYaml),
			del:     func(c, name, _ string) error { return business.DeleteNamespace(c, name) },
		},
		{
			view: "events", title: "Events", namespaced: true,
			headers: []string{"NAMESPACE", "TYPE", "REASON", "OBJECT", "MESSAGE", "COUNT"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, e := range business.GetEvents(c) {
					rows = append(rows, rowData{name: e.Name, namespace: e.Namespace,
						cells: []string{e.Namespace, dash(e.Type), dash(e.Reason), dash(e.Object), dash(e.Message), i32(e.Count)}})
				}
				return rows, nil
			},
		},
		{
			view: "resourcequotas", title: "Resource Quotas", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "RESOURCE", "USED", "HARD", "USE%"},
			// One row per tracked resource entry: rows of a multi-entry quota share
			// name/namespace, so y/e/d on any of them targets the same quota object.
			list: func(c string) ([]rowData, error) {
				quotas, err := business.GetResourceQuotas(c)
				if err != nil {
					return nil, err
				}
				var rows []rowData
				for _, q := range quotas {
					if len(q.Entries) == 0 {
						rows = append(rows, rowData{name: q.Name, namespace: q.Namespace,
							cells: []string{q.Namespace, q.Name, "-", "-", "-", "-"}})
						continue
					}
					for _, e := range q.Entries {
						rows = append(rows, rowData{name: q.Name, namespace: q.Namespace,
							cells: []string{q.Namespace, q.Name, e.Resource, e.Used, e.Hard, textBar(e.UsedNum, e.HardNum, 10)}})
					}
				}
				return rows, nil
			},
			getYAML:    business.GetResourceQuotaYaml,
			updateYAML: business.UpdateResourceQuotaYaml,
			del: func(c, name, ns string) error {
				return business.DeleteObject(c, "", "resourcequotas", ns, name)
			},
		},
		{
			view: "limitranges", title: "Limit Ranges", namespaced: true,
			headers: []string{"NAMESPACE", "NAME", "ITEMS", "AGE"},
			list: func(c string) ([]rowData, error) {
				var rows []rowData
				for _, lr := range business.GetLimitRanges(c) {
					rows = append(rows, rowData{name: lr.Name, namespace: lr.Namespace,
						cells: []string{lr.Namespace, lr.Name, iN(len(lr.Limits)), dash(lr.CreatedAt)}})
				}
				return rows, nil
			},
			getYAML: business.GetLimitRangeYaml, updateYAML: business.UpdateLimitRangeYaml,
		},
		{
			view: "crds", title: "CRDs", namespaced: false,
			headers: []string{"NAME", "GROUP", "KIND", "SCOPE", "VERSION", "AGE"},
			list: func(c string) ([]rowData, error) {
				crds, err := business.GetCRDs(c)
				if err != nil {
					return nil, err
				}
				var rows []rowData
				for _, crd := range crds {
					rows = append(rows, rowData{name: crd.Name, ref: crd,
						cells: []string{crd.Name, dash(crd.Group), dash(crd.Kind), dash(crd.Scope), dash(crd.Version), dash(crd.Age)}})
				}
				return rows, nil
			},
			getYAML: func(c, name, _ string) (string, error) {
				return business.GetObjectYaml(c, "apiextensions.k8s.io", "customresourcedefinitions", "", name)
			},
			updateYAML: func(c, name, _, yaml string) error {
				return business.UpdateObjectYaml(c, "apiextensions.k8s.io", "customresourcedefinitions", "", name, yaml)
			},
			del: func(c, name, _ string) error {
				return business.DeleteObject(c, "apiextensions.k8s.io", "customresourcedefinitions", "", name)
			},
			drill: crdChildDef,
		},
	}

	reg := make(map[string]*resourceDef, len(defs))
	for _, d := range defs {
		reg[d.view] = d
	}

	groups := []menuGroup{
		{"WORKLOADS", []menuItem{{"Pods", "pods"}, {"Deployments", "deployments"}, {"StatefulSets", "statefulsets"}, {"ReplicaSets", "replicasets"}, {"DaemonSets", "daemonsets"}, {"Jobs", "jobs"}, {"CronJobs", "cronjobs"}}},
		{"NETWORKING", []menuItem{{"Services", "services"}, {"Ingresses", "ingresses"}, {"Ingress Classes", "ingressclasses"}, {"Endpoints", "endpoints"}, {"Network Policies", "networkpolicies"}}},
		{"CONFIG & SECRETS", []menuItem{{"ConfigMaps", "configmaps"}, {"Secrets", "secrets"}}},
		{"SECURITY", []menuItem{{"Service Accounts", "serviceaccounts"}, {"Roles", "roles"}, {"Role Bindings", "rolebindings"}}},
		{"STORAGE", []menuItem{{"Persistent Volumes", "persistentvolumes"}, {"Volume Claims", "persistentvolumeclaims"}, {"Storage Classes", "storageclasses"}}},
		{"CLUSTER", []menuItem{{"Monitoring", "monitoring"}, {"Nodes", "nodes"}, {"Namespaces", "namespaces"}, {"Events", "events"}, {"Resource Quotas", "resourcequotas"}, {"Limit Ranges", "limitranges"}, {"CRDs", "crds"}, {"Apply YAML", "applyyaml"}}},
	}

	return groups, reg
}

// clusterScopedYAML adapts a (cluster, name) YAML getter to the namespaced
// (cluster, name, namespace) signature the generic list screen expects.
func clusterScopedYAML(fn func(cluster, name string) (string, error)) func(cluster, name, namespace string) (string, error) {
	return func(cluster, name, _ string) (string, error) { return fn(cluster, name) }
}
