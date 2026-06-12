package helper

import (
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// anthropicSSEPaddingMax is the upper bound (inclusive) on the number of
// trailing ASCII-space characters appended to a Claude-protocol SSE `data:`
// line. api.anthropic.com pads each event with a random run of spaces
// (observed roughly 0–15) so that the encrypted chunk length no longer
// correlates with the underlying token content (a length side-channel
// defense, R3). Statistical randomness is sufficient (R3.4); cryptographic
// strength is not required.
const anthropicSSEPaddingMax = 15

// anthropicSSEPadding returns a run of 0..anthropicSSEPaddingMax ASCII spaces
// (0x20) to append to a Claude SSE data line, randomizing its byte length to
// break the "ciphertext-fragment length ↔ token content" correlation (R3).
//
// It only emits padding when the independent SsePaddingEnabled switch (R3.3) is
// on; otherwise it returns "" so the wire format is byte-identical to the
// pre-normalize behavior (R3.3 rollback). The length is uniformly random in the
// closed range so it is never a fixed/predictable value (R3.4). Only spaces are
// used, which are insignificant after a JSON value and so do not affect
// client JSON parsing (R3.2). math/rand's top-level generator is safe for
// concurrent use, matching the concurrent SSE writers here.
func anthropicSSEPadding() string {
	if !model_setting.GetClaudeSettings().SsePaddingEnabled {
		return ""
	}
	n := rand.Intn(anthropicSSEPaddingMax + 1)
	if n == 0 {
		return ""
	}
	return strings.Repeat(" ", n)
}

func FlushWriter(c *gin.Context) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("flush panic recovered: %v", r)
		}
	}()

	if c == nil || c.Writer == nil {
		return nil
	}

	if c.Request != nil && c.Request.Context().Err() != nil {
		return fmt.Errorf("request context done: %w", c.Request.Context().Err())
	}

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		return errors.New("streaming error: flusher not found")
	}

	flusher.Flush()
	return nil
}

func SetEventStreamHeaders(c *gin.Context) {
	// 检查是否已经设置过头部
	if _, exists := c.Get("event_stream_headers_set"); exists {
		return
	}

	// 设置标志，表示头部已经设置过
	c.Set("event_stream_headers_set", true)

	// charset=utf-8 mirrors api.anthropic.com and OpenAI's SSE Content-Type;
	// it is semantically harmless for all SSE clients (R1.3).
	c.Writer.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
}

// FinalizeAnthropicResponseHeaders rewrites the client-facing response headers
// for a Claude-protocol relay response toward the api.anthropic.com shape.
//
// When response normalization is enabled it:
//   - removes the internal X-Oneapi-Request-Id header (R1.2);
//   - emits "request-id: req_<encoded>" where <encoded> is a deterministic,
//     time-ordered re-encoding of the internal request id (R1.1), and logs the
//     mapping so an operator can grep the internal id from the client value.
//
// When disabled it leaves X-Oneapi-Request-Id in place (current behavior),
// providing a config-controlled rollback for R1.5.
//
// It MUST be called before headers are flushed (i.e. before WriteHeader / the
// first SSE chunk). Calling it more than once per request is a no-op after the
// first invocation.
func FinalizeAnthropicResponseHeaders(c *gin.Context) {
	if c == nil || c.Writer == nil {
		return
	}
	if !model_setting.GetClaudeSettings().ResponseNormalizeEnabled {
		return
	}
	if _, done := c.Get("anthropic_request_id_set"); done {
		return
	}
	c.Set("anthropic_request_id_set", true)

	internalID, _ := c.Get(common.RequestIdKey)
	internalIDStr, _ := internalID.(string)
	if internalIDStr == "" {
		// No internal id to re-encode; just strip the internal header so we
		// don't leak it, and skip emitting a request-id we can't reverse-map.
		c.Writer.Header().Del(common.RequestIdKey)
		return
	}

	reqID := common.EncodeAnthropicRequestID(internalIDStr, common.GetTimestamp())
	c.Writer.Header().Del(common.RequestIdKey)
	c.Writer.Header().Set("request-id", reqID)
	logger.LogInfo(c, fmt.Sprintf("anthropic request-id=%s internal=%s", reqID, internalIDStr))
}

func ClaudeData(c *gin.Context, resp dto.ClaudeResponse) error {
	jsonData, err := common.Marshal(resp)
	if err != nil {
		common.SysError("error marshalling stream response: " + err.Error())
	} else {
		c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\n", resp.Type)})
		// Trailing-space padding randomizes the data line length as a token
		// length side-channel defense (R3); the event: line is left untouched.
		c.Render(-1, common.CustomEvent{Data: "data: " + string(jsonData) + anthropicSSEPadding()})
	}
	_ = FlushWriter(c)
	return nil
}

func ClaudeChunkData(c *gin.Context, resp dto.ClaudeResponse, data string) {
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\n", resp.Type)})
	// Padding is inserted between the JSON payload and the line's newline so it
	// is a JSON-insignificant trailing run of spaces (R3.1/R3.2).
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("data: %s%s\n", data, anthropicSSEPadding())})
	_ = FlushWriter(c)
}

func ResponseChunkData(c *gin.Context, resp dto.ResponsesStreamResponse, data string) {
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\n", resp.Type)})
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("data: %s", data)})
	_ = FlushWriter(c)
}

func StringData(c *gin.Context, str string) error {
	if c == nil || c.Writer == nil {
		return errors.New("context or writer is nil")
	}

	if c.Request != nil && c.Request.Context().Err() != nil {
		return fmt.Errorf("request context done: %w", c.Request.Context().Err())
	}

	c.Render(-1, common.CustomEvent{Data: "data: " + str})
	return FlushWriter(c)
}

func PingData(c *gin.Context) error {
	if c == nil || c.Writer == nil {
		return errors.New("context or writer is nil")
	}

	if c.Request != nil && c.Request.Context().Err() != nil {
		return fmt.Errorf("request context done: %w", c.Request.Context().Err())
	}

	if _, err := c.Writer.Write([]byte(": PING\n\n")); err != nil {
		return fmt.Errorf("write ping data failed: %w", err)
	}
	return FlushWriter(c)
}

func ObjectData(c *gin.Context, object interface{}) error {
	if object == nil {
		return errors.New("object is nil")
	}
	jsonData, err := common.Marshal(object)
	if err != nil {
		return fmt.Errorf("error marshalling object: %w", err)
	}
	return StringData(c, string(jsonData))
}

func Done(c *gin.Context) {
	_ = StringData(c, "[DONE]")
}

func WssString(c *gin.Context, ws *websocket.Conn, str string) error {
	if ws == nil {
		logger.LogError(c, "websocket connection is nil")
		return errors.New("websocket connection is nil")
	}
	//common.LogInfo(c, fmt.Sprintf("sending message: %s", str))
	return ws.WriteMessage(1, []byte(str))
}

func WssObject(c *gin.Context, ws *websocket.Conn, object interface{}) error {
	jsonData, err := common.Marshal(object)
	if err != nil {
		return fmt.Errorf("error marshalling object: %w", err)
	}
	if ws == nil {
		logger.LogError(c, "websocket connection is nil")
		return errors.New("websocket connection is nil")
	}
	//common.LogInfo(c, fmt.Sprintf("sending message: %s", jsonData))
	return ws.WriteMessage(1, jsonData)
}

func WssError(c *gin.Context, ws *websocket.Conn, openaiError types.OpenAIError) {
	if ws == nil {
		return
	}
	errorObj := &dto.RealtimeEvent{
		Type:    "error",
		EventId: GetLocalRealtimeID(c),
		Error:   &openaiError,
	}
	_ = WssObject(c, ws, errorObj)
}

func GetResponseID(c *gin.Context) string {
	logID := c.GetString(common.RequestIdKey)
	return fmt.Sprintf("chatcmpl-%s", logID)
}

func GetLocalRealtimeID(c *gin.Context) string {
	logID := c.GetString(common.RequestIdKey)
	return fmt.Sprintf("evt_%s", logID)
}

func GenerateStartEmptyResponse(id string, createAt int64, model string, systemFingerprint *string) *dto.ChatCompletionsStreamResponse {
	return &dto.ChatCompletionsStreamResponse{
		Id:                id,
		Object:            "chat.completion.chunk",
		Created:           createAt,
		Model:             model,
		SystemFingerprint: systemFingerprint,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Role:    "assistant",
					Content: common.GetPointer(""),
				},
			},
		},
	}
}

func GenerateStopResponse(id string, createAt int64, model string, finishReason string) *dto.ChatCompletionsStreamResponse {
	return &dto.ChatCompletionsStreamResponse{
		Id:                id,
		Object:            "chat.completion.chunk",
		Created:           createAt,
		Model:             model,
		SystemFingerprint: nil,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				FinishReason: &finishReason,
			},
		},
	}
}

func GenerateFinalUsageResponse(id string, createAt int64, model string, usage dto.Usage) *dto.ChatCompletionsStreamResponse {
	return &dto.ChatCompletionsStreamResponse{
		Id:                id,
		Object:            "chat.completion.chunk",
		Created:           createAt,
		Model:             model,
		SystemFingerprint: nil,
		Choices:           make([]dto.ChatCompletionsStreamResponseChoice, 0),
		Usage:             &usage,
	}
}
