package openaicompat

import (
	"encoding/json"
	"errors"
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

// responsesInputItem is the superset shape of a single Responses API `input` item.
// The public dto.Input only carries {type, role, content}; function_call and
// function_call_output items additionally carry call_id/name/arguments/output,
// so we parse into this richer local struct.
type responsesInputItem struct {
	Type             string          `json:"type"`
	Role             string          `json:"role"`
	Content          json.RawMessage `json:"content"`
	CallID           string          `json:"call_id"`
	ToolCallID       string          `json:"tool_call_id"`
	ID               string          `json:"id"`
	Name             string          `json:"name"`
	Namespace        string          `json:"namespace"`
	Arguments        json.RawMessage `json:"arguments"`
	Input            json.RawMessage `json:"input"`
	Output           json.RawMessage `json:"output"`
	Summary          json.RawMessage `json:"summary"`
	Reasoning        json.RawMessage `json:"reasoning"`
	ReasoningContent json.RawMessage `json:"reasoning_content"`
	ToolUse          json.RawMessage `json:"tool_use"`
}

// ResponsesRequestToChatCompletionsRequest converts an OpenAI Responses API
// request into an equivalent Chat Completions request. It is the reverse of
// ChatCompletionsRequestToResponsesRequest and is used to serve Responses-only
// clients (e.g. Codex) from Chat-only upstreams.
func ResponsesRequestToChatCompletionsRequest(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, *dto.ResponsesToolContext, error) {
	if req == nil {
		return nil, nil, errors.New("request is nil")
	}
	if req.Model == "" {
		return nil, nil, errors.New("model is required")
	}
	// `prompt` is a reference to a server-side stored prompt template that a
	// Chat-only upstream cannot resolve; fail clearly rather than silently
	// running without the configured prompt.
	if len(req.Prompt) > 0 && strings.TrimSpace(string(req.Prompt)) != "null" {
		return nil, nil, errors.New("prompt references a server-side stored prompt that a Chat-only upstream cannot resolve; inline the prompt content in `instructions`/`input` instead")
	}

	toolCtx := BuildCodexToolContext(req.Tools)
	toolCtx.OriginalRequest = req

	messages := make([]dto.Message, 0)

	// instructions -> leading instruction message. Use the model-specific role
	// (o-series / GPT-5 expect "developer") so it matches the Chat request logic
	// and applySystemPromptIfNeeded downstream.
	systemRole := (&dto.GeneralOpenAIRequest{Model: responsesModelBaseName(req.Model)}).GetSystemRoleName()
	preserveInstructionRoles := shouldPreserveResponsesInstructionRoles(req.Model)
	if instr := responsesInstructionsToString(req.Instructions); instr != "" {
		messages = append(messages, dto.Message{Role: systemRole, Content: instr})
	}

	// Responses emits function_call items at the top level; Chat requires them
	// attached to the preceding assistant message. Track the last assistant
	// message so consecutive (parallel) tool calls accumulate onto it. `seen`
	// records tool-call ids so a stray output with no matching call is emitted
	// as a user message instead of a role:tool message.
	lastAssistantIdx := -1
	toolCallsByIdx := make(map[int][]dto.ToolCallRequest)
	seen := make(map[string]bool)
	pendingReasoning := make([]string, 0)

	attachPendingReasoning := func(messageIdx int) {
		if messageIdx < 0 || len(pendingReasoning) == 0 {
			return
		}
		reasoning := strings.Join(pendingReasoning, "\n")
		if existing := messages[messageIdx].GetReasoningContent(); existing != "" {
			reasoning = existing + "\n" + reasoning
		}
		messages[messageIdx].ReasoningContent = common.GetPointer(reasoning)
		pendingReasoning = pendingReasoning[:0]
	}

	flushPendingReasoning := func() {
		if len(pendingReasoning) == 0 {
			return
		}
		messages = append(messages, dto.Message{Role: "assistant", Content: ""})
		lastAssistantIdx = len(messages) - 1
		attachPendingReasoning(lastAssistantIdx)
	}

	addToolCall := func(callID string, tc dto.ToolCallRequest) {
		if lastAssistantIdx < 0 {
			messages = append(messages, dto.Message{Role: "assistant", Content: ""})
			lastAssistantIdx = len(messages) - 1
		}
		attachPendingReasoning(lastAssistantIdx)
		toolCallsByIdx[lastAssistantIdx] = append(toolCallsByIdx[lastAssistantIdx], tc)
		seen[callID] = true
	}

	for _, it := range parseResponsesInputItems(req.Input) {
		switch it.Type {
		case "function_call":
			callID := firstNonEmpty(it.CallID, it.ID)
			name := strings.TrimSpace(it.Name)
			if it.Namespace != "" {
				name = flattenNamespaceToolName(it.Namespace, name)
			}
			if callID == "" || name == "" {
				continue
			}
			addToolCall(callID, dto.ToolCallRequest{
				ID:       callID,
				Type:     "function",
				Function: dto.FunctionRequest{Name: name, Arguments: responsesArgumentsToChat(it.Arguments)},
			})

		case "custom_tool_call":
			callID := firstNonEmpty(it.CallID, it.ID)
			if callID == "" {
				continue
			}
			input := it.Input
			if len(input) == 0 {
				input = it.Arguments
			}
			subName, args := buildCustomToolCallHistory(strings.TrimSpace(it.Name), input)
			if subName == "" {
				continue
			}
			addToolCall(callID, dto.ToolCallRequest{
				ID:       callID,
				Type:     "function",
				Function: dto.FunctionRequest{Name: subName, Arguments: args},
			})

		case "tool_call":
			var toolUse struct {
				ID    string          `json:"id"`
				Name  string          `json:"name"`
				Input json.RawMessage `json:"input"`
			}
			if common.Unmarshal(it.ToolUse, &toolUse) != nil {
				continue
			}
			callID := firstNonEmpty(toolUse.ID, firstNonEmpty(it.CallID, it.ID))
			if callID == "" || strings.TrimSpace(toolUse.Name) == "" {
				continue
			}
			addToolCall(callID, dto.ToolCallRequest{
				ID:       callID,
				Type:     "function",
				Function: dto.FunctionRequest{Name: strings.TrimSpace(toolUse.Name), Arguments: responsesArgumentsToChat(toolUse.Input)},
			})

		case "function_call_output", "custom_tool_call_output":
			callID := strings.TrimSpace(it.CallID)
			if callID == "" {
				continue
			}
			content := responsesRawToString(it.Output)
			if seen[callID] {
				messages = append(messages, dto.Message{Role: "tool", ToolCallId: callID, Content: content})
			} else {
				// Orphan output: no matching preceding call → fold into a user message.
				flushPendingReasoning()
				messages = append(messages, dto.Message{Role: "user", Content: "Function call output (" + callID + "): " + content})
			}
			lastAssistantIdx = -1

		case "tool_result":
			var legacyContent struct {
				ToolUseID string          `json:"tool_use_id"`
				Content   json.RawMessage `json:"content"`
			}
			_ = common.Unmarshal(it.Content, &legacyContent)
			callID := firstNonEmpty(legacyContent.ToolUseID, firstNonEmpty(it.ToolCallID, it.CallID))
			if callID == "" {
				continue
			}
			output := legacyContent.Content
			if len(output) == 0 {
				output = it.Content
			}
			content := responsesRawToString(output)
			if seen[callID] {
				messages = append(messages, dto.Message{Role: "tool", ToolCallId: callID, Content: content})
			} else {
				flushPendingReasoning()
				messages = append(messages, dto.Message{Role: "user", Content: "Function call output (" + callID + "): " + content})
			}
			lastAssistantIdx = -1

		case "reasoning":
			if reasoning := responsesInputReasoningText(it); reasoning != "" {
				pendingReasoning = append(pendingReasoning, reasoning)
			}
			continue

		case "message", "":
			rawRole := strings.TrimSpace(it.Role)
			if rawRole == "" {
				continue
			}
			role := responsesRoleToChatRole(rawRole, systemRole, preserveInstructionRoles)
			if role != "assistant" {
				flushPendingReasoning()
			}
			msg := dto.Message{Role: role}
			setResponsesMessageContent(&msg, it.Content)
			messages = append(messages, msg)
			if role == "assistant" {
				lastAssistantIdx = len(messages) - 1
				attachPendingReasoning(lastAssistantIdx)
			} else {
				lastAssistantIdx = -1
			}

		default:
			// Unknown item type (e.g. built-in tool calls) — drop.
			continue
		}
	}
	flushPendingReasoning()

	for idx, tcs := range toolCallsByIdx {
		if len(tcs) > 0 {
			messages[idx].SetToolCalls(tcs)
		}
	}
	if !preserveInstructionRoles {
		// Strict non-GPT Chat templates commonly accept only one leading system
		// message. Responses clients may place system/developer messages
		// throughout input history, so merge their textual content at the head.
		messages = collapseInstructionMessagesToHead(messages, systemRole)
	}

	// previous_response_id means the client is in stateful mode, sending only the
	// incremental turn and relying on server-side conversation state that a
	// Chat-only upstream cannot load. Fail clearly instead of answering without
	// the prior context. (The compaction path clears it before calling here,
	// since its input already carries the full window.)
	if strings.TrimSpace(req.PreviousResponseID) != "" {
		return nil, nil, errors.New("previous_response_id references server-side conversation state that a Chat-only upstream cannot recover; use stateless mode and resend the full conversation in `input`")
	}
	// `conversation` is likewise a reference to server-side stored conversation state.
	if len(req.Conversation) > 0 && strings.TrimSpace(string(req.Conversation)) != "null" {
		return nil, nil, errors.New("conversation references server-side conversation state that a Chat-only upstream cannot recover; use stateless mode and resend the full conversation in `input`")
	}

	out := &dto.GeneralOpenAIRequest{
		Model:       req.Model,
		Messages:    messages,
		Stream:      req.Stream,
		Temperature: req.Temperature,
		User:        req.User,
		Store:       req.Store,
		Metadata:    req.Metadata,
	}

	if req.MaxOutputTokens != nil {
		if isOpenAIOSeries(req.Model) {
			out.MaxCompletionTokens = common.GetPointer(*req.MaxOutputTokens)
		} else {
			out.MaxTokens = common.GetPointer(*req.MaxOutputTokens)
		}
	}
	if req.TopP != nil {
		out.TopP = common.GetPointer(*req.TopP)
	}
	if req.TopLogProbs != nil {
		out.TopLogProbs = common.GetPointer(*req.TopLogProbs)
		// Chat requires logprobs=true for top_logprobs to take effect.
		out.LogProbs = common.GetPointer(true)
	}
	// Carry service_tier / safety / prompt-cache metadata through; downstream
	// RemoveDisabledFields still filters them per channel settings (allow_*).
	if req.ServiceTier != "" {
		out.ServiceTier = mustMarshalJSON(req.ServiceTier)
	}
	if len(req.SafetyIdentifier) > 0 {
		out.SafetyIdentifier = req.SafetyIdentifier
	}
	if len(req.PromptCacheKey) > 0 {
		out.PromptCacheKey = common.JsonRawMessageToString(req.PromptCacheKey)
	}
	if len(req.PromptCacheRetention) > 0 {
		out.PromptCacheRetention = req.PromptCacheRetention
	}
	if b, ok := responsesParallelToolCalls(req.ParallelToolCalls); ok {
		out.ParallelTooCalls = common.GetPointer(b)
	}
	if tools := responsesToolsToChatToolsWithContext(req.Tools, toolCtx); len(tools) > 0 {
		out.Tools = chatToolMapsToRequests(tools)
	}
	// tool_choice is only meaningful alongside tools. Some upstreams (e.g. vLLM)
	// reject tool_choice when tools is absent, and Codex sends tool_choice:"auto"
	// on tool-less requests such as context compaction, so drop it in that case.
	if len(out.Tools) > 0 {
		if tc := responsesToolChoiceToChatWithContext(req.ToolChoice, toolCtx); tc != nil {
			out.ToolChoice = tc
		}
	}
	if rf := responsesTextToResponseFormat(req.Text); rf != nil {
		out.ResponseFormat = rf
	}
	applyChatReasoningOptions(out, req.Reasoning, req.Model)
	// An explicit provider extension from the client wins over the inferred mapping.
	if len(req.EnableThinking) > 0 {
		out.EnableThinking = req.EnableThinking
	}

	return out, toolCtx, nil
}

// shouldPreserveResponsesInstructionRoles reports whether the mapped upstream
// model is an OpenAI GPT/o-series model whose Chat API understands Responses
// instruction roles. Provider prefixes such as "openai/gpt-5" are supported.
func shouldPreserveResponsesInstructionRoles(model string) bool {
	model = responsesModelBaseName(model)
	model = strings.ToLower(model)
	return strings.HasPrefix(model, "gpt-") ||
		strings.HasPrefix(model, "chatgpt-") ||
		dto.IsOpenAIReasoningOModel(model)
}

func responsesModelBaseName(model string) string {
	model = strings.TrimSpace(model)
	if idx := strings.LastIndex(model, "/"); idx >= 0 {
		model = model[idx+1:]
	}
	return model
}

// responsesRoleToChatRole normalizes Responses-only roles for Chat upstreams.
// GPT/o-series models preserve explicit system/developer roles. Other mapped
// upstream models receive one compatible instruction role (normally system).
func responsesRoleToChatRole(role string, instructionRole string, preserveInstructionRoles bool) string {
	switch strings.TrimSpace(role) {
	case "developer", "system":
		if preserveInstructionRoles {
			return strings.TrimSpace(role)
		}
		return instructionRole
	case "assistant":
		return "assistant"
	case "tool":
		return "tool"
	case "latest_reminder", "user":
		return "user"
	default:
		// Unknown Responses roles are safer as user content than as an invalid
		// Chat role that strict upstream templates reject.
		return "user"
	}
}

// collapseInstructionMessagesToHead merges textual instruction messages into a
// single leading message. Non-text instruction content is preserved in place so
// media is never silently flattened or discarded.
func collapseInstructionMessagesToHead(messages []dto.Message, instructionRole string) []dto.Message {
	instructionChunks := make([]string, 0)
	rest := make([]dto.Message, 0, len(messages))

	for _, message := range messages {
		if message.Role == instructionRole {
			if content, ok := message.Content.(string); ok {
				if strings.TrimSpace(content) != "" {
					instructionChunks = append(instructionChunks, content)
				}
				continue
			}
		}
		rest = append(rest, message)
	}

	if len(instructionChunks) == 0 {
		return rest
	}

	result := make([]dto.Message, 0, len(rest)+1)
	result = append(result, dto.Message{
		Role:    instructionRole,
		Content: strings.Join(instructionChunks, "\n\n"),
	})
	result = append(result, rest...)
	return result
}

func firstNonEmpty(a, b string) string {
	if s := strings.TrimSpace(a); s != "" {
		return s
	}
	return strings.TrimSpace(b)
}

// chatToolMapsToRequests converts the map-shaped chat tool objects produced by
// the Codex tool adaptation layer into typed ToolCallRequest for the upstream
// request, preserving the `strict` schema-enforcement flag.
func chatToolMapsToRequests(tools []map[string]any) []dto.ToolCallRequest {
	out := make([]dto.ToolCallRequest, 0, len(tools))
	for _, t := range tools {
		fn, _ := t["function"].(map[string]any)
		if fn == nil {
			continue
		}
		out = append(out, dto.ToolCallRequest{
			Type: "function",
			Function: dto.FunctionRequest{
				Name:        mapGetString(fn, "name"),
				Description: mapGetString(fn, "description"),
				Parameters:  fn["parameters"],
				Strict:      fn["strict"],
			},
		})
	}
	return out
}

// parseResponsesInputItems normalizes the polymorphic `input` field (string or
// array of items) into a slice of responsesInputItem.
func parseResponsesInputItems(raw json.RawMessage) []responsesInputItem {
	if len(raw) == 0 {
		return nil
	}
	switch common.GetJsonType(raw) {
	case "string":
		var s string
		_ = common.Unmarshal(raw, &s)
		return []responsesInputItem{{Type: "message", Role: "user", Content: mustMarshalJSON(s)}}
	case "array":
		var items []responsesInputItem
		_ = common.Unmarshal(raw, &items)
		return items
	default:
		return nil
	}
}

// setResponsesMessageContent maps a Responses message `content` (string or array
// of typed parts) onto a Chat message. Text-only content collapses to a plain
// string; mixed content becomes MediaContent parts.
func setResponsesMessageContent(msg *dto.Message, rawContent json.RawMessage) {
	if len(rawContent) == 0 {
		msg.Content = ""
		return
	}
	switch common.GetJsonType(rawContent) {
	case "null":
		msg.Content = ""
		return
	case "string":
		var s string
		_ = common.Unmarshal(rawContent, &s)
		msg.Content = s
		return
	case "array":
		// handled below
	default:
		msg.Content = string(rawContent)
		return
	}

	var parts []map[string]any
	_ = common.Unmarshal(rawContent, &parts)

	media := make([]dto.MediaContent, 0, len(parts))
	allText := true
	var sb strings.Builder
	for _, p := range parts {
		partType, _ := p["type"].(string)
		switch partType {
		case "input_text", "output_text", "text":
			text, _ := p["text"].(string)
			media = append(media, dto.MediaContent{Type: dto.ContentTypeText, Text: text})
			sb.WriteString(text)
		case "refusal":
			text, _ := p["refusal"].(string)
			media = append(media, dto.MediaContent{Type: dto.ContentTypeText, Text: text})
			sb.WriteString(text)
		case "input_image":
			allText = false
			media = append(media, dto.MediaContent{Type: dto.ContentTypeImageURL, ImageUrl: responsesImageURLToChat(p)})
		case "input_file":
			allText = false
			media = append(media, dto.MediaContent{Type: dto.ContentTypeFile, File: responsesInputFileToChat(p)})
		case "input_audio":
			allText = false
			media = append(media, dto.MediaContent{Type: dto.ContentTypeInputAudio, InputAudio: p["input_audio"]})
		case "input_video":
			allText = false
			media = append(media, dto.MediaContent{Type: dto.ContentTypeVideoUrl, VideoUrl: p["video_url"]})
		default:
			// Unknown part type — drop.
		}
	}

	if allText {
		msg.Content = sb.String()
		return
	}
	msg.SetMediaContent(media)
}

func responsesInputReasoningText(item responsesInputItem) string {
	for _, raw := range []json.RawMessage{item.Summary, item.ReasoningContent, item.Reasoning, item.Content} {
		if text := responsesReasoningRawText(raw); text != "" {
			return text
		}
	}
	return ""
}

func responsesReasoningRawText(raw json.RawMessage) string {
	if len(raw) == 0 || common.GetJsonType(raw) == "null" {
		return ""
	}
	if common.GetJsonType(raw) == "string" {
		var text string
		_ = common.Unmarshal(raw, &text)
		return strings.TrimSpace(text)
	}
	if common.GetJsonType(raw) == "array" {
		var parts []map[string]any
		if common.Unmarshal(raw, &parts) == nil {
			texts := make([]string, 0, len(parts))
			for _, part := range parts {
				text := firstNonEmpty(mapGetString(part, "text"), mapGetString(part, "summary"))
				if text != "" {
					texts = append(texts, text)
				}
			}
			return strings.Join(texts, "\n")
		}
	}
	return ""
}

// responsesInputFileToChat builds the Chat `file` object for an input_file part.
// Responses/Codex carries the file fields at the top level of the part
// (file_id/file_data/filename/file_url); our own chat→responses converter nests
// them under `file`. Prefer the nested shape, else assemble from top-level fields.
func responsesInputFileToChat(p map[string]any) any {
	if nested, ok := p["file"]; ok && nested != nil {
		return nested
	}
	file := map[string]any{}
	for _, k := range []string{"file_id", "file_data", "filename", "file_url"} {
		if v, ok := p[k]; ok && v != nil {
			file[k] = v
		}
	}
	if len(file) == 0 {
		return nil
	}
	return file
}

// responsesImageURLToChat converts a Responses input_image part into the Chat
// image_url object {"url": ..., "detail": ...}. Responses carries `detail` at
// the top level of the part (sibling of image_url); Chat nests it under image_url.
func responsesImageURLToChat(p map[string]any) any {
	obj := map[string]any{}
	switch v := p["image_url"].(type) {
	case string:
		obj["url"] = v
	case map[string]any:
		for k, val := range v {
			obj[k] = val
		}
	default:
		return p["image_url"]
	}
	if _, ok := obj["detail"]; !ok {
		if detail, ok := p["detail"].(string); ok && detail != "" {
			obj["detail"] = detail
		}
	}
	return obj
}

// responsesTextToResponseFormat converts a Responses `text` ({"format": {...}})
// into a Chat response_format. json_schema is un-nested from the flat Responses
// shape back into Chat's {type:"json_schema", json_schema:{...}} shape.
func responsesTextToResponseFormat(raw json.RawMessage) *dto.ResponseFormat {
	if len(raw) == 0 {
		return nil
	}
	var textObj map[string]any
	if err := common.Unmarshal(raw, &textObj); err != nil {
		return nil
	}
	format, ok := textObj["format"].(map[string]any)
	if !ok {
		return nil
	}
	typ, _ := format["type"].(string)
	if typ == "" {
		return nil
	}
	rf := &dto.ResponseFormat{Type: typ}
	if typ == "json_schema" {
		schema := make(map[string]any)
		for k, v := range format {
			if k == "type" {
				continue
			}
			schema[k] = v
		}
		if len(schema) > 0 {
			if b, err := common.Marshal(schema); err == nil {
				rf.JsonSchema = b
			}
		}
	}
	return rf
}

// responsesParallelToolCalls parses the Responses parallel_tool_calls raw value
// into a bool. The second return reports whether a value was present.
func responsesParallelToolCalls(raw json.RawMessage) (bool, bool) {
	if len(raw) == 0 {
		return false, false
	}
	var b bool
	if err := common.Unmarshal(raw, &b); err != nil {
		return false, false
	}
	return b, true
}

// responsesInstructionsToString flattens the Responses `instructions` field
// (normally a JSON string) into plain text.
func responsesInstructionsToString(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	if common.GetJsonType(raw) == "string" {
		var s string
		_ = common.Unmarshal(raw, &s)
		return strings.TrimSpace(s)
	}
	return strings.TrimSpace(string(raw))
}

// responsesRawToString renders a raw JSON value as a Chat message string: JSON
// strings are unquoted, everything else is passed through verbatim.
func responsesRawToString(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	if common.GetJsonType(raw) == "string" {
		var s string
		_ = common.Unmarshal(raw, &s)
		return s
	}
	return string(raw)
}

func mustMarshalJSON(v any) json.RawMessage {
	b, _ := common.Marshal(v)
	return b
}
