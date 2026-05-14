package openaicompat

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestChatCompletionsRequestToResponsesRequestDropsNullableOnlyToolParameter(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-4o",
		Messages: []dto.Message{
			{Role: "user", Content: "read the file"},
		},
		Tools: []dto.ToolCallRequest{
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name: "read_file",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"file_path": map[string]any{"type": "string"},
							"pages": map[string]any{
								"anyOf": []any{
									map[string]any{"type": "null"},
								},
							},
						},
						"required": []any{"file_path", "pages"},
					},
				},
			},
		},
	}

	responsesReq, err := ChatCompletionsRequestToResponsesRequest(req)
	require.NoError(t, err)

	var tools []map[string]any
	require.NoError(t, common.Unmarshal(responsesReq.Tools, &tools))
	require.Len(t, tools, 1)

	parameters, ok := tools[0]["parameters"].(map[string]any)
	require.True(t, ok)
	properties, ok := parameters["properties"].(map[string]any)
	require.True(t, ok)
	_, exists := properties["pages"]
	require.False(t, exists)
	require.ElementsMatch(t, []string{"file_path"}, parameters["required"])
}

func TestChatCompletionsRequestToResponsesRequestOmitsRequiredWhenNullableOnlyToolParameterWasOnlyRequired(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-4o",
		Messages: []dto.Message{
			{Role: "user", Content: "ask a question"},
		},
		Tools: []dto.ToolCallRequest{
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name: "AskUserQuestion",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"questions": map[string]any{
								"anyOf": []any{
									map[string]any{"type": "null"},
								},
							},
						},
						"required": []any{"questions"},
					},
				},
			},
		},
	}

	responsesReq, err := ChatCompletionsRequestToResponsesRequest(req)
	require.NoError(t, err)

	var tools []map[string]any
	require.NoError(t, common.Unmarshal(responsesReq.Tools, &tools))
	parameters := tools[0]["parameters"].(map[string]any)
	_, exists := parameters["required"]
	require.False(t, exists)
}

func TestChatCompletionsRequestToResponsesRequestKeepsTypedNullableToolParameter(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-4o",
		Messages: []dto.Message{
			{Role: "user", Content: "read the file"},
		},
		Tools: []dto.ToolCallRequest{
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name: "read_file",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"pages": map[string]any{
								"description": "Page numbers to read",
								"anyOf": []any{
									map[string]any{"type": "array", "items": map[string]any{"type": "integer"}},
									map[string]any{"type": "null"},
								},
							},
						},
						"required": []any{"pages"},
					},
				},
			},
		},
	}

	responsesReq, err := ChatCompletionsRequestToResponsesRequest(req)
	require.NoError(t, err)

	var tools []map[string]any
	require.NoError(t, common.Unmarshal(responsesReq.Tools, &tools))
	parameters := tools[0]["parameters"].(map[string]any)
	properties := parameters["properties"].(map[string]any)
	pages := properties["pages"].(map[string]any)
	require.Equal(t, "array", pages["type"])
	require.Equal(t, map[string]any{"type": "integer"}, pages["items"])
	require.Equal(t, "Page numbers to read", pages["description"])
	require.NotContains(t, pages, "anyOf")
	require.ElementsMatch(t, []string{"pages"}, parameters["required"])
}

func TestChatCompletionsRequestToResponsesRequestDropsEmptyToolCallArgumentForDroppedParameter(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-4o",
		Messages: []dto.Message{
			{Role: "user", Content: "read the file"},
			{
				Role:      "assistant",
				Content:   "",
				ToolCalls: json.RawMessage(`[{"id":"call_1","type":"function","function":{"name":"read_file","arguments":"{\"file_path\":\"/tmp/a.pdf\",\"pages\":\"\"}"}}]`),
			},
		},
		Tools: []dto.ToolCallRequest{
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name: "read_file",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"file_path": map[string]any{"type": "string"},
							"pages": map[string]any{
								"anyOf": []any{
									map[string]any{"type": "null"},
								},
							},
						},
						"required": []any{"file_path", "pages"},
					},
				},
			},
		},
	}

	responsesReq, err := ChatCompletionsRequestToResponsesRequest(req)
	require.NoError(t, err)

	var input []map[string]any
	require.NoError(t, common.Unmarshal(responsesReq.Input, &input))
	require.Len(t, input, 3)

	arguments := input[2]["arguments"].(string)
	var args map[string]any
	require.NoError(t, common.Unmarshal([]byte(arguments), &args))
	require.Equal(t, "/tmp/a.pdf", args["file_path"])
	require.NotContains(t, args, "pages")
}

func TestChatCompletionsRequestToResponsesRequestKeepsEmptyStringToolCallArgumentForStringParameter(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-4o",
		Messages: []dto.Message{
			{Role: "user", Content: "search"},
			{
				Role:      "assistant",
				Content:   "",
				ToolCalls: json.RawMessage(`[{"id":"call_1","type":"function","function":{"name":"search","arguments":"{\"query\":\"\"}"}}]`),
			},
		},
		Tools: []dto.ToolCallRequest{
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name: "search",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"query": map[string]any{"type": "string"},
						},
						"required": []any{"query"},
					},
				},
			},
		},
	}

	responsesReq, err := ChatCompletionsRequestToResponsesRequest(req)
	require.NoError(t, err)

	var input []map[string]any
	require.NoError(t, common.Unmarshal(responsesReq.Input, &input))
	require.Len(t, input, 3)

	arguments := input[2]["arguments"].(string)
	var args map[string]any
	require.NoError(t, common.Unmarshal([]byte(arguments), &args))
	require.Contains(t, args, "query")
	require.Equal(t, "", args["query"])
}
