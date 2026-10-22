package helper

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// streamKeepAliveWriter 在业务写入前保活，写入开始时等待心跳退出。
type streamKeepAliveWriter struct {
	gin.ResponseWriter
	mutex       sync.Mutex
	cancel      context.CancelFunc
	done        chan struct{}
	pingContext *gin.Context
}

func (writer *streamKeepAliveWriter) stop() {
	writer.cancel()
	<-writer.done
}

func (writer *streamKeepAliveWriter) Unwrap() http.ResponseWriter {
	return writer.ResponseWriter
}

func (writer *streamKeepAliveWriter) Write(data []byte) (int, error) {
	writer.stop()
	return writer.ResponseWriter.Write(data)
}

func (writer *streamKeepAliveWriter) WriteString(data string) (int, error) {
	writer.stop()
	return writer.ResponseWriter.WriteString(data)
}

func (writer *streamKeepAliveWriter) WriteHeader(status int) {
	writer.stop()
	writer.ResponseWriter.WriteHeader(status)
}

func (writer *streamKeepAliveWriter) WriteHeaderNow() {
	writer.stop()
	writer.ResponseWriter.WriteHeaderNow()
}

func (writer *streamKeepAliveWriter) Flush() {
	writer.stop()
	writer.ResponseWriter.Flush()
}

func (writer *streamKeepAliveWriter) Status() int {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()
	return writer.ResponseWriter.Status()
}

func (writer *streamKeepAliveWriter) Size() int {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()
	return writer.ResponseWriter.Size()
}

func (writer *streamKeepAliveWriter) Written() bool {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()
	return writer.ResponseWriter.Written()
}

func (writer *streamKeepAliveWriter) ping() error {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()
	ExtendWriteDeadline(writer.pingContext)
	return PingData(writer.pingContext)
}

// StartStreamKeepAlive 按 interval 发送心跳，覆盖请求准备和重试；业务写入开始后交给流处理器。
// 内层请求复用外层的保活，内层清理不会提前结束它。
func StartStreamKeepAlive(c *gin.Context, interval time.Duration) func() {
	if previous, ok := c.Writer.(*streamKeepAliveWriter); ok {
		select {
		case <-previous.done:
			c.Writer = previous.ResponseWriter
		default:
			return func() {}
		}
	}
	if requestContextDone(c) {
		return func() {}
	}
	if interval <= 0 {
		interval = DefaultPingInterval
	}
	SetEventStreamHeaders(c)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 120*time.Minute)
	pingContext := c.Copy()
	// 心跳使用原 writer，业务写入才会触发交接。
	pingContext.Writer = c.Writer
	writer := &streamKeepAliveWriter{ResponseWriter: c.Writer, cancel: cancel, done: make(chan struct{}), pingContext: pingContext}
	c.Writer = writer
	go writer.keepAlive(ctx, interval)
	return writer.stop
}

func (writer *streamKeepAliveWriter) keepAlive(ctx context.Context, interval time.Duration) {
	defer close(writer.done)
	defer writer.cancel()
	defer func() {
		if recovered := recover(); recovered != nil {
			logger.LogDebug(writer.pingContext, "SSE ping goroutine panic recovered: %v", recovered)
		}
	}()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if ctx.Err() != nil || writer.ping() != nil {
				return
			}
		}
	}
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

	if requestContextDone(c) {
		return fmt.Errorf("request context done: %w", c.Request.Context().Err())
	}

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		return errors.New("streaming error: flusher not found")
	}

	flusher.Flush()
	// Gin's http.Flusher wrapper discards the underlying FlushError result.
	// Flush wrappers first so their buffers are preserved, then surface any
	// stored write error from an error-aware writer underneath them.
	var writer http.ResponseWriter = c.Writer
	for {
		if flusher, ok := writer.(interface{ FlushError() error }); ok {
			return flusher.FlushError()
		}
		unwrapper, ok := writer.(interface{ Unwrap() http.ResponseWriter })
		if !ok {
			break
		}
		writer = unwrapper.Unwrap()
	}
	return nil
}

func requestContextDone(c *gin.Context) bool {
	return c != nil && c.Request != nil && c.Request.Context().Err() != nil
}

func SetEventStreamHeaders(c *gin.Context) {
	// 检查是否已经设置过头部
	if _, exists := c.Get("event_stream_headers_set"); exists {
		return
	}

	// 设置标志，表示头部已经设置过
	c.Set("event_stream_headers_set", true)

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
}

func ClaudeData(c *gin.Context, resp dto.ClaudeResponse) error {
	if requestContextDone(c) {
		return nil
	}

	jsonData, err := common.Marshal(resp)
	if err != nil {
		common.SysError(common.LogText("error marshalling stream response: %s", err.Error()))
	} else {
		c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\n", resp.Type)})
		c.Render(-1, common.CustomEvent{Data: "data: " + string(jsonData)})
	}
	_ = FlushWriter(c)
	return nil
}

func ClaudeChunkData(c *gin.Context, resp dto.ClaudeResponse, data string) {
	if requestContextDone(c) {
		return
	}

	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\n", resp.Type)})
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("data: %s\n", data)})
	_ = FlushWriter(c)
}

func ResponseChunkData(c *gin.Context, resp dto.ResponsesStreamResponse, data string) error {
	if requestContextDone(c) {
		return fmt.Errorf("request context done: %w", c.Request.Context().Err())
	}

	event := common.CustomEvent{Data: fmt.Sprintf("event: %s\n", resp.Type)}
	if err := event.Render(c.Writer); err != nil {
		return err
	}
	event.Data = fmt.Sprintf("data: %s", data)
	if err := event.Render(c.Writer); err != nil {
		return err
	}
	return FlushWriter(c)
}

func StringData(c *gin.Context, str string) error {
	if c == nil || c.Writer == nil {
		return errors.New("context or writer is nil")
	}

	if requestContextDone(c) {
		return fmt.Errorf("request context done: %w", c.Request.Context().Err())
	}

	c.Render(-1, common.CustomEvent{Data: "data: " + str})
	return FlushWriter(c)
}

func PingData(c *gin.Context) error {
	if c == nil || c.Writer == nil {
		return errors.New("context or writer is nil")
	}

	if requestContextDone(c) {
		return fmt.Errorf("request context done: %w", c.Request.Context().Err())
	}

	if _, err := c.Writer.Write([]byte(": PING\n\n")); err != nil {
		return fmt.Errorf("write ping data failed: %w", err)
	}
	return FlushWriter(c)
}

func ObjectData(c *gin.Context, object any) error {
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
		logger.LogError(c, common.LogText("websocket connection is nil"))
		return errors.New("websocket connection is nil")
	}
	//common.LogInfo(c, fmt.Sprintf("sending message: %s", str))
	return ws.WriteMessage(1, []byte(str))
}

func WssObject(c *gin.Context, ws *websocket.Conn, object any) error {
	jsonData, err := common.Marshal(object)
	if err != nil {
		return fmt.Errorf("error marshalling object: %w", err)
	}
	if ws == nil {
		logger.LogError(c, common.LogText("websocket connection is nil"))
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
