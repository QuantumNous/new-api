package oairesponses

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	sharedresponses "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/responses"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

const (
	// Responses tool types that wrap a group of function tools. Chat completions
	// has no grouping of its own, so the members are lifted to the top level.
	responsesToolTypeNamespace = "namespace"
	responsesToolTypeMCPServer = "mcp_server"

	// Cap on the dropped tool JSON echoed into the log; tool schemas can be tens
	// of kilobytes and only the head identifies the shape.
	droppedToolLogBytes = 2048
)

// positionedTool pairs a Responses tool with the request path it came from, so
// errors and logs can point at the exact entry the client sent. name is the
// tool's effective chat completions name, which for a namespace member is
// qualified with its namespace.
type positionedTool struct {
	position string
	name     string
	tool     map[string]any
}

// ChatToolsFromResponsesTools converts the Responses tools array into the shape
// chat completions accepts.
//
// Chat completions only understands "function" and OpenAI's "custom" tools, so
// every other Responses tool type has to be resolved here. Forwarding one
// verbatim makes the upstream reject the whole request with an opaque
// deserialization error, which is what this replaces.
func ChatToolsFromResponsesTools(raw json.RawMessage) ([]dto.ToolCallRequest, error) {
	if !rawJSONPresent(raw) {
		return nil, nil
	}

	var tools []map[string]any
	if err := kitutil.Unmarshal(raw, &tools); err != nil {
		return nil, fmt.Errorf("invalid tools: %w", err)
	}

	flattened, err := flattenResponsesToolGroups(tools)
	if err != nil {
		return nil, err
	}

	out := make([]dto.ToolCallRequest, 0, len(flattened))
	declaredAt := make(map[string]string, len(flattened))
	for _, entry := range flattened {
		toolType := strings.TrimSpace(kitutil.Interface2String(entry.tool["type"]))
		switch toolType {
		case "function":
			out = append(out, dto.ToolCallRequest{
				Type: "function",
				Function: dto.FunctionRequest{
					Name:        entry.name,
					Description: kitutil.Interface2String(entry.tool["description"]),
					Parameters:  entry.tool["parameters"],
				},
			})
		case dto.CustomType:
			// Chat completions keeps the discriminator in the outer "type" and
			// nests the rest of the custom tool under "custom".
			payload := make(map[string]any, len(entry.tool))
			for key, value := range entry.tool {
				if key != "type" {
					payload[key] = value
				}
			}
			if entry.name != "" {
				payload["name"] = entry.name
			}
			rawTool, err := kitutil.Marshal(payload)
			if err != nil {
				return nil, err
			}
			out = append(out, dto.ToolCallRequest{
				Type:   dto.CustomType,
				Custom: rawTool,
			})
		default:
			// Hosted Responses tools (web_search, file_search, tool_search,
			// code_interpreter, ...) run on the provider side and have no chat
			// completions representation. Failing here would be worse than
			// dropping them: an agent client attaches web_search to every
			// request, so the channel would never answer at all. Drop the
			// capability, keep the request, and log what was lost.
			logDroppedResponsesTool(toolType, entry)
			continue
		}

		// Namespace qualification keeps members apart, but a top-level tool can
		// still claim the same name, and chat completions has no way to tell
		// them apart.
		if previous, exists := declaredAt[entry.name]; exists {
			return nil, fmt.Errorf("tool name %q at %s duplicates %s; chat completions requires unique tool names", entry.name, entry.position, previous)
		}
		declaredAt[entry.name] = entry.position
	}
	return out, nil
}

// QualifyResponsesFunctionCallName restores the flattened upstream name of a
// replayed function_call. The client sends back the call it received, with the
// namespace split into its own field, while the upstream only knows the
// flattened name it was offered.
func QualifyResponsesFunctionCallName(item map[string]any, name string) string {
	return sharedresponses.JoinNamespacedTool(strings.TrimSpace(kitutil.Interface2String(item["namespace"])), name)
}

// flattenResponsesToolGroups expands namespace and mcp_server groups so every
// returned entry is a single tool.
func flattenResponsesToolGroups(tools []map[string]any) ([]positionedTool, error) {
	flattened := make([]positionedTool, 0, len(tools))
	for i, tool := range tools {
		position := fmt.Sprintf("tools[%d]", i)
		name := strings.TrimSpace(kitutil.Interface2String(tool["name"]))
		toolType := strings.TrimSpace(kitutil.Interface2String(tool["type"]))
		if toolType != responsesToolTypeNamespace && toolType != responsesToolTypeMCPServer {
			flattened = append(flattened, positionedTool{position: position, name: name, tool: tool})
			continue
		}
		members, ok := tool["tools"].([]any)
		if !ok {
			return nil, fmt.Errorf("%s declares tool type %q without a \"tools\" array", position, toolType)
		}
		for j, rawMember := range members {
			member, ok := rawMember.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("%s.tools[%d] is not a tool object", position, j)
			}
			// Member names are unique only inside their namespace — two
			// namespaces in one request can each expose a "js" tool — so the
			// namespace has to survive into the flat name and be split back out
			// when the model calls the tool.
			memberName := strings.TrimSpace(kitutil.Interface2String(member["name"]))
			flattened = append(flattened, positionedTool{
				position: fmt.Sprintf("%s.tools[%d]", position, j),
				name:     sharedresponses.JoinNamespacedTool(name, memberName),
				tool:     member,
			})
		}
	}
	return flattened, nil
}

func logDroppedResponsesTool(toolType string, entry positionedTool) {
	rawTool, err := kitutil.Marshal(entry.tool)
	if err != nil {
		return
	}
	if len(rawTool) > droppedToolLogBytes {
		rawTool = rawTool[:droppedToolLogBytes]
	}
	kitutil.LogError(fmt.Sprintf("responses to chat conversion dropped unsupported tool type %q at %s: %s",
		toolType, entry.position, strings.ToValidUTF8(string(rawTool), "")))
}
