package openaicompat

import (
	"fmt"
	"encoding/json"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// ResponsesRequestToChatCompletionsRequest converts an OpenAI Responses API
// request into a Chat Completions API request.  This is the reverse of
// ChatCompletionsRequestToResponsesRequest and is used when the upstream
// channel only supports /v1/chat/completions but the client sent a
// /v1/responses request (e.g. Codex CLI).
func ResponsesRequestToChatCompletionsRequest(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	if req == nil {
		return nil, errors.New("request is nil")
	}
	if req.Model == "" {
		return nil, errors.New("model is required")
	}

	messages, err := responsesInputToMessages(req.Input)
	if err != nil {
		return nil, err
	}

	// Prepend instructions as system message.
	if len(req.Instructions) > 0 {
		var instructions string
		if err := common.Unmarshal(req.Instructions, &instructions); err == nil && strings.TrimSpace(instructions) != "" {
			systemMsg := dto.Message{
				Role:    "system",
				Content: instructions,
			}
			messages = append([]dto.Message{systemMsg}, messages...)
		}
	}

	out := &dto.GeneralOpenAIRequest{
		Model:    req.Model,
		Messages: messages,
		Stream:   req.Stream,
	}

	// max_output_tokens → max_tokens
	if req.MaxOutputTokens > 0 {
		out.MaxTokens = req.MaxOutputTokens
	}

	// temperature
	if req.Temperature != nil {
		out.Temperature = req.Temperature
	}

	// top_p
	if req.TopP != nil {
		out.TopP = *req.TopP
	}

	// reasoning → reasoning_effort
	if req.Reasoning != nil && req.Reasoning.Effort != "" {
		out.ReasoningEffort = req.Reasoning.Effort
	}

	// user
	if req.User != "" {
		out.User = req.User
	}

	// store
	if len(req.Store) > 0 {
		out.Store = req.Store
	}

	// metadata
	if len(req.Metadata) > 0 {
		out.Metadata = req.Metadata
	}

	// stream_options
	if req.StreamOptions != nil {
		out.StreamOptions = req.StreamOptions
	}

	// tools conversion: Responses tools → Chat Completions tools
	if len(req.Tools) > 0 {
		chatTools, toolErr := responsesToolsToChatTools(req.Tools)
		if toolErr == nil && len(chatTools) > 0 {
			out.Tools = chatTools
		}
	}

	// tool_choice
	if len(req.ToolChoice) > 0 {
		var toolChoice any
		if err := common.Unmarshal(req.ToolChoice, &toolChoice); err == nil {
			out.ToolChoice = toolChoice
		}
	}

	// parallel_tool_calls
	if len(req.ParallelToolCalls) > 0 {
		var ptc bool
		if err := common.Unmarshal(req.ParallelToolCalls, &ptc); err == nil {
			out.ParallelTooCalls = &ptc
		}
	}

	return out, nil
}

// responsesInputToMessages converts the Responses API `input` field
// (json.RawMessage) into a slice of Chat Completions messages.
func responsesInputToMessages(input json.RawMessage) ([]dto.Message, error) {
	if len(input) == 0 {
		return nil, nil
	}

	// Case 1: input is a plain string
	if common.GetJsonType(input) == "string" {
		var str string
		if err := common.Unmarshal(input, &str); err != nil {
			return nil, err
		}
		return []dto.Message{{Role: "user", Content: str}}, nil
	}

	// Case 2: input is an array
	if common.GetJsonType(input) != "array" {
		return nil, errors.New("unsupported input type")
	}

	var items []json.RawMessage
	if err := common.Unmarshal(input, &items); err != nil {
		return nil, err
	}

	var messages []dto.Message

	// pendingToolCalls accumulates consecutive function_call items so they
	// can be merged into a single assistant message (Chat Completions
	// requires all tool_calls for one turn in a single assistant message).
	var pendingToolCalls []dto.ToolCallResponse

	flushToolCalls := func() {
		if len(pendingToolCalls) == 0 {
			return
		}
		msg := dto.Message{Role: "assistant"}
		msg.SetToolCalls(pendingToolCalls)
		messages = append(messages, msg)
		pendingToolCalls = nil
	}

	for _, raw := range items {
		var item map[string]any
		if err := common.Unmarshal(raw, &item); err != nil {
			common.SysLog(fmt.Sprintf("skipping malformed Responses input item: %v", err))
			continue
		}

		itemType, _ := item["type"].(string)
		role, _ := item["role"].(string)

		switch {
		case itemType == "function_call":
			// Accumulate; will be flushed as a single assistant message.
			name, _ := item["name"].(string)
			callID, _ := item["call_id"].(string)
			arguments, _ := item["arguments"].(string)
			pendingToolCalls = append(pendingToolCalls, dto.ToolCallResponse{
				ID:   callID,
				Type: "function",
				Function: dto.FunctionResponse{
					Name:      name,
					Arguments: arguments,
				},
			})

		case itemType == "function_call_output":
			// Flush any pending tool calls before adding tool results.
			flushToolCalls()
			callID, _ := item["call_id"].(string)
			output, _ := item["output"].(string)
			messages = append(messages, dto.Message{
				Role:       "tool",
				Content:    output,
				ToolCallId: callID,
			})

		default:
			// Flush pending tool calls before any non-tool-call item.
			flushToolCalls()

			switch {
			case itemType == "message" || role != "":
				// message item → chat message
				if role == "" {
					role = "user"
				}
				content := convertResponsesContentToChat(item)
				messages = append(messages, dto.Message{
					Role:    role,
					Content: content,
				})

			case itemType == "input_text":
				// bare input_text
				text, _ := item["text"].(string)
				messages = append(messages, dto.Message{
					Role:    "user",
					Content: text,
				})

			case itemType == "input_image":
				// bare input_image → multimodal message
				imageUrl, _ := item["image_url"].(string)
				messages = append(messages, dto.Message{
					Role: "user",
					Content: []dto.MediaContent{
						{
							Type:     dto.ContentTypeImageURL,
							ImageUrl: &dto.MessageImageUrl{Url: imageUrl},
						},
					},
				})

			default:
				// Best effort: treat as user message with text content
				if content, ok := item["content"]; ok {
					messages = append(messages, dto.Message{
						Role:    cond(role != "", role, "user"),
						Content: content,
					})
				}
			}
		}
	}

	// Flush any remaining tool calls at the end of input.
	flushToolCalls()

	return messages, nil
}

// convertResponsesContentToChat extracts content from a responses message item
// and returns a suitable chat message content (string or []MediaContent).
func convertResponsesContentToChat(item map[string]any) any {
	contentRaw, ok := item["content"]
	if !ok {
		return ""
	}

	// content might be a string
	if str, ok := contentRaw.(string); ok {
		return str
	}

	// content might be an array of parts
	parts, ok := contentRaw.([]any)
	if !ok {
		return ""
	}

	var textParts []string
	var mediaContents []dto.MediaContent
	hasMedia := false

	for _, partAny := range parts {
		part, ok := partAny.(map[string]any)
		if !ok {
			continue
		}
		partType, _ := part["type"].(string)

		switch partType {
		case "input_text":
			text, _ := part["text"].(string)
			textParts = append(textParts, text)
			mediaContents = append(mediaContents, dto.MediaContent{
				Type: dto.ContentTypeText,
				Text: text,
			})
		case "output_text":
			text, _ := part["text"].(string)
			textParts = append(textParts, text)
			mediaContents = append(mediaContents, dto.MediaContent{
				Type: dto.ContentTypeText,
				Text: text,
			})
		case "input_image":
			hasMedia = true
			imageUrl, _ := part["image_url"].(string)
			mediaContents = append(mediaContents, dto.MediaContent{
				Type:     dto.ContentTypeImageURL,
				ImageUrl: &dto.MessageImageUrl{Url: imageUrl},
			})
		case "input_file":
			hasMedia = true
			fileUrl, _ := part["file_url"].(string)
			mediaContents = append(mediaContents, dto.MediaContent{
				Type: dto.ContentTypeFile,
				File: &dto.MessageFile{FileData: fileUrl},
			})
		default:
			if text, ok := part["text"].(string); ok {
				textParts = append(textParts, text)
				mediaContents = append(mediaContents, dto.MediaContent{
					Type: dto.ContentTypeText,
					Text: text,
				})
			}
		}
	}

	if hasMedia {
		return mediaContents
	}
	return strings.Join(textParts, "")
}

// responsesToolsToChatTools converts Responses API tool definitions to Chat
// Completions format.
func responsesToolsToChatTools(toolsRaw json.RawMessage) ([]dto.ToolCallRequest, error) {
	var tools []map[string]any
	if err := common.Unmarshal(toolsRaw, &tools); err != nil {
		return nil, err
	}

	var chatTools []dto.ToolCallRequest
	for _, tool := range tools {
		toolType, _ := tool["type"].(string)
		if toolType != "function" {
			// Skip built-in tools like web_search_preview, file_search, etc.
			continue
		}

		name, _ := tool["name"].(string)
		desc, _ := tool["description"].(string)

		var params any
		if p, ok := tool["parameters"]; ok {
			params = p
		}

		chatTools = append(chatTools, dto.ToolCallRequest{
			Type: "function",
			Function: dto.FunctionRequest{
				Name:        name,
				Description: desc,
				Parameters:  params,
			},
		})
	}
	return chatTools, nil
}

// cond returns t if b is true, f otherwise.  A simple ternary helper.
func cond(b bool, t, f string) string {
	if b {
		return t
	}
	return f
}
