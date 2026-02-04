package openaicompat

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func ChatCompletionsResponseToResponsesResponse(chat *dto.OpenAITextResponse, info *relaycommon.RelayInfo, responseID string) (*dto.OpenAIResponsesResponse, *dto.Usage, error) {
	if chat == nil {
		return nil, nil, errors.New("response is nil")
	}

	responseID = normalizeResponsesID(responseID)
	createdAt := coerceCreatedAt(chat.Created)

	output := chatMessageToResponsesOutput(chat)

	usage := &dto.Usage{
		PromptTokens:     chat.Usage.PromptTokens,
		CompletionTokens: chat.Usage.CompletionTokens,
		TotalTokens:      chat.Usage.TotalTokens,
	}
	usage.PromptTokensDetails = chat.Usage.PromptTokensDetails
	usage.CompletionTokenDetails = chat.Usage.CompletionTokenDetails

	if usage.TotalTokens == 0 {
		text := extractChatText(chat)
		if info != nil {
			usage.PromptTokens = info.GetEstimatePromptTokens()
		}
		usage.CompletionTokens = estimateTokenFallback(text)
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}

	resp := &dto.OpenAIResponsesResponse{
		ID:        responseID,
		Object:    "response",
		CreatedAt: createdAt,
		Status:    "completed",
		Model:     chat.Model,
		Output:    output,
		Usage:     usage,
	}

	return resp, usage, nil
}

func chatMessageToResponsesOutput(chat *dto.OpenAITextResponse) []dto.ResponsesOutput {
	if chat == nil || len(chat.Choices) == 0 {
		return nil
	}

	msg := chat.Choices[0].Message
	output := make([]dto.ResponsesOutput, 0, 2)

	text := messageTextContent(msg)
	if strings.TrimSpace(text) != "" {
		output = append(output, dto.ResponsesOutput{
			Type: "message",
			Role: "assistant",
			Content: []dto.ResponsesOutputContent{
				{
					Type: "output_text",
					Text: text,
				},
			},
		})
	}

	for _, tc := range msg.ParseToolCalls() {
		callID := strings.TrimSpace(tc.ID)
		if callID == "" {
			callID = fmt.Sprintf("call_%d", len(output))
		}
		name := strings.TrimSpace(tc.Function.Name)
		if name == "" {
			continue
		}
		output = append(output, dto.ResponsesOutput{
			Type:      "function_call",
			ID:        callID,
			CallId:    callID,
			Name:      name,
			Arguments: tc.Function.Arguments,
		})
	}

	return output
}

func extractChatText(chat *dto.OpenAITextResponse) string {
	if chat == nil || len(chat.Choices) == 0 {
		return ""
	}
	return messageTextContent(chat.Choices[0].Message)
}

func messageTextContent(msg dto.Message) string {
	if msg.IsStringContent() {
		return msg.StringContent()
	}
	var sb strings.Builder
	for _, part := range msg.ParseContent() {
		if part.Type == dto.ContentTypeText && part.Text != "" {
			sb.WriteString(part.Text)
		}
	}
	return sb.String()
}

func normalizeResponsesID(id string) string {
	id = strings.TrimSpace(id)
	if id == "" {
		return ""
	}
	if strings.HasPrefix(id, "resp_") {
		return id
	}
	if strings.HasPrefix(id, "chatcmpl-") {
		return "resp_" + strings.TrimPrefix(id, "chatcmpl-")
	}
	if strings.HasPrefix(id, "chatcmpl_") {
		return "resp_" + strings.TrimPrefix(id, "chatcmpl_")
	}
	return "resp_" + id
}

func coerceCreatedAt(created any) int {
	switch v := created.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case json.Number:
		if i, err := v.Int64(); err == nil {
			return int(i)
		}
	default:
		return 0
	}
	return 0
}

func estimateTokenFallback(text string) int {
	if text == "" {
		return 0
	}
	// Best-effort fallback: roughly 4 chars per token.
	count := len([]rune(text)) / 4
	if count == 0 {
		count = 1
	}
	return count
}
