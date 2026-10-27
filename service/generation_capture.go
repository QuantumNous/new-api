package service

import (
	"bytes"
	"encoding/json"
	"io"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// Generation relays answer with whatever the upstream produced: an OpenAI image
// envelope, a task submission, or a task poll. The playground history has to
// read all three without knowing which channel served the request, so the
// parsing here walks the JSON instead of binding to one schema.

const (
	generationCaptureLimit = 16 << 20

	GenerationStatusQueued  = "queued"
	GenerationStatusRunning = "running"
	GenerationStatusSuccess = "success"
	GenerationStatusFailure = "failure"

	GenerationKindImage = "image"
	GenerationKindVideo = "video"
)

// GenerationCapture tees the handler's body while it streams to the browser, so
// the same bytes can be inspected once the relay is done. Only the first
// generationCaptureLimit bytes are kept; an oversized body simply yields no
// history entry rather than unbounded memory use.
type GenerationCapture struct {
	gin.ResponseWriter
	body  bytes.Buffer
	limit int
}

func CaptureGenerationResponse(c *gin.Context) *GenerationCapture {
	capture := &GenerationCapture{ResponseWriter: c.Writer, limit: generationCaptureLimit}
	c.Writer = capture
	return capture
}

func (w *GenerationCapture) Write(data []byte) (int, error) {
	w.keep(data)
	return w.ResponseWriter.Write(data)
}

func (w *GenerationCapture) WriteString(text string) (int, error) {
	w.keep([]byte(text))
	return w.ResponseWriter.WriteString(text)
}

func (w *GenerationCapture) keep(data []byte) {
	remaining := w.limit - w.body.Len()
	if remaining <= 0 {
		return
	}
	if len(data) > remaining {
		data = data[:remaining]
	}
	_, _ = w.body.Write(data)
}

// Body returns the bytes the handler wrote, or nil when nothing was captured.
func (w *GenerationCapture) Body() []byte {
	if w == nil || w.body.Len() == 0 {
		return nil
	}
	return w.body.Bytes()
}

// StatusCode reports the status the handler actually sent.
func (w *GenerationCapture) StatusCode() int {
	if w == nil {
		return 0
	}
	return w.ResponseWriter.Status()
}

// GenerationRequestFields are the request values a history row keeps so the
// prompt and settings can be replayed later.
type GenerationRequestFields struct {
	Model  string
	Prompt string
	Params string
}

// ReadGenerationRequestFields reads the cached request body without consuming
// it: the relay seeks the same storage back to the start when it decodes the
// request.
func ReadGenerationRequestFields(c *gin.Context) GenerationRequestFields {
	body := ReadGenerationRequestBody(c)
	if len(body) == 0 {
		return GenerationRequestFields{}
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return GenerationRequestFields{}
	}
	fields := GenerationRequestFields{
		Model:  stringField(payload, "model"),
		Prompt: stringField(payload, "prompt"),
	}
	params := map[string]any{}
	for _, key := range []string{"size", "n", "seconds", "duration", "resolution", "ratio", "quality", "response_format"} {
		if value, ok := payload[key]; ok && value != nil {
			params[key] = value
		}
	}
	if len(params) > 0 {
		if encoded, err := json.Marshal(params); err == nil {
			fields.Params = string(encoded)
		}
	}
	return fields
}

// ReadGenerationRequestBody returns the raw request body from the body storage
// the relay middleware already populated.
func ReadGenerationRequestBody(c *gin.Context) []byte {
	storage, err := common.GetRequestBody(c)
	if err != nil || storage == nil {
		return nil
	}
	// The stored body is a BodyStorage in practice; asking it for its bytes
	// leaves the cursor where the relay expects it.
	if withBytes, ok := storage.(interface{ Bytes() ([]byte, error) }); ok {
		body, err := withBytes.Bytes()
		if err != nil {
			return nil
		}
		return body
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return nil
	}
	reader, ok := storage.(io.Reader)
	if !ok {
		return nil
	}
	body, err := io.ReadAll(reader)
	if err != nil {
		return nil
	}
	return body
}

// ExtractGenerationMediaRefs returns every image or video the response points
// at. Both plain JSON and event-stream payloads are accepted, because image
// relays stream their final payload on some upstreams.
func ExtractGenerationMediaRefs(body []byte) []GenerationMediaRef {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		return nil
	}
	seen := map[string]struct{}{}
	refs := make([]GenerationMediaRef, 0, 2)

	collect := func(payload any) {
		for _, ref := range walkGenerationMediaRefs(payload) {
			key := ref.Kind + "\x00" + ref.Value
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			refs = append(refs, ref)
		}
	}

	var payload any
	if err := json.Unmarshal(trimmed, &payload); err == nil {
		collect(payload)
		return refs
	}
	for _, line := range strings.Split(string(trimmed), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		chunk := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if chunk == "" || chunk == "[DONE]" {
			continue
		}
		var streamed any
		if err := json.Unmarshal([]byte(chunk), &streamed); err == nil {
			collect(streamed)
		}
	}
	return refs
}

// GenerationTaskState is what a task submission or poll tells the history.
type GenerationTaskState struct {
	TaskID     string
	Status     string
	Progress   string
	FailReason string
	Refs       []GenerationMediaRef
}

// ExtractGenerationTaskState reads a submission or poll response. The poll
// envelope wraps the task in data; the submission puts its fields at the root.
func ExtractGenerationTaskState(body []byte) GenerationTaskState {
	state := GenerationTaskState{}
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		return state
	}
	var payload map[string]any
	if err := json.Unmarshal(trimmed, &payload); err != nil {
		return state
	}

	primary := payload
	if nested, ok := payload["data"].(map[string]any); ok {
		primary = nested
	}
	state.TaskID = firstString(primary, "task_id", "id")
	if state.TaskID == "" {
		state.TaskID = firstString(payload, "task_id", "id")
	}
	state.Status = NormalizeGenerationStatus(firstString(primary, "status"))
	if state.Status == "" {
		state.Status = NormalizeGenerationStatus(firstString(payload, "status"))
	}
	state.Progress = firstScalar(primary, "progress")
	state.FailReason = firstString(primary, "fail_reason", "failReason")
	if state.FailReason == "" {
		state.FailReason = firstString(payload, "fail_reason", "failReason")
	}
	if state.FailReason == "" {
		if errObject, ok := primary["error"].(map[string]any); ok {
			state.FailReason = firstString(errObject, "message", "code")
		}
	}
	state.Refs = ExtractGenerationMediaRefs(body)
	if resultURL := firstString(primary, "result_url", "video_url"); resultURL != "" {
		state.Refs = appendGenerationRef(state.Refs, resultURL)
	}
	return state
}

// ExtractGenerationError returns the human-readable failure a relay body
// carries, if any.
func ExtractGenerationError(body []byte) string {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		return ""
	}
	var payload map[string]any
	if err := json.Unmarshal(trimmed, &payload); err != nil {
		return ""
	}
	if errObject, ok := payload["error"].(map[string]any); ok {
		if message := firstString(errObject, "message"); message != "" {
			return message
		}
	}
	return firstString(payload, "message", "fail_reason")
}

func NormalizeGenerationStatus(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "success", "succeeded", "completed", "complete":
		return GenerationStatusSuccess
	case "failure", "failed", "error", "cancelled", "canceled":
		return GenerationStatusFailure
	case "in_progress", "running", "processing", "generating":
		return GenerationStatusRunning
	case "queued", "queueing", "not_start", "submitted", "pending", "":
		if strings.TrimSpace(raw) == "" {
			return ""
		}
		return GenerationStatusQueued
	default:
		return strings.ToLower(strings.TrimSpace(raw))
	}
}

func walkGenerationMediaRefs(value any) []GenerationMediaRef {
	refs := make([]GenerationMediaRef, 0, 2)
	switch typed := value.(type) {
	case map[string]any:
		for key, item := range typed {
			if text, ok := item.(string); ok {
				lowerKey := strings.ToLower(key)
				switch {
				case strings.Contains(lowerKey, "b64"):
					if text != "" {
						refs = append(refs, GenerationMediaRef{Kind: "base64", Value: text, MimeType: "image/png"})
					}
				case lowerKey == "url" || lowerKey == "image_url" || lowerKey == "video_url" ||
					lowerKey == "result_url" || lowerKey == "output_url" || lowerKey == "download_url":
					refs = appendGenerationRef(refs, text)
				}
				continue
			}
			refs = append(refs, walkGenerationMediaRefs(item)...)
		}
	case []any:
		for _, item := range typed {
			refs = append(refs, walkGenerationMediaRefs(item)...)
		}
	}
	return refs
}

func appendGenerationRef(refs []GenerationMediaRef, value string) []GenerationMediaRef {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
		return append(refs, GenerationMediaRef{Kind: "url", Value: value})
	}
	if strings.HasPrefix(value, "data:image") || strings.HasPrefix(value, "data:video") {
		return append(refs, GenerationMediaRef{Kind: "base64", Value: value, MimeType: "image/png"})
	}
	return refs
}

func stringField(payload map[string]any, key string) string {
	if value, ok := payload[key].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}

func firstString(payload map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := payload[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func firstScalar(payload map[string]any, keys ...string) string {
	for _, key := range keys {
		switch value := payload[key].(type) {
		case string:
			if strings.TrimSpace(value) != "" {
				return strings.TrimSpace(value)
			}
		case float64:
			return strconv.FormatFloat(value, 'f', -1, 64)
		case json.Number:
			return value.String()
		}
	}
	return ""
}
