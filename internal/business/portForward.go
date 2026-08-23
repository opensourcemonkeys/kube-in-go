package business

import (
	"fmt"

	"kube-ins/internal/models"
	repository "kube-ins/internal/repository"
	services "kube-ins/internal/services"
)

// StartPortForward opens a tunnel from 127.0.0.1 to a port on a pod in
// clusterName and registers it process-wide. It returns once the tunnel is
// ready, so info.LocalPort is the port that was actually bound.
//
// The *streaming* client is mandatory here: the ordinary constructors set a 20s
// request timeout, which would tear the tunnel down mid-session.
func StartPortForward(clusterName, kind, name, namespace string, localPort, remotePort int, id string, onEvent func(models.PortForwardInfo)) (models.PortForwardInfo, error) {
	client, config, err := repository.NewK8sClientAndConfigForClusterStreaming(clusterName)
	if err != nil {
		return models.PortForwardInfo{}, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	info, err := services.StartPortForward(id, services.PortForwardRequest{
		ClusterName: clusterName,
		Kind:        kind,
		Name:        name,
		Namespace:   namespace,
		LocalPort:   localPort,
		RemotePort:  remotePort,
	}, client, config, onEvent)
	if err != nil {
		return models.PortForwardInfo{}, fmt.Errorf("port-forward %s/%s in cluster %q: %w", kind, name, clusterName, err)
	}
	return info, nil
}

// GetForwardablePorts lists the ports the port-forward dialog offers for a
// target. Unlike the tunnel itself this is an ordinary request, so it uses the
// ordinary (timeout-bearing) client.
func GetForwardablePorts(clusterName, kind, name, namespace string) ([]models.PortOption, error) {
	client, err := repository.NewK8sClientForCluster(clusterName)
	if err != nil {
		return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
	}
	opts, err := services.ResolveForwardablePorts(kind, namespace, name, client)
	if err != nil {
		return nil, fmt.Errorf("list ports of %s/%s in cluster %q: %w", kind, name, clusterName, err)
	}
	return opts, nil
}

func StopPortForward(id string) error { return services.StopPortForward(id) }

func ListPortForwards() []models.PortForwardInfo { return services.ListPortForwards() }

// StopAllPortForwards is called from the shutdown paths in main.go so the
// process never leaves a listener behind.
func StopAllPortForwards() { services.StopAllPortForwards() }

// SuggestLocalPort picks a free local port, preferring the remote one so the
// resulting address reads the way the user expects.
func SuggestLocalPort(preferred int) int { return services.SuggestLocalPort(preferred) }
