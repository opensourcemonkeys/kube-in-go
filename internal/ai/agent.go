package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/ollama/ollama/api"
)

// maxIterations caps the number of model<->tool round-trips per user message so a
// misbehaving model cannot loop forever.
const maxIterations = 8

// ToolEvent is emitted to the frontend so it can render a tool-activity line.
type ToolEvent struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	Args     map[string]any `json:"args,omitempty"`
	Status   string         `json:"status"` // running | done | declined | error
	Result   string         `json:"result,omitempty"`
	Mutating bool           `json:"mutating"`
}

type normalizedCall struct {
	id   string
	name string
	args map[string]any
}

// RunChat runs the chat + tool loop until the model produces a final answer with
// no further tool calls (or the iteration cap is hit). Read tools run immediately;
// mutating tools are gated through awaitConfirm.
//
// The loop is non-streaming per turn so we can inspect the whole assistant message
// before deciding whether it was a tool call: many local models emit tool calls as
// plain-text JSON ({"name":...,"arguments":...}) instead of the native tool_calls
// field. We detect both forms and never surface a raw tool-call JSON to the user.
// nativeTools selects how tools are offered to the model: when true the ollama
// native tool-calling field is used; when false (model lacks the "tools"
// capability, or its template garbles tools) the tools are described in the
// system prompt instead and replies are parsed as JSON — avoiding broken templates.
func RunChat(
	ctx context.Context,
	host, model, clusterName string,
	msgs []api.Message,
	tools []Tool,
	nativeTools bool,
	emitToken func(string),
	emitTool func(ToolEvent),
	awaitConfirm func(id, name string, args map[string]any) bool,
) error {
	client, err := newClient(host)
	if err != nil {
		return err
	}
	apiTools, byName, err := buildAPITools(tools)
	if err != nil {
		return err
	}

	stream := false

	for iter := 0; iter < maxIterations; iter++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		var assistant api.Message
		assistant.Role = "assistant"

		req := &api.ChatRequest{
			Model:    model,
			Messages: msgs,
			Stream:   &stream,
		}
		if nativeTools {
			req.Tools = apiTools
		}

		if err := client.Chat(ctx, req, func(resp api.ChatResponse) error {
			assistant.Content += resp.Message.Content
			assistant.ToolCalls = append(assistant.ToolCalls, resp.Message.ToolCalls...)
			return nil
		}); err != nil {
			return err
		}

		// Normalize tool calls from the native field, or fall back to parsing
		// tool-call JSON the model wrote into its text content.
		var calls []normalizedCall
		if len(assistant.ToolCalls) > 0 {
			for _, tc := range assistant.ToolCalls {
				argsObj := tc.Function.Arguments
				args := map[string]any{}
				_ = json.Unmarshal([]byte(argsObj.String()), &args)
				id := tc.ID
				if id == "" {
					id = fmt.Sprintf("%s-%d", tc.Function.Name, tc.Function.Index)
				}
				calls = append(calls, normalizedCall{id, tc.Function.Name, args})
			}
		} else if parsed := parseTextToolCalls(assistant.Content); len(parsed) > 0 {
			// Rewrite the assistant turn into proper tool calls and drop the raw
			// JSON content so it never reaches the UI / history as prose.
			assistant.Content = ""
			assistant.ToolCalls = nil
			for i, p := range parsed {
				assistant.ToolCalls = append(assistant.ToolCalls, api.ToolCall{
					Function: api.ToolCallFunction{Name: p.name, Arguments: argsToAPI(p.args)},
				})
				calls = append(calls, normalizedCall{fmt.Sprintf("text-%d-%d", iter, i), p.name, p.args})
			}
		}

		// Emit any genuine prose the model produced alongside its decision.
		if assistant.Content != "" {
			emitToken(assistant.Content)
		}
		msgs = append(msgs, assistant)

		// No tool calls => final answer.
		if len(calls) == 0 {
			return nil
		}

		for _, c := range calls {
			tool, ok := byName[c.name]
			if !ok {
				emitTool(ToolEvent{ID: c.id, Name: c.name, Args: c.args, Status: "error", Result: "unknown tool"})
				msgs = append(msgs, toolResultMsg(nativeTools, c.name, "error: unknown tool '"+c.name+"'. Only call tools from the provided list; otherwise answer the user directly."))
				continue
			}

			if tool.Mutating {
				emitTool(ToolEvent{ID: c.id, Name: c.name, Args: c.args, Status: "running", Mutating: true})
				if !awaitConfirm(c.id, c.name, c.args) {
					emitTool(ToolEvent{ID: c.id, Name: c.name, Args: c.args, Status: "declined", Mutating: true})
					msgs = append(msgs, toolResultMsg(nativeTools, c.name, "The user declined to run this action."))
					continue
				}
			} else {
				emitTool(ToolEvent{ID: c.id, Name: c.name, Args: c.args, Status: "running"})
			}

			result, runErr := tool.Run(clusterName, c.args)
			if runErr != nil {
				emitTool(ToolEvent{ID: c.id, Name: c.name, Args: c.args, Status: "error", Result: runErr.Error(), Mutating: tool.Mutating})
				msgs = append(msgs, toolResultMsg(nativeTools, c.name, "error: "+runErr.Error()))
				continue
			}
			emitTool(ToolEvent{ID: c.id, Name: c.name, Args: c.args, Status: "done", Result: result, Mutating: tool.Mutating})
			msgs = append(msgs, toolResultMsg(nativeTools, c.name, result))
		}
	}

	emitToken("\n\n_(stopped: reached the tool-call limit)_")
	return nil
}

// toolResultMsg formats a tool result as a chat message. Native mode uses the
// "tool" role; prompt mode (no native tools) feeds it back as a user message so
// templates that don't understand the tool role still see it.
func toolResultMsg(native bool, name, content string) api.Message {
	if native {
		return api.Message{Role: "tool", ToolName: name, Content: content}
	}
	return api.Message{Role: "user", Content: "TOOL RESULT (" + name + "):\n" + content + "\n\nUsing this, continue: call another tool the same way, or give your final answer in plain text."}
}

// ToolSpec renders a prompt describing the tools and the JSON call protocol, for
// models that don't support native tool calling.
func ToolSpec(tools []Tool) string {
	var b strings.Builder
	b.WriteString("You can call tools. To call one, reply with ONLY a single JSON object and nothing else (no backticks, no prose):\n")
	b.WriteString(`{"tool": "<tool_name>", "arguments": { ... }}` + "\n")
	b.WriteString("You will then receive a TOOL RESULT message. Call more tools the same way if needed. When done, reply to the user in plain text with NO JSON.\n\n")
	b.WriteString("Available tools:\n")
	for _, t := range tools {
		b.WriteString("- " + t.Name + ": " + t.Description + "\n  parameters: " + t.Schema + "\n")
	}
	return b.String()
}

type textCall struct {
	name string
	args map[string]any
}

// parseTextToolCalls extracts tool calls a model wrote as JSON text instead of
// using native tool calling, e.g. `{"name":"list_pods","arguments":{...}}`. It
// scans for balanced JSON objects carrying a "name" plus "arguments"/"parameters".
func parseTextToolCalls(content string) []textCall {
	var out []textCall
	for _, obj := range jsonObjects(content) {
		var probe struct {
			Name       string          `json:"name"`
			Tool       string          `json:"tool"`
			Arguments  json.RawMessage `json:"arguments"`
			Parameters json.RawMessage `json:"parameters"`
		}
		if json.Unmarshal([]byte(obj), &probe) != nil {
			continue
		}
		if probe.Name == "" {
			probe.Name = probe.Tool
		}
		if probe.Name == "" {
			continue
		}
		raw := probe.Arguments
		if len(raw) == 0 {
			raw = probe.Parameters
		}
		args := map[string]any{}
		if len(raw) > 0 {
			_ = json.Unmarshal(raw, &args)
		}
		out = append(out, textCall{name: probe.Name, args: args})
	}
	return out
}

// jsonObjects returns top-level balanced {...} substrings found in s (string-aware,
// so braces inside quoted strings don't unbalance the scan).
func jsonObjects(s string) []string {
	var out []string
	depth, start := 0, -1
	inStr, esc := false, false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if inStr {
			switch {
			case esc:
				esc = false
			case c == '\\':
				esc = true
			case c == '"':
				inStr = false
			}
			continue
		}
		switch c {
		case '"':
			inStr = true
		case '{':
			if depth == 0 {
				start = i
			}
			depth++
		case '}':
			if depth > 0 {
				depth--
				if depth == 0 && start >= 0 {
					out = append(out, s[start:i+1])
					start = -1
				}
			}
		}
	}
	return out
}

// argsToAPI converts a plain args map into the ollama ordered-map arguments type.
func argsToAPI(args map[string]any) api.ToolCallFunctionArguments {
	var a api.ToolCallFunctionArguments
	b, _ := json.Marshal(args)
	_ = json.Unmarshal(b, &a)
	return a
}
