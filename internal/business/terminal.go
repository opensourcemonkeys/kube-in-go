package business

import services "kube-ins/internal/services"

// terminalKubeconfig returns the kubeconfig contents a terminal session should
// run with. An empty result is deliberate: the session file is then left empty
// and kubectl falls back to the user's own kubeconfig, which is the second
// entry in the session's KUBECONFIG list.
func terminalKubeconfig(clusterName string) string {
	if clusterName == "" {
		return ""
	}
	content, err := GetClusterContent(clusterName)
	if err != nil {
		return ""
	}
	return content
}

func CreateTerminalSession(id string, clusterName string, onOutput func(string)) error {
	return services.CreateTerminalSession(id, terminalKubeconfig(clusterName), onOutput)
}

// SetTerminalSessionCluster retargets a running terminal without restarting its
// shell — see services.SetTerminalSessionKubeconfig.
func SetTerminalSessionCluster(id string, clusterName string) error {
	return services.SetTerminalSessionKubeconfig(id, terminalKubeconfig(clusterName))
}

func WriteToTerminalSession(id string, data string) error {
	return services.WriteToTerminalSession(id, data)
}

func ResizeTerminalSession(id string, cols int, rows int) error {
	return services.ResizeTerminalSession(id, uint16(cols), uint16(rows))
}

func CloseTerminalSession(id string) error {
	return services.CloseTerminalSession(id)
}
