package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/openaicompat"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// responsesViaChatCompletions converts an incoming /v1/responses request
// into /v1/chat/completions, forwards it to the upstream channel, and
// converts the response back to Responses API format.
//
// This is the reverse of chatCompletionsViaResponses and is used when the
// upstream channel only supports Chat Completions (e.g. NVIDIA NIM, ZhipuAI)
// but the client speaks the Responses API (e.g. OpenAI Codex CLI).
func responsesViaChatCompletions(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, request *dto.OpenAIResponsesRequest) (*dto.Usage, *types.NewAPIError) {
	// Convert responses request → chat completions request
	chatReq, err := openaicompat.ResponsesRequestToChatCompletionsRequest(request)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	info.AppendRequestConversion(types.RelayFormatOpenAI)

	// Save and override relay mode
	savedRelayMode := info.RelayMode
	savedRequestURLPath := info.RequestURLPath
	defer func() {
		info.RelayMode = savedRelayMode
		info.RequestURLPath = savedRequestURLPath
	}()

	info.RelayMode = relayconstant.RelayModeChatCompletions
	info.RequestURLPath = "/v1/chat/completions"

	// Convert via the adaptor (handles model-specific transformations)
	convertedRequest, err := adaptor.ConvertOpenAIRequest(c, info, chatReq)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

	jsonData, err := common.Marshal(convertedRequest)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return nil, newAPIErrorFromParamOverride(err)
		}
	}

	if common.DebugEnabled {
		println("responsesViaChatCompletions requestBody: ", string(jsonData))
	}

	// Send to upstream
	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, info, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	if resp == nil {
		return nil, types.NewOpenAIError(nil, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	var ok bool
	httpResp, ok = resp.(*http.Response)
	if !ok {
		return nil, types.NewOpenAIError(fmt.Errorf("unexpected response type: %T", resp), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
	if httpResp.StatusCode != http.StatusOK {
		newApiErr := service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newApiErr, statusCodeMappingStr)
		return nil, newApiErr
	}

	// Convert response back to Responses API format
	if info.IsStream {
		usage, newApiErr := chatToResponsesStreamHandler(c, info, httpResp)
		if newApiErr != nil {
			service.ResetStatusCode(newApiErr, statusCodeMappingStr)
			return nil, newApiErr
		}
		return usage, nil
	}

	usage, newApiErr := chatToResponsesHandler(c, info, httpResp)
	if newApiErr != nil {
		service.ResetStatusCode(newApiErr, statusCodeMappingStr)
		return nil, newApiErr
	}
	return usage, nil
}

// chatToResponsesHandler converts a non-streaming Chat Completions response
// to Responses API format.
func chatToResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
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

	responsesResp, err := openaicompat.ChatCompletionsResponseToResponsesResponse(&chatResp, info.UpstreamModelName)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	usage := &chatResp.Usage
	if usage.TotalTokens == 0 {
		text := ""
		if len(chatResp.Choices) > 0 {
			text = chatResp.Choices[0].Message.StringContent()
		}
		usage = service.ResponseText2Usage(c, text, info.UpstreamModelName, info.GetEstimatePromptTokens())
		responsesResp.Usage = usage
	}

	responseBody, err := common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)
	return usage, nil
}

// chatToResponsesStreamHandler converts a streaming Chat Completions response
// to Responses API streaming format.
func chatToResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	respID := fmt.Sprintf("resp_%d", time.Now().UnixNano())
	model := info.UpstreamModelName

	type toolCallState struct {
		ID        string
		Name      string
		Arguments strings.Builder
	}

	var (
		usage           = &dto.Usage{}
		fullText        strings.Builder
		streamErr       *types.NewAPIError
		sentCreated     bool
		sentOutputItem  bool // whether we sent response.output_item.added for the message
		sentContentPart bool // whether we sent response.content_part.added for output_text
	)

	msgID := "msg_" + strings.TrimPrefix(respID, "resp_")

	// Track tool calls by index (stable across streaming chunks).
	// The first chunk carries the real call ID and function name; subsequent
	// chunks only carry the index and argument fragments.
	toolCallsByIndex := make(map[int]*toolCallState)
	toolCallOrder := []int{} // preserve insertion order

	sendEvent := func(event any) bool {
		data, err := openaicompat.MarshalSSEEvent(event)
		if err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
			return false
		}
		if _, err := c.Writer.Write(data); err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			return false
		}
		c.Writer.Flush()
		return true
	}

	sendCreatedIfNeeded := func() bool {
		if sentCreated {
			return true
		}
		created := map[string]any{
			"type": "response.created",
			"response": map[string]any{
				"id":         respID,
				"object":     "response",
				"status":     "in_progress",
				"model":      model,
				"created_at": int(time.Now().Unix()),
				"output":     []any{},
			},
		}
		if !sendEvent(created) {
			return false
		}
		sentCreated = true
		return true
	}

	// Set SSE headers
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")

	helper.StreamScannerHandler(c, resp, info, func(data string) bool {
		if streamErr != nil {
			return false
		}

		var chunk dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
			return true // skip malformed chunks
		}

		if chunk.Model != "" {
			model = chunk.Model
		}

		if !sendCreatedIfNeeded() {
			return false
		}

		if len(chunk.Choices) == 0 {
			// Usage-only chunk
			if chunk.Usage != nil {
				usage = chunk.Usage
			}
			return true
		}

		choice := chunk.Choices[0]
		delta := choice.Delta

		// Content delta → response.output_text.delta
		contentStr := delta.GetContentString()
		if contentStr != "" {
			// Emit output_item.added and content_part.added before first text delta
			if !sentOutputItem {
				if !sendEvent(map[string]any{
					"type":          "response.output_item.added",
					"output_index":  0,
					"item": map[string]any{
						"type":   "message",
						"id":     msgID,
						"status": "in_progress",
						"role":   "assistant",
						"content": []any{},
					},
				}) {
					return false
				}
				sentOutputItem = true
			}
			if !sentContentPart {
				if !sendEvent(map[string]any{
					"type":          "response.content_part.added",
					"item_id":       msgID,
					"output_index":  0,
					"content_index": 0,
					"part": map[string]any{
						"type": "output_text",
						"text": "",
					},
				}) {
					return false
				}
				sentContentPart = true
			}

			fullText.WriteString(contentStr)
			event := map[string]any{
				"type":          "response.output_text.delta",
				"item_id":       msgID,
				"output_index":  0,
				"content_index": 0,
				"delta":         contentStr,
			}
			if !sendEvent(event) {
				return false
			}
		}

		// Tool calls — track by index for consistent identity across chunks
		for _, tc := range delta.ToolCalls {
			idx := 0
			if tc.Index != nil {
				idx = *tc.Index
			}

			state, exists := toolCallsByIndex[idx]
			if !exists {
				// First chunk for this tool call
				callID := tc.ID
				if callID == "" {
					callID = fmt.Sprintf("call_%d", idx)
				}
				state = &toolCallState{ID: callID}
				toolCallsByIndex[idx] = state
				toolCallOrder = append(toolCallOrder, idx)
			} else if tc.ID != "" && state.ID == "" {
				// Got a real ID on a later chunk (unlikely but safe)
				state.ID = tc.ID
			}

			if tc.Function.Name != "" {
				state.Name = tc.Function.Name
				// Emit output_item.added for the tool call
				if !sendEvent(map[string]any{
					"type": "response.output_item.added",
					"item": map[string]any{
						"type":      "function_call",
						"id":        state.ID,
						"call_id":   state.ID,
						"name":      state.Name,
						"arguments": "",
						"status":    "in_progress",
					},
				}) {
					return false
				}
			}

			if tc.Function.Arguments != "" {
				state.Arguments.WriteString(tc.Function.Arguments)
				if !sendEvent(map[string]any{
					"type":    "response.function_call_arguments.delta",
					"item_id": state.ID,
					"delta":   tc.Function.Arguments,
				}) {
					return false
				}
			}
		}

		// Check for finish
		if choice.FinishReason != nil && *choice.FinishReason != "" {
			if chunk.Usage != nil {
				usage = chunk.Usage
			}
		}

		return true
	})

	if streamErr != nil {
		return nil, streamErr
	}

	// Send completed event
	if !sendCreatedIfNeeded() {
		return nil, streamErr
	}

	// Send content_part.done and output_item.done if we emitted text content.
	// These are best-effort cleanup events — if the client already disconnected
	// we still return whatever usage we collected.
	if sentContentPart {
		if !sendEvent(map[string]any{
			"type":          "response.output_text.done",
			"item_id":       msgID,
			"output_index":  0,
			"content_index": 0,
			"text":          fullText.String(),
		}) {
			return usage, streamErr
		}
		if !sendEvent(map[string]any{
			"type":          "response.content_part.done",
			"item_id":       msgID,
			"output_index":  0,
			"content_index": 0,
			"part": map[string]any{
				"type": "output_text",
				"text": fullText.String(),
			},
		}) {
			return usage, streamErr
		}
	}
	if sentOutputItem {
		if !sendEvent(map[string]any{
			"type":         "response.output_item.done",
			"output_index": 0,
			"item": map[string]any{
				"type":   "message",
				"id":     msgID,
				"status": "completed",
				"role":   "assistant",
				"content": []map[string]any{
					{
						"type": "output_text",
						"text": fullText.String(),
					},
				},
			},
		}) {
			return usage, streamErr
		}
	}

	// Send tool call done events
	toolOutputOffset := 0
	if sentOutputItem {
		toolOutputOffset = 1
	}

	// Build final toolCalls slice from tracked state (preserving order)
	var toolCalls []dto.ToolCallResponse
	for _, idx := range toolCallOrder {
		state := toolCallsByIndex[idx]
		toolCalls = append(toolCalls, dto.ToolCallResponse{
			ID:   state.ID,
			Type: "function",
			Function: dto.FunctionResponse{
				Name:      state.Name,
				Arguments: state.Arguments.String(),
			},
		})
	}

	for i, tc := range toolCalls {
		sendEvent(map[string]any{
			"type":      "response.function_call_arguments.done",
			"item_id":   tc.ID,
			"arguments": tc.Function.Arguments,
		})
		sendEvent(map[string]any{
			"type":         "response.output_item.done",
			"output_index": i + toolOutputOffset,
			"item": map[string]any{
				"type":      "function_call",
				"id":        tc.ID,
				"call_id":   tc.ID,
				"name":      tc.Function.Name,
				"arguments": tc.Function.Arguments,
				"status":    "completed",
			},
		})
	}

	completedEvent := openaicompat.BuildResponsesCompletedEvent(respID, model, fullText.String(), usage, toolCalls)
	sendEvent(completedEvent)

	// Send [DONE]
	c.Writer.Write([]byte("data: [DONE]\n\n"))
	c.Writer.Flush()

	if usage.TotalTokens == 0 {
		usage = service.ResponseText2Usage(c, fullText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}

	return usage, nil
}
