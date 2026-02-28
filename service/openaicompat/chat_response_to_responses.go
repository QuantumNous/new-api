package openaicompat

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// ChatCompletionsResponseToResponsesResponse converts a Chat Completions
// response into an OpenAI Responses API response.  This is the reverse of
// ResponsesResponseToChatCompletionsResponse and is used when the proxy
// needs to return a /v1/responses payload to the client while the upstream
// channel only spoke /v1/chat/completions.
func ChatCompletionsResponseToResponsesResponse(chatResp *dto.OpenAITextResponse, model string) (*dto.OpenAIResponsesResponse, error) {
	if chatResp == nil {
		return nil, fmt.Errorf("chat response is nil")
	}

	respID := "resp_" + chatResp.Id
	createdAt := 0
	if chatResp.Created != nil {
		switch v := chatResp.Created.(type) {
		case float64:
			createdAt = int(v)
		case int64:
			createdAt = int(v)
		case int:
			createdAt = v
		case json.Number:
			if n, err := v.Int64(); err == nil {
				createdAt = int(n)
			}
		}
	}
	if createdAt == 0 {
		createdAt = int(time.Now().Unix())
	}

	if model == "" {
		model = chatResp.Model
	}

	var outputs []dto.ResponsesOutput

	if len(chatResp.Choices) > 0 {
		choice := chatResp.Choices[0]
		msg := choice.Message

		// Check for tool calls first
		toolCalls := msg.ParseToolCalls()
		if len(toolCalls) > 0 {
			for _, tc := range toolCalls {
				outputs = append(outputs, dto.ResponsesOutput{
					Type:      "function_call",
					ID:        tc.ID,
					CallId:    tc.ID,
					Name:      tc.Function.Name,
					Arguments: tc.Function.Arguments,
					Status:    "completed",
				})
			}
		} else {
			// Regular text output
			text := msg.StringContent()
			outputs = append(outputs, dto.ResponsesOutput{
				Type:   "message",
				ID:     "msg_" + chatResp.Id,
				Status: "completed",
				Role:   "assistant",
				Content: []dto.ResponsesOutputContent{
					{
						Type: "output_text",
						Text: text,
					},
				},
			})
		}
	}

	usage := chatResp.Usage
	respUsage := &dto.Usage{
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		TotalTokens:      usage.TotalTokens,
		InputTokens:      usage.PromptTokens,
		OutputTokens:     usage.CompletionTokens,
	}

	return &dto.OpenAIResponsesResponse{
		ID:        respID,
		Object:    "response",
		CreatedAt: createdAt,
		Status:    "completed",
		Model:     model,
		Output:    outputs,
		Usage:     respUsage,
	}, nil
}

// ChatStreamChunkToResponsesEvents converts a Chat Completions stream chunk
// into one or more Responses API SSE event payloads.
// Returns nil when the chunk produces no events (e.g. empty delta).
func ChatStreamChunkToResponsesEvents(chunk *dto.ChatCompletionsStreamResponse, respID string) []map[string]any {
	if chunk == nil || len(chunk.Choices) == 0 {
		return nil
	}

	choice := chunk.Choices[0]
	delta := choice.Delta

	var events []map[string]any

	// Content delta
	contentStr := delta.GetContentString()
	if contentStr != "" {
		events = append(events, map[string]any{
			"type":  "response.output_text.delta",
			"delta": contentStr,
		})
	}

	// Reasoning content delta
	reasoningStr := delta.GetReasoningContent()
	if reasoningStr != "" {
		events = append(events, map[string]any{
			"type":  "response.reasoning_summary_text.delta",
			"delta": reasoningStr,
		})
	}

	// Tool calls
	for _, tc := range delta.ToolCalls {
		if tc.Function.Name != "" {
			events = append(events, map[string]any{
				"type": "response.output_item.added",
				"item": map[string]any{
					"type":      "function_call",
					"id":        tc.ID,
					"call_id":   tc.ID,
					"name":      tc.Function.Name,
					"arguments": "",
				},
			})
		}
		if tc.Function.Arguments != "" {
			events = append(events, map[string]any{
				"type":    "response.function_call_arguments.delta",
				"item_id": tc.ID,
				"delta":   tc.Function.Arguments,
			})
		}
	}

	return events
}

// BuildResponsesCompletedEvent builds the final response.completed SSE event.
func BuildResponsesCompletedEvent(respID string, model string, fullText string, usage *dto.Usage, toolCalls []dto.ToolCallResponse) map[string]any {
	var outputs []map[string]any

	if len(toolCalls) > 0 {
		for _, tc := range toolCalls {
			outputs = append(outputs, map[string]any{
				"type":      "function_call",
				"id":        tc.ID,
				"call_id":   tc.ID,
				"name":      tc.Function.Name,
				"arguments": tc.Function.Arguments,
				"status":    "completed",
			})
		}
	} else {
		outputs = append(outputs, map[string]any{
			"type":   "message",
			"id":     "msg_" + strings.TrimPrefix(respID, "resp_"),
			"status": "completed",
			"role":   "assistant",
			"content": []map[string]any{
				{
					"type": "output_text",
					"text": fullText,
				},
			},
		})
	}

	respUsage := map[string]any{
		"input_tokens":  0,
		"output_tokens": 0,
		"total_tokens":  0,
	}
	if usage != nil {
		respUsage["input_tokens"] = usage.PromptTokens
		respUsage["output_tokens"] = usage.CompletionTokens
		respUsage["total_tokens"] = usage.TotalTokens
	}

	return map[string]any{
		"type": "response.completed",
		"response": map[string]any{
			"id":         respID,
			"object":     "response",
			"created_at": int(time.Now().Unix()),
			"status":     "completed",
			"model":      model,
			"output":     outputs,
			"usage":      respUsage,
		},
	}
}

// MarshalSSEEvent marshals an event to "data: {json}\n\n" format.
func MarshalSSEEvent(event any) ([]byte, error) {
	data, err := common.Marshal(event)
	if err != nil {
		return nil, err
	}
	return append([]byte("data: "), append(data, '\n', '\n')...), nil
}
