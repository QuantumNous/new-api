package openai

import (
	"encoding/json"
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

// OaiChatToResponsesHandler adapts a non-streaming upstream Chat Completions
// response back into a Responses API response for Responses-only clients.
// It is the reverse of OaiResponsesToChatHandler.
func OaiChatToResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var chatResp dto.OpenAITextResponse
	if err := common.Unmarshal(body, &chatResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oaiError := chatResp.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}
	service.EnrichChatResponseReasoningDetails(&chatResp, body)

	// Normalize provider-specific usage (cached-token fields) like the native Chat path.
	applyUsagePostProcessing(info, &chatResp.Usage, body)

	respID := helper.GetResponseID(c)
	responsesResp, err := service.ChatCompletionsResponseToResponsesResponse(&chatResp, respID, info.ResponsesToolContext)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if responsesResp.Model == "" {
		responsesResp.Model = info.UpstreamModelName
	}

	usage := &chatResp.Usage
	// Fill total from the parts when the upstream omits it (mirrors captureChatUsage).
	if usage.TotalTokens == 0 {
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	if usage.TotalTokens == 0 {
		// no usage at all -> estimate
		text := service.ExtractOutputTextFromResponses(responsesResp)
		usage = service.ResponseText2Usage(c, text, info.UpstreamModelName, info.GetEstimatePromptTokens())
		responsesResp.Usage = chatUsageToResponsesUsage(usage)
	}

	responseBody, err := common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)
	return usage, nil
}

// OaiChatToResponsesCompactionHandler adapts a non-streaming upstream Chat
// Completions response into a Responses /compact response. The upstream Chat
// call carries Codex's own summarization prompt, so the assistant output IS the
// compacted window; we return it as Responses output items (a message item),
// without fabricating the proprietary encrypted compaction item.
func OaiChatToResponsesCompactionHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var chatResp dto.OpenAITextResponse
	if err := common.Unmarshal(body, &chatResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oaiError := chatResp.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}
	service.EnrichChatResponseReasoningDetails(&chatResp, body)

	// Normalize provider-specific usage (cached-token fields) like the native Chat path.
	applyUsagePostProcessing(info, &chatResp.Usage, body)

	respID := helper.GetResponseID(c)
	responsesResp, err := service.ChatCompletionsResponseToResponsesResponse(&chatResp, respID, info.ResponsesToolContext)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	usage := &chatResp.Usage
	// Fill total from the parts when the upstream omits it (mirrors captureChatUsage).
	if usage.TotalTokens == 0 {
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	if usage.TotalTokens == 0 {
		// no usage at all -> estimate
		text := service.ExtractOutputTextFromResponses(responsesResp)
		usage = service.ResponseText2Usage(c, text, info.UpstreamModelName, info.GetEstimatePromptTokens())
	}

	outputRaw, err := common.Marshal(responsesResp.Output)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	compaction := dto.OpenAIResponsesCompactionResponse{
		ID:        responsesResp.ID,
		Object:    "response",
		CreatedAt: responsesResp.CreatedAt,
		Output:    outputRaw,
		Usage:     chatUsageToResponsesUsage(usage),
	}

	responseBody, err := common.Marshal(compaction)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)
	return usage, nil
}

type responsesToolCallState struct {
	outputIndex   int
	itemID        string
	callID        string
	name          string // upstream (chat) tool name
	displayName   string // original Responses tool name (after back-mapping)
	namespace     string
	isCustomProxy bool
	args          strings.Builder
	added         bool
}

// OaiChatToResponsesStreamHandler consumes an upstream Chat Completions SSE
// stream and emits an equivalent Responses API event stream. It is the reverse
// of OaiResponsesToChatStreamHandler.
func OaiChatToResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	respID := "resp_" + helper.GetResponseID(c)
	createdAt := int(time.Now().Unix())
	model := info.UpstreamModelName

	var (
		usage         = &dto.Usage{}
		usageText     strings.Builder
		streamErr     *types.NewAPIError
		finishReason  string
		lastUsageData string

		seq         int
		sentCreated bool

		// reasoning summary item state (emitted first, before the message)
		reasoningAdded     bool
		reasoningClosed    bool
		reasoningItemID    = "rs_" + helper.GetResponseID(c)
		reasoningOutputIdx int
		reasoningBuilder   strings.Builder
		reasoningFinalItem map[string]any
		explicitReasoning  bool

		// Some OpenAI-compatible reasoning models place thought text in a
		// leading <think>...</think> block instead of reasoning_content.
		inlineThinkState  string
		inlineThinkBuffer strings.Builder

		// assistant message item state
		msgAdded       bool
		msgItemID      = "msg_" + helper.GetResponseID(c)
		msgOutputIndex int
		textBuilder    strings.Builder

		// tool call item state
		toolStates    = make(map[int]*responsesToolCallState)
		toolOrder     []int
		nextOutputIdx int
	)

	emit := func(eventType string, payload map[string]any) bool {
		if streamErr != nil {
			return false
		}
		payload["type"] = eventType
		payload["sequence_number"] = seq
		seq++
		data, err := common.Marshal(payload)
		if err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
			return false
		}
		helper.ResponseChunkData(c, dto.ResponsesStreamResponse{Type: eventType}, string(data))
		return true
	}

	buildResponseObject := func(status string, output []map[string]any, u *dto.Usage) map[string]any {
		obj := map[string]any{
			"id":         respID,
			"object":     "response",
			"created_at": createdAt,
			"status":     status,
			"model":      model,
			"output":     output,
		}
		if u != nil {
			obj["usage"] = map[string]any{
				"input_tokens":  u.PromptTokens,
				"output_tokens": u.CompletionTokens,
				"total_tokens":  u.TotalTokens,
			}
		}
		copyResponsesRequestFieldsToMap(obj, info.ResponsesToolContext)
		return obj
	}

	sendCreatedIfNeeded := func() bool {
		if sentCreated {
			return true
		}
		if !emit("response.created", map[string]any{
			"response": buildResponseObject("in_progress", []map[string]any{}, nil),
		}) {
			return false
		}
		sentCreated = true
		return true
	}

	openMessageItemIfNeeded := func() bool {
		if msgAdded {
			return true
		}
		msgOutputIndex = nextOutputIdx
		nextOutputIdx++
		if !emit("response.output_item.added", map[string]any{
			"output_index": msgOutputIndex,
			"item": map[string]any{
				"type":    "message",
				"id":      msgItemID,
				"status":  "in_progress",
				"role":    "assistant",
				"content": []any{},
			},
		}) {
			return false
		}
		if !emit("response.content_part.added", map[string]any{
			"item_id":       msgItemID,
			"output_index":  msgOutputIndex,
			"content_index": 0,
			"part":          map[string]any{"type": "output_text", "text": ""},
		}) {
			return false
		}
		msgAdded = true
		return true
	}

	// closeReasoningIfOpen finalizes the reasoning summary item. It is called
	// when the first non-reasoning output (text/tool) arrives and again at
	// stream end, so the reasoning item is fully closed before the message item.
	closeReasoningIfOpen := func() bool {
		if !reasoningAdded || reasoningClosed {
			return true
		}
		reasoningClosed = true
		text := reasoningBuilder.String()
		if !emit("response.reasoning_summary_text.done", map[string]any{
			"item_id": reasoningItemID, "output_index": reasoningOutputIdx, "summary_index": 0, "text": text,
		}) {
			return false
		}
		if !emit("response.reasoning_summary_part.done", map[string]any{
			"item_id": reasoningItemID, "output_index": reasoningOutputIdx, "summary_index": 0,
			"part": map[string]any{"type": "summary_text", "text": text},
		}) {
			return false
		}
		reasoningFinalItem = map[string]any{
			"type":    "reasoning",
			"id":      reasoningItemID,
			"status":  "completed",
			"summary": []any{map[string]any{"type": "summary_text", "text": text}},
		}
		if !emit("response.output_item.done", map[string]any{
			"output_index": reasoningOutputIdx, "item": reasoningFinalItem,
		}) {
			return false
		}
		return true
	}

	emitReasoningDelta := func(reasoning string) bool {
		if reasoning == "" || reasoningClosed {
			return true
		}
		if !reasoningAdded {
			reasoningOutputIdx = nextOutputIdx
			nextOutputIdx++
			if !emit("response.output_item.added", map[string]any{
				"output_index": reasoningOutputIdx,
				"item":         map[string]any{"type": "reasoning", "id": reasoningItemID, "status": "in_progress", "summary": []any{}},
			}) {
				return false
			}
			if !emit("response.reasoning_summary_part.added", map[string]any{
				"item_id": reasoningItemID, "output_index": reasoningOutputIdx, "summary_index": 0,
				"part": map[string]any{"type": "summary_text", "text": ""},
			}) {
				return false
			}
			reasoningAdded = true
		}
		reasoningBuilder.WriteString(reasoning)
		usageText.WriteString(reasoning)
		return emit("response.reasoning_summary_text.delta", map[string]any{
			"item_id": reasoningItemID, "output_index": reasoningOutputIdx, "summary_index": 0, "delta": reasoning,
		})
	}

	emitTextDelta := func(content string) bool {
		if content == "" {
			return true
		}
		if !closeReasoningIfOpen() {
			return false
		}
		if !openMessageItemIfNeeded() {
			return false
		}
		textBuilder.WriteString(content)
		usageText.WriteString(content)
		return emit("response.output_text.delta", map[string]any{
			"item_id":       msgItemID,
			"output_index":  msgOutputIndex,
			"content_index": 0,
			"delta":         content,
		})
	}

	processContentDelta := func(content string) bool {
		if content == "" {
			return true
		}
		if explicitReasoning || inlineThinkState == "plain" || inlineThinkState == "done" {
			return emitTextDelta(content)
		}

		inlineThinkBuffer.WriteString(content)
		buffered := inlineThinkBuffer.String()
		trimmed := strings.TrimLeft(buffered, " \t\r\n")

		if inlineThinkState == "" {
			switch {
			case strings.HasPrefix(trimmed, "<think>"):
				inlineThinkState = "active"
			case strings.HasPrefix("<think>", trimmed):
				return true
			default:
				inlineThinkState = "plain"
				inlineThinkBuffer.Reset()
				return emitTextDelta(buffered)
			}
		}

		if inlineThinkState == "active" {
			afterOpen := strings.TrimPrefix(trimmed, "<think>")
			if end := strings.Index(afterOpen, "</think>"); end >= 0 {
				reasoning := strings.TrimSpace(afterOpen[:end])
				answer := strings.TrimLeft(afterOpen[end+len("</think>"):], " \t\r\n")
				inlineThinkState = "done"
				inlineThinkBuffer.Reset()
				if !emitReasoningDelta(reasoning) {
					return false
				}
				return emitTextDelta(answer)
			}
		}
		return true
	}

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if streamErr != nil {
			sr.Stop(streamErr)
			return
		}

		// Surface an in-stream upstream error frame instead of masking it as a
		// successful (empty) completion.
		if oaiErr := chatStreamErrorFromData(data); oaiErr != nil {
			if sendCreatedIfNeeded() {
				failed := buildResponseObject("failed", []map[string]any{}, usage)
				failed["error"] = map[string]any{
					"message": oaiErr.Message,
					"type":    oaiErr.Type,
					"code":    oaiErr.Code,
					"param":   oaiErr.Param,
				}
				_ = emit("response.failed", map[string]any{"response": failed})
			}
			streamErr = types.WithOpenAIError(*oaiErr, http.StatusInternalServerError)
			sr.Stop(streamErr)
			return
		}

		var chunk dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
			logger.LogError(c, "failed to unmarshal chat stream chunk: "+err.Error())
			sr.Error(err)
			return
		}

		if chunk.Model != "" {
			model = chunk.Model
		}
		if chunk.Created != 0 {
			createdAt = int(chunk.Created)
		}
		if chunk.Usage != nil {
			captureChatUsage(usage, chunk.Usage)
			lastUsageData = data
		}

		if !sendCreatedIfNeeded() {
			sr.Stop(streamErr)
			return
		}

		if len(chunk.Choices) == 0 {
			return
		}
		choice := chunk.Choices[0]
		if choice.FinishReason != nil && *choice.FinishReason != "" {
			finishReason = *choice.FinishReason
		}

		// reasoning summary (emitted before any text/tool output)
		if reasoning := choice.Delta.GetReasoningContent(); reasoning != "" && !reasoningClosed {
			explicitReasoning = true
			if !emitReasoningDelta(reasoning) {
				sr.Stop(streamErr)
				return
			}
		}

		// assistant text
		if content := choice.Delta.GetContentString(); content != "" {
			if !processContentDelta(content) {
				sr.Stop(streamErr)
				return
			}
		}

		// tool calls
		if len(choice.Delta.ToolCalls) > 0 {
			if !closeReasoningIfOpen() {
				sr.Stop(streamErr)
				return
			}
		}
		for _, tc := range choice.Delta.ToolCalls {
			idx := 0
			if tc.Index != nil {
				idx = *tc.Index
			}
			st, ok := toolStates[idx]
			if !ok {
				st = &responsesToolCallState{
					outputIndex: nextOutputIdx,
					itemID:      fmt.Sprintf("fc_%s_%d", helper.GetResponseID(c), idx),
				}
				nextOutputIdx++
				toolStates[idx] = st
				toolOrder = append(toolOrder, idx)
			}
			if tc.ID != "" {
				st.callID = tc.ID
			}
			if tc.Function.Name != "" {
				st.name = tc.Function.Name
			}

			// Accumulate arguments first, so a delayed open (name arriving after
			// the id) can flush what was already buffered.
			if tc.Function.Arguments != "" {
				st.args.WriteString(tc.Function.Arguments)
				usageText.WriteString(tc.Function.Arguments)
			}

			// Open the item only once the tool name is known — the item id/type
			// (custom_tool_call vs function_call) depends on it, so opening early
			// with a placeholder name would emit inconsistent events.
			justOpened := false
			if !st.added && st.name != "" {
				if st.callID == "" {
					st.callID = fmt.Sprintf("call_%d", idx)
				}
				st.isCustomProxy = info.ResponsesToolContext.IsCustomToolProxy(st.name)
				var item map[string]any
				if st.isCustomProxy {
					st.itemID = "ctc_" + st.callID
					st.displayName = info.ResponsesToolContext.OriginalCustomToolName(st.name)
					item = map[string]any{
						"type":    "custom_tool_call",
						"id":      st.itemID,
						"status":  "in_progress",
						"call_id": st.callID,
						"name":    st.displayName,
						"input":   "",
					}
				} else {
					st.displayName, st.namespace = info.ResponsesToolContext.OpenAINameForFunctionTool(st.name)
					st.itemID = "fc_" + st.callID
					item = map[string]any{
						"type":      "function_call",
						"id":        st.itemID,
						"status":    "in_progress",
						"call_id":   st.callID,
						"name":      st.displayName,
						"arguments": "",
					}
					if st.namespace != "" {
						item["namespace"] = st.namespace
					}
				}
				if !emit("response.output_item.added", map[string]any{"output_index": st.outputIndex, "item": item}) {
					sr.Stop(streamErr)
					return
				}
				st.added = true
				justOpened = true
				usageText.WriteString(st.name)
			}

			// Emit function-call argument deltas (custom-proxy tools suppress them;
			// their reconstructed input is delivered once at the end). On open,
			// flush any buffered args as a single delta; otherwise emit this chunk.
			if st.added && !st.isCustomProxy {
				delta := ""
				if justOpened {
					delta = st.args.String()
				} else if tc.Function.Arguments != "" {
					delta = tc.Function.Arguments
				}
				if delta != "" {
					if !emit("response.function_call_arguments.delta", map[string]any{
						"item_id":      st.itemID,
						"output_index": st.outputIndex,
						"delta":        delta,
					}) {
						sr.Stop(streamErr)
						return
					}
				}
			}
		}
	})

	if streamErr != nil {
		return nil, streamErr
	}

	if inlineThinkBuffer.Len() > 0 {
		buffered := inlineThinkBuffer.String()
		inlineThinkBuffer.Reset()
		if inlineThinkState == "active" {
			trimmed := strings.TrimLeft(buffered, " \t\r\n")
			if !emitReasoningDelta(strings.TrimSpace(strings.TrimPrefix(trimmed, "<think>"))) {
				return nil, streamErr
			}
		} else if !emitTextDelta(buffered) {
			return nil, streamErr
		}
	}

	// The stream may end before any data arrived (e.g. empty completion).
	if !sendCreatedIfNeeded() {
		return nil, streamErr
	}

	// close reasoning summary item (if the model reasoned but produced no text)
	if !closeReasoningIfOpen() {
		return nil, streamErr
	}

	finalOutput := make([]map[string]any, 0, 2+len(toolOrder))
	// reasoning item comes first in the output order (output_index 0)
	if reasoningFinalItem != nil {
		finalOutput = append(finalOutput, reasoningFinalItem)
	}

	// close assistant message item
	if msgAdded {
		fullText := textBuilder.String()
		if !emit("response.output_text.done", map[string]any{
			"item_id":       msgItemID,
			"output_index":  msgOutputIndex,
			"content_index": 0,
			"text":          fullText,
		}) {
			return nil, streamErr
		}
		if !emit("response.content_part.done", map[string]any{
			"item_id":       msgItemID,
			"output_index":  msgOutputIndex,
			"content_index": 0,
			"part":          map[string]any{"type": "output_text", "text": fullText},
		}) {
			return nil, streamErr
		}
		messageItem := map[string]any{
			"type":    "message",
			"id":      msgItemID,
			"status":  "completed",
			"role":    "assistant",
			"content": []any{map[string]any{"type": "output_text", "text": fullText}},
		}
		if !emit("response.output_item.done", map[string]any{
			"output_index": msgOutputIndex,
			"item":         messageItem,
		}) {
			return nil, streamErr
		}
		finalOutput = append(finalOutput, messageItem)
	}

	// close tool call items
	for _, idx := range toolOrder {
		st := toolStates[idx]
		// A tool that only ever produced arguments (no id/name) was never added.
		if !st.added {
			if st.callID == "" {
				st.callID = fmt.Sprintf("call_%d", idx)
			}
			if st.name == "" {
				st.name = "unknown_tool"
			}
			st.isCustomProxy = info.ResponsesToolContext.IsCustomToolProxy(st.name)
			if st.isCustomProxy {
				st.itemID = "ctc_" + st.callID
				st.displayName = info.ResponsesToolContext.OriginalCustomToolName(st.name)
			} else {
				st.displayName, st.namespace = info.ResponsesToolContext.OpenAINameForFunctionTool(st.name)
				st.itemID = "fc_" + st.callID
			}
			addedItem := map[string]any{"type": "function_call", "id": st.itemID, "status": "in_progress", "call_id": st.callID, "name": st.displayName, "arguments": ""}
			if st.isCustomProxy {
				addedItem = map[string]any{"type": "custom_tool_call", "id": st.itemID, "status": "in_progress", "call_id": st.callID, "name": st.displayName, "input": ""}
			} else if st.namespace != "" {
				addedItem["namespace"] = st.namespace
			}
			if !emit("response.output_item.added", map[string]any{"output_index": st.outputIndex, "item": addedItem}) {
				return nil, streamErr
			}
			st.added = true
		}

		args := st.args.String()
		item := service.ResponseToolCallItem(st.callID, st.name, args, info.ResponsesToolContext)
		if st.isCustomProxy {
			// deliver the fully reconstructed input as a single delta at the end,
			// then a matching done event so clients know the input is complete
			input, _ := item["input"].(string)
			if !emit("response.custom_tool_call_input.delta", map[string]any{
				"item_id":      st.itemID,
				"call_id":      st.callID,
				"output_index": st.outputIndex,
				"delta":        input,
			}) {
				return nil, streamErr
			}
			if !emit("response.custom_tool_call_input.done", map[string]any{
				"item_id":      st.itemID,
				"call_id":      st.callID,
				"output_index": st.outputIndex,
				"input":        input,
			}) {
				return nil, streamErr
			}
		} else {
			if !emit("response.function_call_arguments.done", map[string]any{
				"item_id":      st.itemID,
				"output_index": st.outputIndex,
				"arguments":    args,
			}) {
				return nil, streamErr
			}
		}
		if !emit("response.output_item.done", map[string]any{
			"output_index": st.outputIndex,
			"item":         item,
		}) {
			return nil, streamErr
		}
		finalOutput = append(finalOutput, item)
	}

	// Normalize provider-specific usage (cached-token fields) like the native
	// Chat stream path, using the last usage-bearing frame as the body.
	applyUsagePostProcessing(info, usage, common.StringToByteSlice(lastUsageData))

	if usage.TotalTokens == 0 {
		usage = service.ResponseText2Usage(c, usageText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}

	// Preserve length truncation: report status=incomplete like the non-stream path.
	completedResp := buildResponseObject("completed", finalOutput, usage)
	if finishReason == "length" {
		completedResp["status"] = "incomplete"
		completedResp["incomplete_details"] = map[string]any{"reason": "max_output_tokens"}
	}
	if !emit("response.completed", map[string]any{
		"response": completedResp,
	}) {
		return nil, streamErr
	}

	if info.RelayFormat == types.RelayFormatOpenAI {
		helper.Done(c)
	}

	return usage, nil
}

// chatStreamErrorFromData detects an in-stream Chat error frame
// (data: {"error": {...}}) and returns the parsed OpenAI error, or nil.
func chatStreamErrorFromData(data string) *types.OpenAIError {
	var probe struct {
		Error any `json:"error"`
	}
	if err := common.UnmarshalJsonStr(data, &probe); err != nil || probe.Error == nil {
		return nil
	}
	if e := dto.GetOpenAIError(probe.Error); e != nil && e.Type != "" {
		return e
	}
	return nil
}

func copyResponsesRequestFieldsToMap(out map[string]any, toolCtx *dto.ResponsesToolContext) {
	if out == nil || toolCtx == nil || toolCtx.OriginalRequest == nil {
		return
	}
	req := toolCtx.OriginalRequest
	fields := map[string]any{
		"instructions":         req.Instructions,
		"reasoning":            req.Reasoning,
		"tool_choice":          req.ToolChoice,
		"tools":                req.Tools,
		"metadata":             req.Metadata,
		"parallel_tool_calls":  req.ParallelToolCalls,
		"previous_response_id": req.PreviousResponseID,
	}
	if req.MaxOutputTokens != nil {
		fields["max_output_tokens"] = *req.MaxOutputTokens
	}
	if req.Temperature != nil {
		fields["temperature"] = *req.Temperature
	}
	if req.TopP != nil {
		fields["top_p"] = *req.TopP
	}
	for key, value := range fields {
		switch typed := value.(type) {
		case nil:
			continue
		case string:
			if typed == "" {
				continue
			}
		case json.RawMessage:
			if len(typed) == 0 {
				continue
			}
		}
		out[key] = value
	}
}

// captureChatUsage copies token counts from an upstream Chat usage payload into
// the accumulator, normalizing to both Chat and Responses field names.
func captureChatUsage(dst *dto.Usage, src *dto.Usage) {
	if src == nil {
		return
	}
	if src.PromptTokens != 0 {
		dst.PromptTokens = src.PromptTokens
		dst.InputTokens = src.PromptTokens
	}
	if src.CompletionTokens != 0 {
		dst.CompletionTokens = src.CompletionTokens
		dst.OutputTokens = src.CompletionTokens
	}
	if src.TotalTokens != 0 {
		dst.TotalTokens = src.TotalTokens
	} else if dst.TotalTokens == 0 {
		dst.TotalTokens = dst.PromptTokens + dst.CompletionTokens
	}
	// Preserve the full token detail structs (image/audio/text/cache), which
	// quota settlement uses to price multimodal/cached usage.
	if src.PromptTokensDetails != (dto.InputTokenDetails{}) {
		dst.PromptTokensDetails = src.PromptTokensDetails
	}
	if src.CompletionTokenDetails != (dto.OutputTokenDetails{}) {
		dst.CompletionTokenDetails = src.CompletionTokenDetails
	}
}

// chatUsageToResponsesUsage mirrors the Chat token counts onto the Responses
// usage shape (input_tokens / output_tokens).
func chatUsageToResponsesUsage(u *dto.Usage) *dto.Usage {
	if u == nil {
		return nil
	}
	out := *u
	out.InputTokens = u.PromptTokens
	out.OutputTokens = u.CompletionTokens
	if out.TotalTokens == 0 {
		out.TotalTokens = out.PromptTokens + out.CompletionTokens
	}
	return &out
}
