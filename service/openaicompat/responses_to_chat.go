package openaicompat

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

const (
	responsesEventCreated                  = "response.created"
	responsesEventCompleted                = "response.completed"
	responsesEventDone                     = "response.done"
	responsesEventIncomplete               = "response.incomplete"
	responsesEventFailed                   = "response.failed"
	responsesEventError                    = "response.error"
	responsesEventOutputTextDelta          = "response.output_text.delta"
	responsesEventOutputItemAdded          = "response.output_item.added"
	responsesEventOutputItemDone           = "response.output_item.done"
	responsesEventFunctionArgsDelta        = "response.function_call_arguments.delta"
	responsesEventFunctionArgsDone         = "response.function_call_arguments.done"
	responsesEventCustomToolInputDelta     = "response.custom_tool_call_input.delta"
	responsesEventCustomToolInputDone      = "response.custom_tool_call_input.done"
	responsesEventReasoningSummaryDelta    = "response.reasoning_summary_text.delta"
	responsesEventReasoningSummaryDone     = "response.reasoning_summary_text.done"
	responsesEventReasoningTextDelta       = "response.reasoning_text.delta"
	responsesEventReasoningTextDone        = "response.reasoning_text.done"
	responsesOutputTypeFunctionCall        = "function_call"
	responsesOutputTypeCustomToolCall      = "custom_tool_call"
	responsesOutputTypeMessage             = "message"
	responsesOutputTypeReasoning           = "reasoning"
	responsesIncompleteReasonContentFilter = "content_filter"
	responsesIncompleteReasonMaxTokens     = "max_output_tokens"
)

func ResponsesFinishReasonFromStatus(resp *dto.OpenAIResponsesResponse) (string, bool) {
	if resp == nil {
		return "", false
	}

	status := responseStatusString(resp)
	if status != "incomplete" {
		return "", false
	}

	reason := ""
	if resp.IncompleteDetails != nil {
		reason = strings.TrimSpace(resp.IncompleteDetails.Reason)
	}
	if reason == responsesIncompleteReasonContentFilter {
		return "content_filter", true
	}
	return "length", true
}

func ResponsesResponseToChatCompletionsResponse(resp *dto.OpenAIResponsesResponse, id string) (*dto.OpenAITextResponse, *dto.Usage, error) {
	if resp == nil {
		return nil, nil, errors.New("response is nil")
	}

	text := ExtractOutputTextFromResponses(resp)
	reasoning := ExtractReasoningTextFromResponses(resp)

	usage := UsageFromResponsesUsage(resp.Usage)

	created := resp.CreatedAt

	var toolCalls []dto.ToolCallResponse
	if len(resp.Output) > 0 {
		for _, out := range resp.Output {
			if !isResponsesToolOutputType(out.Type) {
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
	if mappedReason, ok := ResponsesFinishReasonFromStatus(resp); ok {
		finishReason = mappedReason
	} else if len(toolCalls) > 0 {
		finishReason = "tool_calls"
	}

	msg := dto.Message{
		Role:    "assistant",
		Content: text,
	}
	if reasoning != "" {
		msg.ReasoningContent = &reasoning
	}
	if len(toolCalls) > 0 {
		msg.SetToolCalls(toolCalls)
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

func UsageFromResponsesUsage(src *dto.Usage) *dto.Usage {
	usage := &dto.Usage{}
	if src == nil {
		return usage
	}
	if src.InputTokens != 0 {
		usage.PromptTokens = src.InputTokens
		usage.InputTokens = src.InputTokens
	}
	if src.OutputTokens != 0 {
		usage.CompletionTokens = src.OutputTokens
		usage.OutputTokens = src.OutputTokens
	}
	if src.TotalTokens != 0 {
		usage.TotalTokens = src.TotalTokens
	} else {
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	if src.InputTokensDetails != nil {
		usage.PromptTokensDetails.CachedTokens = src.InputTokensDetails.CachedTokens
		usage.PromptTokensDetails.ImageTokens = src.InputTokensDetails.ImageTokens
		usage.PromptTokensDetails.AudioTokens = src.InputTokensDetails.AudioTokens
	}
	if src.CompletionTokenDetails.ReasoningTokens != 0 {
		usage.CompletionTokenDetails.ReasoningTokens = src.CompletionTokenDetails.ReasoningTokens
	}
	return usage
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

func ExtractReasoningTextFromResponses(resp *dto.OpenAIResponsesResponse) string {
	if resp == nil || len(resp.Output) == 0 {
		return ""
	}

	var sb strings.Builder
	for _, out := range resp.Output {
		if out.Type != responsesOutputTypeReasoning {
			continue
		}
		for _, c := range out.Content {
			if c.Text != "" {
				sb.WriteString(c.Text)
			}
		}
	}
	return sb.String()
}

type ResponsesToChatStreamState struct {
	ID           string
	Model        string
	Created      int64
	IncludeUsage bool

	Usage *dto.Usage

	sentStart                  bool
	finalized                  bool
	hasSentText                bool
	sawToolCall                bool
	hasSentReasoning           bool
	needsReasoningSummaryBreak bool
	nextToolIndex              int
	toolByKey                  map[string]*responsesStreamTool
	outputIndexToKey           map[int]string
	itemIDToKey                map[string]string
	callIDToKey                map[string]string
	pendingArgsByOutputIndex   map[int]string
	pendingArgsByItemID        map[string]string
	usageText                  strings.Builder
}

type responsesStreamTool struct {
	Key        string
	CallID     string
	ItemID     string
	Name       string
	Arguments  string
	Index      int
	Sent       bool
	NameSent   bool
	ArgsSentAt int
}

func NewResponsesToChatStreamState(model string, includeUsage bool) *ResponsesToChatStreamState {
	return &ResponsesToChatStreamState{
		Model:                    model,
		Created:                  time.Now().Unix(),
		IncludeUsage:             includeUsage,
		Usage:                    &dto.Usage{},
		toolByKey:                make(map[string]*responsesStreamTool),
		outputIndexToKey:         make(map[int]string),
		itemIDToKey:              make(map[string]string),
		callIDToKey:              make(map[string]string),
		pendingArgsByOutputIndex: make(map[int]string),
		pendingArgsByItemID:      make(map[string]string),
	}
}

func (s *ResponsesToChatStreamState) UsageText() string {
	if s == nil {
		return ""
	}
	return s.usageText.String()
}

func ResponsesStreamEventToChatChunks(event *dto.ResponsesStreamResponse, state *ResponsesToChatStreamState) ([]dto.ChatCompletionsStreamResponse, error) {
	if event == nil || state == nil {
		return nil, nil
	}

	switch event.Type {
	case responsesEventCreated:
		state.applyResponseMetadata(event.Response)
		return state.ensureStart(), nil
	case responsesEventReasoningSummaryDelta, responsesEventReasoningTextDelta:
		return state.reasoningDelta(event.Delta), nil
	case responsesEventReasoningSummaryDone, responsesEventReasoningTextDone:
		if state.hasSentReasoning {
			state.needsReasoningSummaryBreak = true
		}
		return nil, nil
	case responsesEventOutputTextDelta:
		return state.textDelta(event.Delta), nil
	case responsesEventOutputItemAdded, responsesEventOutputItemDone:
		if event.Item == nil || !isResponsesToolOutputType(event.Item.Type) {
			return nil, nil
		}
		return state.toolItem(event), nil
	case responsesEventFunctionArgsDelta, responsesEventCustomToolInputDelta:
		return state.toolArgumentsDelta(event), nil
	case responsesEventFunctionArgsDone, responsesEventCustomToolInputDone:
		return state.flushPendingTool(event), nil
	case responsesEventCompleted, responsesEventDone, responsesEventIncomplete:
		response := event.Response
		if event.Type == responsesEventIncomplete {
			response = ensureIncompleteResponse(response)
		}
		state.applyResponseMetadata(response)
		chunks := state.terminalOutputChunks(response)
		chunks = append(chunks, state.finalize(response)...)
		return chunks, nil
	case responsesEventFailed, responsesEventError:
		return nil, fmt.Errorf("responses stream error: %s", event.Type)
	default:
		return nil, nil
	}
}

func FinalizeResponsesToChatStream(state *ResponsesToChatStreamState) []dto.ChatCompletionsStreamResponse {
	if state == nil {
		return nil
	}
	return state.finalize(nil)
}

func (s *ResponsesToChatStreamState) applyResponseMetadata(response *dto.OpenAIResponsesResponse) {
	if response == nil {
		return
	}
	if response.ID != "" && s.ID == "" {
		s.ID = response.ID
	}
	if response.Model != "" {
		s.Model = response.Model
	}
	if response.CreatedAt != 0 {
		s.Created = int64(response.CreatedAt)
	}
	if response.Usage != nil {
		s.Usage = UsageFromResponsesUsage(response.Usage)
	}
}

func (s *ResponsesToChatStreamState) ensureStart() []dto.ChatCompletionsStreamResponse {
	if s.sentStart {
		return nil
	}
	s.sentStart = true
	return []dto.ChatCompletionsStreamResponse{s.makeChunk(dto.ChatCompletionsStreamResponseChoiceDelta{
		Role:    "assistant",
		Content: common.GetPointer(""),
	}, nil)}
}

func (s *ResponsesToChatStreamState) textDelta(delta string) []dto.ChatCompletionsStreamResponse {
	if delta == "" {
		return nil
	}
	s.usageText.WriteString(delta)
	s.hasSentText = true
	chunks := s.ensureStart()
	chunks = append(chunks, s.makeChunk(dto.ChatCompletionsStreamResponseChoiceDelta{
		Content: &delta,
	}, nil))
	return chunks
}

func (s *ResponsesToChatStreamState) terminalOutputChunks(response *dto.OpenAIResponsesResponse) []dto.ChatCompletionsStreamResponse {
	if s == nil || response == nil || len(response.Output) == 0 {
		return nil
	}

	var chunks []dto.ChatCompletionsStreamResponse
	for i := range response.Output {
		out := &response.Output[i]
		switch {
		case out.Type == responsesOutputTypeMessage && !s.hasSentText:
			var text strings.Builder
			for _, c := range out.Content {
				if c.Type == "output_text" && c.Text != "" {
					text.WriteString(c.Text)
				}
			}
			chunks = append(chunks, s.textDelta(text.String())...)
		case out.Type == responsesOutputTypeReasoning && !s.hasSentReasoning:
			var reasoning strings.Builder
			for _, c := range out.Content {
				if c.Text != "" {
					reasoning.WriteString(c.Text)
				}
			}
			chunks = append(chunks, s.reasoningDelta(reasoning.String())...)
		case isResponsesToolOutputType(out.Type):
			chunks = append(chunks, s.toolItem(&dto.ResponsesStreamResponse{Item: out})...)
		}
	}
	return chunks
}

func (s *ResponsesToChatStreamState) reasoningDelta(delta string) []dto.ChatCompletionsStreamResponse {
	if delta == "" {
		return nil
	}
	if s.needsReasoningSummaryBreak {
		if strings.HasPrefix(delta, "\n\n") {
			s.needsReasoningSummaryBreak = false
		} else if strings.HasPrefix(delta, "\n") {
			delta = "\n" + delta
			s.needsReasoningSummaryBreak = false
		} else {
			delta = "\n\n" + delta
			s.needsReasoningSummaryBreak = false
		}
	}
	s.usageText.WriteString(delta)
	chunks := s.ensureStart()
	chunks = append(chunks, s.makeChunk(dto.ChatCompletionsStreamResponseChoiceDelta{
		ReasoningContent: &delta,
	}, nil))
	s.hasSentReasoning = true
	return chunks
}

func (s *ResponsesToChatStreamState) toolItem(event *dto.ResponsesStreamResponse) []dto.ChatCompletionsStreamResponse {
	tool := s.ensureToolForEvent(event)
	if tool == nil {
		return nil
	}
	args := event.Item.ArgumentsString()
	if args != "" {
		tool.Arguments = args
	}
	return s.toolDelta(tool, "")
}

func (s *ResponsesToChatStreamState) toolArgumentsDelta(event *dto.ResponsesStreamResponse) []dto.ChatCompletionsStreamResponse {
	if event.Delta == "" {
		return nil
	}
	tool := s.findToolForEvent(event)
	if tool == nil {
		if event.OutputIndex != nil {
			s.pendingArgsByOutputIndex[*event.OutputIndex] += event.Delta
		}
		if itemID := strings.TrimSpace(event.ItemID); itemID != "" {
			s.pendingArgsByItemID[itemID] += event.Delta
		}
		return nil
	}
	tool.Arguments += event.Delta
	return s.toolDelta(tool, event.Delta)
}

func (s *ResponsesToChatStreamState) flushPendingTool(event *dto.ResponsesStreamResponse) []dto.ChatCompletionsStreamResponse {
	tool := s.findToolForEvent(event)
	if tool == nil {
		tool = s.ensureFallbackToolForEvent(event)
	}
	if tool == nil {
		return nil
	}
	return s.toolDelta(tool, "")
}

func (s *ResponsesToChatStreamState) ensureToolForEvent(event *dto.ResponsesStreamResponse) *responsesStreamTool {
	if event == nil || event.Item == nil {
		return nil
	}
	key := s.keyForEvent(event)
	if key == "" {
		key = fallbackToolKey(event.Item.ID, event.Item.CallId, event.OutputIndex)
	}
	if key == "" {
		return nil
	}

	tool := s.toolByKey[key]
	if tool == nil {
		tool = &responsesStreamTool{Key: key, Index: s.nextToolIndex}
		s.nextToolIndex++
		s.toolByKey[key] = tool
	}

	if event.OutputIndex != nil {
		s.outputIndexToKey[*event.OutputIndex] = key
		if pending := s.pendingArgsByOutputIndex[*event.OutputIndex]; pending != "" {
			tool.Arguments += pending
			delete(s.pendingArgsByOutputIndex, *event.OutputIndex)
		}
	}
	if itemID := strings.TrimSpace(event.Item.ID); itemID != "" {
		tool.ItemID = itemID
		s.itemIDToKey[itemID] = key
		if pending := s.pendingArgsByItemID[itemID]; pending != "" {
			tool.Arguments += pending
			delete(s.pendingArgsByItemID, itemID)
		}
	}
	if callID := strings.TrimSpace(event.Item.CallId); callID != "" {
		tool.CallID = callID
		s.callIDToKey[callID] = key
	} else if tool.CallID == "" {
		tool.CallID = strings.TrimSpace(event.Item.ID)
	}
	if name := strings.TrimSpace(event.Item.Name); name != "" {
		tool.Name = name
	}
	return tool
}

func (s *ResponsesToChatStreamState) findToolForEvent(event *dto.ResponsesStreamResponse) *responsesStreamTool {
	if event == nil {
		return nil
	}
	if event.OutputIndex != nil {
		if key := s.outputIndexToKey[*event.OutputIndex]; key != "" {
			return s.toolByKey[key]
		}
	}
	if itemID := strings.TrimSpace(event.ItemID); itemID != "" {
		if key := s.itemIDToKey[itemID]; key != "" {
			return s.toolByKey[key]
		}
	}
	if event.Item != nil {
		if key := s.keyForEvent(event); key != "" {
			return s.toolByKey[key]
		}
	}
	return nil
}

func (s *ResponsesToChatStreamState) ensureFallbackToolForEvent(event *dto.ResponsesStreamResponse) *responsesStreamTool {
	if event == nil {
		return nil
	}
	key := ""
	if event.OutputIndex != nil {
		key = fmt.Sprintf("output:%d", *event.OutputIndex)
	}
	if key == "" && strings.TrimSpace(event.ItemID) != "" {
		key = "item:" + strings.TrimSpace(event.ItemID)
	}
	if key == "" {
		return nil
	}
	tool := s.toolByKey[key]
	if tool == nil {
		tool = &responsesStreamTool{
			Key:    key,
			Index:  s.nextToolIndex,
			CallID: fallbackCallID(event),
		}
		s.nextToolIndex++
		s.toolByKey[key] = tool
	}
	if event.OutputIndex != nil {
		s.outputIndexToKey[*event.OutputIndex] = key
		if pending := s.pendingArgsByOutputIndex[*event.OutputIndex]; pending != "" {
			tool.Arguments += pending
			delete(s.pendingArgsByOutputIndex, *event.OutputIndex)
		}
	}
	if itemID := strings.TrimSpace(event.ItemID); itemID != "" {
		tool.ItemID = itemID
		s.itemIDToKey[itemID] = key
		if pending := s.pendingArgsByItemID[itemID]; pending != "" {
			tool.Arguments += pending
			delete(s.pendingArgsByItemID, itemID)
		}
	}
	return tool
}

func (s *ResponsesToChatStreamState) toolDelta(tool *responsesStreamTool, explicitDelta string) []dto.ChatCompletionsStreamResponse {
	if tool == nil {
		return nil
	}

	argsDelta := explicitDelta
	if argsDelta == "" && len(tool.Arguments) > tool.ArgsSentAt {
		argsDelta = tool.Arguments[tool.ArgsSentAt:]
	}
	if tool.Sent && argsDelta == "" && (tool.Name == "" || tool.NameSent) {
		return nil
	}

	chunks := s.ensureStart()
	callID := strings.TrimSpace(tool.CallID)
	if callID == "" {
		callID = tool.Key
	}
	responseTool := dto.ToolCallResponse{
		ID:   callID,
		Type: "function",
		Function: dto.FunctionResponse{
			Arguments: argsDelta,
		},
	}
	responseTool.SetIndex(tool.Index)
	if !tool.NameSent && tool.Name != "" {
		responseTool.Function.Name = tool.Name
		tool.NameSent = true
	}
	if !tool.Sent {
		tool.Sent = true
	}
	if argsDelta != "" {
		tool.ArgsSentAt += len(argsDelta)
		s.usageText.WriteString(argsDelta)
	}
	if responseTool.Function.Name != "" {
		s.usageText.WriteString(responseTool.Function.Name)
	}

	chunks = append(chunks, s.makeChunk(dto.ChatCompletionsStreamResponseChoiceDelta{
		ToolCalls: []dto.ToolCallResponse{responseTool},
	}, nil))
	s.sawToolCall = true
	return chunks
}

func (s *ResponsesToChatStreamState) finalize(response *dto.OpenAIResponsesResponse) []dto.ChatCompletionsStreamResponse {
	if s.finalized {
		return nil
	}
	s.finalized = true

	chunks := s.flushAllPendingTools()
	chunks = append(chunks, s.ensureStart()...)

	finishReason := "stop"
	if mappedReason, ok := ResponsesFinishReasonFromStatus(response); ok {
		finishReason = mappedReason
	} else if s.sawToolCall {
		finishReason = "tool_calls"
	}
	chunks = append(chunks, s.makeChunk(dto.ChatCompletionsStreamResponseChoiceDelta{}, &finishReason))
	if s.IncludeUsage && s.Usage != nil {
		chunks = append(chunks, dto.ChatCompletionsStreamResponse{
			Id:      s.ID,
			Object:  "chat.completion.chunk",
			Created: s.Created,
			Model:   s.Model,
			Choices: make([]dto.ChatCompletionsStreamResponseChoice, 0),
			Usage:   s.Usage,
		})
	}
	return chunks
}

func (s *ResponsesToChatStreamState) flushAllPendingTools() []dto.ChatCompletionsStreamResponse {
	keys := make([]string, 0, len(s.toolByKey)+len(s.pendingArgsByOutputIndex)+len(s.pendingArgsByItemID))
	seen := make(map[string]bool)
	for key := range s.toolByKey {
		keys = append(keys, key)
		seen[key] = true
	}
	for outputIndex := range s.pendingArgsByOutputIndex {
		key := fmt.Sprintf("output:%d", outputIndex)
		if !seen[key] {
			keys = append(keys, key)
			seen[key] = true
		}
	}
	for itemID := range s.pendingArgsByItemID {
		key := "item:" + itemID
		if !seen[key] {
			keys = append(keys, key)
			seen[key] = true
		}
	}
	sort.Strings(keys)

	var chunks []dto.ChatCompletionsStreamResponse
	for _, key := range keys {
		tool := s.toolByKey[key]
		if tool == nil {
			callID := strings.TrimPrefix(key, "item:")
			if strings.HasPrefix(key, "output:") {
				callID = "call_output_" + strings.TrimPrefix(key, "output:")
			}
			tool = &responsesStreamTool{
				Key:    key,
				Index:  s.nextToolIndex,
				CallID: callID,
			}
			s.nextToolIndex++
			s.toolByKey[key] = tool
		}
		if strings.HasPrefix(key, "output:") {
			var outputIndex int
			if _, err := fmt.Sscanf(key, "output:%d", &outputIndex); err == nil {
				tool.Arguments += s.pendingArgsByOutputIndex[outputIndex]
				delete(s.pendingArgsByOutputIndex, outputIndex)
			}
		}
		if strings.HasPrefix(key, "item:") {
			itemID := strings.TrimPrefix(key, "item:")
			tool.Arguments += s.pendingArgsByItemID[itemID]
			delete(s.pendingArgsByItemID, itemID)
		}
		chunks = append(chunks, s.toolDelta(tool, "")...)
	}
	return chunks
}

func (s *ResponsesToChatStreamState) makeChunk(delta dto.ChatCompletionsStreamResponseChoiceDelta, finishReason *string) dto.ChatCompletionsStreamResponse {
	return dto.ChatCompletionsStreamResponse{
		Id:      s.ID,
		Object:  "chat.completion.chunk",
		Created: s.Created,
		Model:   s.Model,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index:        0,
				Delta:        delta,
				FinishReason: finishReason,
			},
		},
	}
}

func (s *ResponsesToChatStreamState) keyForEvent(event *dto.ResponsesStreamResponse) string {
	if event == nil {
		return ""
	}
	if event.OutputIndex != nil {
		return fmt.Sprintf("output:%d", *event.OutputIndex)
	}
	if event.Item != nil {
		if itemID := strings.TrimSpace(event.Item.ID); itemID != "" {
			return "item:" + itemID
		}
		if callID := strings.TrimSpace(event.Item.CallId); callID != "" {
			return "call:" + callID
		}
	}
	if itemID := strings.TrimSpace(event.ItemID); itemID != "" {
		return "item:" + itemID
	}
	return ""
}

type ResponsesBufferedAccumulator struct {
	text                 strings.Builder
	reasoning            strings.Builder
	tools                []*responsesBufferedTool
	outputIndexToToolIdx map[int]int
	itemIDToToolIdx      map[string]int
	pendingByOutputIndex map[int]string
	pendingByItemID      map[string]string
}

type responsesBufferedTool struct {
	CallID    string
	ItemID    string
	Name      string
	Arguments strings.Builder
}

func NewResponsesBufferedAccumulator() *ResponsesBufferedAccumulator {
	return &ResponsesBufferedAccumulator{
		outputIndexToToolIdx: make(map[int]int),
		itemIDToToolIdx:      make(map[string]int),
		pendingByOutputIndex: make(map[int]string),
		pendingByItemID:      make(map[string]string),
	}
}

func (a *ResponsesBufferedAccumulator) ProcessEvent(event *dto.ResponsesStreamResponse) {
	if a == nil || event == nil {
		return
	}
	switch event.Type {
	case responsesEventOutputTextDelta:
		a.text.WriteString(event.Delta)
	case responsesEventReasoningSummaryDelta, responsesEventReasoningTextDelta:
		a.reasoning.WriteString(event.Delta)
	case responsesEventOutputItemAdded, responsesEventOutputItemDone:
		if event.Item != nil && isResponsesToolOutputType(event.Item.Type) {
			tool := a.ensureTool(event)
			if args := event.Item.ArgumentsString(); args != "" {
				tool.Arguments.Reset()
				tool.Arguments.WriteString(args)
			}
		}
	case responsesEventFunctionArgsDelta, responsesEventCustomToolInputDelta:
		if idx, ok := a.findToolIndex(event); ok {
			a.tools[idx].Arguments.WriteString(event.Delta)
			return
		}
		if event.OutputIndex != nil {
			a.pendingByOutputIndex[*event.OutputIndex] += event.Delta
		}
		if itemID := strings.TrimSpace(event.ItemID); itemID != "" {
			a.pendingByItemID[itemID] += event.Delta
		}
	}
}

func (a *ResponsesBufferedAccumulator) SupplementResponseOutput(resp *dto.OpenAIResponsesResponse) {
	if a == nil || resp == nil || len(resp.Output) > 0 {
		return
	}
	resp.Output = a.BuildOutput()
}

func (a *ResponsesBufferedAccumulator) BuildOutput() []dto.ResponsesOutput {
	if a == nil {
		return nil
	}
	out := make([]dto.ResponsesOutput, 0, 2+len(a.tools))
	if a.reasoning.Len() > 0 {
		out = append(out, dto.ResponsesOutput{
			Type: responsesOutputTypeReasoning,
			Content: []dto.ResponsesOutputContent{
				{Type: "summary_text", Text: a.reasoning.String()},
			},
		})
	}
	if a.text.Len() > 0 {
		out = append(out, dto.ResponsesOutput{
			Type: responsesOutputTypeMessage,
			Role: "assistant",
			Content: []dto.ResponsesOutputContent{
				{Type: "output_text", Text: a.text.String()},
			},
		})
	}
	for _, tool := range a.tools {
		if tool == nil {
			continue
		}
		argsRaw, _ := common.Marshal(tool.Arguments.String())
		out = append(out, dto.ResponsesOutput{
			Type:      responsesOutputTypeFunctionCall,
			ID:        tool.ItemID,
			CallId:    tool.CallID,
			Name:      tool.Name,
			Arguments: argsRaw,
		})
	}
	return out
}

func (a *ResponsesBufferedAccumulator) ensureTool(event *dto.ResponsesStreamResponse) *responsesBufferedTool {
	if idx, ok := a.findToolIndex(event); ok {
		tool := a.tools[idx]
		a.applyToolMetadata(tool, event)
		return tool
	}
	tool := &responsesBufferedTool{}
	a.applyToolMetadata(tool, event)
	idx := len(a.tools)
	a.tools = append(a.tools, tool)
	if event.OutputIndex != nil {
		a.outputIndexToToolIdx[*event.OutputIndex] = idx
		if pending := a.pendingByOutputIndex[*event.OutputIndex]; pending != "" {
			tool.Arguments.WriteString(pending)
			delete(a.pendingByOutputIndex, *event.OutputIndex)
		}
	}
	if tool.ItemID != "" {
		a.itemIDToToolIdx[tool.ItemID] = idx
		if pending := a.pendingByItemID[tool.ItemID]; pending != "" {
			tool.Arguments.WriteString(pending)
			delete(a.pendingByItemID, tool.ItemID)
		}
	}
	return tool
}

func (a *ResponsesBufferedAccumulator) applyToolMetadata(tool *responsesBufferedTool, event *dto.ResponsesStreamResponse) {
	if tool == nil || event == nil || event.Item == nil {
		return
	}
	if itemID := strings.TrimSpace(event.Item.ID); itemID != "" {
		tool.ItemID = itemID
	}
	if callID := strings.TrimSpace(event.Item.CallId); callID != "" {
		tool.CallID = callID
	} else if tool.CallID == "" {
		tool.CallID = strings.TrimSpace(event.Item.ID)
	}
	if name := strings.TrimSpace(event.Item.Name); name != "" {
		tool.Name = name
	}
}

func (a *ResponsesBufferedAccumulator) findToolIndex(event *dto.ResponsesStreamResponse) (int, bool) {
	if event == nil {
		return 0, false
	}
	if event.OutputIndex != nil {
		if idx, ok := a.outputIndexToToolIdx[*event.OutputIndex]; ok {
			return idx, true
		}
	}
	itemID := strings.TrimSpace(event.ItemID)
	if itemID == "" && event.Item != nil {
		itemID = strings.TrimSpace(event.Item.ID)
	}
	if itemID != "" {
		idx, ok := a.itemIDToToolIdx[itemID]
		return idx, ok
	}
	return 0, false
}

func responseStatusString(resp *dto.OpenAIResponsesResponse) string {
	if resp == nil || len(resp.Status) == 0 {
		return ""
	}
	var status string
	_ = common.Unmarshal(resp.Status, &status)
	return strings.TrimSpace(status)
}

func ensureIncompleteResponse(resp *dto.OpenAIResponsesResponse) *dto.OpenAIResponsesResponse {
	if resp == nil {
		resp = &dto.OpenAIResponsesResponse{}
	}
	if len(resp.Status) == 0 {
		resp.Status = []byte(`"incomplete"`)
	}
	return resp
}

func isResponsesToolOutputType(outputType string) bool {
	return outputType == responsesOutputTypeFunctionCall || outputType == responsesOutputTypeCustomToolCall
}

func fallbackToolKey(itemID string, callID string, outputIndex *int) string {
	if outputIndex != nil {
		return fmt.Sprintf("output:%d", *outputIndex)
	}
	if strings.TrimSpace(itemID) != "" {
		return "item:" + strings.TrimSpace(itemID)
	}
	if strings.TrimSpace(callID) != "" {
		return "call:" + strings.TrimSpace(callID)
	}
	return ""
}

func fallbackCallID(event *dto.ResponsesStreamResponse) string {
	if event == nil {
		return ""
	}
	if strings.TrimSpace(event.ItemID) != "" {
		return strings.TrimSpace(event.ItemID)
	}
	if event.OutputIndex != nil {
		return fmt.Sprintf("call_output_%d", *event.OutputIndex)
	}
	return ""
}
