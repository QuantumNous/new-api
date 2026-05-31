package openaicompat

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
)

func ResponsesRequestToChatCompletionsRequest(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	if req == nil {
		return nil, errors.New("request is nil")
	}
	if req.Model == "" {
		return nil, errors.New("model is required")
	}

	messages := make([]dto.Message, 0)

	// instructions → system message
	if req.Instructions != nil {
		var instructions string
		if common.GetJsonType(req.Instructions) == "string" {
			_ = common.Unmarshal(req.Instructions, &instructions)
		}
		if strings.TrimSpace(instructions) != "" {
			messages = append(messages, dto.Message{
				Role:    "system",
				Content: instructions,
			})
		}
	}

	// input → messages
	inputMessages, err := convertResponsesInputToMessages(req.Input)
	if err != nil {
		return nil, fmt.Errorf("failed to convert input: %w", err)
	}
	messages = append(messages, inputMessages...)

	// tools → ChatCompletions tools format
	var tools []dto.ToolCallRequest
	if req.Tools != nil {
		chatTools, err := convertResponsesToolsToChatTools(req.Tools)
		if err != nil {
			return nil, fmt.Errorf("failed to convert tools: %w", err)
		}
		tools = chatTools
	}

	// tool_choice → ChatCompletions tool_choice (only if tools are present)
	var toolChoice any
	if req.ToolChoice != nil && len(tools) > 0 {
		toolChoice = convertResponsesToolChoiceToChatToolChoice(req.ToolChoice)
	}

	// text → response_format
	var responseFormat *dto.ResponseFormat
	if req.Text != nil {
		responseFormat = convertResponsesTextToResponseFormat(req.Text)
	}

	// max_output_tokens → max_completion_tokens
	var maxCompletionTokens *uint
	if req.MaxOutputTokens != nil {
		maxCompletionTokens = req.MaxOutputTokens
	}

	// reasoning → reasoning_effort
	reasoningEffort := ""
	if req.Reasoning != nil && req.Reasoning.Effort != "" {
		reasoningEffort = req.Reasoning.Effort
	}

	// parallel_tool_calls → *bool
	var parallelToolCalls *bool
	if req.ParallelToolCalls != nil {
		var ptc bool
		if err := common.Unmarshal(req.ParallelToolCalls, &ptc); err == nil {
			parallelToolCalls = &ptc
		}
	}

	// user
	var user json.RawMessage
	if req.User != nil {
		user = req.User
	}

	out := &dto.GeneralOpenAIRequest{
		Model:               req.Model,
		Messages:            messages,
		Stream:              req.Stream,
		Temperature:         req.Temperature,
		TopP:                req.TopP,
		MaxCompletionTokens: maxCompletionTokens,
		ReasoningEffort:     reasoningEffort,
		Tools:               tools,
		ToolChoice:          toolChoice,
		ResponseFormat:      responseFormat,
		User:                user,
		ParallelTooCalls:    parallelToolCalls,
	}

	return out, nil
}

// pendingCall tracks function_call items that need to be flushed.
type pendingCall struct {
	ID   string
	Name string
	Args string
}

func convertResponsesInputToMessages(input json.RawMessage) ([]dto.Message, error) {
	if input == nil {
		return nil, nil
	}

	jsonType := common.GetJsonType(input)

	// Simple string input → single user message
	if jsonType == "string" {
		var str string
		_ = common.Unmarshal(input, &str)
		return []dto.Message{
			{Role: "user", Content: str},
		}, nil
	}

	// Array of items
	if jsonType != "array" {
		return nil, nil
	}

	var items []map[string]any
	if err := common.Unmarshal(input, &items); err != nil {
		return nil, fmt.Errorf("failed to unmarshal input array: %w", err)
	}

	messages := make([]dto.Message, 0)

	// Track pending function calls and their responses
	var pendingCalls []pendingCall
	respondedIDs := make(map[string]bool)
	pendingReasoning := ""

	// flushPendingCalls emits pending function_calls whose IDs have been responded to,
	// then appends the corresponding tool messages.
	flushPendingCalls := func() {
		if len(pendingCalls) == 0 {
			return
		}
		var resolved []pendingCall
		var remaining []pendingCall
		for _, pc := range pendingCalls {
			if respondedIDs[pc.ID] {
				resolved = append(resolved, pc)
			} else {
				remaining = append(remaining, pc)
			}
		}
		if len(resolved) > 0 {
			toolCalls := make([]dto.ToolCallRequest, 0, len(resolved))
			for _, pc := range resolved {
				args := pc.Args
				if args == "" {
					args = "{}"
				}
				toolCalls = append(toolCalls, dto.ToolCallRequest{
					ID:   pc.ID,
					Type: "function",
					Function: dto.FunctionRequest{
						Name:      pc.Name,
						Arguments: args,
					},
				})
			}
			msg := dto.Message{
				Role:    "assistant",
				Content: nil,
			}
			msg.SetToolCalls(toolCalls)
			// DeepSeek thinking mode requires reasoning_content on tool call messages
			reasoningText := pendingReasoning
			if reasoningText == "" {
				reasoningText = "Tool calls."
			}
			msg.ReasoningContent = &reasoningText
			pendingReasoning = ""
			messages = append(messages, msg)
		}
		pendingCalls = remaining
	}

	for _, item := range items {
		itemType, _ := item["type"].(string)

		switch itemType {
		case "reasoning":
			// Cache reasoning text, attach to next assistant message
			content, _ := item["content"].([]any)
			var texts []string
			for _, partAny := range content {
				part, ok := partAny.(map[string]any)
				if !ok {
					continue
				}
				if txt, ok := part["text"].(string); ok && txt != "" {
					texts = append(texts, txt)
				}
			}
			if len(texts) > 0 {
				pendingReasoning = strings.Join(texts, "\n")
			}

		case "function_call":
			callID, _ := item["call_id"].(string)
			if callID == "" {
				callID, _ = item["id"].(string)
			}
			if callID == "" {
				continue
			}
			name, _ := item["name"].(string)
			args, _ := item["arguments"].(string)
			pendingCalls = append(pendingCalls, pendingCall{
				ID:   callID,
				Name: name,
				Args: args,
			})

		case "function_call_output":
			callID, _ := item["call_id"].(string)
			if callID == "" {
				continue
			}
			respondedIDs[callID] = true
			flushPendingCalls()

			output := item["output"]
			outputStr := ""
			switch v := output.(type) {
			case string:
				outputStr = v
			default:
				if b, err := common.Marshal(output); err == nil {
					outputStr = string(b)
				}
			}
			messages = append(messages, dto.Message{
				Role:       "tool",
				Content:    outputStr,
				ToolCallId: callID,
			})

		default:
			// Flush pending calls before non-function_call messages
			flushPendingCalls()

			role, _ := item["role"].(string)
			role = normalizeResponsesRole(role)
			if role == "" {
				continue
			}

			content := item["content"]
			msg := dto.Message{Role: role}

			// name field
			if n, ok := item["name"].(string); ok && n != "" {
				msg.Name = &n
			}

			// tool_call_id
			if tcid, ok := item["tool_call_id"].(string); ok && tcid != "" {
				msg.ToolCallId = tcid
			}

			switch v := content.(type) {
			case string:
				msg.Content = v
			case []any:
				mediaContents := make([]dto.MediaContent, 0, len(v))
				for _, partAny := range v {
					part, ok := partAny.(map[string]any)
					if !ok {
						continue
					}
					partType, _ := part["type"].(string)
					switch partType {
					case "input_text", "output_text":
						text, _ := part["text"].(string)
						mediaContents = append(mediaContents, dto.MediaContent{
							Type: dto.ContentTypeText,
							Text: text,
						})
					case "input_image":
						mediaContents = append(mediaContents, dto.MediaContent{
							Type:     dto.ContentTypeImageURL,
							ImageUrl: normalizeResponsesImageURL(part),
						})
					case "input_audio":
						mediaContents = append(mediaContents, dto.MediaContent{
							Type:       dto.ContentTypeInputAudio,
							InputAudio: part["input_audio"],
						})
					case "input_file":
						mediaContents = append(mediaContents, dto.MediaContent{
							Type: dto.ContentTypeFile,
							File: part["file"],
						})
					case "input_video":
						mediaContents = append(mediaContents, dto.MediaContent{
							Type:     dto.ContentTypeVideoUrl,
							VideoUrl: part["video_url"],
						})
					default:
						text, _ := part["text"].(string)
						mediaContents = append(mediaContents, dto.MediaContent{
							Type: partType,
							Text: text,
						})
					}
				}
				if len(mediaContents) == 1 && mediaContents[0].Type == dto.ContentTypeText {
					msg.Content = mediaContents[0].Text
				} else {
					msg.Content = mediaContents
				}
			default:
				if content != nil {
					if b, err := common.Marshal(content); err == nil {
						msg.Content = string(b)
					}
				}
			}

			// Attach cached reasoning to assistant message
			if role == "assistant" && pendingReasoning != "" {
				msg.ReasoningContent = &pendingReasoning
				pendingReasoning = ""
			}

			// tool_calls from the input item itself (legacy format)
			if tcRaw, ok := item["tool_calls"]; ok {
				if tcBytes, err := common.Marshal(tcRaw); err == nil {
					msg.ToolCalls = tcBytes
				}
			}

			messages = append(messages, msg)
		}
	}

	// Flush remaining pending calls
	flushPendingCalls()

	// If there are still unresolved function_calls (no matching output seen),
	// flush them as an assistant message with tool_calls
	if len(pendingCalls) > 0 {
		toolCalls := make([]dto.ToolCallRequest, 0, len(pendingCalls))
		for _, pc := range pendingCalls {
			args := pc.Args
			if args == "" {
				args = "{}"
			}
			toolCalls = append(toolCalls, dto.ToolCallRequest{
				ID:   pc.ID,
				Type: "function",
				Function: dto.FunctionRequest{
					Name:      pc.Name,
					Arguments: args,
				},
			})
		}
		msg := dto.Message{
			Role:    "assistant",
			Content: "",
		}
		msg.SetToolCalls(toolCalls)
		messages = append(messages, msg)
		pendingCalls = nil
	}

	// Trailing pending reasoning -> last assistant message
	if pendingReasoning != "" {
		for i := len(messages) - 1; i >= 0; i-- {
			if messages[i].Role == "assistant" && messages[i].ReasoningContent == nil {
				messages[i].ReasoningContent = &pendingReasoning
				break
			}
		}
		pendingReasoning = ""
	}

	return messages, nil
}

func convertResponsesToolsToChatTools(tools json.RawMessage) ([]dto.ToolCallRequest, error) {
	if tools == nil {
		return nil, nil
	}

	var items []map[string]any
	if err := common.Unmarshal(tools, &items); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tools: %w", err)
	}

	chatTools := make([]dto.ToolCallRequest, 0, len(items))
	for _, item := range items {
		itemType, _ := item["type"].(string)
		if itemType != "function" {
			continue
		}
		name, _ := item["name"].(string)
		desc, _ := item["description"].(string)
		params := item["parameters"]
		var strict *bool
		if s, ok := item["strict"].(bool); ok {
			strict = &s
		}

		// Normalize parameters: ensure it's a valid JSON Schema with type:"object" and properties
		params = normalizeToolParameters(params)

		chatTools = append(chatTools, dto.ToolCallRequest{
			Type:     "function",
			Function: dto.FunctionRequest{Name: name, Description: desc, Parameters: params, Strict: strict},
		})
	}

	return chatTools, nil
}

// normalizeToolParameters ensures the tool parameters conform to the expected JSON Schema format
// with type:"object" and a properties field, as required by most Chat Completions providers.
func normalizeToolParameters(params any) any {
	if params == nil {
		return map[string]any{"type": "object", "properties": map[string]any{}}
	}
	pMap, ok := params.(map[string]any)
	if !ok {
		return map[string]any{"type": "object", "properties": map[string]any{}}
	}
	pType, _ := pMap["type"].(string)
	if pType == "" {
		pMap["type"] = "object"
	}
	if _, hasProps := pMap["properties"]; !hasProps {
		pMap["properties"] = map[string]any{}
	}
	return pMap
}

func convertResponsesToolChoiceToChatToolChoice(toolChoice json.RawMessage) any {
	if toolChoice == nil {
		return nil
	}

	// Try string first
	if common.GetJsonType(toolChoice) == "string" {
		var str string
		_ = common.Unmarshal(toolChoice, &str)
		return str
	}

	// Try object
	var m map[string]any
	if err := common.Unmarshal(toolChoice, &m); err != nil {
		return toolChoice
	}

	t, _ := m["type"].(string)
	switch t {
	case "function":
		// Responses: {"type":"function","name":"X"} → Chat: {"type":"function","function":{"name":"X"}}
		name, _ := m["name"].(string)
		if name != "" {
			return map[string]any{
				"type":     "function",
				"function": map[string]any{"name": name},
			}
		}
		return toolChoice
	default:
		return toolChoice
	}
}

func convertResponsesTextToResponseFormat(text json.RawMessage) *dto.ResponseFormat {
	if text == nil {
		return nil
	}

	var textObj map[string]any
	if err := common.Unmarshal(text, &textObj); err != nil {
		return nil
	}

	formatAny, ok := textObj["format"]
	if !ok {
		return nil
	}

	formatMap, ok := formatAny.(map[string]any)
	if !ok {
		return nil
	}

	formatType, _ := formatMap["type"].(string)
	if formatType == "" {
		return nil
	}

	rf := &dto.ResponseFormat{Type: formatType}

	if formatType == "json_schema" {
		schemaMap := make(map[string]any)
		for k, v := range formatMap {
			if k == "type" {
				continue
			}
			schemaMap[k] = v
		}
		if len(schemaMap) > 0 {
			schemaJSON, err := common.Marshal(schemaMap)
			if err == nil {
				rf.JsonSchema = schemaJSON
			}
		}
	}

	return rf
}

// normalizeResponsesImageURL handles both direct image_url fields and source.base64 format.
func normalizeResponsesImageURL(part map[string]any) any {
	// Try direct image_url or url fields first
	if imgURL, ok := part["image_url"]; ok && imgURL != nil {
		return normalizeImageURLValue(imgURL)
	}
	if url, ok := part["url"]; ok && url != nil {
		return normalizeImageURLValue(url)
	}
	// Try source.base64 format
	if source, ok := part["source"].(map[string]any); ok {
		if sType, _ := source["type"].(string); sType == "base64" {
			mediaType, _ := source["media_type"].(string)
			data, _ := source["data"].(string)
			if mediaType != "" && data != "" {
				return &dto.MessageImageUrl{Url: "data:" + mediaType + ";base64," + data}
			}
		}
	}
	return nil
}

func normalizeImageURLValue(v any) any {
	switch vv := v.(type) {
	case string:
		return &dto.MessageImageUrl{Url: vv}
	case map[string]any:
		url, _ := vv["url"].(string)
		detail, _ := vv["detail"].(string)
		return &dto.MessageImageUrl{Url: url, Detail: lo.CoalesceOrEmpty(detail, "high")}
	default:
		return v
	}
}

func normalizeResponsesRole(role string) string {
	switch role {
	case "developer":
		return "system"
	default:
		return role
	}
}
