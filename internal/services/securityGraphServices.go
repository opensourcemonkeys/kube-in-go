package services_k8sclient

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"kube-ins/internal/models"

	rbacv1 "k8s.io/api/rbac/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// maxObjectsPerResource caps how many real objects are attached under a single
// resource node, so a role granting e.g. "secrets" cluster-wide cannot explode
// the graph. Excess is summarised with a "+N more" node.
const maxObjectsPerResource = 50

const rbacGroup = "rbac.authorization.k8s.io"

type objRef struct {
	Namespace string
	Name      string
}

// GetSecurityGraph builds an RBAC relationship graph across all namespaces:
//
//	ServiceAccount --subject--> RoleBinding --roleref--> Role/ClusterRole --grants--> Resource --instance--> Object
//
// Verbs allowed on each (role, resource) pair are collected onto the "grants"
// edge label. Each resource-type node is expanded with the real cluster objects
// of that type the role can reach. Only ClusterRoles referenced by a RoleBinding
// are included, to avoid dumping the dozens of default cluster roles.
func GetSecurityGraph(client *kubernetes.Clientset, config *rest.Config) (*models.SecurityGraph, error) {
	ctx := context.TODO()
	graph := &models.SecurityGraph{Nodes: []models.SecurityNode{}, Edges: []models.SecurityEdge{}}

	nodeSet := make(map[string]bool)
	addNode := func(n models.SecurityNode) {
		if !nodeSet[n.ID] {
			nodeSet[n.ID] = true
			graph.Nodes = append(graph.Nodes, n)
		}
	}

	edgeSet := make(map[string]bool)
	addEdge := func(e models.SecurityEdge) {
		if !edgeSet[e.ID] {
			edgeSet[e.ID] = true
			graph.Edges = append(graph.Edges, e)
		}
	}

	// Best-effort dynamic client + REST mapper for listing the real objects each
	// resource grant exposes. If this can't be built the graph still works, just
	// without the object (instance) layer.
	var dyn dynamic.Interface
	var mapper meta.RESTMapper
	if config != nil {
		if d, m, err := newDynamicAndMapper(config); err == nil {
			dyn, mapper = d, m
		}
	}

	// ── Service Accounts ──────────────────────────────────────────────────────
	sas, err := client.CoreV1().ServiceAccounts("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for _, sa := range sas.Items {
		addNode(models.SecurityNode{
			ID:        saID(sa.Namespace, sa.Name),
			Kind:      "ServiceAccount",
			Name:      sa.Name,
			Namespace: sa.Namespace,
			Resource:  "serviceaccounts",
		})
	}

	// ── Roles (+ rule expansion) ──────────────────────────────────────────────
	roles, err := client.RbacV1().Roles("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	// verbsByEdge accumulates the unique verb set per "grants" edge id so a role
	// with several rules touching the same resource shows a merged verb list.
	verbsByEdge := make(map[string]map[string]bool)
	for _, role := range roles.Items {
		rid := roleID(role.Namespace, role.Name)
		addNode(models.SecurityNode{ID: rid, Kind: "Role", Name: role.Name, Namespace: role.Namespace, Group: rbacGroup, Resource: "roles"})
		expandRules(ctx, rid, role.Namespace, role.Rules, addNode, addEdge, verbsByEdge, dyn, mapper)
	}

	// ── Role Bindings (+ subject/roleref edges) ───────────────────────────────
	rbs, err := client.RbacV1().RoleBindings("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	referencedClusterRoles := make(map[string]bool)
	for _, rb := range rbs.Items {
		rbid := rbID(rb.Namespace, rb.Name)
		addNode(models.SecurityNode{ID: rbid, Kind: "RoleBinding", Name: rb.Name, Namespace: rb.Namespace, Group: rbacGroup, Resource: "rolebindings"})

		// Subjects (only ServiceAccount subjects are mapped).
		for _, s := range rb.Subjects {
			if s.Kind != "ServiceAccount" {
				continue
			}
			ns := s.Namespace
			if ns == "" {
				ns = rb.Namespace
			}
			saNodeID := saID(ns, s.Name)
			// Surface SA subjects that have no ServiceAccount object listed.
			addNode(models.SecurityNode{ID: saNodeID, Kind: "ServiceAccount", Name: s.Name, Namespace: ns, Resource: "serviceaccounts"})
			addEdge(models.SecurityEdge{
				ID:     "subject:" + saNodeID + "->" + rbid,
				Source: saNodeID,
				Target: rbid,
				Kind:   "subject",
			})
		}

		// Role reference (Role in same ns, or a ClusterRole).
		var targetID string
		if rb.RoleRef.Kind == "ClusterRole" {
			targetID = clusterRoleID(rb.RoleRef.Name)
			referencedClusterRoles[rb.RoleRef.Name] = true
			addNode(models.SecurityNode{ID: targetID, Kind: "ClusterRole", Name: rb.RoleRef.Name, Group: rbacGroup, Resource: "clusterroles"})
		} else {
			targetID = roleID(rb.Namespace, rb.RoleRef.Name)
			// Node may already exist from the role listing; add a placeholder if not.
			addNode(models.SecurityNode{ID: targetID, Kind: "Role", Name: rb.RoleRef.Name, Namespace: rb.Namespace, Group: rbacGroup, Resource: "roles"})
		}
		addEdge(models.SecurityEdge{
			ID:     "roleref:" + rbid + "->" + targetID,
			Source: rbid,
			Target: targetID,
			Kind:   "roleref",
		})
	}

	// ── Referenced ClusterRoles (+ rule expansion) ────────────────────────────
	if len(referencedClusterRoles) > 0 {
		clusterRoles, err := client.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
		for _, cr := range clusterRoles.Items {
			if !referencedClusterRoles[cr.Name] {
				continue
			}
			crid := clusterRoleID(cr.Name)
			addNode(models.SecurityNode{ID: crid, Kind: "ClusterRole", Name: cr.Name, Group: rbacGroup, Resource: "clusterroles"})
			// ClusterRoles are cluster-scoped: pass "" so namespaced objects are
			// listed across all namespaces.
			expandRules(ctx, crid, "", cr.Rules, addNode, addEdge, verbsByEdge, dyn, mapper)
		}
	}

	// ── Emit "grants" edges (unlabelled) and put the verbs on the Resource ────
	// node instead, so the permission set shows inside the box rather than on
	// the arrow.
	verbsByResNode := make(map[string]string)
	for edgeID, verbSet := range verbsByEdge {
		src, tgt := splitGrantEdgeID(edgeID)
		addEdge(models.SecurityEdge{
			ID:     edgeID,
			Source: src,
			Target: tgt,
			Kind:   "grants",
		})
		verbsByResNode[tgt] = joinSortedVerbs(verbSet)
	}
	for i := range graph.Nodes {
		if v, ok := verbsByResNode[graph.Nodes[i].ID]; ok {
			graph.Nodes[i].Verbs = v
		}
	}

	return graph, nil
}

// expandRules turns a role's PolicyRules into Resource nodes, accumulates the
// verbs for each (role, resource) pair into verbsByEdge, and attaches the real
// cluster objects each resource grant exposes (Resource --instance--> Object).
func expandRules(
	ctx context.Context,
	roleNodeID, roleNamespace string,
	rules []rbacv1.PolicyRule,
	addNode func(models.SecurityNode),
	addEdge func(models.SecurityEdge),
	verbsByEdge map[string]map[string]bool,
	dyn dynamic.Interface,
	mapper meta.RESTMapper,
) {
	for _, rule := range rules {
		groups := rule.APIGroups
		if len(groups) == 0 {
			groups = []string{""}
		}
		for _, resource := range rule.Resources {
			for _, group := range groups {
				// Resource nodes are scoped to the owning role so each grant
				// arrow has its own target — shared resource nodes would make
				// many arrows converge on (and overlap at) a single node.
				resNodeID := secResourceID(roleNodeID, group, resource)
				addNode(models.SecurityNode{
					ID:        resNodeID,
					Kind:      "Resource",
					Name:      resourceDisplayName(resource),
					Namespace: resourceGroupLabel(group),
				})
				edgeID := grantEdgeID(roleNodeID, resNodeID)
				if verbsByEdge[edgeID] == nil {
					verbsByEdge[edgeID] = make(map[string]bool)
				}
				for _, v := range rule.Verbs {
					verbsByEdge[edgeID][v] = true
				}

				// Attach the real objects of this resource type the role reaches.
				// Wildcards and subresources cannot be listed as objects.
				if dyn != nil && mapper != nil && resource != "*" && !strings.Contains(resource, "/") {
					refs, more := listResourceObjects(ctx, dyn, mapper, group, resource, roleNamespace, rule.ResourceNames)
					for _, r := range refs {
						objID := "obj/" + resNodeID + "/" + r.Namespace + "/" + r.Name
						addNode(models.SecurityNode{ID: objID, Kind: "Object", Name: r.Name, Namespace: r.Namespace, Group: group, Resource: resource})
						addEdge(models.SecurityEdge{ID: "instance:" + resNodeID + "->" + objID, Source: resNodeID, Target: objID, Kind: "instance"})
					}
					if more > 0 {
						moreID := "objmore/" + resNodeID
						addNode(models.SecurityNode{ID: moreID, Kind: "Object", Name: fmt.Sprintf("+%d more", more)})
						addEdge(models.SecurityEdge{ID: "instance:" + resNodeID + "->" + moreID, Source: resNodeID, Target: moreID, Kind: "instance"})
					}
				}
			}
		}
	}
}

// listResourceObjects lists the real objects of a (group, resource) type, scoped
// to namespace (empty namespace lists across all namespaces for namespaced
// resources). When resourceNames is non-empty the result is filtered to those
// names. Returns up to maxObjectsPerResource refs plus the count truncated.
func listResourceObjects(ctx context.Context, dyn dynamic.Interface, mapper meta.RESTMapper, group, resource, namespace string, resourceNames []string) ([]objRef, int) {
	partial := schema.GroupVersionResource{Group: group, Resource: resource}
	gvr, err := mapper.ResourceFor(partial)
	if err != nil {
		return nil, 0
	}

	namespaced := true
	if gvk, e := mapper.KindFor(partial); e == nil {
		if m, e2 := mapper.RESTMapping(gvk.GroupKind(), gvk.Version); e2 == nil {
			namespaced = m.Scope.Name() == meta.RESTScopeNameNamespace
		}
	}

	var ri dynamic.ResourceInterface
	if namespaced {
		ri = dyn.Resource(gvr).Namespace(namespace) // namespace "" => all namespaces
	} else {
		ri = dyn.Resource(gvr)
	}

	list, err := ri.List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, 0
	}

	nameFilter := make(map[string]bool, len(resourceNames))
	for _, n := range resourceNames {
		nameFilter[n] = true
	}

	refs := make([]objRef, 0, len(list.Items))
	for _, item := range list.Items {
		if len(nameFilter) > 0 && !nameFilter[item.GetName()] {
			continue
		}
		refs = append(refs, objRef{Namespace: item.GetNamespace(), Name: item.GetName()})
	}

	truncated := 0
	if len(refs) > maxObjectsPerResource {
		truncated = len(refs) - maxObjectsPerResource
		refs = refs[:maxObjectsPerResource]
	}
	return refs, truncated
}

// ── ID helpers ───────────────────────────────────────────────────────────────

func saID(ns, name string) string      { return "sa/" + ns + "/" + name }
func roleID(ns, name string) string    { return "role/" + ns + "/" + name }
func rbID(ns, name string) string      { return "rb/" + ns + "/" + name }
func clusterRoleID(name string) string { return "clusterrole/" + name }

// secResourceID is scoped to the owning role so each (role, resource) pair gets
// a distinct node — avoids arrows from many roles converging on one node.
func secResourceID(roleNodeID, group, res string) string {
	return "res/" + roleNodeID + "/" + resourceGroupLabel(group) + "/" + res
}

// resourceGroupLabel maps the API group to a short display label.
func resourceGroupLabel(group string) string {
	if group == "" {
		return "core"
	}
	return group
}

// grantEdgeID encodes both endpoints so they can be recovered when emitting edges.
func grantEdgeID(src, tgt string) string { return "grants:" + src + "##" + tgt }

func splitGrantEdgeID(id string) (src, tgt string) {
	body := strings.TrimPrefix(id, "grants:")
	parts := strings.SplitN(body, "##", 2)
	if len(parts) != 2 {
		return body, ""
	}
	return parts[0], parts[1]
}

func resourceDisplayName(res string) string {
	if res == "*" {
		return "* (all)"
	}
	return res
}

func joinSortedVerbs(set map[string]bool) string {
	verbs := make([]string, 0, len(set))
	for v := range set {
		verbs = append(verbs, v)
	}
	sort.Strings(verbs)
	return strings.Join(verbs, ", ")
}
