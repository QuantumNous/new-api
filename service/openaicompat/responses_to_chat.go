package openaicompat

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func ResponsesResponseToChatCompletionsResponse(resp *dto.OpenAIResponsesResponse, id string) (*dto.OpenAITextResponse, *dto.Usage, error) {
	if resp == nil {
		return nil, nil, errors.New("response is nil")
	}

	text := ExtractOutputTextFromResponses(resp)

	usage := &dto.Usage{}
	if resp.Usage != nil {
		if resp.Usage.InputTokens != 0 {
			usage.PromptTokens = resp.Usage.InputTokens
			usage.InputTokens = resp.Usage.InputTokens
		}
		if resp.Usage.OutputTokens != 0 {
			usage.CompletionTokens = resp.Usage.OutputTokens
			usage.OutputTokens = resp.Usage.OutputTokens
		}
		if resp.Usage.TotalTokens != 0 {
			usage.TotalTokens = resp.Usage.TotalTokens
		} else {
			usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		}
		if resp.Usage.InputTokensDetails != nil {
			usage.PromptTokensDetails.CachedTokens = resp.Usage.InputTokensDetails.CachedTokens
			usage.PromptTokensDetails.ImageTokens = resp.Usage.InputTokensDetails.ImageTokens
			usage.PromptTokensDetails.AudioTokens = resp.Usage.InputTokensDetails.AudioTokens
		}
		if resp.Usage.CompletionTokenDetails.ReasoningTokens != 0 {
			usage.CompletionTokenDetails.ReasoningTokens = resp.Usage.CompletionTokenDetails.ReasoningTokens
		}
	}

	created := resp.CreatedAt

	var toolCalls []dto.ToolCallResponse
	if text == "" && len(resp.Output) > 0 {
		for _, out := range resp.Output {
			if out.Type != "function_call" {
				continue
			}
			name := strings.TrimSpace(out.Name)
			if name == "" {
				continue
			}
			callId := strings.TrimSpace(out.CallId)
			if callId == "" {
				callId = strings.TrimSpace(out.ID)
			}
			toolCalls = append(toolCalls, dto.ToolCallResponse{
				ID:   callId,
				Type: "function",
				Function: dto.FunctionResponse{
					Name:      name,
					Arguments: out.ArgumentsString(),
				},
			})
		}
	}

	finishReason := "stop"
	if len(toolCalls) > 0 {
		finishReason = "tool_calls"
	}

	msg := dto.Message{
		Role:    "assistant",
		Content: text,
	}
	if len(toolCalls) > 0 {
		msg.SetToolCalls(toolCalls)
		msg.Content = ""
	}

	out := &dto.OpenAITextResponse{
		Id:      id,
		Object:  "chat.completion",
		Created: created,
		Model:   resp.Model,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index:        0,
				Message:      msg,
				FinishReason: finishReason,
			},
		},
		Usage: *usage,
	}

	return out, usage, nil
}

func ExtractOutputTextFromResponses(resp *dto.OpenAIResponsesResponse) string {
	if resp == nil || len(resp.Output) == 0 {
		return ""
	}

	var sb strings.Builder

	// Prefer assistant message outputs.
	for _, out := range resp.Output {
		if out.Type != "message" {
			continue
		}
		if out.Role != "" && out.Role != "assistant" {
			continue
		}
		for _, c := range out.Content {
			if c.Type == "output_text" && c.Text != "" {
				sb.WriteString(c.Text)
			}
		}
	}
	if sb.Len() > 0 {
		return sb.String()
	}
	for _, out := range resp.Output {
		for _, c := range out.Content {
			if c.Text != "" {
				sb.WriteString(c.Text)
			}
		}
	}
	return sb.String()
}

// ResponsesRequestToChatCompletionsRequest translates the Responses-API shape
// into a Chat-Completions intermediate that can then be re-translated by the
// existing Chat -> Anthropic converter.
//
// It implements spec sections §3 through §10:
//   - input-shape normalization (string / empty / array / non-string-non-array)
//   - instructions lifting
//   - role-only fallback for item type
//   - message content normalization (input_text/output_text/input_image)
//   - function_call buffering into assistant tool_calls
//   - function_call_output -> role: "tool" with stringified non-string output
//   - reasoning item buffering -> attached as reasoning_content to next assistant
//   - tool declaration conversion (both Chat-Completions-shaped and Responses-flat)
//   - Responses-only field cleanup
//   - reasoning_effort carry
//   - text.format -> response_format carry
//
// Any other input shape (number, object) returns an error so the caller can
// decide whether to fall back to the existing adaptor stub.
func ResponsesRequestToChatCompletionsRequest(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	if req == nil {
		return nil, errors.New("request is nil")
	}

	out := &dto.GeneralOpenAIRequest{
		Model:       req.Model,
		Stream:      req.Stream,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		User:        req.User,
		Metadata:    req.Metadata,
		Store:       req.Store,
	}
	// max_output_tokens -> max_tokens (the field the Claude converter consumes).
	if req.MaxOutputTokens != nil {
		mt := *req.MaxOutputTokens
		out.MaxTokens = &mt
	}

	// reasoning.effort carry-through.
	if req.Reasoning != nil && strings.TrimSpace(req.Reasoning.Effort) != "" {
		out.ReasoningEffort = req.Reasoning.Effort
	}

	// text.format -> response_format. text JSON shape can be either
	//   { "format": { "type": "json_object" } }
	// or
	//   { "format": { "type": "json_schema", "json_schema": {...} } }
	// or
	//   { "format": { "type": "json_schema", "name": ..., "schema": ... } } (flat)
	if len(req.Text) > 0 {
		var textObj map[string]any
		if err := common.Unmarshal(req.Text, &textObj); err == nil {
			if fmtAny, ok := textObj["format"]; ok {
				if fmtMap, ok := fmtAny.(map[string]any); ok {
					rf := &dto.ResponseFormat{}
					if t, _ := fmtMap["type"].(string); t != "" {
						rf.Type = t
					}
					if rf.Type == "json_schema" {
						if schema, ok := fmtMap["json_schema"]; ok {
							if b, err := common.Marshal(schema); err == nil {
								rf.JsonSchema = b
							}
						} else {
							// Flat shape: merge name/schema/strict/description into a json_schema object.
							flat := map[string]any{}
							for k, v := range fmtMap {
								if k == "type" {
									continue
								}
								flat[k] = v
							}
							if len(flat) > 0 {
								if b, err := common.Marshal(flat); err == nil {
									rf.JsonSchema = b
								}
							}
						}
					}
					if rf.Type != "" {
						out.ResponseFormat = rf
					}
				}
			}
		}
	}

	// ----- Tool declarations -----
	if len(req.Tools) > 0 {
		var toolsRaw []map[string]any
		if err := common.Unmarshal(req.Tools, &toolsRaw); err == nil {
			converted := make([]dto.ToolCallRequest, 0, len(toolsRaw))
			for _, t := range toolsRaw {
				if t == nil {
					continue
				}
				toolType, _ := t["type"].(string)
				if toolType == "" {
					toolType = "function"
				}
				// Already Chat-Completions shape (has "function" key)?
				if fnAny, ok := t["function"]; ok {
					fnMap, _ := fnAny.(map[string]any)
					name, _ := fnMap["name"].(string)
					if strings.TrimSpace(name) == "" {
						continue
					}
					params := normalizeToolParameters(fnMap["parameters"])
					desc, _ := fnMap["description"].(string)
					converted = append(converted, dto.ToolCallRequest{
						Type: "function",
						Function: dto.FunctionRequest{
							Name:        name,
							Description: desc,
							Parameters:  params,
						},
					})
					continue
				}
				if toolType == "function" {
					name, _ := t["name"].(string)
					if strings.TrimSpace(name) == "" {
						continue
					}
					params := normalizeToolParameters(t["parameters"])
					desc, _ := t["description"].(string)
					converted = append(converted, dto.ToolCallRequest{
						Type: "function",
						Function: dto.FunctionRequest{
							Name:        name,
							Description: desc,
							Parameters:  params,
						},
					})
					continue
				}
				// Hosted / non-function tool with no name => drop silently.
				if name, _ := t["name"].(string); strings.TrimSpace(name) == "" {
					continue
				}
				// Preserve hosted tool with name as a custom tool stub. We
				// pass-through here using the raw map; the downstream Claude
				// converter only recognises `function` types and ignores
				// others, which keeps backwards behavior intact.
				if b, err := common.Marshal(t); err == nil {
					var stub dto.ToolCallRequest
					_ = common.Unmarshal(b, &stub)
					if stub.Type == "" {
						stub.Type = toolType
					}
					converted = append(converted, stub)
				}
			}
			if len(converted) > 0 {
				out.Tools = converted
			}
		}
	}

	// tool_choice pass-through (raw JSON -> any).
	if len(req.ToolChoice) > 0 {
		var any2 any
		if err := common.Unmarshal(req.ToolChoice, &any2); err == nil {
			// If the Responses-style {"type":"function","name":"x"} shape arrives,
			// reshape to Chat-Completions {"type":"function","function":{"name":"x"}}.
			if m, ok := any2.(map[string]any); ok {
				if t, _ := m["type"].(string); t == "function" {
					if _, has := m["function"]; !has {
						if name, _ := m["name"].(string); name != "" {
							any2 = map[string]any{
								"type":     "function",
								"function": map[string]any{"name": name},
							}
						}
					}
				}
			}
			out.ToolChoice = any2
		}
	}

	// parallel_tool_calls pass-through.
	if len(req.ParallelToolCalls) > 0 {
		var b bool
		if err := common.Unmarshal(req.ParallelToolCalls, &b); err == nil {
			out.ParallelTooCalls = &b
		}
	}

	// ----- Input normalization -----
	// instructions => leading system message.
	if len(req.Instructions) > 0 {
		var instr string
		if err := common.Unmarshal(req.Instructions, &instr); err == nil {
			if strings.TrimSpace(instr) != "" {
				out.Messages = append(out.Messages, dto.Message{
					Role:    "system",
					Content: instr,
				})
			}
		}
	}

	// Parse the input field.
	var inputItems []map[string]any
	if req.Input == nil || len(req.Input) == 0 {
		// Treat absent input as empty -> placeholder user message.
		inputItems = []map[string]any{
			{
				"type":    "message",
				"role":    "user",
				"content": []map[string]any{{"type": "input_text", "text": "..."}},
			},
		}
	} else {
		switch common.GetJsonType(req.Input) {
		case "string":
			var s string
			_ = common.Unmarshal(req.Input, &s)
			if strings.TrimSpace(s) == "" {
				s = "..."
			}
			inputItems = []map[string]any{
				{
					"type":    "message",
					"role":    "user",
					"content": []map[string]any{{"type": "input_text", "text": s}},
				},
			}
		case "array":
			if err := common.Unmarshal(req.Input, &inputItems); err != nil {
				return nil, fmt.Errorf("input array unmarshal: %w", err)
			}
			if len(inputItems) == 0 {
				inputItems = []map[string]any{
					{
						"type":    "message",
						"role":    "user",
						"content": []map[string]any{{"type": "input_text", "text": "..."}},
					},
				}
			}
		default:
			// Per spec §3, return error so caller can fall through.
			return nil, fmt.Errorf("unsupported input shape: %s", common.GetJsonType(req.Input))
		}
	}

	// Convert items, with buffering for reasoning and consecutive function_calls.
	var reasoningBuf []string
	flushReasoningInto := func(msg *dto.Message) {
		if len(reasoningBuf) == 0 {
			return
		}
		s := strings.Join(reasoningBuf, "\n")
		reasoningBuf = nil
		msg.ReasoningContent = &s
	}

	// Pending assistant tool_calls accumulator (so consecutive function_calls
	// collapse into one assistant message).
	var pendingAssistantToolCalls []dto.ToolCallRequest
	flushAssistantToolCalls := func() {
		if len(pendingAssistantToolCalls) == 0 {
			return
		}
		msg := dto.Message{
			Role: "assistant",
		}
		msg.SetNullContent()
		flushReasoningInto(&msg)
		msg.SetToolCalls(pendingAssistantToolCalls)
		out.Messages = append(out.Messages, msg)
		pendingAssistantToolCalls = nil
	}

	for _, item := range inputItems {
		if item == nil {
			continue
		}
		itemType, _ := item["type"].(string)
		role, _ := item["role"].(string)
		if itemType == "" && role != "" {
			itemType = "message"
		}
		if itemType == "" {
			// Neither type nor role -> skip per spec §5.
			continue
		}

		switch itemType {
		case "message":
			flushAssistantToolCalls()
			msg := dto.Message{Role: role}
			if msg.Role == "" {
				msg.Role = "user"
			}
			// Content can be string or array.
			contentAny, hasContent := item["content"]
			if !hasContent {
				msg.Content = ""
			} else {
				// Normalize to []any so we can walk it uniformly regardless of
				// whether it came from JSON unmarshal ([]any) or from in-process
				// construction ([]map[string]any).
				var parts []any
				switch cv := contentAny.(type) {
				case string:
					msg.Content = cv
					parts = nil
				case []any:
					parts = cv
				case []map[string]any:
					parts = make([]any, len(cv))
					for i := range cv {
						parts[i] = cv[i]
					}
				}
				if parts != nil {
					mc := convertResponsesContentParts(parts)
					if len(mc) == 0 {
						msg.Content = ""
					} else if len(mc) == 1 && mc[0].Type == dto.ContentTypeText {
						msg.Content = mc[0].Text
					} else {
						out2 := make([]any, 0, len(mc))
						for _, p := range mc {
							pm := map[string]any{"type": p.Type}
							switch p.Type {
							case dto.ContentTypeText:
								pm["text"] = p.Text
							case dto.ContentTypeImageURL:
								pm["image_url"] = p.ImageUrl
							}
							out2 = append(out2, pm)
						}
						msg.Content = out2
					}
				}
			}
			if msg.Role == "assistant" {
				flushReasoningInto(&msg)
			}
			out.Messages = append(out.Messages, msg)

		case "function_call":
			name, _ := item["name"].(string)
			if strings.TrimSpace(name) == "" {
				continue
			}
			callID, _ := item["call_id"].(string)
			argsStr := ""
			if raw, ok := item["arguments"]; ok {
				switch av := raw.(type) {
				case string:
					argsStr = av
				default:
					if b, err := common.Marshal(av); err == nil {
						argsStr = string(b)
					}
				}
			}
			pendingAssistantToolCalls = append(pendingAssistantToolCalls, dto.ToolCallRequest{
				ID:   callID,
				Type: "function",
				Function: dto.FunctionRequest{
					Name:      name,
					Arguments: argsStr,
				},
			})

		case "function_call_output":
			flushAssistantToolCalls()
			callID, _ := item["call_id"].(string)
			outputAny := item["output"]
			var output string
			switch ov := outputAny.(type) {
			case string:
				output = ov
			default:
				if b, err := common.Marshal(ov); err == nil {
					output = string(b)
				} else {
					output = fmt.Sprintf("%v", ov)
				}
			}
			out.Messages = append(out.Messages, dto.Message{
				Role:       "tool",
				Content:    output,
				ToolCallId: callID,
			})

		case "reasoning":
			text := extractReasoningItemText(item)
			if text != "" {
				reasoningBuf = append(reasoningBuf, text)
			}

		default:
			// Unknown item type: skip silently to match spec §5 forgiving stance.
			continue
		}
	}
	// End-of-input flush.
	flushAssistantToolCalls()

	// Strip Responses-only fields explicitly: input/instructions/include/
	// prompt_cache_key/store/reasoning/background are NOT carried over.
	// "store" is intentionally also dropped to keep the Chat intermediate clean.
	out.Store = nil

	return out, nil
}

// normalizeToolParameters ensures an object-typed schema has a `properties` key
// per spec §8.
func normalizeToolParameters(params any) any {
	if params == nil {
		return map[string]any{
			"type":       "object",
			"properties": map[string]any{},
		}
	}
	m, ok := params.(map[string]any)
	if !ok {
		return params
	}
	if t, _ := m["type"].(string); strings.EqualFold(t, "object") {
		if _, has := m["properties"]; !has {
			m["properties"] = map[string]any{}
		}
	}
	return m
}

func convertResponsesContentParts(parts []any) []dto.MediaContent {
	result := make([]dto.MediaContent, 0, len(parts))
	for _, p := range parts {
		pm, ok := p.(map[string]any)
		if !ok {
			continue
		}
		pt, _ := pm["type"].(string)
		switch pt {
		case "input_text", "output_text":
			if t, ok := pm["text"].(string); ok {
				result = append(result, dto.MediaContent{
					Type: dto.ContentTypeText,
					Text: t,
				})
			}
		case "input_image":
			detail, _ := pm["detail"].(string)
			if detail == "" {
				detail = "auto"
			}
			url := ""
			switch v := pm["image_url"].(type) {
			case string:
				url = v
			case map[string]any:
				if s, ok := v["url"].(string); ok {
					url = s
				}
			}
			if url == "" {
				if s, ok := pm["file_id"].(string); ok {
					url = s
				}
			}
			result = append(result, dto.MediaContent{
				Type: dto.ContentTypeImageURL,
				ImageUrl: map[string]any{
					"url":    url,
					"detail": detail,
				},
			})
		default:
			// Pass-through unknown types as a generic text block to keep the
			// converter forgiving.
			if t, _ := pm["text"].(string); t != "" {
				result = append(result, dto.MediaContent{
					Type: dto.ContentTypeText,
					Text: t,
				})
			}
		}
	}
	return result
}

// extractReasoningItemText pulls text out of a reasoning input item per spec §7.
// Priority: summary[].text joined with \n; else content[].text joined with \n; else "".
func extractReasoningItemText(item map[string]any) string {
	if item == nil {
		return ""
	}
	if sums, ok := item["summary"].([]any); ok && len(sums) > 0 {
		var b strings.Builder
		for _, s := range sums {
			sm, ok := s.(map[string]any)
			if !ok {
				continue
			}
			if t, _ := sm["text"].(string); t != "" {
				if b.Len() > 0 {
					b.WriteString("\n")
				}
				b.WriteString(t)
			}
		}
		if b.Len() > 0 {
			return b.String()
		}
	}
	if conts, ok := item["content"].([]any); ok && len(conts) > 0 {
		var b strings.Builder
		for _, c := range conts {
			cm, ok := c.(map[string]any)
			if !ok {
				continue
			}
			if t, _ := cm["text"].(string); t != "" {
				if b.Len() > 0 {
					b.WriteString("\n")
				}
				b.WriteString(t)
			}
		}
		if b.Len() > 0 {
			return b.String()
		}
	}
	return ""
}
