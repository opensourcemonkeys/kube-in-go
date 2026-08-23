package services_k8sclient

import (
	"context"
	"fmt"
	"kube-ins/internal/models"
	"kube-ins/internal/safego"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// countsTimeout bounds the whole tile row: five parallel probes, and a
// dashboard that takes longer than this to answer is a dashboard nobody is
// waiting for any more.
const countsTimeout = 20 * time.Second

// countProbeLimit is deliberately 1. A `Limit`ed list is served from etcd
// rather than the watch cache, so the API server fills in
// `ListMeta.RemainingItemCount` — which turns "how many pods are there" into
// one round trip that transfers a single object instead of all of them.
const countProbeLimit = 1

// listPage is one page of a typed List call, reduced to the two things a
// counter needs: the number of items in this page and the list metadata.
type listPage func(ctx context.Context, opts metav1.ListOptions) (metav1.ListMeta, int, error)

// countAll returns the exact number of items a collection holds.
//
// Three cases, in order of how good the API server is being:
//   - no continue token → the "page" was the whole collection; the page size is
//     the answer.
//   - a continue token and a RemainingItemCount → exact, for one object of
//     traffic. This is the normal path.
//   - a continue token and no RemainingItemCount (the field is documented as
//     optional, and an API server may omit it) → fall back to an unlimited list
//     and count what comes back. Slower, but never wrong, which matters more:
//     an under-count here would silently under-report a production cluster.
func countAll(ctx context.Context, page listPage) (int, error) {
	meta, n, err := page(ctx, metav1.ListOptions{Limit: countProbeLimit})
	if err != nil {
		return 0, err
	}
	if meta.Continue == "" {
		return n, nil
	}
	if meta.RemainingItemCount != nil {
		return n + int(*meta.RemainingItemCount), nil
	}
	_, total, err := page(ctx, metav1.ListOptions{})
	if err != nil {
		return 0, err
	}
	return total, nil
}

// GetClusterCounts returns one integer per Overview tile.
//
// The five probes run concurrently and each writes its own slot, so the result
// does not depend on completion order. A single failure fails the whole call:
// a tile row where one number is fresh and another is silently zero is worse
// than an honest error banner.
func GetClusterCounts(client *kubernetes.Clientset) (models.ClusterCounts, error) {
	ctx, cancel := context.WithTimeout(context.Background(), countsTimeout)
	defer cancel()

	probes := []struct {
		name string
		page listPage
	}{
		{"pods", func(ctx context.Context, o metav1.ListOptions) (metav1.ListMeta, int, error) {
			l, err := client.CoreV1().Pods("").List(ctx, o)
			if err != nil {
				return metav1.ListMeta{}, 0, err
			}
			return l.ListMeta, len(l.Items), nil
		}},
		{"deployments", func(ctx context.Context, o metav1.ListOptions) (metav1.ListMeta, int, error) {
			l, err := client.AppsV1().Deployments("").List(ctx, o)
			if err != nil {
				return metav1.ListMeta{}, 0, err
			}
			return l.ListMeta, len(l.Items), nil
		}},
		{"services", func(ctx context.Context, o metav1.ListOptions) (metav1.ListMeta, int, error) {
			l, err := client.CoreV1().Services("").List(ctx, o)
			if err != nil {
				return metav1.ListMeta{}, 0, err
			}
			return l.ListMeta, len(l.Items), nil
		}},
		{"nodes", func(ctx context.Context, o metav1.ListOptions) (metav1.ListMeta, int, error) {
			l, err := client.CoreV1().Nodes().List(ctx, o)
			if err != nil {
				return metav1.ListMeta{}, 0, err
			}
			return l.ListMeta, len(l.Items), nil
		}},
		{"namespaces", func(ctx context.Context, o metav1.ListOptions) (metav1.ListMeta, int, error) {
			l, err := client.CoreV1().Namespaces().List(ctx, o)
			if err != nil {
				return metav1.ListMeta{}, 0, err
			}
			return l.ListMeta, len(l.Items), nil
		}},
	}

	totals := make([]int, len(probes))
	errs := make([]error, len(probes))

	var wg sync.WaitGroup
	for i, p := range probes {
		i, p := i, p
		wg.Add(1)
		// safego per the project rule: a panic in one probe must not take the
		// process down, and its own defer runs before safego's Recover so the
		// WaitGroup is always released.
		safego.Go("services.clustercounts."+p.name, func() {
			defer wg.Done()
			n, err := countAll(ctx, p.page)
			if err != nil {
				errs[i] = fmt.Errorf("count %s: %w", p.name, err)
				return
			}
			totals[i] = n
		})
	}
	wg.Wait()

	for _, err := range errs {
		if err != nil {
			return models.ClusterCounts{}, err
		}
	}

	return models.ClusterCounts{
		Pods:        totals[0],
		Deployments: totals[1],
		Services:    totals[2],
		Nodes:       totals[3],
		Namespaces:  totals[4],
	}, nil
}
