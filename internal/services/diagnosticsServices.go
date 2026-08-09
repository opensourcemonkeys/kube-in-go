package services_k8sclient

import (
	"context"
	"encoding/json"
	"time"

	authv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

// PingCluster reports the API server's version and the round-trip time.
//
// It goes through the REST client rather than Discovery().ServerVersion(),
// which takes no context and so cannot be bounded by the caller's per-check
// timeout — the whole point of a health check is that it comes back.
func PingCluster(ctx context.Context, client *kubernetes.Clientset) (string, time.Duration, error) {
	start := time.Now()
	raw, err := client.Discovery().RESTClient().Get().AbsPath("/version").DoRaw(ctx)
	elapsed := time.Since(start)
	if err != nil {
		return "", elapsed, err
	}
	var v struct {
		GitVersion string `json:"gitVersion"`
	}
	if err := json.Unmarshal(raw, &v); err != nil || v.GitVersion == "" {
		return "unknown", elapsed, nil
	}
	return v.GitVersion, elapsed, nil
}

// CanListPods asks the API server what this credential is actually allowed to
// do, which is the difference between "the namespace is empty" and "RBAC said
// no" — the single most common confusing state in the app.
func CanListPods(ctx context.Context, client *kubernetes.Clientset) (bool, string, error) {
	review := &authv1.SelfSubjectAccessReview{
		Spec: authv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authv1.ResourceAttributes{
				Verb:     "list",
				Group:    "",
				Resource: "pods",
			},
		},
	}
	res, err := client.AuthorizationV1().SelfSubjectAccessReviews().Create(ctx, review, metav1.CreateOptions{})
	if err != nil {
		return false, "", err
	}
	reason := res.Status.Reason
	if reason == "" && res.Status.EvaluationError != "" {
		reason = res.Status.EvaluationError
	}
	return res.Status.Allowed, reason, nil
}

// HasMetricsServer reports whether the metrics API answers. A single-item list
// keeps it cheap on a large cluster.
func HasMetricsServer(ctx context.Context, mc *metricsclient.Clientset) (int, error) {
	list, err := mc.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		return 0, err
	}
	return len(list.Items), nil
}
