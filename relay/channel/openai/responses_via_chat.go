package openai

import (
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

// OaiChatToResponsesHandler reads a chat-completions response from upstream and
// reformats it as an OpenAI /v1/responses response for the client.
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

	if oaiErr := chatResp.GetOpenAIError(); oaiErr != nil && oaiErr.Type != "" {
		return nil, types.WithOpenAIError(*oaiErr, resp.StatusCode)
	}

	usage := chatResp.Usage
	if usage.PromptTokens == 0 && usage.CompletionTokens == 0 {
		var combined strings.Builder
		for _, choice := range chatResp.Choices {
			combined.WriteString(choice.Message.StringContent())
			combined.WriteString(choice.Message.ReasoningContent)
			combined.WriteString(choice.Message.Reasoning)
		}
		fallback := service.ResponseText2Usage(c, combined.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		usage = *fallback
	}

	respID := helper.GetResponseID(c)
	createdAt := time.Now().Unix()
	if createdRaw, ok := chatResp.Created.(int64); ok && createdRaw != 0 {
		createdAt = createdRaw
	} else if createdRaw, ok := chatResp.Created.(float64); ok && createdRaw != 0 {
		createdAt = int64(createdRaw)
	}

	out := buildResponsesResponseFromChat(&chatResp, &usage, info, respID, createdAt)
	bodyOut, err := common.Marshal(out)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, bodyOut)
	return &usage, nil
}

// OaiChatToResponsesStreamHandler consumes a chat-completions SSE stream from
// upstream and re-emits it as an OpenAI /v1/responses event stream.
func OaiChatToResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	respID := helper.GetResponseID(c)
	createdAt := time.Now().Unix()
	model := info.UpstreamModelName

	var (
		usage          = &dto.Usage{}
		textBuilder    strings.Builder
		streamErr      *types.NewAPIError
		sentCreated    bool
		messageItemID  = fmt.Sprintf("msg_%s", respID)
		messageOpen    bool
		contentPartOpn bool
		toolItemIDs    = map[int]string{}
		toolNames      = map[int]string{}
		toolArgs       = map[int]string{}
		toolCallIDs    = map[int]string{}
		finishReason   string
	)

	emit := func(eventType string, payload any) bool {
		data, err := common.Marshal(payload)
		if err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
			return false
		}
		c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\n", eventType)})
		c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("data: %s\n", string(data))})
		_ = helper.FlushWriter(c)
		return true
	}

	emitCreated := func() bool {
		if sentCreated {
			return true
		}
		sentCreated = true
		payload := map[string]any{
			"type": "response.created",
			"response": map[string]any{
				"id":         respID,
				"object":     "response",
				"created_at": createdAt,
				"status":     "in_progress",
				"model":      model,
				"output":     []any{},
			},
		}
		return emit("response.created", payload)
	}

	openMessageItem := func() bool {
		if messageOpen {
			return true
		}
		if !emitCreated() {
			return false
		}
		messageOpen = true
		itemPayload := map[string]any{
			"type":         "response.output_item.added",
			"output_index": 0,
			"item": map[string]any{
				"type":    "message",
				"id":      messageItemID,
				"status":  "in_progress",
				"role":    "assistant",
				"content": []any{},
			},
		}
		if !emit("response.output_item.added", itemPayload) {
			return false
		}
		partPayload := map[string]any{
			"type":          "response.content_part.added",
			"item_id":       messageItemID,
			"output_index":  0,
			"content_index": 0,
			"part": map[string]any{
				"type": "output_text",
				"text": "",
			},
		}
		if !emit("response.content_part.added", partPayload) {
			return false
		}
		contentPartOpn = true
		return true
	}

	closeMessageItem := func() bool {
		if !messageOpen {
			return true
		}
		fullText := textBuilder.String()
		if contentPartOpn {
			donePart := map[string]any{
				"type":          "response.output_text.done",
				"item_id":       messageItemID,
				"output_index":  0,
				"content_index": 0,
				"text":          fullText,
			}
			if !emit("response.output_text.done", donePart) {
				return false
			}
			doneContent := map[string]any{
				"type":          "response.content_part.done",
				"item_id":       messageItemID,
				"output_index":  0,
				"content_index": 0,
				"part": map[string]any{
					"type": "output_text",
					"text": fullText,
				},
			}
			if !emit("response.content_part.done", doneContent) {
				return false
			}
			contentPartOpn = false
		}
		itemDone := map[string]any{
			"type":         "response.output_item.done",
			"output_index": 0,
			"item": map[string]any{
				"type":   "message",
				"id":     messageItemID,
				"status": "completed",
				"role":   "assistant",
				"content": []map[string]any{
					{"type": "output_text", "text": fullText},
				},
			},
		}
		if !emit("response.output_item.done", itemDone) {
			return false
		}
		messageOpen = false
		return true
	}

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if streamErr != nil {
			sr.Stop(streamErr)
			return
		}
		data = strings.TrimSpace(data)
		if data == "" || data == "[DONE]" {
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
			createdAt = chunk.Created
		}
		if chunk.Usage != nil && chunk.Usage.TotalTokens != 0 {
			*usage = *chunk.Usage
		}

		for _, choice := range chunk.Choices {
			if choice.Delta.Content != nil && *choice.Delta.Content != "" {
				if !openMessageItem() {
					sr.Stop(streamErr)
					return
				}
				delta := *choice.Delta.Content
				textBuilder.WriteString(delta)
				payload := map[string]any{
					"type":          "response.output_text.delta",
					"item_id":       messageItemID,
					"output_index":  0,
					"content_index": 0,
					"delta":         delta,
				}
				if !emit("response.output_text.delta", payload) {
					sr.Stop(streamErr)
					return
				}
			}
			for _, tc := range choice.Delta.ToolCalls {
				idx := 0
				if tc.Index != nil {
					idx = *tc.Index
				}
				if _, ok := toolItemIDs[idx]; !ok {
					if !emitCreated() {
						sr.Stop(streamErr)
						return
					}
					itemID := fmt.Sprintf("fc_%s_%d", respID, idx)
					toolItemIDs[idx] = itemID
					toolCallIDs[idx] = tc.ID
					toolNames[idx] = tc.Function.Name
					addPayload := map[string]any{
						"type":         "response.output_item.added",
						"output_index": idx + 1,
						"item": map[string]any{
							"type":      "function_call",
							"id":        itemID,
							"status":    "in_progress",
							"call_id":   tc.ID,
							"name":      tc.Function.Name,
							"arguments": "",
						},
					}
					if !emit("response.output_item.added", addPayload) {
						sr.Stop(streamErr)
						return
					}
				} else {
					if tc.ID != "" && toolCallIDs[idx] == "" {
						toolCallIDs[idx] = tc.ID
					}
					if tc.Function.Name != "" && toolNames[idx] == "" {
						toolNames[idx] = tc.Function.Name
					}
				}
				if tc.Function.Arguments != "" {
					toolArgs[idx] += tc.Function.Arguments
					argPayload := map[string]any{
						"type":         "response.function_call_arguments.delta",
						"item_id":      toolItemIDs[idx],
						"output_index": idx + 1,
						"delta":        tc.Function.Arguments,
					}
					if !emit("response.function_call_arguments.delta", argPayload) {
						sr.Stop(streamErr)
						return
					}
				}
			}
			if choice.FinishReason != nil && *choice.FinishReason != "" {
				finishReason = *choice.FinishReason
			}
		}
	})

	if streamErr != nil {
		return nil, streamErr
	}

	if !closeMessageItem() {
		return nil, streamErr
	}

	// Close any open function-call items.
	for idx, itemID := range toolItemIDs {
		doneArgs := map[string]any{
			"type":         "response.function_call_arguments.done",
			"item_id":      itemID,
			"output_index": idx + 1,
			"arguments":    toolArgs[idx],
		}
		if !emit("response.function_call_arguments.done", doneArgs) {
			return nil, streamErr
		}
		itemDone := map[string]any{
			"type":         "response.output_item.done",
			"output_index": idx + 1,
			"item": map[string]any{
				"type":      "function_call",
				"id":        itemID,
				"status":    "completed",
				"call_id":   toolCallIDs[idx],
				"name":      toolNames[idx],
				"arguments": toolArgs[idx],
			},
		}
		if !emit("response.output_item.done", itemDone) {
			return nil, streamErr
		}
	}

	if usage.TotalTokens == 0 {
		fallback := service.ResponseText2Usage(c, textBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		*usage = *fallback
	}

	if !sentCreated {
		_ = emitCreated()
	}

	// Build final response object for response.completed.
	finalUsage := map[string]any{
		"input_tokens":  usage.PromptTokens,
		"output_tokens": usage.CompletionTokens,
		"total_tokens":  usage.TotalTokens,
	}

	var output []map[string]any
	fullText := textBuilder.String()
	if fullText != "" || len(toolItemIDs) == 0 {
		output = append(output, map[string]any{
			"type":   "message",
			"id":     messageItemID,
			"status": "completed",
			"role":   "assistant",
			"content": []map[string]any{
				{"type": "output_text", "text": fullText},
			},
		})
	}
	for idx := 0; idx < len(toolItemIDs); idx++ {
		itemID, ok := toolItemIDs[idx]
		if !ok {
			continue
		}
		output = append(output, map[string]any{
			"type":      "function_call",
			"id":        itemID,
			"status":    "completed",
			"call_id":   toolCallIDs[idx],
			"name":      toolNames[idx],
			"arguments": toolArgs[idx],
		})
	}

	status := "completed"
	if finishReason == "length" {
		status = "incomplete"
	}

	completedPayload := map[string]any{
		"type": "response.completed",
		"response": map[string]any{
			"id":         respID,
			"object":     "response",
			"created_at": createdAt,
			"model":      model,
			"status":     status,
			"output":     output,
			"usage":      finalUsage,
		},
	}
	if !emit("response.completed", completedPayload) {
		return nil, streamErr
	}

	return usage, nil
}

func buildResponsesResponseFromChat(chatResp *dto.OpenAITextResponse, usage *dto.Usage, info *relaycommon.RelayInfo, respID string, createdAt int64) *dto.OpenAIResponsesResponse {
	out := &dto.OpenAIResponsesResponse{
		ID:        respID,
		Object:    "response",
		CreatedAt: int(createdAt),
		Model:     chatResp.Model,
		Usage:     usage,
	}
	if info != nil && info.UpstreamModelName != "" && out.Model == "" {
		out.Model = info.UpstreamModelName
	}

	status := "completed"
	for _, choice := range chatResp.Choices {
		msgID := fmt.Sprintf("msg_%s_%d", respID, choice.Index)
		text := choice.Message.StringContent()
		if text != "" {
			out.Output = append(out.Output, dto.ResponsesOutput{
				Type:   "message",
				ID:     msgID,
				Status: "completed",
				Role:   "assistant",
				Content: []dto.ResponsesOutputContent{
					{Type: "output_text", Text: text},
				},
			})
		}
		for tcIdx, tc := range choice.Message.ParseToolCalls() {
			callID := tc.ID
			if callID == "" {
				callID = fmt.Sprintf("call_%s_%d", respID, tcIdx)
			}
			out.Output = append(out.Output, dto.ResponsesOutput{
				Type:      "function_call",
				ID:        fmt.Sprintf("fc_%s_%d_%d", respID, choice.Index, tcIdx),
				Status:    "completed",
				CallId:    callID,
				Name:      tc.Function.Name,
				Arguments: tc.Function.Arguments,
			})
		}
		if choice.FinishReason == "length" {
			status = "incomplete"
		}
	}

	statusBytes, _ := common.Marshal(status)
	out.Status = statusBytes
	return out
}
