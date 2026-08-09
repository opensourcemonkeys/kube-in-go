package business

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ollama/ollama/api"
	"kube-ins/internal/ai"
	"kube-ins/internal/models"
)

// ListAiModels returns the models available on the given Ollama host.
func ListAiModels(host string) ([]string, error) {
	return ai.ListModels(host)
}

// AiAvailable reports whether an Ollama server is reachable at host.
func AiAvailable(host string) bool {
	return ai.IsAvailable(host)
}

// ListAiModelCatalog returns downloadable + installed models for the model manager.
func ListAiModelCatalog(host string) ([]models.OllamaModelInfo, error) {
	return ai.ModelCatalog(host)
}

// AiModelSupportsTools reports whether the model can do function calling.
func AiModelSupportsTools(host, model string) bool {
	return ai.SupportsTools(host, model)
}

// ListAiModelTags returns the registry tags (size variants) of a base model.
func ListAiModelTags(name string) ([]string, error) {
	return ai.ModelTags(name)
}

// PullAiModel downloads a model, reporting progress via onProgress.
func PullAiModel(ctx context.Context, host, model string, onProgress func(status string, total, completed int64)) error {
	return ai.PullModel(ctx, host, model, onProgress)
}

// chatMsg is the simple role/content shape the frontend sends.
type chatMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

const aiSystemPrompt = `You are the built-in assistant for Kube Inspector, a Kubernetes desktop client.
You help the user inspect and manage their currently selected cluster using the provided tools.
Guidelines:
- Only call a tool when you actually need cluster data or must perform an action.
  For greetings, small talk, or general questions, just reply normally — do NOT call a tool.
- When you do call a tool, use the function-calling mechanism. NEVER write a tool call as
  JSON text in your reply (e.g. do not output {"name": ...}); the user must never see that.
- Only call tools from the provided list; never invent tool names.
- Use the read tools (list_*, get_*) to gather facts before answering.
- Mutating tools (delete_*, apply_yaml, update_*) require user approval; the app will
  prompt the user, so call them when appropriate and explain what you intend to do.
- After tools return, answer the user in plain language. Be concise. Prefer real data
  from tools over guessing. Use the cluster context below.`

// RunAiChat builds the tool registry + system context and runs the agent loop.
func RunAiChat(
	ctx context.Context,
	host, model, clusterName, messagesJSON, contextJSON string,
	emitToken func(string),
	emitTool func(ai.ToolEvent),
	awaitConfirm func(id, name string, args map[string]any) bool,
) error {
	var incoming []chatMsg
	if err := json.Unmarshal([]byte(messagesJSON), &incoming); err != nil {
		return fmt.Errorf("invalid messages: %w", err)
	}

	tools := aiTools()

	// Use native tool calling only when the model advertises the capability;
	// otherwise describe the tools in the prompt and parse JSON replies — this
	// avoids broken/garbled tool templates on non-tool-capable models.
	native := ai.SupportsTools(host, model)

	system := aiSystemPrompt + "\n\nActive cluster: " + clusterName + "\nCurrent UI context (open tabs / active tab):\n" + contextJSON
	if !native {
		system += "\n\n" + ai.ToolSpec(tools)
	}

	msgs := []api.Message{{Role: "system", Content: system}}
	for _, m := range incoming {
		msgs = append(msgs, api.Message{Role: m.Role, Content: m.Content})
	}

	return ai.RunChat(ctx, host, model, clusterName, msgs, tools, native, emitToken, emitTool, awaitConfirm)
}

func argStr(args map[string]any, key string) string {
	if v, ok := args[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func argInt(args map[string]any, key string, def int64) int64 {
	if v, ok := args[key]; ok {
		if f, ok := v.(float64); ok {
			return int64(f)
		}
	}
	return def
}

func asJSON(v any) string {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Sprintf("error encoding result: %v", err)
	}
	return string(b)
}

// aiTools is the registry exposed to the model. Read tools run immediately;
// Mutating tools are gated behind user confirmation by the agent loop.
func aiTools() []ai.Tool {
	return []ai.Tool{
		{
			Name:        "list_pods",
			Description: "List pods in the active cluster, optionally filtered by namespace.",
			Schema:      `{"type":"object","properties":{"namespace":{"type":"string","description":"Filter to this namespace; omit for all namespaces"}}}`,
			Run: func(clusterName string, args map[string]any) (string, error) {
				ns := argStr(args, "namespace")
				pods, err := GetPods(clusterName)
				if err != nil {
					return "", err
				}
				if ns != "" {
					filtered := pods[:0:0]
					for _, p := range pods {
						if p.Namespace == ns {
							filtered = append(filtered, p)
						}
					}
					pods = filtered
				}
				return asJSON(pods), nil
			},
		},
		{
			Name:        "list_deployments",
			Description: "List deployments in the active cluster, optionally filtered by namespace.",
			Schema:      `{"type":"object","properties":{"namespace":{"type":"string"}}}`,
			Run: func(clusterName string, args map[string]any) (string, error) {
				ns := argStr(args, "namespace")
				deps, err := GetDeployments(clusterName)
				if err != nil {
					return "", err
				}
				if ns != "" {
					filtered := deps[:0:0]
					for _, d := range deps {
						if d.Namespace == ns {
							filtered = append(filtered, d)
						}
					}
					deps = filtered
				}
				return asJSON(deps), nil
			},
		},
		{
			Name:        "list_events",
			Description: "List recent Kubernetes events in the active cluster (useful for diagnosing problems).",
			Schema:      `{"type":"object","properties":{"namespace":{"type":"string"}}}`,
			Run: func(clusterName string, args map[string]any) (string, error) {
				ns := argStr(args, "namespace")
				events, err := GetEvents(clusterName)
				if err != nil {
					return "", err
				}
				if ns != "" {
					filtered := events[:0:0]
					for _, e := range events {
						if e.Namespace == ns {
							filtered = append(filtered, e)
						}
					}
					events = filtered
				}
				return asJSON(events), nil
			},
		},
		{
			Name:        "get_pod_yaml",
			Description: "Get the full YAML manifest of a pod.",
			Schema:      `{"type":"object","properties":{"namespace":{"type":"string"},"name":{"type":"string"}},"required":["namespace","name"]}`,
			Run: func(clusterName string, args map[string]any) (string, error) {
				return GetPodYaml(clusterName, argStr(args, "name"), argStr(args, "namespace"))
			},
		},
		{
			Name:        "get_deployment_yaml",
			Description: "Get the full YAML manifest of a deployment.",
			Schema:      `{"type":"object","properties":{"namespace":{"type":"string"},"name":{"type":"string"}},"required":["namespace","name"]}`,
			Run: func(clusterName string, args map[string]any) (string, error) {
				return GetDeploymentYaml(clusterName, argStr(args, "name"), argStr(args, "namespace"))
			},
		},
		{
			Name:        "get_pod_logs",
			Description: "Get the most recent log lines of a pod container.",
			Schema:      `{"type":"object","properties":{"namespace":{"type":"string"},"pod":{"type":"string"},"container":{"type":"string","description":"Container name; omit for the first container"},"tail":{"type":"integer","description":"Number of lines from the end (default 200)"}},"required":["namespace","pod"]}`,
			Run: func(clusterName string, args map[string]any) (string, error) {
				return GetPodLogsTail(clusterName, argStr(args, "namespace"), argStr(args, "pod"), argStr(args, "container"), argInt(args, "tail", 200))
			},
		},
		{
			Name:        "delete_pod",
			Description: "Delete a pod. Mutating: requires user confirmation.",
			Mutating:    true,
			Schema:      `{"type":"object","properties":{"namespace":{"type":"string"},"name":{"type":"string"}},"required":["namespace","name"]}`,
			Run: func(clusterName string, args map[string]any) (string, error) {
				if err := DeletePod(clusterName, argStr(args, "name"), argStr(args, "namespace")); err != nil {
					return "", err
				}
				return fmt.Sprintf("Deleted pod %s/%s", argStr(args, "namespace"), argStr(args, "name")), nil
			},
		},
		{
			Name:        "delete_deployment",
			Description: "Delete a deployment. Mutating: requires user confirmation.",
			Mutating:    true,
			Schema:      `{"type":"object","properties":{"namespace":{"type":"string"},"name":{"type":"string"}},"required":["namespace","name"]}`,
			Run: func(clusterName string, args map[string]any) (string, error) {
				if err := DeleteDeployment(clusterName, argStr(args, "name"), argStr(args, "namespace")); err != nil {
					return "", err
				}
				return fmt.Sprintf("Deleted deployment %s/%s", argStr(args, "namespace"), argStr(args, "name")), nil
			},
		},
		{
			Name:        "apply_yaml",
			Description: "Apply a Kubernetes YAML manifest to the active cluster (create or update). Mutating: requires user confirmation.",
			Mutating:    true,
			Schema:      `{"type":"object","properties":{"yaml":{"type":"string","description":"The full YAML manifest"}},"required":["yaml"]}`,
			Run: func(clusterName string, args map[string]any) (string, error) {
				return ApplyYaml(clusterName, argStr(args, "yaml"))
			},
		},
		{
			Name:        "update_deployment_yaml",
			Description: "Replace a deployment's manifest with new YAML (e.g. to change replicas or image). Mutating: requires user confirmation.",
			Mutating:    true,
			Schema:      `{"type":"object","properties":{"namespace":{"type":"string"},"name":{"type":"string"},"yaml":{"type":"string"}},"required":["namespace","name","yaml"]}`,
			Run: func(clusterName string, args map[string]any) (string, error) {
				if err := UpdateDeploymentYaml(clusterName, argStr(args, "name"), argStr(args, "namespace"), argStr(args, "yaml")); err != nil {
					return "", err
				}
				return fmt.Sprintf("Updated deployment %s/%s", argStr(args, "namespace"), argStr(args, "name")), nil
			},
		},
	}
}
