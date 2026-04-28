package openai

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func responsesStreamIndexKey(itemID string, idx *int) string {
	if itemID == "" {
		return ""
	}
	if idx == nil {
		return itemID
	}
	return fmt.Sprintf("%s:%d", itemID, *idx)
}

func stringDeltaFromPrefix(prev string, next string) string {
	if next == "" {
		return ""
	}
	if prev != "" && strings.HasPrefix(next, prev) {
		return next[len(prev):]
	}
	return next
}

type responsesStreamAccumulator struct {
	c    *gin.Context
	info *relaycommon.RelayInfo

	responseID string
	createdAt  int64
	model      string

	usage         *dto.Usage
	outputText    strings.Builder
	reasoningText strings.Builder
	usageText     strings.Builder

	sawToolCall                 bool
	toolCallIndexByID           map[string]int
	toolCallNameByID            map[string]string
	toolCallArgsByID            map[string]string
	toolCallCanonicalIDByItemID map[string]string
	lastToolCallID              string
	lastToolCallName            string
	lastToolCallArgsDelta       string
	err                         *types.NewAPIError
}

func newResponsesStreamAccumulator(c *gin.Context, info *relaycommon.RelayInfo, responseID string, createdAt int64, model string) *responsesStreamAccumulator {
	return &responsesStreamAccumulator{
		c:                           c,
		info:                        info,
		responseID:                  responseID,
		createdAt:                   createdAt,
		model:                       model,
		usage:                       &dto.Usage{},
		toolCallIndexByID:           make(map[string]int),
		toolCallNameByID:            make(map[string]string),
		toolCallArgsByID:            make(map[string]string),
		toolCallCanonicalIDByItemID: make(map[string]string),
	}
}

func (a *responsesStreamAccumulator) Apply(ev *dto.ResponsesStreamResponse) error {
	if a == nil || ev == nil {
		return nil
	}
	if a.err != nil {
		return a.applyError()
	}

	a.lastToolCallID = ""
	a.lastToolCallName = ""
	a.lastToolCallArgsDelta = ""

	switch ev.Type {
	case "response.created":
		a.applyResponseMeta(ev.Response)

	case "response.output_text.delta":
		if ev.Delta != "" {
			a.outputText.WriteString(ev.Delta)
			a.usageText.WriteString(ev.Delta)
		}

	case "response.reasoning_summary_text.delta":
		if ev.Delta != "" {
			a.reasoningText.WriteString(ev.Delta)
			a.usageText.WriteString(ev.Delta)
		}

	case "response.output_item.added", "response.output_item.done":
		a.applyToolCallItem(ev.Item)

	case "response.function_call_arguments.delta":
		a.applyToolCallArgumentsDelta(ev.ItemID, ev.Delta)

	case "response.function_call_arguments.done":

	case "response.completed":
		a.applyResponseMeta(ev.Response)
		a.mergeUsage(ev.Response)

	case "response.error", "response.failed":
		if ev.Response != nil {
			if oaiErr := ev.Response.GetOpenAIError(); oaiErr != nil && oaiErr.Type != "" {
				a.err = types.WithOpenAIError(*oaiErr, http.StatusInternalServerError)
			} else {
				a.err = types.NewOpenAIError(fmt.Errorf("responses stream error: %s", ev.Type), types.ErrorCodeBadResponse, http.StatusInternalServerError)
			}
		} else {
			a.err = types.NewOpenAIError(fmt.Errorf("responses stream error: %s", ev.Type), types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
		return a.applyError()

	default:
	}

	return nil
}

func (a *responsesStreamAccumulator) Result() (messageText string, reasoningText string, usage *dto.Usage, toolCalls []dto.ToolCallResponse, err *types.NewAPIError) {
	if a == nil {
		return "", "", nil, nil, nil
	}
	if a.err != nil {
		return "", "", nil, nil, a.err
	}
	usage = a.usage
	if usage == nil {
		usage = &dto.Usage{}
	}
	if usage.TotalTokens == 0 {
		usage = service.ResponseText2Usage(a.c, a.usageText.String(), a.info.UpstreamModelName, a.info.GetEstimatePromptTokens())
		usage.CompletionTokens += len(a.toolCallIndexByID) * 7
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		a.usage = usage
	}
	if a.sawToolCall && a.outputText.Len() == 0 {
		toolCalls = a.orderedToolCalls()
	}
	return a.outputText.String(), a.reasoningText.String(), usage, toolCalls, nil
}

func (a *responsesStreamAccumulator) applyResponseMeta(response *dto.OpenAIResponsesResponse) {
	if response == nil {
		return
	}
	if response.ID != "" {
		a.responseID = response.ID
	}
	if response.Model != "" {
		a.model = response.Model
	}
	if response.CreatedAt != 0 {
		a.createdAt = int64(response.CreatedAt)
	}
}

func (a *responsesStreamAccumulator) mergeUsage(response *dto.OpenAIResponsesResponse) {
	if response == nil || response.Usage == nil {
		return
	}
	if a.usage == nil {
		a.usage = &dto.Usage{}
	}
	if response.Usage.InputTokens != 0 {
		a.usage.PromptTokens = response.Usage.InputTokens
		a.usage.InputTokens = response.Usage.InputTokens
	}
	if response.Usage.OutputTokens != 0 {
		a.usage.CompletionTokens = response.Usage.OutputTokens
		a.usage.OutputTokens = response.Usage.OutputTokens
	}
	if response.Usage.TotalTokens != 0 {
		a.usage.TotalTokens = response.Usage.TotalTokens
	} else {
		a.usage.TotalTokens = a.usage.PromptTokens + a.usage.CompletionTokens
	}
	if response.Usage.InputTokensDetails != nil {
		a.usage.PromptTokensDetails.CachedTokens = response.Usage.InputTokensDetails.CachedTokens
		a.usage.PromptTokensDetails.ImageTokens = response.Usage.InputTokensDetails.ImageTokens
		a.usage.PromptTokensDetails.AudioTokens = response.Usage.InputTokensDetails.AudioTokens
	}
	if response.Usage.CompletionTokenDetails.ReasoningTokens != 0 {
		a.usage.CompletionTokenDetails.ReasoningTokens = response.Usage.CompletionTokenDetails.ReasoningTokens
	}
}

func (a *responsesStreamAccumulator) applyToolCallItem(item *dto.ResponsesOutput) {
	if item == nil || item.Type != "function_call" {
		return
	}
	itemID := strings.TrimSpace(item.ID)
	callID := strings.TrimSpace(item.CallId)
	if callID == "" {
		callID = itemID
	}
	if itemID != "" && callID != "" {
		a.toolCallCanonicalIDByItemID[itemID] = callID
	}
	if callID == "" {
		return
	}
	a.ensureToolCallIndex(callID)
	if name := strings.TrimSpace(item.Name); name != "" {
		if a.toolCallNameByID[callID] != name {
			a.usageText.WriteString(name)
		}
		a.toolCallNameByID[callID] = name
		a.lastToolCallName = name
	}
	if args := item.Arguments; args != "" {
		prevArgs := a.toolCallArgsByID[callID]
		switch {
		case prevArgs == "":
			a.lastToolCallArgsDelta = args
		case strings.HasPrefix(args, prevArgs):
			a.lastToolCallArgsDelta = args[len(prevArgs):]
		case prevArgs != args:
			a.lastToolCallArgsDelta = args
		}
		if a.lastToolCallArgsDelta != "" {
			a.usageText.WriteString(a.lastToolCallArgsDelta)
		}
		a.toolCallArgsByID[callID] = args
	}
	a.lastToolCallID = callID
	a.sawToolCall = true
}

func (a *responsesStreamAccumulator) applyToolCallArgumentsDelta(itemID string, delta string) {
	callID := a.toolCallCanonicalIDByItemID[strings.TrimSpace(itemID)]
	if callID == "" {
		callID = strings.TrimSpace(itemID)
	}
	if callID == "" {
		return
	}
	a.ensureToolCallIndex(callID)
	a.toolCallArgsByID[callID] += delta
	a.usageText.WriteString(delta)
	a.lastToolCallID = callID
	a.lastToolCallArgsDelta = delta
	a.sawToolCall = true
}

func (a *responsesStreamAccumulator) ensureToolCallIndex(callID string) {
	if _, ok := a.toolCallIndexByID[callID]; !ok {
		a.toolCallIndexByID[callID] = len(a.toolCallIndexByID)
	}
}

func (a *responsesStreamAccumulator) orderedToolCalls() []dto.ToolCallResponse {
	toolCalls := make([]dto.ToolCallResponse, 0, len(a.toolCallIndexByID))
	callIDs := make([]string, len(a.toolCallIndexByID))
	for callID, idx := range a.toolCallIndexByID {
		if idx >= 0 && idx < len(callIDs) {
			callIDs[idx] = callID
		}
	}
	for _, callID := range callIDs {
		if callID == "" {
			continue
		}
		toolCalls = append(toolCalls, dto.ToolCallResponse{
			ID:   callID,
			Type: "function",
			Function: dto.FunctionResponse{
				Name:      a.toolCallNameByID[callID],
				Arguments: a.toolCallArgsByID[callID],
			},
		})
	}
	return toolCalls
}

func (a *responsesStreamAccumulator) applyError() error {
	if a == nil || a.err == nil {
		return nil
	}
	if a.err.Err != nil {
		return a.err.Err
	}
	return fmt.Errorf("responses stream error")
}

func OaiResponsesToChatHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	var responsesResp dto.OpenAIResponsesResponse
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	if err := common.Unmarshal(body, &responsesResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if oaiError := responsesResp.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	chatId := helper.GetResponseID(c)
	chatResp, usage, err := service.ResponsesResponseToChatCompletionsResponse(&responsesResp, chatId)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if usage == nil || usage.TotalTokens == 0 {
		text := service.ExtractOutputTextFromResponses(&responsesResp)
		usage = service.ResponseText2Usage(c, text, info.UpstreamModelName, info.GetEstimatePromptTokens())
		chatResp.Usage = *usage
	}

	var responseBody []byte
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		claudeResp := service.ResponseOpenAI2Claude(chatResp, info)
		responseBody, err = common.Marshal(claudeResp)
	case types.RelayFormatGemini:
		geminiResp := service.ResponseOpenAI2Gemini(chatResp, info)
		responseBody, err = common.Marshal(geminiResp)
	default:
		responseBody, err = common.Marshal(chatResp)
	}
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)
	return usage, nil
}

func OaiResponsesToChatStreamToNonStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	responseId := helper.GetResponseID(c)
	createdAt := time.Now().Unix()
	model := info.UpstreamModelName
	var streamErr *types.NewAPIError
	acc := newResponsesStreamAccumulator(c, info, responseId, createdAt, model)

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, helper.InitialScannerBufferSize), helper.DefaultMaxScannerBufferSize)
	for scanner.Scan() {
		data := strings.TrimSpace(scanner.Text())
		if data == "" {
			continue
		}
		if !strings.HasPrefix(data, "data:") && !strings.HasPrefix(data, "[DONE]") && !strings.HasPrefix(data, "event:") {
			continue
		}
		if strings.HasPrefix(data, "event:") {
			continue
		}
		if strings.HasPrefix(data, "data:") {
			data = strings.TrimSpace(data[5:])
		}
		if data == "" || strings.HasPrefix(data, "[DONE]") {
			break
		}

		var streamResp dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResp); err != nil {
			logger.LogError(c, "failed to unmarshal responses stream event: "+err.Error())
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			break
		}

		info.SetFirstResponseTime()
		info.ReceivedResponseCount++

		if err := acc.Apply(&streamResp); err != nil {
			_, _, _, _, streamErr = acc.Result()
		}
		if streamErr != nil {
			break
		}
	}
	if err := scanner.Err(); err != nil && streamErr == nil {
		streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if streamErr != nil {
		return nil, streamErr
	}

	messageText, reasoning, usage, toolCalls, streamErr := acc.Result()
	if streamErr != nil {
		return nil, streamErr
	}

	msg := dto.Message{
		Role:    "assistant",
		Content: messageText,
	}
	if reasoning != "" {
		msg.ReasoningContent = reasoning
	}

	if len(toolCalls) > 0 {
		msg.SetToolCalls(toolCalls)
		msg.Content = ""
	}

	finishReason := "stop"
	if len(toolCalls) > 0 {
		finishReason = "tool_calls"
	}

	chatResp := &dto.OpenAITextResponse{
		Id:      acc.responseID,
		Object:  "chat.completion",
		Created: acc.createdAt,
		Model:   acc.model,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index:        0,
				Message:      msg,
				FinishReason: finishReason,
			},
		},
		Usage: *usage,
	}

	var responseBody []byte
	var err error
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		claudeResp := service.ResponseOpenAI2Claude(chatResp, info)
		responseBody, err = common.Marshal(claudeResp)
	case types.RelayFormatGemini:
		geminiResp := service.ResponseOpenAI2Gemini(chatResp, info)
		responseBody, err = common.Marshal(geminiResp)
	default:
		responseBody, err = common.Marshal(chatResp)
	}
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, nil, responseBody)
	return usage, nil
}

func OaiResponsesToChatStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	responseId := helper.GetResponseID(c)
	createAt := time.Now().Unix()
	model := info.UpstreamModelName
	acc := newResponsesStreamAccumulator(c, info, responseId, createAt, model)

	var (
		sentStart bool
		sentStop  bool
		streamErr *types.NewAPIError
	)

	toolCallNameSent := make(map[string]bool)
	hasSentReasoningSummary := false
	needsReasoningSummarySeparator := false
	//reasoningSummaryTextByKey := make(map[string]string)

	if info.RelayFormat == types.RelayFormatClaude && info.ClaudeConvertInfo == nil {
		info.ClaudeConvertInfo = &relaycommon.ClaudeConvertInfo{LastMessagesType: relaycommon.LastMessageTypeNone}
	}

	sendChatChunk := func(chunk *dto.ChatCompletionsStreamResponse) bool {
		if chunk == nil {
			return true
		}
		if info.RelayFormat == types.RelayFormatOpenAI {
			if err := helper.ObjectData(c, chunk); err != nil {
				streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
				return false
			}
			return true
		}

		chunkData, err := common.Marshal(chunk)
		if err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
			return false
		}
		if err := HandleStreamFormat(c, info, string(chunkData), false, false); err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		return true
	}

	sendStartIfNeeded := func() bool {
		if sentStart {
			return true
		}
		if !sendChatChunk(helper.GenerateStartEmptyResponse(acc.responseID, acc.createdAt, acc.model, nil)) {
			return false
		}
		sentStart = true
		return true
	}

	//sendReasoningDelta := func(delta string) bool {
	//	if delta == "" {
	//		return true
	//	}
	//	if !sendStartIfNeeded() {
	//		return false
	//	}
	//
	//	usageText.WriteString(delta)
	//	chunk := &dto.ChatCompletionsStreamResponse{
	//		Id:      responseId,
	//		Object:  "chat.completion.chunk",
	//		Created: createAt,
	//		Model:   model,
	//		Choices: []dto.ChatCompletionsStreamResponseChoice{
	//			{
	//				Index: 0,
	//				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
	//					ReasoningContent: &delta,
	//				},
	//			},
	//		},
	//	}
	//	if err := helper.ObjectData(c, chunk); err != nil {
	//		streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	//		return false
	//	}
	//	return true
	//}

	sendReasoningSummaryDelta := func(delta string) bool {
		if delta == "" {
			return true
		}
		if needsReasoningSummarySeparator {
			if strings.HasPrefix(delta, "\n\n") {
				needsReasoningSummarySeparator = false
			} else if strings.HasPrefix(delta, "\n") {
				delta = "\n" + delta
				needsReasoningSummarySeparator = false
			} else {
				delta = "\n\n" + delta
				needsReasoningSummarySeparator = false
			}
		}
		if !sendStartIfNeeded() {
			return false
		}

		chunk := &dto.ChatCompletionsStreamResponse{
			Id:      acc.responseID,
			Object:  "chat.completion.chunk",
			Created: acc.createdAt,
			Model:   acc.model,
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{
					Index: 0,
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
						ReasoningContent: &delta,
					},
				},
			},
		}
		if !sendChatChunk(chunk) {
			return false
		}
		hasSentReasoningSummary = true
		return true
	}

	sendToolCallDelta := func(callID string, name string, argsDelta string) bool {
		if callID == "" {
			return true
		}
		if acc.outputText.Len() > 0 {
			// Prefer streaming assistant text over tool calls to match non-stream behavior.
			return true
		}
		if !sendStartIfNeeded() {
			return false
		}

		idx, ok := acc.toolCallIndexByID[callID]
		if !ok {
			idx = len(acc.toolCallIndexByID)
			acc.toolCallIndexByID[callID] = idx
		}
		if acc.toolCallNameByID[callID] != "" {
			name = acc.toolCallNameByID[callID]
		}

		tool := dto.ToolCallResponse{
			ID:   callID,
			Type: "function",
			Function: dto.FunctionResponse{
				Arguments: argsDelta,
			},
		}
		tool.SetIndex(idx)
		if name != "" && !toolCallNameSent[callID] {
			tool.Function.Name = name
			toolCallNameSent[callID] = true
		}

		chunk := &dto.ChatCompletionsStreamResponse{
			Id:      acc.responseID,
			Object:  "chat.completion.chunk",
			Created: acc.createdAt,
			Model:   acc.model,
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{
					Index: 0,
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
						ToolCalls: []dto.ToolCallResponse{tool},
					},
				},
			},
		}
		if !sendChatChunk(chunk) {
			return false
		}
		return true
	}

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if streamErr != nil {
			sr.Stop(streamErr)
			return
		}

		var streamResp dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResp); err != nil {
			logger.LogError(c, "failed to unmarshal responses stream event: "+err.Error())
			sr.Error(err)
			return
		}

		streamEvent := streamResp
		if streamEvent.Type == "response.reasoning_summary_text.delta" && streamEvent.Delta != "" && needsReasoningSummarySeparator {
			if strings.HasPrefix(streamEvent.Delta, "\n\n") {
				needsReasoningSummarySeparator = false
			} else if strings.HasPrefix(streamEvent.Delta, "\n") {
				streamEvent.Delta = "\n" + streamEvent.Delta
				needsReasoningSummarySeparator = false
			} else {
				streamEvent.Delta = "\n\n" + streamEvent.Delta
				needsReasoningSummarySeparator = false
			}
		}

		if err := acc.Apply(&streamEvent); err != nil {
			_, _, _, _, streamErr = acc.Result()
			sr.Stop(streamErr)
			return
		}

		switch streamEvent.Type {
		case "response.created":

		//case "response.reasoning_text.delta":
		//if !sendReasoningDelta(streamResp.Delta) {
		//	sr.Stop(streamErr)
		//	return
		//}

		//case "response.reasoning_text.done":

		case "response.reasoning_summary_text.delta":
			if !sendReasoningSummaryDelta(streamEvent.Delta) {
				sr.Stop(streamErr)
				return
			}

		case "response.reasoning_summary_text.done":
			if hasSentReasoningSummary {
				needsReasoningSummarySeparator = true
			}

		//case "response.reasoning_summary_part.added", "response.reasoning_summary_part.done":
		//	key := responsesStreamIndexKey(strings.TrimSpace(streamResp.ItemID), streamResp.SummaryIndex)
		//	if key == "" || streamResp.Part == nil {
		//		break
		//	}
		//	// Only handle summary text parts, ignore other part types.
		//	if streamResp.Part.Type != "" && streamResp.Part.Type != "summary_text" {
		//		break
		//	}
		//	prev := reasoningSummaryTextByKey[key]
		//	next := streamResp.Part.Text
		//	delta := stringDeltaFromPrefix(prev, next)
		//	reasoningSummaryTextByKey[key] = next
		//	if !sendReasoningSummaryDelta(delta) {
		//		sr.Stop(streamErr)
		//		return
		//	}

		case "response.output_text.delta":
			if !sendStartIfNeeded() {
				sr.Stop(streamErr)
				return
			}

			if streamEvent.Delta != "" {
				delta := streamEvent.Delta
				chunk := &dto.ChatCompletionsStreamResponse{
					Id:      acc.responseID,
					Object:  "chat.completion.chunk",
					Created: acc.createdAt,
					Model:   acc.model,
					Choices: []dto.ChatCompletionsStreamResponseChoice{
						{
							Index: 0,
							Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
								Content: &delta,
							},
						},
					},
				}
				if !sendChatChunk(chunk) {
					sr.Stop(streamErr)
					return
				}
			}

		case "response.output_item.added", "response.output_item.done":
			if !sendToolCallDelta(acc.lastToolCallID, acc.lastToolCallName, acc.lastToolCallArgsDelta) {
				sr.Stop(streamErr)
				return
			}

		case "response.function_call_arguments.delta":
			if !sendToolCallDelta(acc.lastToolCallID, "", acc.lastToolCallArgsDelta) {
				sr.Stop(streamErr)
				return
			}

		case "response.function_call_arguments.done":

		case "response.completed":
			_, _, usage, toolCalls, resultErr := acc.Result()
			if resultErr != nil {
				streamErr = resultErr
				sr.Stop(streamErr)
				return
			}

			if !sendStartIfNeeded() {
				sr.Stop(streamErr)
				return
			}
			if !sentStop {
				if info.RelayFormat == types.RelayFormatClaude && info.ClaudeConvertInfo != nil {
					info.ClaudeConvertInfo.Usage = usage
				}
				finishReason := "stop"
				if len(toolCalls) > 0 {
					finishReason = "tool_calls"
				}
				stop := helper.GenerateStopResponse(acc.responseID, acc.createdAt, acc.model, finishReason)
				if !sendChatChunk(stop) {
					sr.Stop(streamErr)
					return
				}
				sentStop = true
			}

		case "response.error", "response.failed":
			// Error events are converted to streamErr by acc.Apply before dispatch.

		default:
		}
	})

	if streamErr != nil {
		return nil, streamErr
	}

	_, _, usage, toolCalls, streamErr := acc.Result()
	if streamErr != nil {
		return nil, streamErr
	}

	if !sentStart {
		if !sendChatChunk(helper.GenerateStartEmptyResponse(acc.responseID, acc.createdAt, acc.model, nil)) {
			return nil, streamErr
		}
	}
	if !sentStop {
		if info.RelayFormat == types.RelayFormatClaude && info.ClaudeConvertInfo != nil {
			info.ClaudeConvertInfo.Usage = usage
		}
		finishReason := "stop"
		if len(toolCalls) > 0 {
			finishReason = "tool_calls"
		}
		stop := helper.GenerateStopResponse(acc.responseID, acc.createdAt, acc.model, finishReason)
		if !sendChatChunk(stop) {
			return nil, streamErr
		}
	}
	if info.RelayFormat == types.RelayFormatOpenAI && info.ShouldIncludeUsage && usage != nil {
		if err := helper.ObjectData(c, helper.GenerateFinalUsageResponse(acc.responseID, acc.createdAt, acc.model, *usage)); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
	}

	if info.RelayFormat == types.RelayFormatOpenAI {
		helper.Done(c)
	}
	return usage, nil
}
