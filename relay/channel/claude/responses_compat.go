package claude

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func ClaudeResponsesHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	var claudeResponse dto.ClaudeResponse
	if err := common.Unmarshal(body, &claudeResponse); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if claudeError := claudeResponse.GetClaudeError(); claudeError != nil && claudeError.Type != "" {
		return nil, types.WithClaudeError(*claudeError, http.StatusInternalServerError)
	}
	outputs := outputsFromClaudeMessage(&claudeResponse)
	usage := usageFromClaudeUsage(claudeResponse.Usage, info)
	usage = deferCursorHarnessResponsesUsage(info, outputsContainFunctionCall(outputs), usage)
	response := completedResponsesResponse(
		common.GetStringIfEmpty(claudeResponse.Id, helper.GetResponseID(c)),
		common.GetStringIfEmpty(claudeResponse.Model, info.UpstreamModelName),
		usage,
		outputs,
	)
	data, err := common.Marshal(response)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	service.IOCopyBytesGracefully(c, resp, data)
	return usage, nil
}

func ClaudeResponsesStreamHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	helper.SetEventStreamHeaders(c)
	state := newClaudeResponsesStreamState(c, info)
	var streamErr *types.NewAPIError

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		var claudeResponse dto.ClaudeResponse
		if err := common.UnmarshalJsonStr(data, &claudeResponse); err != nil {
			streamErr = types.NewError(err, types.ErrorCodeBadResponseBody)
			sr.Stop(streamErr)
			return
		}
		if claudeError := claudeResponse.GetClaudeError(); claudeError != nil && claudeError.Type != "" {
			streamErr = types.WithClaudeError(*claudeError, http.StatusInternalServerError)
			sr.Stop(streamErr)
			return
		}
		if err := state.handle(c, &claudeResponse); err != nil {
			streamErr = types.NewError(err, types.ErrorCodeBadResponse)
			sr.Stop(streamErr)
		}
	})
	if streamErr != nil {
		return nil, streamErr
	}
	if !state.completed {
		if err := state.complete(c); err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponse)
		}
	}
	return state.usage, nil
}

type claudeResponsesStreamState struct {
	id              string
	model           string
	created         int
	usage           *dto.Usage
	outputText      strings.Builder
	outputs         []dto.ResponsesOutput
	textItemID      string
	textPartOpen    bool
	reasoningItemID string
	reasoningText   strings.Builder
	reasoningOpen   bool
	blockTypeByID   map[int]string
	toolIndexByID   map[int]string
	toolOutputByID  map[string]*dto.ResponsesOutput
	toolArgsByID    map[string]string
	toolCurrentName map[int]string
	completed       bool
	sequence        int
	riskWarning     string
	riskWarningSent bool
	cursorHarness   bool
	hasToolUse      bool
}

func newClaudeResponsesStreamState(c *gin.Context, info *relaycommon.RelayInfo) *claudeResponsesStreamState {
	estimatePromptTokens := info.GetEstimatePromptTokens()
	return &claudeResponsesStreamState{
		id:              helper.GetResponseID(c),
		model:           info.UpstreamModelName,
		created:         int(common.GetTimestamp()),
		usage:           &dto.Usage{PromptTokens: estimatePromptTokens, InputTokens: estimatePromptTokens, TotalTokens: estimatePromptTokens},
		blockTypeByID:   make(map[int]string),
		toolIndexByID:   make(map[int]string),
		toolOutputByID:  make(map[string]*dto.ResponsesOutput),
		toolArgsByID:    make(map[string]string),
		toolCurrentName: make(map[int]string),
		riskWarning:     "",
		cursorHarness:   info != nil && info.ChannelMeta != nil && info.ChannelType == constant.ChannelTypeCursorAgent,
	}
}

func (s *claudeResponsesStreamState) handle(c *gin.Context, response *dto.ClaudeResponse) error {
	switch response.Type {
	case "message_start":
		if response.Message != nil {
			if response.Message.Id != "" {
				s.id = response.Message.Id
			}
			if response.Message.Model != "" {
				s.model = response.Message.Model
			}
			s.mergeClaudeUsage(response.Message.Usage)
		}
		return s.emit(c, "response.created", map[string]any{
			"type":     "response.created",
			"response": s.baseResponse("in_progress", nil),
		})
	case "content_block_start":
		if response.ContentBlock == nil {
			return nil
		}
		idx := 0
		if response.Index != nil {
			idx = *response.Index
		}
		s.blockTypeByID[idx] = response.ContentBlock.Type
		switch response.ContentBlock.Type {
		case "thinking":
			return s.startReasoning(c)
		case "text":
			return s.startText(c)
		case "tool_use":
			return s.startTool(c, response)
		}
	case "content_block_delta":
		if response.Delta == nil {
			return nil
		}
		switch response.Delta.Type {
		case "thinking_delta":
			if response.Delta.Thinking != nil {
				return s.reasoningDelta(c, *response.Delta.Thinking)
			}
		case "text_delta":
			if response.Delta.Text != nil {
				return s.textDelta(c, *response.Delta.Text)
			}
		case "input_json_delta":
			if response.Index != nil && response.Delta.PartialJson != nil {
				return s.toolDelta(c, *response.Index, *response.Delta.PartialJson)
			}
		}
	case "content_block_stop":
		if response.Index != nil {
			return s.stopBlock(c, *response.Index)
		}
	case "message_delta":
		s.mergeClaudeUsage(response.Usage)
	case "message_stop":
		return s.complete(c)
	}
	return nil
}

func (s *claudeResponsesStreamState) startReasoning(c *gin.Context) error {
	if s.reasoningOpen {
		return nil
	}
	s.reasoningItemID = fmt.Sprintf("rs_%s", common.GetUUID())
	s.reasoningText.Reset()
	s.reasoningOpen = true
	item := dto.ResponsesOutput{
		ID:      s.reasoningItemID,
		Type:    "reasoning",
		Status:  "in_progress",
		Summary: []dto.ResponsesReasoningSummaryPart{},
	}
	s.outputs = append(s.outputs, item)
	outputIndex := len(s.outputs) - 1
	if err := s.emit(c, "response.output_item.added", map[string]any{
		"type":         "response.output_item.added",
		"output_index": outputIndex,
		"item":         openAIReasoningItem(item),
	}); err != nil {
		return err
	}
	return s.emit(c, "response.reasoning_summary_part.added", map[string]any{
		"type":          "response.reasoning_summary_part.added",
		"item_id":       s.reasoningItemID,
		"output_index":  outputIndex,
		"summary_index": 0,
		"part": map[string]any{
			"type": "summary_text",
			"text": "",
		},
	})
}

func (s *claudeResponsesStreamState) reasoningDelta(c *gin.Context, text string) error {
	if err := s.startReasoning(c); err != nil {
		return err
	}
	s.reasoningText.WriteString(text)
	return s.emit(c, "response.reasoning_summary_text.delta", map[string]any{
		"type":          "response.reasoning_summary_text.delta",
		"item_id":       s.reasoningItemID,
		"output_index":  outputIndexByID(s.outputs, s.reasoningItemID),
		"summary_index": 0,
		"delta":         text,
	})
}

func (s *claudeResponsesStreamState) stopReasoning(c *gin.Context) error {
	if !s.reasoningOpen {
		return nil
	}
	itemID := s.reasoningItemID
	outputIndex := outputIndexByID(s.outputs, itemID)
	text := s.reasoningText.String()
	if err := s.emit(c, "response.reasoning_summary_text.done", map[string]any{
		"type":          "response.reasoning_summary_text.done",
		"item_id":       itemID,
		"output_index":  outputIndex,
		"summary_index": 0,
		"text":          text,
	}); err != nil {
		return err
	}
	part := dto.ResponsesReasoningSummaryPart{Type: "summary_text", Text: text}
	if err := s.emit(c, "response.reasoning_summary_part.done", map[string]any{
		"type":          "response.reasoning_summary_part.done",
		"item_id":       itemID,
		"output_index":  outputIndex,
		"summary_index": 0,
		"part":          part,
	}); err != nil {
		return err
	}
	item := dto.ResponsesOutput{
		ID:      itemID,
		Type:    "reasoning",
		Status:  "completed",
		Summary: []dto.ResponsesReasoningSummaryPart{part},
	}
	s.replaceOutput(item)
	s.reasoningOpen = false
	s.reasoningItemID = ""
	s.reasoningText.Reset()
	return s.emit(c, "response.output_item.done", map[string]any{
		"type":         "response.output_item.done",
		"output_index": outputIndex,
		"item":         openAIReasoningItem(item),
	})
}

func (s *claudeResponsesStreamState) startText(c *gin.Context) error {
	if s.textItemID == "" {
		s.textItemID = fmt.Sprintf("msg_%s", common.GetUUID())
		item := dto.ResponsesOutput{
			ID:      s.textItemID,
			Type:    "message",
			Status:  "in_progress",
			Role:    "assistant",
			Content: []dto.ResponsesOutputContent{},
		}
		s.outputs = append(s.outputs, item)
		if err := s.emit(c, "response.output_item.added", map[string]any{
			"type":         "response.output_item.added",
			"output_index": len(s.outputs) - 1,
			"item":         item,
		}); err != nil {
			return err
		}
	}
	if s.textPartOpen {
		return nil
	}
	s.textPartOpen = true
	return s.emit(c, "response.content_part.added", map[string]any{
		"type":          "response.content_part.added",
		"item_id":       s.textItemID,
		"output_index":  outputIndexByID(s.outputs, s.textItemID),
		"content_index": 0,
		"part": map[string]any{
			"type":        "output_text",
			"text":        "",
			"annotations": []any{},
		},
	})
}

func (s *claudeResponsesStreamState) textDelta(c *gin.Context, text string) error {
	if err := s.startText(c); err != nil {
		return err
	}
	if err := s.emitRiskWarningDeltaIfNeeded(c); err != nil {
		return err
	}
	s.outputText.WriteString(text)
	return s.emit(c, "response.output_text.delta", map[string]any{
		"type":          "response.output_text.delta",
		"item_id":       s.textItemID,
		"output_index":  outputIndexByID(s.outputs, s.textItemID),
		"content_index": 0,
		"delta":         text,
	})
}

func (s *claudeResponsesStreamState) startTool(c *gin.Context, response *dto.ClaudeResponse) error {
	s.hasToolUse = true
	idx := 0
	if response.Index != nil {
		idx = *response.Index
	}
	callID := strings.TrimSpace(response.ContentBlock.Id)
	if callID == "" {
		callID = fmt.Sprintf("call_%s", common.GetUUID())
	}
	itemID := fmt.Sprintf("fc_%s", common.GetUUID())
	item := dto.ResponsesOutput{
		ID:        itemID,
		Type:      "function_call",
		Status:    "in_progress",
		CallId:    callID,
		Name:      response.ContentBlock.Name,
		Arguments: nil,
	}
	s.toolIndexByID[idx] = itemID
	s.toolOutputByID[itemID] = &item
	s.toolCurrentName[idx] = response.ContentBlock.Name
	s.outputs = append(s.outputs, item)
	return s.emit(c, "response.output_item.added", map[string]any{
		"type":         "response.output_item.added",
		"output_index": len(s.outputs) - 1,
		"item":         openAIFunctionCallItem(item),
	})
}

func (s *claudeResponsesStreamState) toolDelta(c *gin.Context, index int, delta string) error {
	itemID := s.toolIndexByID[index]
	if itemID == "" {
		return nil
	}
	s.toolArgsByID[itemID] += delta
	if item := s.toolOutputByID[itemID]; item != nil {
		item.Arguments = json.RawMessage(s.toolArgsByID[itemID])
	}
	return s.emit(c, "response.function_call_arguments.delta", map[string]any{
		"type":         "response.function_call_arguments.delta",
		"item_id":      itemID,
		"output_index": outputIndexByID(s.outputs, itemID),
		"delta":        delta,
	})
}

func (s *claudeResponsesStreamState) stopBlock(c *gin.Context, index int) error {
	blockType := s.blockTypeByID[index]
	delete(s.blockTypeByID, index)
	if blockType == "thinking" {
		return s.stopReasoning(c)
	}
	if itemID := s.toolIndexByID[index]; itemID != "" {
		args := s.toolArgsByID[itemID]
		if err := s.emit(c, "response.function_call_arguments.done", map[string]any{
			"type":         "response.function_call_arguments.done",
			"item_id":      itemID,
			"output_index": outputIndexByID(s.outputs, itemID),
			"arguments":    args,
		}); err != nil {
			return err
		}
		if item := s.toolOutputByID[itemID]; item != nil {
			item.Status = "completed"
			item.Arguments = json.RawMessage(args)
			s.replaceOutput(*item)
			if err := s.emit(c, "response.output_item.done", map[string]any{
				"type":         "response.output_item.done",
				"output_index": outputIndexByID(s.outputs, itemID),
				"item":         openAIFunctionCallItem(*item),
			}); err != nil {
				return err
			}
		}
		delete(s.toolIndexByID, index)
		delete(s.toolOutputByID, itemID)
		delete(s.toolArgsByID, itemID)
		delete(s.toolCurrentName, index)
		return nil
	}
	if s.textPartOpen {
		s.textPartOpen = false
		text := prependClaudeRiskWarningText(s.outputText.String(), s.riskWarning)
		if err := s.emit(c, "response.output_text.done", map[string]any{
			"type":          "response.output_text.done",
			"item_id":       s.textItemID,
			"output_index":  outputIndexByID(s.outputs, s.textItemID),
			"content_index": 0,
			"text":          text,
		}); err != nil {
			return err
		}
		if err := s.emit(c, "response.content_part.done", map[string]any{
			"type":          "response.content_part.done",
			"item_id":       s.textItemID,
			"output_index":  outputIndexByID(s.outputs, s.textItemID),
			"content_index": 0,
			"part": map[string]any{
				"type":        "output_text",
				"text":        text,
				"annotations": []any{},
			},
		}); err != nil {
			return err
		}
		s.replaceOutput(dto.ResponsesOutput{
			ID:     s.textItemID,
			Type:   "message",
			Status: "completed",
			Role:   "assistant",
			Content: []dto.ResponsesOutputContent{{
				Type:        "output_text",
				Text:        text,
				Annotations: []interface{}{},
			}},
		})
		return s.emit(c, "response.output_item.done", map[string]any{
			"type":         "response.output_item.done",
			"output_index": outputIndexByID(s.outputs, s.textItemID),
			"item":         s.outputByID(s.textItemID),
		})
	}
	return nil
}

func (s *claudeResponsesStreamState) complete(c *gin.Context) error {
	if s.completed {
		return nil
	}
	if s.reasoningOpen {
		if err := s.stopReasoning(c); err != nil {
			return err
		}
	}
	if s.textPartOpen {
		if err := s.stopBlock(c, -1); err != nil {
			return err
		}
	} else if s.riskWarning != "" && !s.riskWarningSent {
		if err := s.emitRiskWarningDeltaIfNeeded(c); err != nil {
			return err
		}
		if err := s.stopBlock(c, -1); err != nil {
			return err
		}
	}
	if s.cursorHarness && s.hasToolUse {
		s.usage = deferredCursorHarnessResponsesUsage()
	} else if s.usage.PromptTokens == 0 || s.usage.CompletionTokens == 0 {
		fallback := service.ResponseText2Usage(c, s.outputText.String(), s.model, s.usage.PromptTokens)
		if s.usage.PromptTokens == 0 {
			s.usage.PromptTokens = fallback.PromptTokens
			s.usage.InputTokens = fallback.PromptTokens
		}
		if s.usage.CompletionTokens == 0 {
			s.usage.CompletionTokens = fallback.CompletionTokens
			s.usage.OutputTokens = fallback.CompletionTokens
		}
		s.usage.TotalTokens = s.usage.PromptTokens + s.usage.CompletionTokens
	}
	s.completed = true
	return s.emit(c, "response.completed", map[string]any{
		"type":     "response.completed",
		"response": s.baseResponse("completed", s.outputs),
	})
}

func (s *claudeResponsesStreamState) mergeClaudeUsage(usage *dto.ClaudeUsage) {
	if usage == nil {
		return
	}
	mapped := usageFromClaudeUsage(usage, nil)
	if mapped.PromptTokens == 0 && s.usage != nil {
		mapped.PromptTokens = s.usage.PromptTokens
		mapped.InputTokens = s.usage.InputTokens
		mapped.PromptTokensDetails = s.usage.PromptTokensDetails
		if s.usage.InputTokensDetails != nil {
			inputDetails := *s.usage.InputTokensDetails
			mapped.InputTokensDetails = &inputDetails
		}
		mapped.ClaudeCacheCreation5mTokens = s.usage.ClaudeCacheCreation5mTokens
		mapped.ClaudeCacheCreation1hTokens = s.usage.ClaudeCacheCreation1hTokens
	}
	mapped.TotalTokens = mapped.PromptTokens + mapped.CompletionTokens
	s.usage = mapped
}

func (s *claudeResponsesStreamState) baseResponse(status string, outputs []dto.ResponsesOutput) map[string]any {
	if outputs == nil {
		outputs = []dto.ResponsesOutput{}
	}
	return map[string]any{
		"id":                   s.id,
		"object":               "response",
		"created_at":           s.created,
		"status":               status,
		"model":                s.model,
		"output":               openAIResponsesOutputItems(outputs),
		"parallel_tool_calls":  true,
		"previous_response_id": nil,
		"store":                false,
		"temperature":          nil,
		"tool_choice":          "auto",
		"tools":                []any{},
		"top_p":                nil,
		"truncation":           nil,
		"usage":                openAIResponsesUsage(s.usage),
		"incomplete_details":   nil,
		"error":                nil,
		"max_output_tokens":    nil,
		"metadata":             nil,
		"reasoning":            nil,
		"instructions":         nil,
	}
}

func (s *claudeResponsesStreamState) emit(c *gin.Context, eventName string, payload any) error {
	if event, ok := payload.(map[string]any); ok {
		event["sequence_number"] = s.sequence
		s.sequence++
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\n", eventName)})
	c.Render(-1, common.CustomEvent{Data: "data: " + string(data)})
	return helper.FlushWriter(c)
}

func (s *claudeResponsesStreamState) emitRiskWarningDeltaIfNeeded(c *gin.Context) error {
	if s.riskWarning == "" || s.riskWarningSent {
		return nil
	}
	if err := s.startText(c); err != nil {
		return err
	}
	s.riskWarningSent = true
	return s.emit(c, "response.output_text.delta", map[string]any{
		"type":          "response.output_text.delta",
		"item_id":       s.textItemID,
		"output_index":  outputIndexByID(s.outputs, s.textItemID),
		"content_index": 0,
		"delta":         claudeRiskWarningPrefix(s.riskWarning),
	})
}

func (s *claudeResponsesStreamState) replaceOutput(output dto.ResponsesOutput) {
	for i := range s.outputs {
		if s.outputs[i].ID == output.ID {
			s.outputs[i] = output
			return
		}
	}
	s.outputs = append(s.outputs, output)
}

func (s *claudeResponsesStreamState) outputByID(id string) *dto.ResponsesOutput {
	for i := range s.outputs {
		if s.outputs[i].ID == id {
			return &s.outputs[i]
		}
	}
	return nil
}

func outputIndexByID(outputs []dto.ResponsesOutput, id string) int {
	for i := range outputs {
		if outputs[i].ID == id {
			return i
		}
	}
	return -1
}

func usageFromClaudeUsage(usage *dto.ClaudeUsage, info *relaycommon.RelayInfo) *dto.Usage {
	if usage == nil {
		estimate := 0
		if info != nil {
			estimate = info.GetEstimatePromptTokens()
		}
		return &dto.Usage{
			PromptTokens:       estimate,
			InputTokens:        estimate,
			InputTokensDetails: &dto.InputTokenDetails{},
			UsageSemantic:      "openai",
			UsageSource:        "anthropic",
		}
	}
	cacheCreation5m, cacheCreation1h := service.NormalizeCacheCreationSplit(
		usage.CacheCreationInputTokens,
		usage.GetCacheCreation5mTokens(),
		usage.GetCacheCreation1hTokens(),
	)
	cacheCreationTokens := usage.CacheCreationInputTokens
	if cacheCreationTokens < cacheCreation5m+cacheCreation1h {
		cacheCreationTokens = cacheCreation5m + cacheCreation1h
	}
	inputTokens := usage.InputTokens + usage.CacheReadInputTokens + cacheCreationTokens
	if inputTokens == 0 && info != nil {
		inputTokens = info.GetEstimatePromptTokens()
	}
	return &dto.Usage{
		PromptTokens:                inputTokens,
		InputTokens:                 inputTokens,
		CompletionTokens:            usage.OutputTokens,
		OutputTokens:                usage.OutputTokens,
		TotalTokens:                 inputTokens + usage.OutputTokens,
		UsageSemantic:               "openai",
		UsageSource:                 "anthropic",
		InputTokensDetails:          &dto.InputTokenDetails{CachedTokens: usage.CacheReadInputTokens, CachedCreationTokens: usage.CacheCreationInputTokens},
		ClaudeCacheCreation5mTokens: cacheCreation5m,
		ClaudeCacheCreation1hTokens: cacheCreation1h,
		PromptTokensDetails:         dto.InputTokenDetails{CachedTokens: usage.CacheReadInputTokens, CachedCreationTokens: usage.CacheCreationInputTokens},
	}
}

func outputsContainFunctionCall(outputs []dto.ResponsesOutput) bool {
	for _, output := range outputs {
		if output.Type == "function_call" {
			return true
		}
	}
	return false
}

func deferredCursorHarnessResponsesUsage() *dto.Usage {
	return &dto.Usage{
		InputTokensDetails: &dto.InputTokenDetails{},
		UsageSemantic:      "openai",
		UsageSource:        dto.UsageSourceCursorHarnessDeferred,
	}
}

func deferCursorHarnessResponsesUsage(info *relaycommon.RelayInfo, hasToolUse bool, usage *dto.Usage) *dto.Usage {
	if info != nil && info.ChannelMeta != nil && info.ChannelType == constant.ChannelTypeCursorAgent &&
		hasToolUse {
		return deferredCursorHarnessResponsesUsage()
	}
	return usage
}

func openAIResponsesUsage(usage *dto.Usage) map[string]any {
	if usage == nil {
		usage = &dto.Usage{}
	}
	inputTokens := usage.InputTokens
	if inputTokens == 0 {
		inputTokens = usage.PromptTokens
	}
	outputTokens := usage.OutputTokens
	if outputTokens == 0 {
		outputTokens = usage.CompletionTokens
	}
	inputDetails := usage.InputTokensDetails
	if inputDetails == nil {
		inputDetails = &dto.InputTokenDetails{
			CachedTokens:         usage.PromptTokensDetails.CachedTokens,
			CachedCreationTokens: usage.PromptTokensDetails.CachedCreationTokens,
		}
	}
	return map[string]any{
		"input_tokens":          inputTokens,
		"input_tokens_details":  inputDetails,
		"output_tokens":         outputTokens,
		"output_tokens_details": usage.CompletionTokenDetails,
		"total_tokens":          inputTokens + outputTokens,
	}
}

func openAIFunctionCallItem(item dto.ResponsesOutput) map[string]any {
	return map[string]any{
		"id":        item.ID,
		"type":      item.Type,
		"status":    item.Status,
		"call_id":   item.CallId,
		"name":      item.Name,
		"arguments": string(item.Arguments),
	}
}

func openAIReasoningItem(item dto.ResponsesOutput) map[string]any {
	return map[string]any{
		"id":      item.ID,
		"type":    item.Type,
		"status":  item.Status,
		"summary": item.Summary,
	}
}

func openAIResponsesOutputItems(outputs []dto.ResponsesOutput) []any {
	items := make([]any, 0, len(outputs))
	for _, item := range outputs {
		if item.Type == "function_call" {
			items = append(items, openAIFunctionCallItem(item))
			continue
		}
		if item.Type == "reasoning" {
			items = append(items, openAIReasoningItem(item))
			continue
		}
		items = append(items, item)
	}
	return items
}

func completedResponsesResponse(id string, model string, usage *dto.Usage, outputs []dto.ResponsesOutput) map[string]any {
	return map[string]any{
		"id":                   id,
		"object":               "response",
		"created_at":           int(common.GetTimestamp()),
		"status":               "completed",
		"model":                model,
		"output":               openAIResponsesOutputItems(outputs),
		"parallel_tool_calls":  true,
		"previous_response_id": nil,
		"store":                false,
		"tool_choice":          "auto",
		"tools":                []any{},
		"truncation":           nil,
		"usage":                openAIResponsesUsage(usage),
	}
}

func outputsFromClaudeMessage(response *dto.ClaudeResponse) []dto.ResponsesOutput {
	outputs := make([]dto.ResponsesOutput, 0, len(response.Content))
	var text strings.Builder
	for _, content := range response.Content {
		switch content.Type {
		case "text":
			text.WriteString(content.GetText())
		case "tool_use":
			args, _ := common.Marshal(content.Input)
			outputs = append(outputs, dto.ResponsesOutput{
				ID:        fmt.Sprintf("fc_%s", common.GetUUID()),
				Type:      "function_call",
				Status:    "completed",
				CallId:    content.Id,
				Name:      content.Name,
				Arguments: json.RawMessage(args),
			})
		}
	}
	if text.Len() > 0 || len(outputs) == 0 {
		outputs = append([]dto.ResponsesOutput{{
			ID:     fmt.Sprintf("msg_%s", common.GetUUID()),
			Type:   "message",
			Status: "completed",
			Role:   "assistant",
			Content: []dto.ResponsesOutputContent{{
				Type:        "output_text",
				Text:        text.String(),
				Annotations: []interface{}{},
			}},
		}}, outputs...)
	}
	return outputs
}

func claudeRiskWarningPrefix(warning string) string {
	warning = strings.TrimSpace(warning)
	if warning == "" {
		return ""
	}
	return warning + "\n\n"
}

func prependClaudeRiskWarningText(text string, warning string) string {
	prefix := claudeRiskWarningPrefix(warning)
	if prefix == "" {
		return text
	}
	if text == "" {
		return strings.TrimSpace(warning)
	}
	return prefix + text
}

func prependClaudeResponsesRiskWarning(outputs []dto.ResponsesOutput, warning string) {
	if strings.TrimSpace(warning) == "" {
		return
	}
	for i := range outputs {
		if len(outputs[i].Content) == 0 {
			continue
		}
		for j := range outputs[i].Content {
			if outputs[i].Content[j].Type != "" && outputs[i].Content[j].Type != "output_text" && outputs[i].Content[j].Type != "text" {
				continue
			}
			outputs[i].Content[j].Text = prependClaudeRiskWarningText(outputs[i].Content[j].Text, warning)
			return
		}
	}
}
