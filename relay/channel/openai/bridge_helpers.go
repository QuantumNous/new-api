package openai

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
)

func getBridgeMode(model string) BridgeMode {
	if model == "" {
		return BridgeModeNone
	}
	if mode, ok := ModelBridgeRules[model]; ok {
		return mode
	}
	for key, mode := range ModelBridgeRules {
		if strings.HasSuffix(key, "*") {
			prefix := strings.TrimSuffix(key, "*")
			if strings.HasPrefix(model, prefix) {
				return mode
			}
		}
	}
	return BridgeModeNone
}

func ShouldBridgeChatToResponses(model string) bool {
	return getBridgeMode(model)&BridgeModeChatToResponses != 0
}

func ShouldBridgeResponsesToChat(model string) bool {
	return getBridgeMode(model)&BridgeModeResponsesToChat != 0
}

// GeneralRequestToResponses converts a Chat Completions style request into an OpenAI Responses request.
func GeneralRequestToResponses(req *dto.GeneralOpenAIRequest) (*dto.OpenAIResponsesRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}

	responsesReq := &dto.OpenAIResponsesRequest{
		Model:  req.Model,
		Stream: req.Stream,
		TopP:   req.TopP,
		User:   req.User,
	}

	if req.Temperature != nil {
		responsesReq.Temperature = *req.Temperature
	}

	if req.MaxCompletionTokens > 0 {
		responsesReq.MaxOutputTokens = req.MaxCompletionTokens
	} else if req.MaxTokens > 0 {
		responsesReq.MaxOutputTokens = req.MaxTokens
	}

	if req.Metadata != nil {
		responsesReq.Metadata = req.Metadata
	}

	if req.Store != nil {
		responsesReq.Store = req.Store
	}

	if req.PromptCacheKey != "" {
		responsesReq.PromptCacheKey = json.RawMessage(strconv.Quote(req.PromptCacheKey))
	}
	if req.PromptCacheRetention != nil {
		responsesReq.PromptCacheRetention = req.PromptCacheRetention
	}

	if req.ParallelTooCalls != nil {
		raw, err := json.Marshal(req.ParallelTooCalls)
		if err == nil {
			responsesReq.ParallelToolCalls = raw
		}
	}

	if len(req.Tools) > 0 {
		if raw, err := json.Marshal(req.Tools); err == nil {
			responsesReq.Tools = raw
		}
	}

	if req.ToolChoice != nil {
		if raw, err := json.Marshal(req.ToolChoice); err == nil {
			responsesReq.ToolChoice = raw
		}
	}

	if len(req.Reasoning) > 0 {
		reasoning := &dto.Reasoning{}
		if err := json.Unmarshal(req.Reasoning, reasoning); err == nil {
			responsesReq.Reasoning = reasoning
		}
	} else if req.ReasoningEffort != "" {
		responsesReq.Reasoning = &dto.Reasoning{
			Effort: req.ReasoningEffort,
		}
	}

	// Build input/instructions from messages.
	instructions, inputItems := convertMessagesToResponsesInput(req.Messages)
	if instructions != "" {
		if raw, err := json.Marshal(instructions); err == nil {
			responsesReq.Instructions = raw
		}
	}
	if len(inputItems) > 0 {
		if raw, err := json.Marshal(inputItems); err == nil {
			responsesReq.Input = raw
		} else {
			return nil, fmt.Errorf("failed to marshal responses input: %w", err)
		}
	}

	return responsesReq, nil
}

// ResponsesRequestToGeneral converts a Responses API request into a Chat Completions request.
func ResponsesRequestToGeneral(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}

	general := &dto.GeneralOpenAIRequest{
		Model:                req.Model,
		Stream:               req.Stream,
		TopP:                 req.TopP,
		User:                 req.User,
		Metadata:             req.Metadata,
		Store:                req.Store,
		PromptCacheRetention: req.PromptCacheRetention,
	}

	if req.MaxOutputTokens > 0 {
		general.MaxTokens = req.MaxOutputTokens
	}

	if req.Temperature != 0 {
		temp := req.Temperature
		general.Temperature = &temp
	}

	if len(req.Tools) > 0 {
		var tools []dto.ToolCallRequest
		if err := json.Unmarshal(req.Tools, &tools); err == nil {
			general.Tools = tools
		}
	}

	if len(req.ToolChoice) > 0 {
		var toolChoice any
		if err := json.Unmarshal(req.ToolChoice, &toolChoice); err == nil {
			general.ToolChoice = toolChoice
		}
	}

	if len(req.PromptCacheKey) > 0 {
		var cacheKey string
		if err := json.Unmarshal(req.PromptCacheKey, &cacheKey); err == nil {
			general.PromptCacheKey = cacheKey
		}
	}

	if req.Reasoning != nil {
		if raw, err := json.Marshal(req.Reasoning); err == nil {
			general.Reasoning = raw
		}
	}

	// Restore instructions as system message if present.
	var systemMessages []dto.Message
	if len(req.Instructions) > 0 {
		var instructionText string
		if err := json.Unmarshal(req.Instructions, &instructionText); err == nil && strings.TrimSpace(instructionText) != "" {
			systemMessages = append(systemMessages, dto.Message{
				Role:    "system",
				Content: instructionText,
			})
		}
	}

	convertedMessages, err := convertResponsesInputToMessages(req.Input)
	if err != nil {
		return nil, err
	}

	general.Messages = append(systemMessages, convertedMessages...)
	return general, nil
}

// ResponsesResponseToChat converts a Responses API response into a Chat Completions response.
func ResponsesResponseToChat(resp *dto.OpenAIResponsesResponse, includeUsage bool) *dto.OpenAITextResponse {
	if resp == nil {
		return nil
	}

	text := extractTextFromResponsesOutput(resp.Output)
	message := dto.Message{
		Role:    "assistant",
		Content: text,
	}

	choice := dto.OpenAITextResponseChoice{
		Index:        0,
		Message:      message,
		FinishReason: constant.FinishReasonStop,
	}

	textResp := &dto.OpenAITextResponse{
		Id:      resp.ID,
		Model:   resp.Model,
		Object:  "chat.completion",
		Created: resp.CreatedAt,
		Choices: []dto.OpenAITextResponseChoice{choice},
	}

	if resp.Usage != nil && includeUsage {
		textResp.Usage = *resp.Usage
	} else {
		textResp.Usage = dto.Usage{}
	}

	return textResp
}

// ChatResponseToResponses converts a Chat Completions response into a Responses API response.
func ChatResponseToResponses(resp *dto.OpenAITextResponse, includeUsage bool) *dto.OpenAIResponsesResponse {
	if resp == nil {
		return nil
	}
	var contentText string
	if len(resp.Choices) > 0 {
		contentText = messageTextContent(resp.Choices[0].Message)
	}

	outputContent := []dto.ResponsesOutputContent{{
		Type: "output_text",
		Text: contentText,
	}}
	output := []dto.ResponsesOutput{{
		Type:    "message",
		ID:      resp.Id,
		Status:  "completed",
		Role:    "assistant",
		Content: outputContent,
	}}

	created := parseCreatedTimestamp(resp.Created)
	responses := &dto.OpenAIResponsesResponse{
		ID:        resp.Id,
		Object:    "response",
		CreatedAt: int(created),
		Status:    "completed",
		Model:     resp.Model,
		Output:    output,
	}

	if includeUsage {
		responses.Usage = &resp.Usage
	}

	return responses
}

func convertMessagesToResponsesInput(messages []dto.Message) (string, []map[string]any) {
	var instructionsBuilder strings.Builder
	var inputItems []map[string]any

	for _, msg := range messages {
		role := strings.ToLower(strings.TrimSpace(msg.Role))
		switch role {
		case "system", "developer":
			if text := strings.TrimSpace(messageTextContent(msg)); text != "" {
				if instructionsBuilder.Len() > 0 {
					instructionsBuilder.WriteString("\n")
				}
				instructionsBuilder.WriteString(text)
			}
		default:
			contents := buildResponsesContentList(msg)
			if len(contents) == 0 {
				continue
			}
			item := map[string]any{
				"role":    msg.Role,
				"content": contents,
			}
			if msg.ToolCallId != "" {
				item["tool_call_id"] = msg.ToolCallId
			}
			if len(msg.ToolCalls) > 0 {
				item["tool_calls"] = msg.ToolCalls
			}
			inputItems = append(inputItems, item)
		}
	}

	return instructionsBuilder.String(), inputItems
}

func buildResponsesContentList(msg dto.Message) []map[string]any {
	var contents []map[string]any
	parsed := msg.ParseContent()
	if len(parsed) == 0 {
		if text := strings.TrimSpace(messageTextContent(msg)); text != "" {
			contents = append(contents, map[string]any{
				"type": "input_text",
				"text": text,
			})
		}
		return contents
	}

	for _, part := range parsed {
		switch part.Type {
		case dto.ContentTypeText:
			if strings.TrimSpace(part.Text) == "" {
				continue
			}
			contents = append(contents, map[string]any{
				"type": "input_text",
				"text": part.Text,
			})
		case dto.ContentTypeImageURL:
			if img := part.GetImageMedia(); img != nil && img.Url != "" {
				payload := map[string]any{
					"type": "input_image",
					"image_url": map[string]any{
						"url": img.Url,
					},
				}
				if img.Detail != "" {
					payload["image_url"].(map[string]any)["detail"] = img.Detail
				}
				contents = append(contents, payload)
			}
		case dto.ContentTypeInputAudio:
			if audio := part.GetInputAudio(); audio != nil && audio.Data != "" && audio.Format != "" {
				contents = append(contents, map[string]any{
					"type": "input_audio",
					"input_audio": map[string]any{
						"format": audio.Format,
						"data":   audio.Data,
					},
				})
			}
		case dto.ContentTypeFile:
			if file := part.GetFile(); file != nil {
				filePayload := map[string]any{
					"type": "input_file",
					"file_url": map[string]any{
						"file_id": file.FileId,
					},
				}
				if file.FileData != "" {
					filePayload["file_url"].(map[string]any)["file_data"] = file.FileData
				}
				if file.FileName != "" {
					filePayload["file_url"].(map[string]any)["filename"] = file.FileName
				}
				contents = append(contents, filePayload)
			}
		default:
			if strings.TrimSpace(part.Text) == "" {
				continue
			}
			contents = append(contents, map[string]any{
				"type": "input_text",
				"text": part.Text,
			})
		}
	}
	return contents
}

func convertResponsesInputToMessages(input json.RawMessage) ([]dto.Message, error) {
	if len(input) == 0 {
		return nil, nil
	}

	var raw any
	if err := json.Unmarshal(input, &raw); err != nil {
		var single string
		if err2 := json.Unmarshal(input, &single); err2 == nil {
			return []dto.Message{{
				Role:    "user",
				Content: single,
			}}, nil
		}
		return nil, err
	}

	switch val := raw.(type) {
	case string:
		return []dto.Message{{
			Role:    "user",
			Content: val,
		}}, nil
	case []any:
		messages := make([]dto.Message, 0, len(val))
		for _, item := range val {
			entry, ok := item.(map[string]any)
			if !ok {
				continue
			}
			role := common.Interface2String(entry["role"])
			contentList := convertResponsesContentNode(entry["content"])
			msg := dto.Message{
				Role: role,
			}
			if len(contentList) == 1 && contentList[0].Type == dto.ContentTypeText {
				msg.Content = contentList[0].Text
			} else {
				msg.Content = contentList
			}
			if toolCallID, ok := entry["tool_call_id"].(string); ok {
				msg.ToolCallId = toolCallID
			}
			messages = append(messages, msg)
		}
		return messages, nil
	default:
		return nil, fmt.Errorf("unsupported responses input format")
	}
}

func convertResponsesContentNode(content any) []dto.MediaContent {
	nodeList, ok := content.([]any)
	if !ok {
		return nil
	}
	result := make([]dto.MediaContent, 0, len(nodeList))
	for _, node := range nodeList {
		entry, ok := node.(map[string]any)
		if !ok {
			continue
		}
		contentType := common.Interface2String(entry["type"])
		switch contentType {
		case "input_text", "output_text":
			result = append(result, dto.MediaContent{
				Type: dto.ContentTypeText,
				Text: common.Interface2String(entry["text"]),
			})
		case "input_image", "output_image":
			result = append(result, dto.MediaContent{
				Type: dto.ContentTypeImageURL,
				ImageUrl: map[string]any{
					"url": extractImageURL(entry["image_url"]),
				},
			})
		case "input_file":
			result = append(result, dto.MediaContent{
				Type: dto.ContentTypeFile,
				File: entry["file_url"],
			})
		case "input_audio":
			result = append(result, dto.MediaContent{
				Type:       dto.ContentTypeInputAudio,
				InputAudio: entry["input_audio"],
			})
		default:
			result = append(result, dto.MediaContent{
				Type: dto.ContentTypeText,
				Text: common.Interface2String(entry["text"]),
			})
		}
	}
	return result
}

func extractImageURL(raw any) string {
	switch v := raw.(type) {
	case string:
		return v
	case map[string]any:
		return common.Interface2String(v["url"])
	default:
		return ""
	}
}

func extractTextFromResponsesOutput(outputs []dto.ResponsesOutput) string {
	var builder strings.Builder
	for _, output := range outputs {
		for _, content := range output.Content {
			if content.Type == "output_text" && content.Text != "" {
				builder.WriteString(content.Text)
			}
		}
	}
	return builder.String()
}

func messageTextContent(msg dto.Message) string {
	if msg.Content == nil {
		return ""
	}
	switch v := msg.Content.(type) {
	case string:
		return v
	case []dto.MediaContent:
		var b strings.Builder
		for _, item := range v {
			if item.Type == dto.ContentTypeText {
				b.WriteString(item.Text)
			}
		}
		return b.String()
	default:
		return fmt.Sprint(msg.Content)
	}
}

func parseCreatedTimestamp(value any) int64 {
	switch v := value.(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case float64:
		return int64(v)
	case json.Number:
		if parsed, err := v.Int64(); err == nil {
			return parsed
		}
		if f, err := strconv.ParseFloat(v.String(), 64); err == nil {
			return int64(f)
		}
	case string:
		if parsed, err := strconv.ParseInt(v, 10, 64); err == nil {
			return parsed
		}
	}
	return time.Now().Unix()
}
