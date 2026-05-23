package services_k8sclient

import (
	"fmt"
	"os/exec"
	"strings"
)

func ApplyYaml(yamlContent string) (string, error) {
	kubectlPath, err := exec.LookPath("kubectl")
	if err != nil {
		return "", fmt.Errorf("kubectl bulunamadı: %w", err)
	}
	cmd := exec.Command(kubectlPath, "apply", "-f", "-")
	cmd.Stdin = strings.NewReader(yamlContent)
	out, err := cmd.CombinedOutput()
	return string(out), err
}
