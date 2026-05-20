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

// responsesOutputItemText 提取 Responses message item 中可回传给 Chat/Claude 客户端的文本。
//
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：兼容上游只在 response.output_item.done 携带 message.content，而不发送 response.output_text.delta 的流式输出形态。
// 参数说明：item 为 Responses 流事件中的 output item，可为空。
// 返回值说明：返回 assistant message 的正文；无法提取或非 assistant message 时返回空字符串。
func responsesOutputItemText(item *dto.ResponsesOutput) string {
	if item == nil {
		return ""
	}
	if item.Type != "message" {
		return ""
	}
	if item.Role != "" && item.Role != "assistant" {
		return ""
	}

	var preferred strings.Builder
	var fallback strings.Builder
	for _, content := range item.Content {
		if content.Text == "" {
			continue
		}
		if content.Type == "output_text" {
			preferred.WriteString(content.Text)
			continue
		}
		fallback.WriteString(content.Text)
	}
	if preferred.Len() > 0 {
		return preferred.String()
	}
	return fallback.String()
}

// OaiResponsesToChatHandler 将非流式 Responses 响应写回客户端期望的兼容格式。
//
// 编写时间：2026-05-17
// 作者：苍朮
// 用途：解析 OpenAI Responses 非流式响应，并按原始 RelayFormat 输出 Chat、Claude 或 Gemini 兼容响应。
// 参数说明：c 为 Gin 上下文；info 为中继上下文；resp 为上游 HTTP 响应。
// 返回值说明：返回 usage 与 NewAPIError；成功时错误为空。
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

	return writeResponsesAsClientFormat(c, info, resp, &responsesResp)
}

// OaiResponsesStreamToChatHandler 聚合上游 Responses SSE 并写回非流式兼容响应。
//
// 编写时间：2026-05-17
// 作者：苍朮
// 用途：当上游返回 text/event-stream 但客户端未请求 stream 时，将 Responses 流聚合成普通响应。
// 参数说明：c 为 Gin 上下文；info 为中继上下文；resp 为上游 HTTP 流式响应。
// 返回值说明：返回 usage 与 NewAPIError；成功时错误为空。
func OaiResponsesStreamToChatHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	responsesResp, newApiErr := readResponsesStreamFinal(c, info, resp)
	if newApiErr != nil {
		return nil, newApiErr
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	return writeResponsesAsClientFormat(c, info, nil, responsesResp)
}

// writeResponsesAsClientFormat 将 Responses 结构写成客户端原始协议格式。
//
// 编写时间：2026-05-17
// 作者：苍朮
// 用途：复用 Responses -> Chat 的转换结果，并根据 RelayFormat 转成 Claude/Gemini 或直接写 Chat 响应。
// 参数说明：c 为 Gin 上下文；info 为中继上下文；resp 为上游响应，可为空；responsesResp 为已解析 Responses 响应。
// 返回值说明：返回 usage 与 NewAPIError；成功时错误为空。
func writeResponsesAsClientFormat(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, responsesResp *dto.OpenAIResponsesResponse) (*dto.Usage, *types.NewAPIError) {
	chatId := helper.GetResponseID(c)
	chatResp, usage, err := service.ResponsesResponseToChatCompletionsResponse(responsesResp, chatId)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if usage == nil || usage.TotalTokens == 0 {
		text := service.ExtractOutputTextFromResponses(responsesResp)
		usage = service.ResponseText2Usage(c, text, info.UpstreamModelName, info.GetEstimatePromptTokens())
		chatResp.Usage = *usage
	}

	var responseBody []byte
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		claudeResp, claudeUsage, convErr := service.ResponsesResponseToClaudeResponse(responsesResp, chatId)
		if convErr != nil {
			return nil, types.NewOpenAIError(convErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		if claudeUsage != nil && claudeUsage.ServerToolUse != nil && claudeUsage.ServerToolUse.WebSearchRequests > 0 {
			c.Set("claude_web_search_requests", claudeUsage.ServerToolUse.WebSearchRequests)
		}
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

// readResponsesStreamFinal 读取 Responses SSE 并生成最终 Responses 响应。
//
// 编写时间：2026-05-17
// 作者：苍朮
// 用途：优先使用 response.completed 中的完整响应；缺少 completed 时用 output_text delta 兜底聚合文本。
// 参数说明：c 为 Gin 上下文；info 为中继上下文；resp 为上游流式 HTTP 响应。
// 返回值说明：返回最终 Responses 响应与 NewAPIError；成功时错误为空。
func readResponsesStreamFinal(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.OpenAIResponsesResponse, *types.NewAPIError) {
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, helper.InitialScannerBufferSize), helper.DefaultMaxScannerBufferSize)
	scanner.Split(bufio.ScanLines)

	responseId := helper.GetResponseID(c)
	createdAt := int(time.Now().Unix())
	model := info.UpstreamModelName
	var outputText strings.Builder
	var finalResp *dto.OpenAIResponsesResponse

	for scanner.Scan() {
		line := scanner.Text()
		if len(line) < len("data:") || !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" {
			continue
		}
		if strings.HasPrefix(data, "[DONE]") {
			break
		}

		info.SetFirstResponseTime()
		info.ReceivedResponseCount++

		var streamResp dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResp); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}

		switch streamResp.Type {
		case "response.created":
			if streamResp.Response != nil {
				if streamResp.Response.ID != "" {
					responseId = streamResp.Response.ID
				}
				if streamResp.Response.Model != "" {
					model = streamResp.Response.Model
				}
				if streamResp.Response.CreatedAt != 0 {
					createdAt = streamResp.Response.CreatedAt
				}
			}
		case "response.output_text.delta":
			outputText.WriteString(streamResp.Delta)
		case "response.completed":
			if streamResp.Response != nil {
				finalResp = streamResp.Response
			}
		case "response.error", "response.failed":
			if streamResp.Response != nil {
				if oaiErr := streamResp.Response.GetOpenAIError(); oaiErr != nil && oaiErr.Type != "" {
					return nil, types.WithOpenAIError(*oaiErr, http.StatusInternalServerError)
				}
			}
			return nil, types.NewOpenAIError(fmt.Errorf("responses stream error: %s", streamResp.Type), types.ErrorCodeBadResponse, http.StatusInternalServerError)
		default:
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	if finalResp != nil {
		return finalResp, nil
	}

	return &dto.OpenAIResponsesResponse{
		ID:        responseId,
		Object:    "response",
		CreatedAt: createdAt,
		Model:     model,
		Output: []dto.ResponsesOutput{
			{
				Type: "message",
				Role: "assistant",
				Content: []dto.ResponsesOutputContent{
					{
						Type: "output_text",
						Text: outputText.String(),
					},
				},
			},
		},
	}, nil
}

// OaiResponsesToChatStreamHandler 将流式 Responses SSE 写回客户端期望的兼容流格式。
//
// 编写时间：2026-05-18
// 作者：苍朮
// 用途：解析上游 Responses 流事件，并按原始 RelayFormat 输出 Chat、Claude 或 Gemini 兼容流。
// 参数说明：c 为 Gin 上下文；info 为中继上下文；resp 为上游 HTTP 流式响应。
// 返回值说明：返回 usage 与 NewAPIError；成功时错误为空。
func OaiResponsesToChatStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	responseId := helper.GetResponseID(c)
	createAt := time.Now().Unix()
	model := info.UpstreamModelName

	var (
		usage       = &dto.Usage{}
		outputText  strings.Builder
		usageText   strings.Builder
		sentStart   bool
		sentStop    bool
		sawToolCall bool
		streamErr   *types.NewAPIError
	)

	toolCallIndexByID := make(map[string]int)
	toolCallNameByID := make(map[string]string)
	toolCallArgsByID := make(map[string]string)
	toolCallNameSent := make(map[string]bool)
	toolCallCanonicalIDByItemID := make(map[string]string)
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
		if !sendChatChunk(helper.GenerateStartEmptyResponse(responseId, createAt, model, nil)) {
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

		usageText.WriteString(delta)
		chunk := &dto.ChatCompletionsStreamResponse{
			Id:      responseId,
			Object:  "chat.completion.chunk",
			Created: createAt,
			Model:   model,
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
		if !sendStartIfNeeded() {
			return false
		}

		idx, ok := toolCallIndexByID[callID]
		if !ok {
			idx = len(toolCallIndexByID)
			toolCallIndexByID[callID] = idx
		}
		if name != "" {
			toolCallNameByID[callID] = name
		}
		if toolCallNameByID[callID] != "" {
			name = toolCallNameByID[callID]
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
			Id:      responseId,
			Object:  "chat.completion.chunk",
			Created: createAt,
			Model:   model,
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
		sawToolCall = true

		// Include tool call data in the local builder for fallback token estimation.
		if tool.Function.Name != "" {
			usageText.WriteString(tool.Function.Name)
		}
		if argsDelta != "" {
			usageText.WriteString(argsDelta)
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

		switch streamResp.Type {
		case "response.created":
			if streamResp.Response != nil {
				if streamResp.Response.Model != "" {
					model = streamResp.Response.Model
				}
				if streamResp.Response.CreatedAt != 0 {
					createAt = int64(streamResp.Response.CreatedAt)
				}
			}

		//case "response.reasoning_text.delta":
		//if !sendReasoningDelta(streamResp.Delta) {
		//	sr.Stop(streamErr)
		//	return
		//}

		//case "response.reasoning_text.done":

		case "response.reasoning_summary_text.delta":
			if !sendReasoningSummaryDelta(streamResp.Delta) {
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

			if streamResp.Delta != "" {
				outputText.WriteString(streamResp.Delta)
				usageText.WriteString(streamResp.Delta)
				delta := streamResp.Delta
				chunk := &dto.ChatCompletionsStreamResponse{
					Id:      responseId,
					Object:  "chat.completion.chunk",
					Created: createAt,
					Model:   model,
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
			if streamResp.Item == nil {
				break
			}
			if streamResp.Type == "response.output_item.done" &&
				streamResp.Item.Type == dto.BuildInCallWebSearchCall &&
				streamResp.Item.Status == "completed" &&
				info.RelayFormat == types.RelayFormatClaude {
				if !sendStartIfNeeded() {
					sr.Stop(streamErr)
					return
				}
				for _, claudeResp := range service.ClaudeWebSearchStreamResponses(streamResp.Item, info) {
					if claudeResp == nil {
						continue
					}
					_ = helper.ClaudeData(c, *claudeResp)
				}
				c.Set("claude_web_search_requests", c.GetInt("claude_web_search_requests")+1)
				break
			}
			if streamResp.Type == "response.output_item.done" && streamResp.Item.Type == "message" {
				text := responsesOutputItemText(streamResp.Item)
				delta := stringDeltaFromPrefix(outputText.String(), text)
				if delta == "" {
					break
				}
				if !sendStartIfNeeded() {
					sr.Stop(streamErr)
					return
				}

				outputText.WriteString(delta)
				usageText.WriteString(delta)
				chunk := &dto.ChatCompletionsStreamResponse{
					Id:      responseId,
					Object:  "chat.completion.chunk",
					Created: createAt,
					Model:   model,
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
				break
			}
			if streamResp.Item.Type != "function_call" {
				break
			}

			itemID := strings.TrimSpace(streamResp.Item.ID)
			callID := strings.TrimSpace(streamResp.Item.CallId)
			if callID == "" {
				callID = itemID
			}
			if itemID != "" && callID != "" {
				toolCallCanonicalIDByItemID[itemID] = callID
			}
			name := strings.TrimSpace(streamResp.Item.Name)
			if name != "" {
				toolCallNameByID[callID] = name
			}

			newArgs := streamResp.Item.ArgumentsString()
			prevArgs := toolCallArgsByID[callID]
			argsDelta := ""
			if newArgs != "" {
				if strings.HasPrefix(newArgs, prevArgs) {
					argsDelta = newArgs[len(prevArgs):]
				} else {
					argsDelta = newArgs
				}
				toolCallArgsByID[callID] = newArgs
			}

			if !sendToolCallDelta(callID, name, argsDelta) {
				sr.Stop(streamErr)
				return
			}

		case "response.function_call_arguments.delta":
			itemID := strings.TrimSpace(streamResp.ItemID)
			callID := toolCallCanonicalIDByItemID[itemID]
			if callID == "" {
				callID = itemID
			}
			if callID == "" {
				break
			}
			toolCallArgsByID[callID] += streamResp.Delta
			if !sendToolCallDelta(callID, "", streamResp.Delta) {
				sr.Stop(streamErr)
				return
			}

		case "response.function_call_arguments.done":

		case "response.completed":
			if streamResp.Response != nil {
				if streamResp.Response.Model != "" {
					model = streamResp.Response.Model
				}
				if streamResp.Response.CreatedAt != 0 {
					createAt = int64(streamResp.Response.CreatedAt)
				}
				if streamResp.Response.Usage != nil {
					if streamResp.Response.Usage.InputTokens != 0 {
						usage.PromptTokens = streamResp.Response.Usage.InputTokens
						usage.InputTokens = streamResp.Response.Usage.InputTokens
					}
					if streamResp.Response.Usage.OutputTokens != 0 {
						usage.CompletionTokens = streamResp.Response.Usage.OutputTokens
						usage.OutputTokens = streamResp.Response.Usage.OutputTokens
					}
					if streamResp.Response.Usage.TotalTokens != 0 {
						usage.TotalTokens = streamResp.Response.Usage.TotalTokens
					} else {
						usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
					}
					if streamResp.Response.Usage.InputTokensDetails != nil {
						usage.PromptTokensDetails.CachedTokens = streamResp.Response.Usage.InputTokensDetails.CachedTokens
						usage.PromptTokensDetails.ImageTokens = streamResp.Response.Usage.InputTokensDetails.ImageTokens
						usage.PromptTokensDetails.AudioTokens = streamResp.Response.Usage.InputTokensDetails.AudioTokens
					}
					if streamResp.Response.Usage.CompletionTokenDetails.ReasoningTokens != 0 {
						usage.CompletionTokenDetails.ReasoningTokens = streamResp.Response.Usage.CompletionTokenDetails.ReasoningTokens
					}
				}
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
				if sawToolCall {
					finishReason = "tool_calls"
				}
				stop := helper.GenerateStopResponse(responseId, createAt, model, finishReason)
				if info.RelayFormat == types.RelayFormatClaude {
					stop.Usage = usage
				}
				if !sendChatChunk(stop) {
					sr.Stop(streamErr)
					return
				}
				sentStop = true
			}

		case "response.error", "response.failed":
			if streamResp.Response != nil {
				if oaiErr := streamResp.Response.GetOpenAIError(); oaiErr != nil && oaiErr.Type != "" {
					streamErr = types.WithOpenAIError(*oaiErr, http.StatusInternalServerError)
					sr.Stop(streamErr)
					return
				}
			}
			streamErr = types.NewOpenAIError(fmt.Errorf("responses stream error: %s", streamResp.Type), types.ErrorCodeBadResponse, http.StatusInternalServerError)
			sr.Stop(streamErr)
			return

		default:
		}
	})

	if streamErr != nil {
		return nil, streamErr
	}

	if usage.TotalTokens == 0 {
		usage = service.ResponseText2Usage(c, usageText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}

	if !sentStart {
		if !sendChatChunk(helper.GenerateStartEmptyResponse(responseId, createAt, model, nil)) {
			return nil, streamErr
		}
	}
	if !sentStop {
		if info.RelayFormat == types.RelayFormatClaude && info.ClaudeConvertInfo != nil {
			info.ClaudeConvertInfo.Usage = usage
		}
		finishReason := "stop"
		if sawToolCall {
			finishReason = "tool_calls"
		}
		stop := helper.GenerateStopResponse(responseId, createAt, model, finishReason)
		if info.RelayFormat == types.RelayFormatClaude {
			stop.Usage = usage
		}
		if !sendChatChunk(stop) {
			return nil, streamErr
		}
	}
	if info.RelayFormat == types.RelayFormatOpenAI && info.ShouldIncludeUsage && usage != nil {
		if err := helper.ObjectData(c, helper.GenerateFinalUsageResponse(responseId, createAt, model, *usage)); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
	}

	if info.RelayFormat == types.RelayFormatOpenAI {
		helper.Done(c)
	}
	return usage, nil
}
