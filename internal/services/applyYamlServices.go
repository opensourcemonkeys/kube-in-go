package services_k8sclient

import (
	"os/exec"
	"strings"
)

func ApplyYaml(yamlContent string) (string, error) {
	cmd := exec.Command("kubectl", "apply", "-f", "-")
	cmd.Stdin = strings.NewReader(yamlContent)
	out, err := cmd.CombinedOutput()
	return string(out), err
}
