package services_k8sclient

import (
	"context"
	"errors"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// countAll is the only part of the counts path with a decision in it, and
// getting it wrong under-reports a production cluster silently. A fake
// `listPage` covers the three branches without a cluster.

func TestCountAllUnpaginatedResponseIsTheWholeCollection(t *testing.T) {
	page := func(_ context.Context, _ metav1.ListOptions) (metav1.ListMeta, int, error) {
		return metav1.ListMeta{}, 3, nil
	}
	got, err := countAll(context.Background(), page)
	if err != nil {
		t.Fatalf("countAll: %v", err)
	}
	if got != 3 {
		t.Fatalf("count = %d, want 3", got)
	}
}

func TestCountAllUsesRemainingItemCount(t *testing.T) {
	remaining := int64(41)
	calls := 0
	page := func(_ context.Context, opts metav1.ListOptions) (metav1.ListMeta, int, error) {
		calls++
		if opts.Limit != countProbeLimit {
			t.Fatalf("probe limit = %d, want %d", opts.Limit, countProbeLimit)
		}
		return metav1.ListMeta{Continue: "next", RemainingItemCount: &remaining}, 1, nil
	}
	got, err := countAll(context.Background(), page)
	if err != nil {
		t.Fatalf("countAll: %v", err)
	}
	if got != 42 {
		t.Fatalf("count = %d, want 42", got)
	}
	if calls != 1 {
		t.Fatalf("calls = %d, want 1 — the remaining count makes a second list pointless", calls)
	}
}

func TestCountAllFallsBackToFullListWhenRemainingIsAbsent(t *testing.T) {
	calls := 0
	page := func(_ context.Context, opts metav1.ListOptions) (metav1.ListMeta, int, error) {
		calls++
		if opts.Limit == 0 {
			return metav1.ListMeta{}, 7, nil
		}
		// Paginated, but the server declined to say how much is left.
		return metav1.ListMeta{Continue: "next"}, 1, nil
	}
	got, err := countAll(context.Background(), page)
	if err != nil {
		t.Fatalf("countAll: %v", err)
	}
	if got != 7 {
		t.Fatalf("count = %d, want 7", got)
	}
	if calls != 2 {
		t.Fatalf("calls = %d, want 2 (probe + full list)", calls)
	}
}

func TestCountAllPropagatesListError(t *testing.T) {
	want := errors.New("forbidden")
	page := func(_ context.Context, _ metav1.ListOptions) (metav1.ListMeta, int, error) {
		return metav1.ListMeta{}, 0, want
	}
	if _, err := countAll(context.Background(), page); !errors.Is(err, want) {
		t.Fatalf("err = %v, want %v", err, want)
	}
}
