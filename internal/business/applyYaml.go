package business

import (
	"context"
	"time"

	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

// applyTimeout bounds a single apply. Server-side apply is one PATCH per
// document, but building the REST mapper first fans out over every API
// group-version, so an unreachable cluster would otherwise hang the panel.
const applyTimeout = 60 * time.Second

// ApplyYaml applies a manifest to the cluster the calling panel is pinned to —
// never to the globally active one.
func ApplyYaml(clusterName string, yamlContent string) (string, error) {
	_, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
	if err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), applyTimeout)
	defer cancel()
	return services.ApplyYaml(ctx, config, yamlContent)
}
