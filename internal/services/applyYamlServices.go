package services_k8sclient

import (
	"fmt"
	"os/exec"
	"strings"
)

func ApplyYaml(yamlContent string, kubeconfigPath string) (string, error) {
	kubectlPath, err := exec.LookPath("kubectl")
	if err != nil {
		return "", fmt.Errorf("kubectl bulunamadı: %w", err)
	}

	args := []string{"apply", "-f", "-"}
	if kubeconfigPath != "" {
		args = append([]string{"--kubeconfig=" + kubeconfigPath}, args...)
	}

	cmd := exec.Command(kubectlPath, args...)
	cmd.Stdin = strings.NewReader(yamlContent)
	out, err := cmd.CombinedOutput()
	if err != nil {
		// Wails discards the first return value when error is non-nil, so fold
		// kubectl's combined output into the error so the frontend sees it.
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("%s", msg)
	}
	return string(out), nil
}
