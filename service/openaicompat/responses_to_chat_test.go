package openaicompat

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func newResponsesReq(t *testing.T, body map[string]any) *dto.OpenAIResponsesRequest {
	t.Helper()
	raw, err := common.Marshal(body)
	require.NoError(t, err)
	var req dto.OpenAIResponsesRequest
	require.NoError(t, common.Unmarshal(raw, &req))
	return &req
}

func TestResponsesToChat_StringInputWrapsAsUserMessage(t *testing.T) {
	req := newResponsesReq(t, map[string]any{"model": "claude-3", "input": "hello"})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	if chat.Messages[0].Role != "user" {
		t.Errorf("role=%q want user", chat.Messages[0].Role)
	}
	if chat.Messages[0].StringContent() != "hello" {
		t.Errorf("content=%q want hello", chat.Messages[0].StringContent())
	}
}

func TestResponsesToChat_EmptyStringInputPlaceholder(t *testing.T) {
	req := newResponsesReq(t, map[string]any{"model": "x", "input": ""})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	if chat.Messages[0].StringContent() != "..." {
		t.Errorf("placeholder=%q want ...", chat.Messages[0].StringContent())
	}
}

func TestResponsesToChat_EmptyArrayPlaceholder(t *testing.T) {
	req := newResponsesReq(t, map[string]any{"model": "x", "input": []any{}})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	if chat.Messages[0].StringContent() != "..." {
		t.Errorf("placeholder=%q want ...", chat.Messages[0].StringContent())
	}
}

func TestResponsesToChat_NonStringNonArrayReturnsError(t *testing.T) {
	req := newResponsesReq(t, map[string]any{"model": "x", "input": 42})
	_, err := ResponsesRequestToChatCompletionsRequest(req)
	if err == nil {
		t.Errorf("expected error for numeric input")
	}
}

func TestResponsesToChat_InstructionsLifted(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model":        "x",
		"input":        "hi",
		"instructions": "You are helpful.",
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(chat.Messages), 2)
	if chat.Messages[0].Role != "system" {
		t.Errorf("first role=%q want system", chat.Messages[0].Role)
	}
	if chat.Messages[0].StringContent() != "You are helpful." {
		t.Errorf("system content=%q", chat.Messages[0].StringContent())
	}
}

func TestResponsesToChat_EmptyInstructionsSkipped(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model":        "x",
		"input":        "hi",
		"instructions": "",
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	for _, m := range chat.Messages {
		if m.Role == "system" {
			t.Errorf("system message present when instructions empty")
		}
	}
}

func TestResponsesToChat_RoleOnlyFallbackAndSkipUnknown(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"role": "user", "content": []any{
				map[string]any{"type": "input_text", "text": "hi"},
			}},
			map[string]any{"foo": "bar"}, // skipped
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	if chat.Messages[0].StringContent() != "hi" {
		t.Errorf("got=%q want hi", chat.Messages[0].StringContent())
	}
}

func TestResponsesToChat_OutputTextBecomesText(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"role": "assistant", "content": []any{
				map[string]any{"type": "output_text", "text": "answer"},
			}},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	if chat.Messages[0].StringContent() != "answer" {
		t.Errorf("got=%q want answer", chat.Messages[0].StringContent())
	}
}

func TestResponsesToChat_InputImageWithURL(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"role": "user", "content": []any{
				map[string]any{
					"type":      "input_image",
					"image_url": "https://example.com/a.png",
					"detail":    "high",
				},
			}},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	parts := chat.Messages[0].ParseContent()
	require.Len(t, parts, 1)
	if parts[0].Type != dto.ContentTypeImageURL {
		t.Errorf("type=%q want image_url", parts[0].Type)
	}
}

func TestResponsesToChat_InputImageWithFileID(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"role": "user", "content": []any{
				map[string]any{"type": "input_image", "file_id": "file_abc"},
			}},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	parts := chat.Messages[0].ParseContent()
	require.Len(t, parts, 1)
	if parts[0].Type != dto.ContentTypeImageURL {
		t.Errorf("type=%q want image_url", parts[0].Type)
	}
}

// MINOR-2: input_image with neither image_url nor file_id should still be
// emitted as an image_url part (with empty url and detail="auto") so the
// downstream converter can decide how to handle it.
func TestResponsesToChat_InputImageWithNeitherURLNorFileID(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"role": "user", "content": []any{
				map[string]any{"type": "input_image"},
			}},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	parts := chat.Messages[0].ParseContent()
	require.Len(t, parts, 1)
	require.Equal(t, dto.ContentTypeImageURL, parts[0].Type)

	imageURL := parts[0].GetImageMedia()
	require.NotNil(t, imageURL, "expected image_url to be parseable")
	require.Equal(t, "", imageURL.Url)
	require.Equal(t, "auto", imageURL.Detail)
}

func TestResponsesToChat_FunctionCallBecomesAssistantToolCalls(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{
				"type":      "function_call",
				"call_id":   "c1",
				"name":      "search",
				"arguments": `{"q":"x"}`,
			},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	if chat.Messages[0].Role != "assistant" {
		t.Errorf("role=%q want assistant", chat.Messages[0].Role)
	}
	calls := chat.Messages[0].ParseToolCalls()
	require.Len(t, calls, 1)
	if calls[0].ID != "c1" || calls[0].Function.Name != "search" {
		t.Errorf("call mismatch: id=%q name=%q", calls[0].ID, calls[0].Function.Name)
	}
	if calls[0].Function.Arguments != `{"q":"x"}` {
		t.Errorf("args=%q", calls[0].Function.Arguments)
	}
}

func TestResponsesToChat_FunctionCallEmptyNameDropped(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"type": "function_call", "call_id": "c1", "name": "", "arguments": "{}"},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Empty(t, chat.Messages)
}

func TestResponsesToChat_FunctionCallOutputBecomesToolMessage(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"type": "function_call_output", "call_id": "c1", "output": "result text"},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	if chat.Messages[0].Role != "tool" || chat.Messages[0].ToolCallId != "c1" {
		t.Errorf("tool msg mismatch: role=%q id=%q", chat.Messages[0].Role, chat.Messages[0].ToolCallId)
	}
	if chat.Messages[0].StringContent() != "result text" {
		t.Errorf("content=%q", chat.Messages[0].StringContent())
	}
}

func TestResponsesToChat_FunctionCallOutputObjectStringified(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"type": "function_call_output", "call_id": "c1", "output": map[string]any{"ok": true, "n": 7}},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	c := chat.Messages[0].StringContent()
	if !strings.Contains(c, `"ok":true`) || !strings.Contains(c, `"n":7`) {
		t.Errorf("content=%q want JSON-stringified", c)
	}
}

func TestResponsesToChat_FunctionCallFlushesBeforeOutput(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{
				"type":      "function_call",
				"call_id":   "c1",
				"name":      "search",
				"arguments": "{}",
			},
			map[string]any{"type": "function_call_output", "call_id": "c1", "output": "r"},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 2)
	if chat.Messages[0].Role != "assistant" {
		t.Errorf("first role=%q", chat.Messages[0].Role)
	}
	if chat.Messages[1].Role != "tool" {
		t.Errorf("second role=%q", chat.Messages[1].Role)
	}
}

func TestResponsesToChat_ReasoningAttachedToNextAssistant(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"type": "reasoning", "summary": []any{
				map[string]any{"text": "thinking step 1"},
			}},
			map[string]any{"type": "message", "role": "assistant", "content": []any{
				map[string]any{"type": "output_text", "text": "answer"},
			}},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	m := chat.Messages[0]
	if m.GetReasoningContent() != "thinking step 1" {
		t.Errorf("reasoning=%q", m.GetReasoningContent())
	}
}

func TestResponsesToChat_ReasoningContentFallback(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"type": "reasoning", "content": []any{
				map[string]any{"text": "alt thinking"},
			}},
			map[string]any{"type": "message", "role": "assistant", "content": "ok"},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	if chat.Messages[0].GetReasoningContent() != "alt thinking" {
		t.Errorf("reasoning=%q", chat.Messages[0].GetReasoningContent())
	}
}

func TestResponsesToChat_MultipleReasoningJoined(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"type": "reasoning", "summary": []any{map[string]any{"text": "a"}}},
			map[string]any{"type": "reasoning", "summary": []any{map[string]any{"text": "b"}}},
			map[string]any{"type": "message", "role": "assistant", "content": "ok"},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 1)
	if chat.Messages[0].GetReasoningContent() != "a\nb" {
		t.Errorf("reasoning=%q want a\\nb", chat.Messages[0].GetReasoningContent())
	}
}

func TestResponsesToChat_ReasoningBufferCleared(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": []any{
			map[string]any{"type": "reasoning", "summary": []any{map[string]any{"text": "r"}}},
			map[string]any{"type": "message", "role": "assistant", "content": "first"},
			map[string]any{"type": "message", "role": "assistant", "content": "second"},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Messages, 2)
	if chat.Messages[0].GetReasoningContent() == "" {
		t.Errorf("first message should carry reasoning")
	}
	if chat.Messages[1].GetReasoningContent() != "" {
		t.Errorf("second message should not have reasoning, got=%q", chat.Messages[1].GetReasoningContent())
	}
}

func TestResponsesToChat_ToolDeclarationFlatConverted(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": "hi",
		"tools": []any{
			map[string]any{
				"type":        "function",
				"name":        "search",
				"description": "find",
				"parameters":  map[string]any{"type": "object", "properties": map[string]any{}},
			},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Tools, 1)
	if chat.Tools[0].Function.Name != "search" {
		t.Errorf("name=%q", chat.Tools[0].Function.Name)
	}
}

func TestResponsesToChat_ToolDeclarationChatShapePassThrough(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": "hi",
		"tools": []any{
			map[string]any{
				"type": "function",
				"function": map[string]any{
					"name":        "search",
					"description": "find",
					"parameters":  map[string]any{"type": "object"},
				},
			},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Len(t, chat.Tools, 1)
	if chat.Tools[0].Function.Name != "search" {
		t.Errorf("name=%q", chat.Tools[0].Function.Name)
	}
	// Parameters should have been normalized.
	m, ok := chat.Tools[0].Function.Parameters.(map[string]any)
	require.True(t, ok)
	if _, has := m["properties"]; !has {
		t.Errorf("properties not normalized: %+v", m)
	}
}

func TestResponsesToChat_NamelessToolDropped(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": "hi",
		"tools": []any{
			map[string]any{"type": "request_user_input"},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.Empty(t, chat.Tools)
}

func TestResponsesToChat_ReasoningEffortCarry(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model":     "x",
		"input":     "hi",
		"reasoning": map[string]any{"effort": "high"},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	if chat.ReasoningEffort != "high" {
		t.Errorf("reasoning_effort=%q", chat.ReasoningEffort)
	}
}

func TestResponsesToChat_ResponseFormatJSONObject(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": "hi",
		"text": map[string]any{
			"format": map[string]any{"type": "json_object"},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.NotNil(t, chat.ResponseFormat)
	if chat.ResponseFormat.Type != "json_object" {
		t.Errorf("response_format.type=%q", chat.ResponseFormat.Type)
	}
}

func TestResponsesToChat_ResponseFormatJSONSchema(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": "hi",
		"text": map[string]any{
			"format": map[string]any{
				"type":        "json_schema",
				"json_schema": map[string]any{"schema": map[string]any{"type": "object"}},
			},
		},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.NotNil(t, chat.ResponseFormat)
	if chat.ResponseFormat.Type != "json_schema" {
		t.Errorf("response_format.type=%q", chat.ResponseFormat.Type)
	}
	var got map[string]any
	require.NoError(t, json.Unmarshal(chat.ResponseFormat.JsonSchema, &got))
	if _, has := got["schema"]; !has {
		t.Errorf("schema not preserved: %+v", got)
	}
}

func TestResponsesToChat_ToolChoiceFlatToChatShape(t *testing.T) {
	req := newResponsesReq(t, map[string]any{
		"model":       "x",
		"input":       "hi",
		"tool_choice": map[string]any{"type": "function", "name": "search"},
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	require.NotNil(t, chat.ToolChoice)
	m, ok := chat.ToolChoice.(map[string]any)
	require.True(t, ok)
	if fn, ok := m["function"].(map[string]any); !ok || fn["name"] != "search" {
		t.Errorf("tool_choice did not reshape: %+v", m)
	}
}

func TestResponsesToChat_StoreAndOtherFieldsStripped(t *testing.T) {
	// Spec §10 — Responses-only fields removed from result.
	req := newResponsesReq(t, map[string]any{
		"model": "x",
		"input": "hi",
		"store": false,
	})
	chat, err := ResponsesRequestToChatCompletionsRequest(req)
	require.NoError(t, err)
	if chat.Store != nil {
		t.Errorf("store should be stripped: %v", chat.Store)
	}
}
