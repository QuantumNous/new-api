package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const (
	responsesWebSocketMaxStreamIDLength = 256
	responsesWebSocketErrorType         = "invalid_request_error"
)

// ResponsesWebSocket serves OpenAI-compatible Responses WebSocket mode.
func ResponsesWebSocket(c *gin.Context) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		helper.WssError(c, ws, types.NewErrorWithStatusCode(err, types.ErrorCodeGetChannelFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry()).ToClientOpenAIError(c))
		return
	}
	defer ws.Close()

	messageType, firstMessage, err := ws.ReadMessage()
	if err != nil {
		return
	}
	if messageType != websocket.TextMessage {
		sendResponsesWebSocketError(ws, http.StatusBadRequest, "Responses WebSocket events must be JSON text messages", "invalid_event")
		return
	}

	_, model, _, err := normalizeResponsesWebSocketEvent(firstMessage, true)
	if err != nil {
		sendResponsesWebSocketError(ws, http.StatusBadRequest, err.Error(), "invalid_event")
		return
	}

	// The existing xAI native route also uses GET /v1/responses. Keep it available
	// for xAI model events after the first event reveals the upstream model.
	if isXAIResponsesWebSocketModel(model) {
		common.SetContextKey(c, constant.ContextKeyOriginalModel, model)
		RelayWithWebSocket(c, types.RelayFormatXAIRealtime, ws, messageType, firstMessage)
		return
	}

	engine := newResponsesWebSocketEngine()
	if err := serveResponsesWebSocketEvent(c.Request, ws, engine, firstMessage); err != nil {
		return
	}

	for {
		messageType, message, readErr := ws.ReadMessage()
		if readErr != nil {
			return
		}
		if messageType != websocket.TextMessage {
			sendResponsesWebSocketError(ws, http.StatusBadRequest, "Responses WebSocket events must be JSON text messages", "invalid_event")
			continue
		}
		if err := serveResponsesWebSocketEvent(c.Request, ws, engine, message); err != nil {
			return
		}
	}
}

func newResponsesWebSocketEngine() *gin.Engine {
	engine := gin.New()
	engine.Use(
		middleware.RouteTag("relay"),
		middleware.SystemPerformanceCheck(),
		middleware.TokenAuth(),
		middleware.ModelRequestRateLimit(),
		middleware.TokenRateLimit(),
		middleware.Distribute(),
		middleware.GroupConcurrencyLimit(),
	)
	engine.POST("/v1/responses", func(c *gin.Context) {
		Relay(c, types.RelayFormatOpenAIResponses)
	})
	return engine
}

func serveResponsesWebSocketEvent(parent *http.Request, ws *websocket.Conn, engine *gin.Engine, message []byte) error {
	requestBody, _, streamID, err := normalizeResponsesWebSocketEvent(message, false)
	if err != nil {
		sendResponsesWebSocketError(ws, http.StatusBadRequest, err.Error(), "invalid_event")
		return nil
	}

	request := httptest.NewRequest(http.MethodPost, "/v1/responses", bytes.NewReader(requestBody))
	request = request.WithContext(parent.Context())
	request.Header = cloneResponsesWebSocketHeaders(parent.Header)
	request.Header.Set("Content-Type", "application/json")
	request.Host = parent.Host
	request.RemoteAddr = parent.RemoteAddr

	writer := newResponsesWebSocketWriter(ws, streamID)
	engine.ServeHTTP(writer, request)
	writer.finish()
	return writer.err
}

func normalizeResponsesWebSocketEvent(message []byte, requireModel bool) ([]byte, string, string, error) {
	var event map[string]json.RawMessage
	if err := common.Unmarshal(message, &event); err != nil || event == nil {
		return nil, "", "", fmt.Errorf("event must be a JSON object")
	}

	var eventType string
	if raw, ok := event["type"]; !ok || common.Unmarshal(raw, &eventType) != nil || eventType != "response.create" {
		return nil, "", "", fmt.Errorf("event type must be response.create")
	}

	var model string
	if raw, ok := event["model"]; ok {
		if err := common.Unmarshal(raw, &model); err != nil {
			return nil, "", "", fmt.Errorf("model must be a string")
		}
		model = strings.TrimSpace(model)
	}
	if requireModel && model == "" {
		return nil, "", "", fmt.Errorf("model is required in the first response.create event")
	}

	var streamID string
	if raw, ok := event["stream_id"]; ok {
		if err := common.Unmarshal(raw, &streamID); err != nil {
			return nil, "", "", fmt.Errorf("stream_id must be a string")
		}
		if streamID == "" || len(streamID) > responsesWebSocketMaxStreamIDLength || !validResponsesWebSocketStreamID(streamID) {
			return nil, "", "", fmt.Errorf("stream_id must contain only letters, numbers, underscores, hyphens, and periods")
		}
	}

	delete(event, "type")
	delete(event, "stream_id")
	event["stream"] = json.RawMessage("true")
	requestBody, err := common.Marshal(event)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to encode response.create event")
	}
	return requestBody, model, streamID, nil
}

func validResponsesWebSocketStreamID(streamID string) bool {
	for _, ch := range streamID {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_' || ch == '-' || ch == '.' {
			continue
		}
		return false
	}
	return true
}

func isXAIResponsesWebSocketModel(model string) bool {
	model = strings.ToLower(strings.TrimSpace(model))
	return strings.HasPrefix(model, "grok-") || strings.HasPrefix(model, "grok_") || model == "grok"
}

func cloneResponsesWebSocketHeaders(source http.Header) http.Header {
	cloned := source.Clone()
	for _, key := range []string{
		"Connection",
		"Content-Length",
		"Host",
		"Sec-WebSocket-Extensions",
		"Sec-WebSocket-Key",
		"Sec-WebSocket-Protocol",
		"Sec-WebSocket-Version",
		"Upgrade",
	} {
		cloned.Del(key)
	}
	return cloned
}

type responsesWebSocketWriter struct {
	ws       *websocket.Conn
	streamID string

	header http.Header
	status int
	stream bool
	sent   bool
	err    error
	raw    bytes.Buffer
	lines  bytes.Buffer
	mu     sync.Mutex
}

func newResponsesWebSocketWriter(ws *websocket.Conn, streamID string) *responsesWebSocketWriter {
	return &responsesWebSocketWriter{
		ws:       ws,
		streamID: streamID,
		header:   make(http.Header),
		status:   http.StatusOK,
	}
}

func (w *responsesWebSocketWriter) Header() http.Header {
	return w.header
}

func (w *responsesWebSocketWriter) WriteHeader(statusCode int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.status != http.StatusOK {
		return
	}
	w.status = statusCode
	w.stream = strings.Contains(strings.ToLower(w.header.Get("Content-Type")), "text/event-stream")
}

func (w *responsesWebSocketWriter) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.err != nil {
		return 0, w.err
	}
	if w.status == http.StatusOK {
		w.stream = strings.Contains(strings.ToLower(w.header.Get("Content-Type")), "text/event-stream")
	}
	if !w.stream {
		return w.raw.Write(data)
	}

	_, _ = w.lines.Write(data)
	for {
		line, err := w.lines.ReadBytes('\n')
		if err != nil {
			if len(line) > 0 {
				w.lines.Write(line)
			}
			break
		}
		line = bytes.TrimSpace(line)
		if !bytes.HasPrefix(line, []byte("data:")) {
			continue
		}
		payload := bytes.TrimSpace(bytes.TrimPrefix(line, []byte("data:")))
		if len(payload) == 0 || bytes.Equal(payload, []byte("[DONE]")) {
			continue
		}
		payload = addResponsesWebSocketStreamID(payload, w.streamID)
		if err := w.ws.WriteMessage(websocket.TextMessage, payload); err != nil {
			w.err = err
			return 0, err
		}
		w.sent = true
	}
	return len(data), nil
}

func (w *responsesWebSocketWriter) Flush() {
	w.mu.Lock()
	w.stream = true
	w.mu.Unlock()
}

func (w *responsesWebSocketWriter) finish() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.err != nil || w.sent || w.status < http.StatusBadRequest {
		return
	}

	var body any
	if w.raw.Len() > 0 && common.Unmarshal(w.raw.Bytes(), &body) == nil {
		if object, ok := body.(map[string]any); ok {
			if nested, exists := object["error"]; exists {
				body = nested
			}
		}
	}
	if body == nil {
		body = map[string]any{
			"type":    responsesWebSocketErrorType,
			"message": "response request failed",
		}
	}
	w.err = writeResponsesWebSocketError(w.ws, w.status, body, w.streamID)
}

func addResponsesWebSocketStreamID(payload []byte, streamID string) []byte {
	if streamID == "" {
		return payload
	}
	var event map[string]json.RawMessage
	if common.Unmarshal(payload, &event) != nil || event == nil {
		return payload
	}
	if _, exists := event["stream_id"]; exists {
		return payload
	}
	rawStreamID, err := common.Marshal(streamID)
	if err != nil {
		return payload
	}
	event["stream_id"] = rawStreamID
	encoded, err := common.Marshal(event)
	if err != nil {
		return payload
	}
	return encoded
}

func sendResponsesWebSocketError(ws *websocket.Conn, statusCode int, message, code string) {
	if message == "" {
		message = "invalid Responses WebSocket event"
	}
	body := map[string]any{
		"type":    responsesWebSocketErrorType,
		"code":    code,
		"message": message,
	}
	_ = writeResponsesWebSocketError(ws, statusCode, body, "")
}

func writeResponsesWebSocketError(ws *websocket.Conn, statusCode int, body any, streamID string) error {
	event := map[string]any{
		"type":   "error",
		"status": statusCode,
		"error":  body,
	}
	if streamID != "" {
		event["stream_id"] = streamID
	}
	payload, err := common.Marshal(event)
	if err != nil {
		return err
	}
	return ws.WriteMessage(websocket.TextMessage, payload)
}
