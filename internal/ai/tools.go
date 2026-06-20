package ai

import (
	"encoding/json"
	"fmt"

	"github.com/ollama/ollama/api"
)

// Tool is a callable the model can invoke. Schema is the JSON Schema for the
// tool's parameters (an object schema). Run executes the tool against the active
// cluster. Mutating tools require user confirmation before Run is called.
type Tool struct {
	Name        string
	Description string
	Mutating    bool
	Schema      string
	Run         func(clusterName string, args map[string]any) (string, error)
}

// toAPITool converts a Tool into the ollama api.Tool wire format by marshalling a
// function-tool envelope and unmarshalling it back (so the ordered-map based
// parameter types are populated correctly from the JSON schema).
func toAPITool(t Tool) (api.Tool, error) {
	schema := t.Schema
	if schema == "" {
		schema = `{"type":"object","properties":{}}`
	}
	envelope := fmt.Sprintf(
		`{"type":"function","function":{"name":%q,"description":%q,"parameters":%s}}`,
		t.Name, t.Description, schema,
	)
	var out api.Tool
	if err := json.Unmarshal([]byte(envelope), &out); err != nil {
		return api.Tool{}, fmt.Errorf("tool %s schema invalid: %w", t.Name, err)
	}
	return out, nil
}

// buildAPITools converts the registry into ollama tools and a name lookup map.
func buildAPITools(tools []Tool) (api.Tools, map[string]Tool, error) {
	apiTools := make(api.Tools, 0, len(tools))
	byName := make(map[string]Tool, len(tools))
	for _, t := range tools {
		at, err := toAPITool(t)
		if err != nil {
			return nil, nil, err
		}
		apiTools = append(apiTools, at)
		byName[t.Name] = t
	}
	return apiTools, byName, nil
}
