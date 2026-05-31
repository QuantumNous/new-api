package openaicompat

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func ChatCompletionsResponseToResponsesResponse(chatResp *dto.OpenAITextResponse) (*dto.OpenAIResponsesResponse, error) {
	if chatResp == nil {
		return nil, fmt.Errorf("response is nil")
	}

	// Generate a Responses-format ID
	id := chatResp.Id
	if !strings.HasPrefix(id, "resp_") {
		id = "resp_" + id
	}

	// Extract created timestamp
	createdAt := 0
	switch v := chatResp.Created.(type) {
	case int:
		createdAt = v
	case int64:
		createdAt = int(v)
	case float64:
		createdAt = int(v)
	case json.Number:
		if i, err := v.Int64(); err == nil {
			createdAt = int(i)
		}
	}

	output := make([]dto.ResponsesOutput, 0)

	if len(chatResp.Choices) > 0 {
		choice := chatResp.Choices[0]
		msg := choice.Message

		// reasoning_content → reasoning output item
		reasoningText := ""
		if msg.ReasoningContent != nil {
			reasoningText = *msg.ReasoningContent
		} else if msg.Reasoning != nil {
			reasoningText = *msg.Reasoning
		}
		if reasoningText != "" {
			output = append(output, dto.ResponsesOutput{
				Type:   "reasoning",
				ID:     id + "_reas_0",
				Status: "completed",
				Content: []dto.ResponsesOutputContent{
					{Type: "summary_text", Text: reasoningText},
				},
			})
		}

		// Determine if there are tool calls
		var toolCalls []dto.ToolCallResponse
		if msg.ToolCalls != nil {
			_ = json.Unmarshal(msg.ToolCalls, &toolCalls)
		}

		// Extract text content
		text := ""
		if msg.Content != nil {
			switch v := msg.Content.(type) {
			case string:
				text = v
			}
		}

		// Create message output item (only if there's text content or no tool calls)
		if text != "" || len(toolCalls) == 0 {
			contentItems := make([]dto.ResponsesOutputContent, 0)
			if text != "" || (len(toolCalls) == 0 && reasoningText == "") {
				contentItems = append(contentItems, dto.ResponsesOutputContent{
					Type:        "output_text",
					Text:        text,
					Annotations: []interface{}{},
				})
			}

			output = append(output, dto.ResponsesOutput{
				Type:    "message",
				ID:      id + "_msg_0",
				Status:  "completed",
				Role:    "assistant",
				Content: contentItems,
			})
		}

		// Create function_call output items for each tool call
		for i, tc := range toolCalls {
			callID := tc.ID
			if callID == "" {
				callID = fmt.Sprintf("%s_fc_%d", id, i)
			}

			// Ensure arguments is valid JSON
			args := tc.Function.Arguments
			if args == "" {
				args = "{}"
			}

			// arguments must be a JSON string in the Responses API
			argsJSON, _ := json.Marshal(args)
			output = append(output, dto.ResponsesOutput{
				Type:      "function_call",
				ID:        fmt.Sprintf("%s_fc_%d", id, i),
				Status:    "completed",
				CallId:    callID,
				Name:      tc.Function.Name,
				Arguments: argsJSON,
			})
		}
	}

	// Build usage
	usage := &dto.Usage{}
	if chatResp.Usage.PromptTokens > 0 || chatResp.Usage.CompletionTokens > 0 {
		usage.PromptTokens = chatResp.Usage.PromptTokens
		usage.InputTokens = chatResp.Usage.PromptTokens
		usage.CompletionTokens = chatResp.Usage.CompletionTokens
		usage.OutputTokens = chatResp.Usage.CompletionTokens
		usage.TotalTokens = chatResp.Usage.TotalTokens
		usage.PromptTokensDetails = chatResp.Usage.PromptTokensDetails
		usage.CompletionTokenDetails = chatResp.Usage.CompletionTokenDetails
	}

	// Build status based on finish_reason
	statusStr := "completed"
	statusJSON, _ := common.Marshal(statusStr)

	out := &dto.OpenAIResponsesResponse{
		ID:        id,
		Object:    "response",
		CreatedAt: createdAt,
		Status:    statusJSON,
		Model:     chatResp.Model,
		Output:    output,
		Usage:     usage,
	}

	return out, nil
}
