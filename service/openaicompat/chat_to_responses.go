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

func normalizeChatImageURLToString(v any) any {
	switch vv := v.(type) {
	case string:
		return vv
	case map[string]any:
		if url := common.Interface2String(vv["url"]); url != "" {
			return url
		}
		return v
	case dto.MessageImageUrl:
		if vv.Url != "" {
			return vv.Url
		}
		return v
	case *dto.MessageImageUrl:
		if vv != nil && vv.Url != "" {
			return vv.Url
		}
		return v
	default:
		return v
	}
}

func convertChatResponseFormatToResponsesText(reqFormat *dto.ResponseFormat) json.RawMessage {
	if reqFormat == nil || strings.TrimSpace(reqFormat.Type) == "" {
		return nil
	}

	format := map[string]any{
		"type": reqFormat.Type,
	}

	if reqFormat.Type == "json_schema" && len(reqFormat.JsonSchema) > 0 {
		var chatSchema map[string]any
		if err := common.Unmarshal(reqFormat.JsonSchema, &chatSchema); err == nil {
			for key, value := range chatSchema {
				if key == "type" {
					continue
				}
				format[key] = value
			}

			if nested, ok := format["json_schema"].(map[string]any); ok {
				for key, value := range nested {
					if _, exists := format[key]; !exists {
						format[key] = value
					}
				}
				delete(format, "json_schema")
			}
		} else {
			format["json_schema"] = reqFormat.JsonSchema
		}
	}

	textRaw, _ := common.Marshal(map[string]any{
		"format": format,
	})
	return textRaw
}

func ChatCompletionsRequestToResponsesRequest(req *dto.GeneralOpenAIRequest) (*dto.OpenAIResponsesRequest, error) {
	if req == nil {
		return nil, errors.New("request is nil")
	}
	if req.Model == "" {
		return nil, errors.New("model is required")
	}
	if lo.FromPtrOr(req.N, 1) > 1 {
		return nil, fmt.Errorf("n>1 is not supported in responses compatibility mode")
	}

	var instructionsParts []string
	inputItems := make([]map[string]any, 0, len(req.Messages))

	for _, msg := range req.Messages {
		role := strings.TrimSpace(msg.Role)
		if role == "" {
			continue
		}

		if role == "tool" || role == "function" {
			callID := strings.TrimSpace(msg.ToolCallId)

			var output any
			if msg.Content == nil {
				output = ""
			} else if msg.IsStringContent() {
				output = msg.StringContent()
			} else {
				if b, err := common.Marshal(msg.Content); err == nil {
					output = string(b)
				} else {
					output = fmt.Sprintf("%v", msg.Content)
				}
			}

			if callID == "" {
				inputItems = append(inputItems, map[string]any{
					"role":    "user",
					"content": fmt.Sprintf("[tool_output_missing_call_id] %v", output),
				})
				continue
			}

			inputItems = append(inputItems, map[string]any{
				"type":    "function_call_output",
				"call_id": callID,
				"output":  output,
			})
			continue
		}

		// Prefer mapping system/developer messages into `instructions`.
		if role == "system" || role == "developer" {
			if msg.Content == nil {
				continue
			}
			if msg.IsStringContent() {
				if s := strings.TrimSpace(msg.StringContent()); s != "" {
					instructionsParts = append(instructionsParts, s)
				}
				continue
			}
			parts := msg.ParseContent()
			var sb strings.Builder
			for _, part := range parts {
				if part.Type == dto.ContentTypeText && strings.TrimSpace(part.Text) != "" {
					if sb.Len() > 0 {
						sb.WriteString("\n")
					}
					sb.WriteString(part.Text)
				}
			}
			if s := strings.TrimSpace(sb.String()); s != "" {
				instructionsParts = append(instructionsParts, s)
			}
			continue
		}

		item := map[string]any{
			"role": role,
		}

		if msg.Content == nil {
			item["content"] = ""
			inputItems = append(inputItems, item)

			if role == "assistant" {
				for _, tc := range msg.ParseToolCalls() {
					if strings.TrimSpace(tc.ID) == "" {
						continue
					}
					if tc.Type != "" && tc.Type != "function" {
						continue
					}
					name := strings.TrimSpace(tc.Function.Name)
					if name == "" {
						continue
					}
					inputItems = append(inputItems, map[string]any{
						"type":      "function_call",
						"call_id":   tc.ID,
						"name":      name,
						"arguments": tc.Function.Arguments,
					})
				}
			}
			continue
		}

		if msg.IsStringContent() {
			item["content"] = msg.StringContent()
			inputItems = append(inputItems, item)

			if role == "assistant" {
				for _, tc := range msg.ParseToolCalls() {
					if strings.TrimSpace(tc.ID) == "" {
						continue
					}
					if tc.Type != "" && tc.Type != "function" {
						continue
					}
					name := strings.TrimSpace(tc.Function.Name)
					if name == "" {
						continue
					}
					inputItems = append(inputItems, map[string]any{
						"type":      "function_call",
						"call_id":   tc.ID,
						"name":      name,
						"arguments": tc.Function.Arguments,
					})
				}
			}
			continue
		}

		parts := msg.ParseContent()
		contentParts := make([]map[string]any, 0, len(parts))
		for _, part := range parts {
			switch part.Type {
			case dto.ContentTypeText:
				textType := "input_text"
				if role == "assistant" {
					textType = "output_text"
				}
				contentParts = append(contentParts, map[string]any{
					"type": textType,
					"text": part.Text,
				})
			case dto.ContentTypeImageURL:
				contentParts = append(contentParts, map[string]any{
					"type":      "input_image",
					"image_url": normalizeChatImageURLToString(part.ImageUrl),
				})
			case dto.ContentTypeInputAudio:
				contentParts = append(contentParts, map[string]any{
					"type":        "input_audio",
					"input_audio": part.InputAudio,
				})
			case dto.ContentTypeFile:
				contentParts = append(contentParts, map[string]any{
					"type": "input_file",
					"file": part.File,
				})
			case dto.ContentTypeVideoUrl:
				contentParts = append(contentParts, map[string]any{
					"type":      "input_video",
					"video_url": part.VideoUrl,
				})
			default:
				contentParts = append(contentParts, map[string]any{
					"type": part.Type,
				})
			}
		}
		item["content"] = contentParts
		inputItems = append(inputItems, item)

		if role == "assistant" {
			for _, tc := range msg.ParseToolCalls() {
				if strings.TrimSpace(tc.ID) == "" {
					continue
				}
				if tc.Type != "" && tc.Type != "function" {
					continue
				}
				name := strings.TrimSpace(tc.Function.Name)
				if name == "" {
					continue
				}
				inputItems = append(inputItems, map[string]any{
					"type":      "function_call",
					"call_id":   tc.ID,
					"name":      name,
					"arguments": tc.Function.Arguments,
				})
			}
		}
	}

	inputRaw, err := common.Marshal(inputItems)
	if err != nil {
		return nil, err
	}

	var instructionsRaw json.RawMessage
	if len(instructionsParts) > 0 {
		instructions := strings.Join(instructionsParts, "\n\n")
		instructionsRaw, _ = common.Marshal(instructions)
	}

	var toolsRaw json.RawMessage
	if req.Tools != nil {
		tools := make([]map[string]any, 0, len(req.Tools))
		for _, tool := range req.Tools {
			switch tool.Type {
			case "function":
				tools = append(tools, map[string]any{
					"type":        "function",
					"name":        tool.Function.Name,
					"description": tool.Function.Description,
					"parameters":  tool.Function.Parameters,
				})
			default:
				// Best-effort: keep original tool shape for unknown types.
				var m map[string]any
				if b, err := common.Marshal(tool); err == nil {
					_ = common.Unmarshal(b, &m)
				}
				if len(m) == 0 {
					m = map[string]any{"type": tool.Type}
				}
				tools = append(tools, m)
			}
		}
		toolsRaw, _ = common.Marshal(tools)
	}

	var toolChoiceRaw json.RawMessage
	if req.ToolChoice != nil {
		switch v := req.ToolChoice.(type) {
		case string:
			toolChoiceRaw, _ = common.Marshal(v)
		default:
			var m map[string]any
			if b, err := common.Marshal(v); err == nil {
				_ = common.Unmarshal(b, &m)
			}
			if m == nil {
				toolChoiceRaw, _ = common.Marshal(v)
			} else if t, _ := m["type"].(string); t == "function" {
				// Chat: {"type":"function","function":{"name":"..."}}
				// Responses: {"type":"function","name":"..."}
				if name, ok := m["name"].(string); ok && name != "" {
					toolChoiceRaw, _ = common.Marshal(map[string]any{
						"type": "function",
						"name": name,
					})
				} else if fn, ok := m["function"].(map[string]any); ok {
					if name, ok := fn["name"].(string); ok && name != "" {
						toolChoiceRaw, _ = common.Marshal(map[string]any{
							"type": "function",
							"name": name,
						})
					} else {
						toolChoiceRaw, _ = common.Marshal(v)
					}
				} else {
					toolChoiceRaw, _ = common.Marshal(v)
				}
			} else {
				toolChoiceRaw, _ = common.Marshal(v)
			}
		}
	}

	var parallelToolCallsRaw json.RawMessage
	if req.ParallelTooCalls != nil {
		parallelToolCallsRaw, _ = common.Marshal(*req.ParallelTooCalls)
	}

	textRaw := convertChatResponseFormatToResponsesText(req.ResponseFormat)

	maxOutputTokens := lo.FromPtrOr(req.MaxTokens, uint(0))
	maxCompletionTokens := lo.FromPtrOr(req.MaxCompletionTokens, uint(0))
	if maxCompletionTokens > maxOutputTokens {
		maxOutputTokens = maxCompletionTokens
	}
	// OpenAI Responses API rejects max_output_tokens < 16 when explicitly provided.
	//if maxOutputTokens > 0 && maxOutputTokens < 16 {
	//	maxOutputTokens = 16
	//}

	var topP *float64
	if req.TopP != nil {
		topP = common.GetPointer(lo.FromPtr(req.TopP))
	}

	out := &dto.OpenAIResponsesRequest{
		Model:             req.Model,
		Input:             inputRaw,
		Instructions:      instructionsRaw,
		Stream:            req.Stream,
		Temperature:       req.Temperature,
		Text:              textRaw,
		ToolChoice:        toolChoiceRaw,
		Tools:             toolsRaw,
		TopP:              topP,
		User:              req.User,
		ParallelToolCalls: parallelToolCallsRaw,
		Store:             req.Store,
		Metadata:          req.Metadata,
	}
	if req.MaxTokens != nil || req.MaxCompletionTokens != nil {
		out.MaxOutputTokens = lo.ToPtr(maxOutputTokens)
	}

	if req.ReasoningEffort != "" {
		out.Reasoning = &dto.Reasoning{
			Effort:  req.ReasoningEffort,
			Summary: "detailed",
		}
	}

	return out, nil
}

// ChatCompletionsResponseToResponsesResponse converts a non-streaming Chat
// Completions response into a Responses API response. It is the reverse of
// ResponsesResponseToChatCompletionsResponse and is used to serve
// Responses-only clients (e.g. Codex) from Chat-only upstreams.
func ChatCompletionsResponseToResponsesResponse(resp *dto.OpenAITextResponse, id string, toolCtx *dto.ResponsesToolContext) (*dto.OpenAIResponsesResponse, error) {
	if resp == nil {
		return nil, errors.New("response is nil")
	}

	var msg *dto.Message
	finishReason := ""
	if len(resp.Choices) > 0 {
		msg = &resp.Choices[0].Message
		finishReason = resp.Choices[0].FinishReason
	}

	output := make([]dto.ResponsesOutput, 0, 2)

	if msg != nil {
		reasoning, answer := chatMessageReasoningAndAnswer(msg)
		if reasoning != "" {
			output = append(output, dto.ResponsesOutput{
				Type:    "reasoning",
				ID:      "rs_" + id,
				Status:  "completed",
				Summary: []dto.ResponsesReasoningSummaryPart{{Type: "summary_text", Text: reasoning}},
			})
		}

		if answer != "" {
			output = append(output, dto.ResponsesOutput{
				Type:   "message",
				ID:     "msg_" + id,
				Status: "completed",
				Role:   "assistant",
				Content: []dto.ResponsesOutputContent{
					{Type: "output_text", Text: answer},
				},
			})
		}

		for _, tc := range msg.ParseToolCalls() {
			callID := strings.TrimSpace(tc.ID)
			name := strings.TrimSpace(tc.Function.Name)
			if callID == "" || name == "" {
				continue
			}
			output = append(output, toolCallItemToResponsesOutput(
				ResponseToolCallItem(callID, name, tc.Function.Arguments, toolCtx)))
		}
	}

	created := 0
	switch v := resp.Created.(type) {
	case int:
		created = v
	case int64:
		created = int(v)
	case float64:
		created = int(v)
	}

	out := &dto.OpenAIResponsesResponse{
		ID:        "resp_" + id,
		Object:    "response",
		CreatedAt: created,
		Status:    json.RawMessage(`"completed"`),
		Model:     resp.Model,
		Output:    output,
		Usage:     chatUsageToResponses(resp.Usage),
	}
	copyResponsesRequestFieldsToResponse(out, toolCtx)
	if finishReason == "length" {
		out.Status = json.RawMessage(`"incomplete"`)
		out.IncompleteDetails = &dto.IncompleteDetails{Reason: "max_output_tokens"}
	}

	return out, nil
}

func chatMessageReasoningAndAnswer(msg *dto.Message) (string, string) {
	if msg == nil {
		return "", ""
	}
	reasoning := strings.TrimSpace(msg.GetReasoningContent())
	answer := msg.StringContent()
	if inlineReasoning, inlineAnswer, ok := splitLeadingThinkBlock(answer); ok {
		if reasoning == "" {
			reasoning = inlineReasoning
		}
		answer = inlineAnswer
	}
	return strings.TrimSpace(reasoning), answer
}

// EnrichChatResponseReasoningDetails extracts non-standard reasoning_details
// only on the responses-via-chat return path. Keeping this out of dto.Message
// avoids changing ordinary /v1/chat/completions request passthrough behavior.
func EnrichChatResponseReasoningDetails(resp *dto.OpenAITextResponse, rawBody []byte) {
	if resp == nil || len(resp.Choices) == 0 || resp.Choices[0].Message.GetReasoningContent() != "" {
		return
	}
	var probe struct {
		Choices []struct {
			Message struct {
				ReasoningDetails json.RawMessage `json:"reasoning_details"`
			} `json:"message"`
		} `json:"choices"`
	}
	if common.Unmarshal(rawBody, &probe) != nil || len(probe.Choices) == 0 {
		return
	}
	if reasoning := reasoningDetailsText(probe.Choices[0].Message.ReasoningDetails); reasoning != "" {
		resp.Choices[0].Message.ReasoningContent = common.GetPointer(reasoning)
	}
}

func reasoningDetailsText(raw json.RawMessage) string {
	if len(raw) == 0 || common.GetJsonType(raw) == "null" {
		return ""
	}
	var value any
	if common.Unmarshal(raw, &value) != nil {
		return ""
	}
	var collect func(any) []string
	collect = func(current any) []string {
		switch typed := current.(type) {
		case string:
			if text := strings.TrimSpace(typed); text != "" {
				return []string{text}
			}
		case []any:
			var texts []string
			for _, item := range typed {
				texts = append(texts, collect(item)...)
			}
			return texts
		case map[string]any:
			for _, key := range []string{"summary", "text", "reasoning", "reasoning_content", "parts", "content"} {
				if child, ok := typed[key]; ok {
					if texts := collect(child); len(texts) > 0 {
						return texts
					}
				}
			}
		}
		return nil
	}
	return strings.Join(collect(value), "\n\n")
}

func splitLeadingThinkBlock(text string) (string, string, bool) {
	trimmed := strings.TrimLeft(text, " \t\r\n")
	if !strings.HasPrefix(trimmed, "<think>") {
		return "", text, false
	}
	rest := strings.TrimPrefix(trimmed, "<think>")
	end := strings.Index(rest, "</think>")
	if end < 0 {
		return "", text, false
	}
	reasoning := strings.TrimSpace(rest[:end])
	answer := strings.TrimLeft(rest[end+len("</think>"):], " \t\r\n")
	return reasoning, answer, true
}

func copyResponsesRequestFieldsToResponse(out *dto.OpenAIResponsesResponse, toolCtx *dto.ResponsesToolContext) {
	if out == nil || toolCtx == nil || toolCtx.OriginalRequest == nil {
		return
	}
	req := toolCtx.OriginalRequest
	out.Instructions = req.Instructions
	if req.PreviousResponseID != "" {
		out.PreviousResponseID = mustMarshalJSON(req.PreviousResponseID)
	}
	out.Reasoning = req.Reasoning
	out.ToolChoice = req.ToolChoice
	out.TopP = pointerFloatValue(req.TopP)
	out.Temperature = pointerFloatValue(req.Temperature)
	out.Metadata = req.Metadata
	if req.MaxOutputTokens != nil {
		out.MaxOutputTokens = int(*req.MaxOutputTokens)
	}
	if value, ok := responsesParallelToolCalls(req.ParallelToolCalls); ok {
		out.ParallelToolCalls = value
	}
	if len(req.Store) > 0 {
		_ = common.Unmarshal(req.Store, &out.Store)
	}
	if len(req.Truncation) > 0 {
		out.Truncation = req.Truncation
	}
	if len(req.User) > 0 {
		out.User = req.User
	}
	if len(req.Tools) > 0 {
		_ = common.Unmarshal(req.Tools, &out.Tools)
	}
}

func pointerFloatValue(value *float64) float64 {
	if value == nil {
		return 0
	}
	return *value
}

// toolCallItemToResponsesOutput converts a map-shaped tool-call item (from
// ResponseToolCallItem) into the typed ResponsesOutput for the non-stream response.
func toolCallItemToResponsesOutput(item map[string]any) dto.ResponsesOutput {
	out := dto.ResponsesOutput{
		Type:      mapGetString(item, "type"),
		ID:        mapGetString(item, "id"),
		Status:    mapGetString(item, "status"),
		CallId:    mapGetString(item, "call_id"),
		Name:      mapGetString(item, "name"),
		Namespace: mapGetString(item, "namespace"),
	}
	if args, ok := item["arguments"].(string); ok {
		out.Arguments = jsonStringRaw(args)
	}
	if input, ok := item["input"].(string); ok {
		out.Input = jsonStringRaw(input)
	}
	return out
}

// jsonStringRaw encodes a Go string as a JSON string value (json.RawMessage).
func jsonStringRaw(s string) json.RawMessage {
	b, err := common.Marshal(s)
	if err != nil {
		return nil
	}
	return b
}

// chatArgumentsToResponses encodes Chat tool-call arguments (a raw JSON string
// like `{"cmd":"ls"}`) into the Responses `arguments` field, which is a
// JSON-encoded string (e.g. "\"{\\\"cmd\\\":\\\"ls\\\"}\"").
func chatArgumentsToResponses(arguments string) json.RawMessage {
	if arguments == "" {
		arguments = "{}"
	}
	b, err := common.Marshal(arguments)
	if err != nil {
		return nil
	}
	return b
}

func chatUsageToResponses(u dto.Usage) *dto.Usage {
	out := &dto.Usage{
		PromptTokens:     u.PromptTokens,
		CompletionTokens: u.CompletionTokens,
		TotalTokens:      u.TotalTokens,
		InputTokens:      u.PromptTokens,
		OutputTokens:     u.CompletionTokens,
	}
	if out.TotalTokens == 0 {
		out.TotalTokens = out.PromptTokens + out.CompletionTokens
	}
	if u.PromptTokensDetails.CachedTokens != 0 || u.PromptTokensDetails.ImageTokens != 0 || u.PromptTokensDetails.AudioTokens != 0 {
		details := u.PromptTokensDetails
		out.InputTokensDetails = &details
	}
	out.CompletionTokenDetails = u.CompletionTokenDetails
	return out
}
