package gateway

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/logger"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/QuantumNous/new-api/internal/transport/contract"
)

// RenderSSE writes a raw SSE line, byte-identical to the previous CustomEvent
// render path.
//
// It deliberately does NOT go through contract.EventStream.WriteEvent. The two
// are not byte-equivalent: callers here pass strings that already carry their
// own `data: ` / `event: ` prefix, CustomEvent escapes CR and terminates the
// frame only when the payload starts with "data", and it writes the streaming
// content type per call. WriteEvent prepends its own prefix, always terminates,
// escapes nothing, and flushes internally. Routing this through it would change
// the wire bytes of every SSE response and re-frame partial events, which is
// the regression class that previously fabricated a `data: [DONE]` tail onto
// truncated streams.
//
// The per-call header write CustomEvent.Render performs is reproduced here
// rather than dropped: it is what makes an SSE response carry the streaming
// content type even when no helper installed the headers first.
func RenderSSE(c contract.Context, data string) {
	stream := c.ResponseStream()
	if stream == nil {
		return
	}
	stream.SetHeader("Content-Type", "text/event-stream")
	if stream.Header("Cache-Control") == "" {
		stream.SetHeader("Cache-Control", "no-cache")
	}
	_ = common.CustomEvent{Data: data}.RenderTo(stream)
}

// RequestContextDone checks if the request context has been cancelled.
func RequestContextDone(c contract.Context) bool {
	return c != nil && c.Context().Err() != nil
}

func FlushWriter(c contract.Context) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("flush panic recovered: %v", r)
		}
	}()

	if c == nil {
		return nil
	}

	if RequestContextDone(c) {
		return fmt.Errorf("request context done: %w", c.Context().Err())
	}

	stream := c.ResponseStream()
	if stream == nil || !stream.CanFlush() {
		return errors.New("streaming error: flusher not found")
	}
	return stream.Flush()
}

func SetEventStreamHeaders(c contract.Context) {
	// 检查是否已经设置过头部
	if _, exists := c.Get(contract.EventStreamHeadersKey); exists {
		return
	}

	// 设置标志，表示头部已经设置过
	c.Set(contract.EventStreamHeadersKey, true)
	c.SetHeader("Content-Type", "text/event-stream")
	c.SetHeader("Cache-Control", "no-cache")
	c.SetHeader("Connection", "keep-alive")
	c.SetHeader("Transfer-Encoding", "chunked")
	c.SetHeader("X-Accel-Buffering", "no")
}

func ClaudeData(c contract.Context, resp dto.ClaudeResponse) error {
	if RequestContextDone(c) {
		return nil
	}

	jsonData, err := common.Marshal(resp)
	if err != nil {
		common.SysError("error marshalling stream response: " + err.Error())
	} else {
		RenderSSE(c, fmt.Sprintf("event: %s\n", resp.Type))
		RenderSSE(c, "data: "+string(jsonData))
	}
	_ = FlushWriter(c)
	return nil
}

func ClaudeChunkData(c contract.Context, resp dto.ClaudeResponse, data string) {
	if RequestContextDone(c) {
		return
	}

	data = OutputChunkFiltered(c, data)

	RenderSSE(c, fmt.Sprintf("event: %s\n", resp.Type))
	if data != "" {
		RenderSSE(c, fmt.Sprintf("data: %s\n", data))
	}
	_ = FlushWriter(c)
}

func ResponseChunkData(c contract.Context, resp dto.ResponsesStreamResponse, data string) error {
	if RequestContextDone(c) {
		return fmt.Errorf("request context done: %w", c.Context().Err())
	}

	data = OutputChunkFiltered(c, data)

	RenderSSE(c, fmt.Sprintf("event: %s\n", resp.Type))
	if data != "" {
		RenderSSE(c, fmt.Sprintf("data: %s", data))
	}
	return FlushWriter(c)
}

func StringData(c contract.Context, str string) error {
	if c == nil {
		return errors.New("context is nil")
	}

	if RequestContextDone(c) {
		return fmt.Errorf("request context done: %w", c.Context().Err())
	}

	str = OutputChunkFiltered(c, str)
	if str == "" {
		return nil
	}

	RenderSSE(c, "data: "+str)
	return FlushWriter(c)
}

func PingData(c contract.Context) error {
	if c == nil {
		return errors.New("context is nil")
	}

	if RequestContextDone(c) {
		return fmt.Errorf("request context done: %w", c.Context().Err())
	}

	stream := c.ResponseStream()
	if stream == nil {
		return errors.New("write ping data failed: no response writer")
	}
	if _, err := stream.Write([]byte(": PING\n\n")); err != nil {
		return fmt.Errorf("write ping data failed: %w", err)
	}
	return FlushWriter(c)
}

func ObjectData(c contract.Context, object interface{}) error {
	if object == nil {
		return errors.New("object is nil")
	}
	jsonData, err := common.Marshal(object)
	if err != nil {
		return fmt.Errorf("error marshalling object: %w", err)
	}
	return StringData(c, string(jsonData))
}
func Done(c contract.Context) {
	_ = StringData(c, "[DONE]")
}

func WssString(c contract.Context, ws relaycommon.WSConn, str string) error {
	if ws == nil {
		logger.LogError(c.Context(), "websocket connection is nil")
		return errors.New("websocket connection is nil")
	}
	return ws.WriteMessage(1, []byte(str))
}

func WssObject(c contract.Context, ws relaycommon.WSConn, object interface{}) error {
	jsonData, err := common.Marshal(object)
	if err != nil {
		return fmt.Errorf("error marshalling object: %w", err)
	}
	if ws == nil {
		logger.LogError(c.Context(), "websocket connection is nil")
		return errors.New("websocket connection is nil")
	}
	return ws.WriteMessage(1, jsonData)
}

func WssError(c contract.Context, ws relaycommon.WSConn, openaiError types.OpenAIError) {
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

func GetResponseID(c contract.Context) string {
	logID := c.GetString(common.RequestIdKey)
	return fmt.Sprintf("chatcmpl-%s", logID)
}

func GetLocalRealtimeID(c contract.Context) string {
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

// SSERender is the exported form of renderSSE for relay root handlers that
// stream raw event lines without going through StreamScannerHandler.
func SSERender(c contract.Context, data string) {
	RenderSSE(c, data)
}
