package openaicompat

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
)

// ResponsesRequestToChatCompletionsRequest converts a Responses API request into a
// Chat Completions request. It is the inverse of ChatCompletionsRequestToResponsesRequest
// and is used when the upstream channel only supports /v1/chat/completions but the
// client called /v1/responses.
func ResponsesRequestToChatCompletionsRequest(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	if req == nil {
		return nil, errors.New("request is nil")
	}
	if req.Model == "" {
		return nil, errors.New("model is required")
	}

	out := &dto.GeneralOpenAIRequest{
		Model:       req.Model,
		Stream:      req.Stream,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		User:        req.User,
		Store:       req.Store,
		Metadata:    req.Metadata,
	}

	if req.MaxOutputTokens != nil {
		out.MaxTokens = lo.ToPtr(*req.MaxOutputTokens)
	}

	// instructions => system/developer message at the very beginning.
	if instructions, ok := extractStringFromRaw(req.Instructions); ok && strings.TrimSpace(instructions) != "" {
		out.Messages = append(out.Messages, dto.Message{
			Role:    out.GetSystemRoleName(),
			Content: instructions,
		})
	}

	// Convert input items into chat messages.
	msgs, err := convertResponsesInputToMessages(req)
	if err != nil {
		return nil, err
	}
	out.Messages = append(out.Messages, msgs...)

	// tools
	if len(req.Tools) > 0 {
		var rawTools []map[string]any
		if err := common.Unmarshal(req.Tools, &rawTools); err == nil {
			tools := make([]dto.ToolCallRequest, 0, len(rawTools))
			for _, t := range rawTools {
				typeStr, _ := t["type"].(string)
				if typeStr != "function" {
					// Only function tools have a direct chat-completions analogue.
					continue
				}
				name, _ := t["name"].(string)
				if name == "" {
					if fn, ok := t["function"].(map[string]any); ok {
						name, _ = fn["name"].(string)
					}
				}
				if name == "" {
					continue
				}
				desc, _ := t["description"].(string)
				params := t["parameters"]
				if params == nil {
					if fn, ok := t["function"].(map[string]any); ok {
						params = fn["parameters"]
						if desc == "" {
							desc, _ = fn["description"].(string)
						}
					}
				}
				tools = append(tools, dto.ToolCallRequest{
					Type: "function",
					Function: dto.FunctionRequest{
						Name:        name,
						Description: desc,
						Parameters:  params,
					},
				})
			}
			if len(tools) > 0 {
				out.Tools = tools
			}
		}
	}

	// tool_choice: Responses {"type":"function","name":"x"} => Chat {"type":"function","function":{"name":"x"}}
	if len(req.ToolChoice) > 0 {
		if s, ok := extractStringFromRaw(req.ToolChoice); ok {
			out.ToolChoice = s
		} else {
			var m map[string]any
			if err := common.Unmarshal(req.ToolChoice, &m); err == nil && m != nil {
				if t, _ := m["type"].(string); t == "function" {
					if name, ok := m["name"].(string); ok && name != "" {
						out.ToolChoice = map[string]any{
							"type":     "function",
							"function": map[string]any{"name": name},
						}
					} else {
						out.ToolChoice = m
					}
				} else {
					out.ToolChoice = m
				}
			}
		}
	}

	if len(req.ParallelToolCalls) > 0 {
		var b bool
		if err := common.Unmarshal(req.ParallelToolCalls, &b); err == nil {
			out.ParallelTooCalls = lo.ToPtr(b)
		}
	}

	// text.format => response_format
	if rf := convertResponsesTextToChatResponseFormat(req.Text); rf != nil {
		out.ResponseFormat = rf
	}

	// reasoning => reasoning_effort (string form)
	if req.Reasoning != nil && strings.TrimSpace(req.Reasoning.Effort) != "" {
		out.ReasoningEffort = req.Reasoning.Effort
	}

	if req.StreamOptions != nil {
		out.StreamOptions = req.StreamOptions
	}

	return out, nil
}

func extractStringFromRaw(raw []byte) (string, bool) {
	if len(raw) == 0 {
		return "", false
	}
	if common.GetJsonType(raw) != "string" {
		return "", false
	}
	var s string
	if err := common.Unmarshal(raw, &s); err != nil {
		return "", false
	}
	return s, true
}

func convertResponsesTextToChatResponseFormat(raw []byte) *dto.ResponseFormat {
	if len(raw) == 0 {
		return nil
	}
	var wrapper map[string]any
	if err := common.Unmarshal(raw, &wrapper); err != nil {
		return nil
	}
	formatAny, ok := wrapper["format"]
	if !ok {
		return nil
	}
	format, ok := formatAny.(map[string]any)
	if !ok {
		return nil
	}
	typeStr, _ := format["type"].(string)
	if typeStr == "" {
		return nil
	}
	rf := &dto.ResponseFormat{Type: typeStr}
	if typeStr == "json_schema" {
		// Chat expects `json_schema` to be a sibling object containing schema/name/strict.
		inner := map[string]any{}
		for k, v := range format {
			if k == "type" {
				continue
			}
			inner[k] = v
		}
		if len(inner) > 0 {
			if b, err := common.Marshal(inner); err == nil {
				rf.JsonSchema = b
			}
		}
	}
	return rf
}

func convertResponsesInputToMessages(req *dto.OpenAIResponsesRequest) ([]dto.Message, error) {
	if req.Input == nil {
		return nil, nil
	}

	// A plain string input becomes a single user message.
	if common.GetJsonType(req.Input) == "string" {
		var s string
		if err := common.Unmarshal(req.Input, &s); err != nil {
			return nil, err
		}
		return []dto.Message{{Role: "user", Content: s}}, nil
	}

	// Array of input items.
	if common.GetJsonType(req.Input) != "array" {
		return nil, fmt.Errorf("unsupported responses input type")
	}

	var items []map[string]any
	if err := common.Unmarshal(req.Input, &items); err != nil {
		return nil, err
	}

	var messages []dto.Message
	// Buffer assistant tool_calls so they attach to the matching assistant turn.
	for _, item := range items {
		itemType, _ := item["type"].(string)

		switch itemType {
		case "function_call":
			callID, _ := item["call_id"].(string)
			if callID == "" {
				callID, _ = item["id"].(string)
			}
			name, _ := item["name"].(string)
			args, _ := item["arguments"].(string)
			tc := dto.ToolCallRequest{
				ID:   callID,
				Type: "function",
				Function: dto.FunctionRequest{
					Name:      name,
					Arguments: args,
				},
			}
			// Attach to the previous assistant message when possible, otherwise create one.
			if n := len(messages); n > 0 && messages[n-1].Role == "assistant" {
				existing := messages[n-1].ParseToolCalls()
				existing = append(existing, tc)
				messages[n-1].SetToolCalls(existing)
			} else {
				m := dto.Message{Role: "assistant"}
				m.SetNullContent()
				m.SetToolCalls([]dto.ToolCallRequest{tc})
				messages = append(messages, m)
			}
			continue

		case "function_call_output":
			callID, _ := item["call_id"].(string)
			output := item["output"]
			var contentStr string
			switch v := output.(type) {
			case string:
				contentStr = v
			case nil:
				contentStr = ""
			default:
				if b, err := common.Marshal(v); err == nil {
					contentStr = string(b)
				} else {
					contentStr = fmt.Sprintf("%v", v)
				}
			}
			messages = append(messages, dto.Message{
				Role:       "tool",
				Content:    contentStr,
				ToolCallId: callID,
			})
			continue
		}

		// Default: a chat-style message with role + content.
		role, _ := item["role"].(string)
		if role == "" {
			continue
		}
		msg := dto.Message{Role: role}
		contentAny, hasContent := item["content"]
		if !hasContent || contentAny == nil {
			msg.SetStringContent("")
			messages = append(messages, msg)
			continue
		}

		switch content := contentAny.(type) {
		case string:
			msg.SetStringContent(content)
		case []any:
			parts := convertResponsesContentParts(content, role)
			if len(parts) == 1 && parts[0].Type == dto.ContentTypeText {
				msg.SetStringContent(parts[0].Text)
			} else if len(parts) > 0 {
				msg.SetMediaContent(parts)
			} else {
				msg.SetStringContent("")
			}
		default:
			if b, err := common.Marshal(content); err == nil {
				msg.SetStringContent(string(b))
			}
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

func convertResponsesContentParts(parts []any, role string) []dto.MediaContent {
	out := make([]dto.MediaContent, 0, len(parts))
	for _, partAny := range parts {
		part, ok := partAny.(map[string]any)
		if !ok {
			continue
		}
		partType, _ := part["type"].(string)
		switch partType {
		case "input_text", "output_text", "text":
			text, _ := part["text"].(string)
			out = append(out, dto.MediaContent{Type: dto.ContentTypeText, Text: text})
		case "input_image":
			urlAny := part["image_url"]
			var url string
			switch v := urlAny.(type) {
			case string:
				url = v
			case map[string]any:
				url, _ = v["url"].(string)
			}
			if url != "" {
				out = append(out, dto.MediaContent{
					Type:     dto.ContentTypeImageURL,
					ImageUrl: &dto.MessageImageUrl{Url: url},
				})
			}
		case "input_audio":
			out = append(out, dto.MediaContent{
				Type:       dto.ContentTypeInputAudio,
				InputAudio: part["input_audio"],
			})
		case "input_file":
			out = append(out, dto.MediaContent{
				Type: dto.ContentTypeFile,
				File: part["file"],
			})
		case "input_video":
			urlAny := part["video_url"]
			var url string
			switch v := urlAny.(type) {
			case string:
				url = v
			case map[string]any:
				url, _ = v["url"].(string)
			}
			if url != "" {
				out = append(out, dto.MediaContent{
					Type:     dto.ContentTypeVideoUrl,
					VideoUrl: &dto.MessageVideoUrl{Url: url},
				})
			}
		}
	}
	return out
}
