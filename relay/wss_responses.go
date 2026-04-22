package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type CaptureResponseWriter struct {
	gin.ResponseWriter
	Body *bytes.Buffer
}

func (w *CaptureResponseWriter) Write(b []byte) (int, error) {
	return w.Body.Write(b)
}

func (w *CaptureResponseWriter) WriteString(s string) (int, error) {
	return w.Body.WriteString(s)
}

func (w *CaptureResponseWriter) WriteHeader(statusCode int) {
	// Do nothing, prevent panic on hijacked connections
}

func (w *CaptureResponseWriter) WriteHeaderNow() {
	// Do nothing
}

func (w *CaptureResponseWriter) Flush() {
	// Do nothing, prevent panic on hijacked connections
}

func WssResponsesHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	if info.ClientWs == nil {
		return types.NewError(fmt.Errorf("websocket connection is nil"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}

	info.InitChannelMeta(c)

	// Set a 5-minute timeout as requested by user
	timeout := 5 * time.Minute
	info.ClientWs.SetReadDeadline(time.Now().Add(timeout))
	info.ClientWs.SetWriteDeadline(time.Now().Add(timeout))

	// Default Ping handler in Gorilla responds with a Pong.
	info.ClientWs.SetPingHandler(func(appData string) error {
		info.ClientWs.SetReadDeadline(time.Now().Add(timeout))
		info.ClientWs.SetWriteDeadline(time.Now().Add(timeout))
		return info.ClientWs.WriteMessage(websocket.PongMessage, []byte(appData))
	})

	responseID := "resp_" + common.GetUUID()
	now := common.GetTimestamp()

	defer func() {
		if newAPIError != nil && info.ClientWs != nil {
			_ = sendWsResponseEvent(info.ClientWs, 999, "response.failed", gin.H{
				"response": gin.H{
					"id":     responseID,
					"status": "failed",
					"error":  newAPIError.ToOpenAIError(),
				},
			})
		}
	}()

	// 1. Read the first message from WebSocket
	var message []byte
	var err error
	for {
		_, message, err = info.ClientWs.ReadMessage()
		if err != nil {
			return types.NewError(err, types.ErrorCodeReadRequestBodyFailed)
		}
		if len(message) > 0 {
			break
		}
	}

	var responsesReq dto.OpenAIResponsesRequest
	if err := common.Unmarshal(message, &responsesReq); err != nil {
		return types.NewError(err, types.ErrorCodeInvalidRequest)
	}
	info.Request = &responsesReq

	// 2. Setup adaptor
	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	// Bridging
	request, err := common.DeepCopy(&responsesReq)
	if err != nil {
		return types.NewError(err, types.ErrorCodeInvalidRequest)
	}

	// Force non-streaming for the interceptor to work correctly with synchronous capture
	falseVal := false
	request.Stream = &falseVal

	convertedRequest, err := adaptor.ConvertOpenAIResponsesRequest(c, info, *request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed)
	}

	jsonData, err := common.Marshal(convertedRequest)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed)
	}

	// 3. Send initial events
	// event 0: response.created
	if err := sendWsResponseEvent(info.ClientWs, 0, "response.created", gin.H{
		"response": gin.H{
			"id":                responseID,
			"object":            "response",
			"created_at":         now,
			"status":            "in_progress",
			"background":        false,
			"frequency_penalty": 0.0,
			"model":             responsesReq.Model,
			"presence_penalty":  0.0,
			"temperature":       1.0,
			"top_p":             1.0,
		},
	}); err != nil {
		return types.NewError(err, types.ErrorCodeWssWriteFailed)
	}

	// event 1: response.in_progress
	if err := sendWsResponseEvent(info.ClientWs, 1, "response.in_progress", gin.H{
		"response": gin.H{
			"id":                responseID,
			"object":            "response",
			"created_at":         now,
			"status":            "in_progress",
			"model":             responsesReq.Model,
		},
	}); err != nil {
		return types.NewError(err, types.ErrorCodeWssWriteFailed)
	}

	// 4. Perform the actual HTTP request
	resp, err := adaptor.DoRequest(c, info, io.NopCloser(bytes.NewReader(jsonData)))
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	httpResp, ok := resp.(*http.Response)
	if !ok {
		return types.NewError(fmt.Errorf("invalid response type from adaptor"), types.ErrorCodeDoRequestFailed)
	}
	defer service.CloseResponseBodyGracefully(httpResp)

	if httpResp.StatusCode != http.StatusOK {
		return service.RelayErrorHandler(c.Request.Context(), httpResp, false)
	}

	// Capture output
	capture := &CaptureResponseWriter{
		ResponseWriter: c.Writer,
		Body:           bytes.NewBuffer(nil),
	}

	// Ensure the adaptor knows this is NOT a streaming response for the capture to work
	info.IsStream = false

	// Backup and restore context fields
	originalWriter := c.Writer
	originalMethod := c.Request.Method
	defer func() {
		c.Writer = originalWriter
		c.Request.Method = originalMethod
	}()

	c.Writer = capture
	c.Request.Method = "POST"

	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		return newAPIError
	}

	u, _ := usage.(*dto.Usage)
	if u == nil {
		u = &dto.Usage{}
	}

	usageData := gin.H{
		"total_tokens":      u.TotalTokens,
		"input_tokens":      u.PromptTokens,
		"prompt_tokens":     u.PromptTokens,
		"output_tokens":     u.CompletionTokens,
		"completion_tokens": u.CompletionTokens,
		"input_tokens_details": map[string]interface{}{
			"cached_tokens": 0,
			"text_tokens":   u.PromptTokens,
			"audio_tokens":  0,
			"image_tokens":  0,
		},
		"output_tokens_details": map[string]interface{}{
			"reasoning_tokens": 0,
			"text_tokens":      u.CompletionTokens,
			"audio_tokens":     0,
		},
	}

	// 5. Build and send full sequence of events to ensure client compatibility
	if capture.Body.Len() > 0 {
		var chatResp dto.OpenAITextResponse
		if err := common.Unmarshal(capture.Body.Bytes(), &chatResp); err == nil && len(chatResp.Choices) > 0 {
			content := chatResp.Choices[0].Message.StringContent()
			itemID := "item_" + common.GetUUID()

			// response.output_item.added (seq 2)
			if err := sendWsResponseEvent(info.ClientWs, 2, "response.output_item.added", gin.H{
				"output_index": 0,
				"item": gin.H{
					"id":      itemID,
					"object":  "realtime.item",
					"type":    "message",
					"status":  "in_progress",
					"role":    "assistant",
					"content": []any{},
				},
			}); err != nil {
				return types.NewError(err, types.ErrorCodeWssWriteFailed)
			}

			// response.content_part.added (seq 3)
			if err := sendWsResponseEvent(info.ClientWs, 3, "response.content_part.added", gin.H{
				"item_id":      itemID,
				"output_index": 0,
				"part": gin.H{
					"type": "output_text",
					"text": "",
				},
			}); err != nil {
				return types.NewError(err, types.ErrorCodeWssWriteFailed)
			}

			// response.output_text.delta (seq 4)
			if err := sendWsResponseEvent(info.ClientWs, 4, "response.output_text.delta", gin.H{
				"content_index": 0,
				"item_id":       itemID,
				"output_index":  0,
				"text":          content,
			}); err != nil {
				return types.NewError(err, types.ErrorCodeWssWriteFailed)
			}

			// response.output_text.done (seq 5)
			if err := sendWsResponseEvent(info.ClientWs, 5, "response.output_text.done", gin.H{
				"content_index": 0,
				"item_id":       itemID,
				"output_index":  0,
				"text":          content,
			}); err != nil {
				return types.NewError(err, types.ErrorCodeWssWriteFailed)
			}

			// response.content_part.done (seq 6)
			if err := sendWsResponseEvent(info.ClientWs, 6, "response.content_part.done", gin.H{
				"item_id":      itemID,
				"output_index": 0,
				"part": gin.H{
					"type": "output_text",
					"text": content,
				},
			}); err != nil {
				return types.NewError(err, types.ErrorCodeWssWriteFailed)
			}

			// response.output_item.done (seq 7)
			if err := sendWsResponseEvent(info.ClientWs, 7, "response.output_item.done", gin.H{
				"output_index": 0,
				"item": gin.H{
					"id":     itemID,
					"object": "realtime.item",
					"type":   "message",
					"status": "completed",
					"role":   "assistant",
					"content": []any{
						gin.H{
							"type": "output_text",
							"text": content,
						},
					},
				},
			}); err != nil {
				return types.NewError(err, types.ErrorCodeWssWriteFailed)
			}

			// response.completed (seq 8)
			if err := sendWsResponseEvent(info.ClientWs, 8, "response.completed", gin.H{
				"response": gin.H{
					"id":                responseID,
					"object":            "response",
					"created_at":         now,
					"status":            "completed",
					"completed_at":       now,
					"model":             responsesReq.Model,
					"output": []any{
						gin.H{
							"id":     itemID,
							"status": "completed",
							"usage":  usageData,
						},
					},
					"usage": usageData,
				},
			}); err != nil {
				return types.NewError(err, types.ErrorCodeWssWriteFailed)
			}
		} else {
			// Fallback for empty or unmarshalable content
			_ = sendWsResponseEvent(info.ClientWs, 8, "response.completed", gin.H{
				"response": gin.H{
					"id":           responseID,
					"object":       "response",
					"created_at":   now,
					"status":       "completed",
					"completed_at": now,
					"model":        responsesReq.Model,
					"output":       []any{},
					"usage":        usageData,
				},
			})
		}
	} else {
		// Terminal event for empty response
		_ = sendWsResponseEvent(info.ClientWs, 8, "response.completed", gin.H{
			"response": gin.H{
				"id":           responseID,
				"object":       "response",
				"created_at":   now,
				"status":       "completed",
				"completed_at": now,
				"model":        responsesReq.Model,
				"output":       []any{},
				"usage":        usageData,
			},
		})
	}

	// Usage handling (internal New API consumption)
	if usage != nil {
		if usageDto, ok := usage.(*dto.Usage); ok {
			service.PostTextConsumeQuota(c, info, usageDto, nil)
		}
	}

	return nil
}

func sendWsResponseEvent(ws *websocket.Conn, seq int, eventType string, data gin.H) error {
	msg := gin.H{
		"type":            eventType,
		"sequence_number": seq,
	}
	for k, v := range data {
		msg[k] = v
	}
	_ = ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return ws.WriteJSON(msg)
}
