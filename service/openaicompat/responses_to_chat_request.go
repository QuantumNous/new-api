package openaicompat

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func ResponsesRequestToChatCompletionsRequest(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	if req == nil {
		return nil, errors.New("request is nil")
	}
	if req.Model == "" {
		return nil, errors.New("model is required")
	}

	messages, err := responsesInputToMessages(req)
	if err != nil {
		return nil, err
	}

	tools := responsesToolsToChatTools(req.Tools)
	toolChoice := responsesToolChoiceToChatToolChoice(req.ToolChoice)

	var parallelToolCalls *bool
	if len(req.ParallelToolCalls) > 0 {
		var v bool
		if err := common.Unmarshal(req.ParallelToolCalls, &v); err == nil {
			parallelToolCalls = &v
		}
	}

	out := &dto.GeneralOpenAIRequest{
		Model:                req.Model,
		Messages:             messages,
		Stream:               req.Stream,
		MaxTokens:            req.MaxOutputTokens,
		Temperature:          req.Temperature,
		User:                 req.User,
		Tools:                tools,
		ToolChoice:           toolChoice,
		ParallelTooCalls:     parallelToolCalls,
		Store:                req.Store,
		Metadata:             req.Metadata,
		PromptCacheRetention: req.PromptCacheRetention,
	}

	if len(req.PromptCacheKey) > 0 {
		var key string
		if err := common.Unmarshal(req.PromptCacheKey, &key); err == nil {
			out.PromptCacheKey = key
		}
	}

	if req.TopP != nil {
		out.TopP = *req.TopP
	}
	if req.Reasoning != nil && req.Reasoning.Effort != "" && req.Reasoning.Effort != "none" {
		out.ReasoningEffort = req.Reasoning.Effort
	}
	if req.Text != nil {
		if rf := parseResponsesTextFormat(req.Text); rf != nil {
			out.ResponseFormat = rf
		}
	}

	return out, nil
}

func responsesInputToMessages(req *dto.OpenAIResponsesRequest) ([]dto.Message, error) {
	var messages []dto.Message

	if len(req.Instructions) > 0 {
		systemText := string(req.Instructions)
		if common.GetJsonType(req.Instructions) == "string" {
			var s string
			if err := common.Unmarshal(req.Instructions, &s); err == nil {
				systemText = s
			}
		}
		systemText = strings.TrimSpace(systemText)
		if systemText != "" {
			messages = append(messages, dto.Message{
				Role:    "system",
				Content: systemText,
			})
		}
	}

	if req.Input == nil {
		return messages, errors.New("input is required")
	}

	switch common.GetJsonType(req.Input) {
	case "string":
		var s string
		if err := common.Unmarshal(req.Input, &s); err != nil {
			return nil, err
		}
		messages = append(messages, dto.Message{
			Role:    "user",
			Content: s,
		})
	case "array":
		var items []map[string]any
		if err := common.Unmarshal(req.Input, &items); err != nil {
			return nil, err
		}
		for _, item := range items {
			role := "user"
			if v, ok := item["role"].(string); ok && strings.TrimSpace(v) != "" {
				role = strings.TrimSpace(v)
				if role == "developer" {
					role = "system"
				}
			}

			if content, ok := item["content"]; ok {
				msgContent, err := responsesContentToMessageContent(content)
				if err != nil {
					return nil, err
				}
				if msgContent == nil {
					continue
				}
				messages = append(messages, dto.Message{
					Role:    role,
					Content: msgContent,
				})
				continue
			}

			if itemType, ok := item["type"].(string); ok && itemType != "" {
				msgContent, err := responsesInputItemToMessageContent(itemType, item)
				if err != nil {
					return nil, err
				}
				if msgContent == nil {
					continue
				}
				messages = append(messages, dto.Message{
					Role:    role,
					Content: msgContent,
				})
			}
		}
	default:
		return nil, fmt.Errorf("invalid input type: %s", common.GetJsonType(req.Input))
	}

	return messages, nil
}

func responsesContentToMessageContent(content any) (any, error) {
	switch v := content.(type) {
	case string:
		return v, nil
	case []any:
		media := make([]dto.MediaContent, 0, len(v))
		for _, part := range v {
			partMap, ok := part.(map[string]any)
			if !ok {
				continue
			}
			item, err := responsesContentItemToMediaContent(partMap)
			if err != nil {
				return nil, err
			}
			if item.Type != "" {
				media = append(media, item)
			}
		}
		if len(media) == 1 && media[0].Type == dto.ContentTypeText {
			return media[0].Text, nil
		}
		if len(media) > 0 {
			return media, nil
		}
		return nil, nil
	default:
		// best-effort: try to marshal/unmarshal to string
		if b, err := common.Marshal(v); err == nil {
			return string(b), nil
		}
		return nil, nil
	}
}

func responsesContentItemToMediaContent(part map[string]any) (dto.MediaContent, error) {
	t, _ := part["type"].(string)
	switch t {
	case "input_text":
		text, _ := part["text"].(string)
		return dto.MediaContent{
			Type: dto.ContentTypeText,
			Text: text,
		}, nil
	case "input_image":
		return dto.MediaContent{
			Type:     dto.ContentTypeImageURL,
			ImageUrl: parseResponsesImageURL(part["image_url"], part["detail"]),
		}, nil
	case "input_audio":
		if audio, ok := part["input_audio"].(map[string]any); ok {
			data, _ := audio["data"].(string)
			format, _ := audio["format"].(string)
			return dto.MediaContent{
				Type: dto.ContentTypeInputAudio,
				InputAudio: &dto.MessageInputAudio{
					Data:   data,
					Format: format,
				},
			}, nil
		}
	case "input_file":
		if file, ok := part["file"].(map[string]any); ok {
			msgFile := &dto.MessageFile{}
			if fileID, ok := file["file_id"].(string); ok {
				msgFile.FileId = fileID
			}
			if fileName, ok := file["filename"].(string); ok {
				msgFile.FileName = fileName
			}
			if fileData, ok := file["file_data"].(string); ok {
				msgFile.FileData = fileData
			}
			if fileURL, ok := file["file_url"].(string); ok && msgFile.FileData == "" {
				msgFile.FileData = fileURL
			}
			return dto.MediaContent{
				Type: dto.ContentTypeFile,
				File: msgFile,
			}, nil
		}
	case "input_video":
		if url, ok := part["video_url"].(string); ok {
			return dto.MediaContent{
				Type: dto.ContentTypeVideoUrl,
				VideoUrl: &dto.MessageVideoUrl{
					Url: url,
				},
			}, nil
		}
	}
	return dto.MediaContent{}, nil
}

func responsesInputItemToMessageContent(itemType string, item map[string]any) (any, error) {
	switch itemType {
	case "input_text":
		if text, ok := item["text"].(string); ok {
			return text, nil
		}
	case "input_image":
		media := dto.MediaContent{
			Type:     dto.ContentTypeImageURL,
			ImageUrl: parseResponsesImageURL(item["image_url"], item["detail"]),
		}
		return []dto.MediaContent{media}, nil
	case "input_audio":
		media, err := responsesContentItemToMediaContent(item)
		if err != nil {
			return nil, err
		}
		if media.Type != "" {
			return []dto.MediaContent{media}, nil
		}
	case "input_file":
		media, err := responsesContentItemToMediaContent(item)
		if err != nil {
			return nil, err
		}
		if media.Type != "" {
			return []dto.MediaContent{media}, nil
		}
	}
	return nil, nil
}

func parseResponsesImageURL(image any, detail any) *dto.MessageImageUrl {
	msg := &dto.MessageImageUrl{}
	switch v := image.(type) {
	case string:
		msg.Url = v
	case map[string]any:
		if url, ok := v["url"].(string); ok {
			msg.Url = url
		}
		if det, ok := v["detail"].(string); ok {
			msg.Detail = det
		}
	}
	if msg.Detail == "" {
		if det, ok := detail.(string); ok {
			msg.Detail = det
		}
	}
	return msg
}

func responsesToolsToChatTools(raw json.RawMessage) []dto.ToolCallRequest {
	if len(raw) == 0 {
		return nil
	}
	var tools []map[string]any
	if err := common.Unmarshal(raw, &tools); err != nil {
		return nil
	}
	out := make([]dto.ToolCallRequest, 0, len(tools))
	for _, tool := range tools {
		toolType := common.Interface2String(tool["type"])
		if toolType == "" {
			continue
		}
		if toolType == "function" {
			fnName, _ := tool["name"].(string)
			desc, _ := tool["description"].(string)
			params := tool["parameters"]
			out = append(out, dto.ToolCallRequest{
				Type: toolType,
				Function: dto.FunctionRequest{
					Name:        fnName,
					Description: desc,
					Parameters:  params,
				},
			})
			continue
		}
		if b, err := common.Marshal(tool); err == nil {
			out = append(out, dto.ToolCallRequest{
				Type:   toolType,
				Custom: b,
			})
		}
	}
	return out
}

func responsesToolChoiceToChatToolChoice(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	var v any
	if err := common.Unmarshal(raw, &v); err == nil {
		return v
	}
	return nil
}

func parseResponsesTextFormat(raw json.RawMessage) *dto.ResponseFormat {
	var wrapper map[string]any
	if err := common.Unmarshal(raw, &wrapper); err != nil {
		return nil
	}
	format, ok := wrapper["format"]
	if !ok {
		return nil
	}
	b, err := common.Marshal(format)
	if err != nil {
		return nil
	}
	var rf dto.ResponseFormat
	if err := common.Unmarshal(b, &rf); err != nil {
		return nil
	}
	if rf.Type == "" {
		return nil
	}
	return &rf
}
