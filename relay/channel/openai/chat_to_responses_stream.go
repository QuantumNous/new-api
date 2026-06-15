package openai

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// OaiChatToResponsesHandler 将非流式的 Chat Completions 上游响应转换为 Responses API 格式写回客户端。
// 用于 stream=false 时，读取完整响应体后通过 service.ChatCompletionsResponseToResponsesResponse 转换。
func OaiChatToResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	var chatResp dto.OpenAITextResponse
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	if err := common.Unmarshal(body, &chatResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if oaiError := chatResp.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	responsesResp, err := service.ChatCompletionsResponseToResponsesResponse(&chatResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	responseBody, err := common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	usage := &dto.Usage{}
	if chatResp.Usage.PromptTokens > 0 || chatResp.Usage.CompletionTokens > 0 {
		usage.PromptTokens = chatResp.Usage.PromptTokens
		usage.InputTokens = chatResp.Usage.PromptTokens
		usage.CompletionTokens = chatResp.Usage.CompletionTokens
		usage.OutputTokens = chatResp.Usage.CompletionTokens
		usage.TotalTokens = chatResp.Usage.TotalTokens
		usage.PromptTokensDetails = chatResp.Usage.PromptTokensDetails
		usage.CompletionTokenDetails = chatResp.Usage.CompletionTokenDetails
	}

	return usage, nil
}

// toolCallState 追踪流式构建中的单个 function_call 输出项。
// Chat Completions 流式协议中，工具调用信息可能分多个 chunk 到达：
// 第一个 chunk 包含 id + name + 空 arguments，后续 chunk 携带 arguments 增量。
// 通过 Chat Completions 的 index 字段（而非 callID）来跨 chunk 关联同一个工具调用。
type toolCallState struct {
	callID   string
	name     string
	args     string
	itemIdx  int
	nameDone bool
	addedEmitted bool
}

// OaiChatToResponsesStreamHandler 将流式 Chat Completions 上游响应（SSE 格式）转换为 Responses API SSE 事件写回客户端。
// 用于 stream=true 时，实时转换每个 chunk。实现参考 codex-proxy 的 StreamTranslator 类：
//
// 事件序列（以含 reasoning + text + tool_calls 的响应为例）：
//
//	response.created
//	→ output_item.added (reasoning) → summary_part.added → summary_text.delta × N → summary_part.done → output_item.done
//	→ output_item.added (message) → content_part.added → output_text.delta × N → content_part.done → output_item.done
//	→ output_item.added (function_call) → function_call_arguments.delta × N
//	→ function_call_arguments.done → output_item.done
//	→ response.completed (含完整 output 数组和 usage)
//
// 追踪三种并发输出类型（reasoning、text、function_call），各自维护独立的状态。
// 当 content 或 tool_calls 到达时，自动关闭 reasoning 输出项。
func OaiChatToResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	respID := helper.GetResponseID(c)
	if !strings.HasPrefix(respID, "resp_") {
		respID = "resp_" + respID
	}
	model := info.UpstreamModelName

	var (
		usage       = &dto.Usage{}
		usageText   strings.Builder
		streamErr   *types.NewAPIError
		createdSent bool
		isFinished  bool

		// All output items accumulated during the stream
		outputItems []dto.ResponsesOutput

		// Reasoning state
		reasStarted    bool
		reasIdx        int
		reasID         string
		reasContentIdx int
		reasBuf        strings.Builder

		// Text/message state
		textStarted    bool
		textIdx        int
		textContentIdx int
		accumulatedText strings.Builder

		// Tool call state keyed by the Chat Completions index field
		tcBuf = make(map[int]*toolCallState)
	)

	// sendResponsesEvent sends a Responses SSE event to the client.
	sendResponsesEvent := func(eventType string, data any) bool {
		payload := map[string]any{"type": eventType}
		switch v := data.(type) {
		case map[string]any:
			for k, val := range v {
				payload[k] = val
			}
		default:
			payload["data"] = data
		}
		jsonData, err := common.Marshal(payload)
		if err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
			return false
		}
		logger.LogDebug(c, "responses sse event: %s %s", eventType, string(jsonData))
		helper.ResponseChunkData(c, dto.ResponsesStreamResponse{Type: eventType}, string(jsonData))
		return true
	}

	// sendCreatedIfNeeded sends the response.created event once.
	sendCreatedIfNeeded := func() bool {
		if createdSent {
			return true
		}
		event := map[string]any{
			"response": map[string]any{
				"id":     respID,
				"object": "response",
				"model":  model,
				"status": "in_progress",
				"output": []any{},
			},
		}
		if !sendResponsesEvent("response.created", event) {
			return false
		}
		createdSent = true
		return true
	}

	// ── Reasoning handling ──

	startReasoning := func() {
		if reasStarted {
			return
		}
		reasStarted = true
		outputIdx := len(outputItems)
		reasIdx = outputIdx
		reasContentIdx = 0
		reasBuf.Reset()
		reasID = respID + "_reas_0"

		item := dto.ResponsesOutput{
			Type:   "reasoning",
			ID:     reasID,
			Status: "in_progress",
			Content: []dto.ResponsesOutputContent{
				{Type: "summary_text", Text: ""},
			},
		}
		outputItems = append(outputItems, item)

		if !sendCreatedIfNeeded() {
			return
		}
		sendResponsesEvent("response.output_item.added", map[string]any{
			"output_index": outputIdx,
			"item":         outputItems[outputIdx],
		})
		sendResponsesEvent("response.reasoning_summary_part.added", map[string]any{
			"output_index":  outputIdx,
			"content_index": reasContentIdx,
			"part":          outputItems[outputIdx].Content[0],
		})
	}

	handleReasoning := func(delta string) {
		if streamErr != nil {
			return
		}
		if !reasStarted {
			startReasoning()
		}
		if streamErr != nil {
			return
		}
		reasBuf.WriteString(delta)
		outputItems[reasIdx].Content[0].Text = reasBuf.String()

		sendResponsesEvent("response.reasoning_summary_text.delta", map[string]any{
			"output_index":  reasIdx,
			"content_index": reasContentIdx,
			"delta":         delta,
		})
	}

	finalizeReasoning := func() {
		if !reasStarted {
			return
		}
		item := &outputItems[reasIdx]
		item.Status = "completed"
		item.Content[0].Text = reasBuf.String()

		sendResponsesEvent("response.reasoning_summary_part.done", map[string]any{
			"output_index":  reasIdx,
			"content_index": reasContentIdx,
			"part":          item.Content[0],
		})
		sendResponsesEvent("response.output_item.done", map[string]any{
			"output_index": reasIdx,
			"item":         *item,
		})
		reasStarted = false
	}

	// ── Text/message handling ──

	startText := func() {
		if textStarted {
			return
		}
		textStarted = true
		outputIdx := len(outputItems)
		textIdx = outputIdx
		textContentIdx = 0
		accumulatedText.Reset()

		item := dto.ResponsesOutput{
			Type:   "message",
			ID:     respID + "_msg_0",
			Status: "in_progress",
			Role:   "assistant",
			Content: []dto.ResponsesOutputContent{
				{Type: "output_text", Text: "", Annotations: []interface{}{}},
			},
		}
		outputItems = append(outputItems, item)

		if !sendCreatedIfNeeded() {
			return
		}
		sendResponsesEvent("response.output_item.added", map[string]any{
			"output_index": outputIdx,
			"item":         outputItems[outputIdx],
		})
		sendResponsesEvent("response.content_part.added", map[string]any{
			"output_index":  outputIdx,
			"content_index": textContentIdx,
			"part":          outputItems[outputIdx].Content[0],
		})
	}

	handleText := func(delta string) {
		if streamErr != nil {
			return
		}
		if !textStarted {
			startText()
		}
		if streamErr != nil {
			return
		}
		accumulatedText.WriteString(delta)
		usageText.WriteString(delta)
		outputItems[textIdx].Content[0].Text = accumulatedText.String()

		sendResponsesEvent("response.output_text.delta", map[string]any{
			"output_index":  textIdx,
			"content_index": textContentIdx,
			"delta":         delta,
		})
	}

	finalizeText := func() {
		if !textStarted {
			return
		}
		item := &outputItems[textIdx]
		item.Status = "completed"
		item.Content[0].Text = accumulatedText.String()

		sendResponsesEvent("response.content_part.done", map[string]any{
			"output_index":  textIdx,
			"content_index": textContentIdx,
			"part":          item.Content[0],
		})
		sendResponsesEvent("response.output_item.done", map[string]any{
			"output_index": textIdx,
			"item":         *item,
		})
		textStarted = false
	}

	// ── Tool call handling ──

	handleToolCall := func(tc dto.ToolCallResponse) {
		tcIndex := 0
		if tc.Index != nil {
			tcIndex = *tc.Index
		}

		buf, exists := tcBuf[tcIndex]
		if !exists {
			callID := tc.ID
			if callID == "" {
				callID = fmt.Sprintf("%s_tc_%d", respID, len(tcBuf))
			}
			fn := tc.Function
			itemIdx := len(outputItems)
			name := fn.Name

			logger.LogDebug(c, "responses stream: new tool_call idx=%d name=%s callID=%s", tcIndex, name, callID)
			buf = &toolCallState{
				callID:   callID,
				name:     name,
				args:     "",
				itemIdx:  itemIdx,
				nameDone: name != "",
			}
			tcBuf[tcIndex] = buf

			item := dto.ResponsesOutput{
				Type:   "function_call",
				ID:     callID,
				Status: "in_progress",
				CallId: callID,
				Name:   name,
			}
			outputItems = append(outputItems, item)

			// Only emit output_item.added if we have the name now
			if name != "" {
				if !sendCreatedIfNeeded() {
					return
				}
				sendResponsesEvent("response.output_item.added", map[string]any{
					"output_index": itemIdx,
					"item":         outputItems[itemIdx],
				})
				buf.addedEmitted = true
			}
		}

		fn := tc.Function

		// Name arrives in a later chunk
		if fn.Name != "" && !buf.nameDone {
			buf.name = fn.Name
			buf.nameDone = true
			outputItems[buf.itemIdx].Name = fn.Name

			if !buf.addedEmitted {
				buf.addedEmitted = true
				if !sendCreatedIfNeeded() {
					return
				}
				sendResponsesEvent("response.output_item.added", map[string]any{
					"output_index": buf.itemIdx,
					"item":         outputItems[buf.itemIdx],
				})
			}
		}

		if !buf.addedEmitted && buf.nameDone {
			buf.addedEmitted = true
		}

		// Arguments delta
		if fn.Arguments != "" {
			buf.args += fn.Arguments
			// arguments must be a JSON string in the Responses API, not a raw JSON object
			argsJSON, _ := json.Marshal(buf.args)
			outputItems[buf.itemIdx].Arguments = argsJSON
			usageText.WriteString(fn.Arguments)

			sendResponsesEvent("response.function_call_arguments.delta", map[string]any{
				"output_index": buf.itemIdx,
				"call_id":      buf.callID,
				"delta":        fn.Arguments,
			})
		}
	}

	finalizeAllToolCalls := func() {
		for _, buf := range tcBuf {
			item := &outputItems[buf.itemIdx]
			item.Status = "completed"

			sendResponsesEvent("response.function_call_arguments.done", map[string]any{
				"output_index": buf.itemIdx,
				"call_id":      buf.callID,
				"arguments":    buf.args,
			})
			sendResponsesEvent("response.output_item.done", map[string]any{
				"output_index": buf.itemIdx,
				"item":         *item,
			})
		}
		tcBuf = make(map[int]*toolCallState)
	}

	// ── Finish ──

	finish := func() {
		if isFinished {
			return
		}
		logger.LogDebug(c, "responses stream finish called, reasStarted=%v textStarted=%v toolCalls=%d", reasStarted, textStarted, len(tcBuf))
		isFinished = true

		// Finalize active output items: reasoning → text → tool_calls
		if reasStarted {
			finalizeReasoning()
		}
		if textStarted {
			finalizeText()
		}
		finalizeAllToolCalls()

		if !sendCreatedIfNeeded() {
			return
		}

		// Estimate usage if upstream did not provide it
		if usage.TotalTokens == 0 {
			usage = service.ResponseText2Usage(c, usageText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		} else {
			usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		}

		sendResponsesEvent("response.completed", map[string]any{
			"response": map[string]any{
				"id":     respID,
				"object": "response",
				"model":  model,
				"status": "completed",
				"output": outputItems,
				"usage": map[string]any{
					"input_tokens":  usage.PromptTokens,
					"output_tokens": usage.CompletionTokens,
					"total_tokens":  usage.TotalTokens,
				},
			},
		})
	}

	// ── Stream processing ──

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if streamErr != nil {
			sr.Stop(streamErr)
			return
		}

		if len(data) == 0 {
			return
		}

		var streamResp dto.ChatCompletionsStreamResponse
		if err := common.Unmarshal([]byte(data), &streamResp); err != nil {
			logger.LogError(c, "failed to unmarshal chat stream chunk: "+err.Error())
			sr.Error(err)
			return
		}

		if streamResp.Id != "" {
			respID = streamResp.Id
			if !strings.HasPrefix(respID, "resp_") {
				respID = "resp_" + respID
			}
		}
		if streamResp.Model != "" {
			model = streamResp.Model
		}

		if len(streamResp.Choices) == 0 {
			if streamResp.Usage != nil && service.ValidUsage(streamResp.Usage) {
				usage = streamResp.Usage
			}
			return
		}

		choice := streamResp.Choices[0]
		delta := choice.Delta

		// Reasoning content delta
		if delta.ReasoningContent != nil && *delta.ReasoningContent != "" {
			handleReasoning(*delta.ReasoningContent)
		}

		// Close reasoning when content or tool_calls arrives
		if delta.Content != nil && *delta.Content != "" && reasStarted {
			finalizeReasoning()
		}
		if len(delta.ToolCalls) > 0 && reasStarted {
			finalizeReasoning()
		}

		// Content delta
		if delta.Content != nil && *delta.Content != "" {
			handleText(*delta.Content)
		}

		// Tool calls delta - use index field for tracking
		if len(delta.ToolCalls) > 0 {
			for _, tc := range delta.ToolCalls {
				handleToolCall(tc)
			}
		}

		// Finish reason
		if choice.FinishReason != nil && *choice.FinishReason != "" {
			finish()
		}

		// Extract usage from stream chunks
		if streamResp.Usage != nil && service.ValidUsage(streamResp.Usage) {
			usage = streamResp.Usage
		}
	})

	// If the stream ended without finish_reason, force finish
	if !isFinished {
		logger.LogWarn(c, "stream ended without finish_reason, forcing finish")
		finish()
	}

	if streamErr != nil {
		return nil, streamErr
	}




	return usage, nil
}
