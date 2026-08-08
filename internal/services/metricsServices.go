package services_k8sclient

import (
	"context"
	"time"

	"kube-ins/internal/models"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

const miDivisor = 1024 * 1024

// GetMetricsSnapshot builds a point-in-time view of cluster resource usage from
// metrics-server: node usage+capacity (summed into a cluster total), per-pod
// usage, and per-workload usage aggregated from the pods' top-level owners.
// It degrades gracefully: missing metrics-server yields MetricsAvailable=false
// while still returning node capacities.
func GetMetricsSnapshot(client *kubernetes.Clientset, mc *metricsclient.Clientset) (models.MetricsSnapshot, error) {
	ctx := context.Background()
	snap := models.MetricsSnapshot{
		Timestamp: time.Now().UnixMilli(),
		Cluster:   models.ResourceUsage{Kind: "cluster", Name: "cluster"},
	}

	// ── Nodes (+ capacity, summed into cluster) ──────────────────────
	nodes, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return snap, err
	}

	type usage struct{ cpu, mem int64 }
	nodeUsage := map[string]usage{}
	if mc != nil {
		if nm, e := mc.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{}); e == nil {
			snap.MetricsAvailable = true
			for _, m := range nm.Items {
				nodeUsage[m.Name] = usage{m.Usage.Cpu().MilliValue(), m.Usage.Memory().Value() / miDivisor}
			}
		}
	}

	snap.Nodes = make([]models.ResourceUsage, 0, len(nodes.Items))
	for _, n := range nodes.Items {
		ru := models.ResourceUsage{
			Kind:         "node",
			Name:         n.Name,
			CpuCapMillis: n.Status.Capacity.Cpu().MilliValue(),
			MemCapMi:     n.Status.Capacity.Memory().Value() / miDivisor,
		}
		if u, ok := nodeUsage[n.Name]; ok {
			ru.CpuMillis, ru.MemMi = u.cpu, u.mem
		}
		snap.Cluster.CpuCapMillis += ru.CpuCapMillis
		snap.Cluster.MemCapMi += ru.MemCapMi
		snap.Cluster.CpuMillis += ru.CpuMillis
		snap.Cluster.MemMi += ru.MemMi
		snap.Nodes = append(snap.Nodes, ru)
	}

	if mc == nil {
		return snap, nil
	}

	// ── Pod metrics ──────────────────────────────────────────────────
	pm, err := mc.MetricsV1beta1().PodMetricses("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return snap, nil // node metrics may still be present
	}
	snap.MetricsAvailable = true

	podUsage := make(map[string]usage, len(pm.Items))
	podIndex := make(map[string]int, len(pm.Items))
	snap.Pods = make([]models.ResourceUsage, 0, len(pm.Items))
	for _, p := range pm.Items {
		var u usage
		conts := make([]models.ContainerUsage, 0, len(p.Containers))
		for _, c := range p.Containers {
			cc := c.Usage.Cpu().MilliValue()
			cm := c.Usage.Memory().Value() / miDivisor
			u.cpu += cc
			u.mem += cm
			conts = append(conts, models.ContainerUsage{Name: c.Name, CpuMillis: cc, MemMi: cm})
		}
		key := p.Namespace + "/" + p.Name
		podUsage[key] = u
		podIndex[key] = len(snap.Pods)
		snap.Pods = append(snap.Pods, models.ResourceUsage{
			Kind: "pod", Name: p.Name, Namespace: p.Namespace, CpuMillis: u.cpu, MemMi: u.mem, Containers: conts,
		})
	}

	// ── Pod specs (node + owner) ─────────────────────────────────────
	pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return snap, nil
	}

	// ReplicaSet -> Deployment map, so pods roll up to the Deployment.
	rsToDeploy := map[string]string{}
	if rsl, e := client.AppsV1().ReplicaSets("").List(ctx, metav1.ListOptions{}); e == nil {
		for _, rs := range rsl.Items {
			if owner := controllerRef(rs.OwnerReferences); owner != nil && owner.Kind == "Deployment" {
				rsToDeploy[rs.Namespace+"/"+rs.Name] = owner.Name
			}
		}
	}

	// Patch pod rows with node + resolved owner, and aggregate workloads.
	type wkey struct{ kind, ns, name string }
	wmap := map[wkey]*models.ResourceUsage{}
	for _, p := range pods.Items {
		key := p.Namespace + "/" + p.Name
		ownerKind, ownerName := resolveOwner(p.OwnerReferences, p.Namespace, rsToDeploy)

		// Sum container resource limits for this pod (for usage-vs-limit %).
		var cpuLimit, memLimit int64
		for _, c := range p.Spec.Containers {
			if q := c.Resources.Limits.Cpu(); q != nil {
				cpuLimit += q.MilliValue()
			}
			if q := c.Resources.Limits.Memory(); q != nil {
				memLimit += q.Value() / miDivisor
			}
		}

		if i, ok := podIndex[key]; ok {
			snap.Pods[i].Node = p.Spec.NodeName
			snap.Pods[i].OwnerKind = ownerKind
			snap.Pods[i].OwnerName = ownerName
			snap.Pods[i].CpuLimitMillis = cpuLimit
			snap.Pods[i].MemLimitMi = memLimit
		}
		if u, ok := podUsage[key]; ok && ownerKind != "" {
			k := wkey{ownerKind, p.Namespace, ownerName}
			w := wmap[k]
			if w == nil {
				w = &models.ResourceUsage{Kind: ownerKind, Name: ownerName, Namespace: p.Namespace}
				wmap[k] = w
			}
			w.CpuMillis += u.cpu
			w.MemMi += u.mem
			w.CpuLimitMillis += cpuLimit
			w.MemLimitMi += memLimit
			w.Pods++
		}
	}
	snap.Workloads = make([]models.ResourceUsage, 0, len(wmap))
	for _, w := range wmap {
		snap.Workloads = append(snap.Workloads, *w)
	}

	return snap, nil
}

// resolveOwner returns a pod's top-level controller as (kind, name), rolling
// ReplicaSets up to their Deployment. Empty kind means a bare/unowned pod.
func resolveOwner(refs []metav1.OwnerReference, namespace string, rsToDeploy map[string]string) (string, string) {
	owner := controllerRef(refs)
	if owner == nil {
		return "", ""
	}
	if owner.Kind == "ReplicaSet" {
		if dn, ok := rsToDeploy[namespace+"/"+owner.Name]; ok {
			return "Deployment", dn
		}
	}
	return owner.Kind, owner.Name
}

// controllerRef returns the controlling owner reference (or the first one).
func controllerRef(refs []metav1.OwnerReference) *metav1.OwnerReference {
	for i := range refs {
		if refs[i].Controller != nil && *refs[i].Controller {
			return &refs[i]
		}
	}
	if len(refs) > 0 {
		return &refs[0]
	}
	return nil
}
