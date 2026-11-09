package requestplugin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"mime"
	"net/http"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// Limits of the report hooks, part of the published plugin contract
// (docs/plugin-api/v1.md).
const (
	// maxReportResponseBytes is how much of the response a record keeps.
	maxReportResponseBytes = 1 << 20
	// The queue holds at most maxQueuedReports finished requests and
	// maxQueuedReportBytes of their request and response data; a request past
	// either is dropped.
	maxQueuedReports     = 256
	maxQueuedReportBytes = 64 << 20
	reportWorkers        = 8
	reportDropWarning    = time.Minute
)

// responseCapture passes what the gateway writes to the client through as it
// is and keeps a copy of the first maxReportResponseBytes for the report
// hooks. On a WebSocket it has no writer: event keeps each message the
// client got.
type responseCapture struct {
	gin.ResponseWriter
	socket  bool
	mu      sync.Mutex
	kept    []byte
	written int64
}

// event keeps one WebSocket message the client got, as an event stream
// event. Only whole events are kept; once one does not fit, written past
// kept marks the cut.
func (w *responseCapture) event(message []byte) {
	message = bytes.TrimRight(message, "\r\n")
	framed := len("data: ") + len(message) + bytes.Count(message, []byte("\n"))*len("data: ") + len("\n\n")
	w.mu.Lock()
	defer w.mu.Unlock()
	cut := w.written > int64(len(w.kept))
	w.written += int64(framed)
	if cut || len(w.kept)+framed > maxReportResponseBytes {
		return
	}
	w.kept = append(w.kept, "data: "...)
	for line := range bytes.Lines(message) {
		w.kept = append(w.kept, line...)
		if line[len(line)-1] == '\n' {
			w.kept = append(w.kept, "data: "...)
		}
	}
	w.kept = append(w.kept, "\n\n"...)
}

func (w *responseCapture) Write(data []byte) (int, error) {
	n, err := w.ResponseWriter.Write(data)
	w.mu.Lock()
	w.written += int64(n)
	w.kept = append(w.kept, data[:min(n, maxReportResponseBytes-len(w.kept))]...)
	w.mu.Unlock()
	return n, err
}

func (w *responseCapture) WriteString(text string) (int, error) {
	n, err := w.ResponseWriter.WriteString(text)
	w.mu.Lock()
	w.written += int64(n)
	w.kept = append(w.kept, text[:min(n, maxReportResponseBytes-len(w.kept))]...)
	w.mu.Unlock()
	return n, err
}

// Unwrap lets http.ResponseController reach the connection.
func (w *responseCapture) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// The record a report hook receives; docs/plugin-api/v1.md describes it.
type reportRecord struct {
	RequestID       string                            `json:"requestId"`
	User            reportUser                        `json:"user"`
	Token           reportToken                       `json:"token"`
	StartedAt       int64                             `json:"startedAt"`
	DurationMs      int64                             `json:"durationMs"`
	FirstResponseMs *int64                            `json:"firstResponseMs,omitempty"`
	Request         reportRequest                     `json:"request"`
	Response        *reportResponse                   `json:"response,omitempty"`
	Task            *reportTask                       `json:"task,omitempty"`
	Usage           map[string]any                    `json:"usage,omitempty"`
	Cost            reportCost                        `json:"cost"`
	Error           *reportError                      `json:"error,omitempty"`
	RequestPlugins  []relaycommon.RequestPluginRecord `json:"requestPlugins"`
}

type reportUser struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
}

type reportToken struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type reportRequest struct {
	// Body is null when the request is not JSON.
	Body  json.RawMessage           `json:"body"`
	Media []jsplugin.TransformMedia `json:"media,omitempty"`
}

type reportResponse struct {
	Status      int             `json:"status"`
	ContentType string          `json:"contentType"`
	Stream      bool            `json:"stream"`
	Body        json.RawMessage `json:"body,omitempty"`
	Events      []reportEvent   `json:"events,omitempty"`
	Bytes       int64           `json:"bytes"`
	Truncated   bool            `json:"truncated"`
}

type reportEvent struct {
	Event string          `json:"event,omitempty"`
	Data  json.RawMessage `json:"data"`
}

type reportCost struct {
	Quota int     `json:"quota"`
	USD   float64 `json:"usd"`
}

type reportError struct {
	Status  int    `json:"status"`
	Code    any    `json:"code"`
	Type    string `json:"type"`
	Message string `json:"message"`
}

// consumeLogUsage maps the token counts a consume log keeps in other to their
// record names; prompt and completion tokens are its columns.
var consumeLogUsage = [][2]string{
	{"cache_tokens", "cacheTokens"},
	{"cache_write_tokens", "cacheWriteTokens"},
	{"cache_creation_tokens", "cacheCreationTokens"},
	{"cache_creation_tokens_5m", "cacheCreationTokens5m"},
	{"cache_creation_tokens_1h", "cacheCreationTokens1h"},
	{"cache_creation_tokens_12h", "cacheCreationTokens12h"},
	{"input_tokens_total", "inputTokensTotal"},
	{"text_input", "textInput"},
	{"text_output", "textOutput"},
	{"audio_input", "audioInput"},
	{"audio_output", "audioOutput"},
	{"audio_input_token_count", "audioInputTokenCount"},
	{"image_output", "imageOutput"},
	{"image_cache_tokens", "imageCacheTokens"},
	{"image_count", "imageCount"},
}

type reportTarget struct {
	plugin   *jsplugin.LoadedPlugin
	instance *request_plugin_setting.Instance
}

// reportJob is a finished request waiting for its report hooks: the copies
// the request goroutine took before the request context is recycled. A
// worker builds the record from them.
type reportJob struct {
	targets []reportTarget
	tctx    jsplugin.TransformContext
	record  reportRecord
	// body is the client body after ingress; nil when it is not JSON.
	body     []byte
	response []byte
	size     int64
	// taskData and taskURL are the result of a task, which run reads.
	taskData []byte
	taskURL  string
}

// Report hands a finished relay request to the report hooks of its plan:
// once, after the client has the response and the request has settled,
// whether it succeeded or failed. It copies what the record needs and queues
// it; the hooks run on the report workers, and a full queue drops the
// request. info is nil when the request ended before its RelayInfo existed;
// ingressRecord is then its public record. apiErr is the error the client
// received.
func Report(c *gin.Context, format types.RelayFormat, info *relaycommon.RelayInfo, ingressRecord []relaycommon.RequestPluginRecord, apiErr *types.NewAPIError) {
	plan := planOf(c)
	// A stored task reports once, when it reaches its final state.
	if plan == nil || plan.response == nil || plan.submission != nil && plan.submission.stored {
		return
	}
	call := Call{Format: string(format), Path: c.Request.URL.Path, Model: common.GetContextKeyString(c, constant.ContextKeyOriginalModel), Group: common.GetContextKeyString(c, constant.ContextKeyUsingGroup)}
	call.User, call.Token = requester(c)
	pluginRecord := ingressRecord
	if info != nil {
		call, pluginRecord = attemptCall(c, info), info.RequestPluginRecord
	}
	var targets []reportTarget
	for _, instance := range plan.scope(jsplugin.ReportHook, call.Group, call.Model, call.Bound) {
		if plugin := plan.plugins[instance.Plugin]; plugin != nil && slices.Contains(plugin.TransformHooks(), jsplugin.ReportHook) {
			targets = append(targets, reportTarget{plugin: plugin, instance: instance})
		}
	}
	if len(targets) == 0 {
		return
	}

	plan.response.mu.Lock()
	kept, written := plan.response.kept[:len(plan.response.kept):len(plan.response.kept)], plan.response.written
	plan.response.mu.Unlock()
	var storage common.BodyStorage
	if jsonRequest(c) {
		storage, _ = common.GetBodyStorage(c)
	}
	size := int64(len(kept))
	if storage != nil {
		size += storage.Size()
	}
	if !reports.admit(size) {
		return
	}

	started := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if started.IsZero() {
		started = time.Now()
	}
	response := &reportResponse{Stream: true, Bytes: written, Truncated: written > int64(len(kept))}
	if plan.response.socket {
		// The events of a WebSocket response: an error goes out as one of
		// them.
		response.Status = http.StatusOK
		if apiErr != nil {
			response.Status = apiErr.StatusCode
		}
	} else {
		response.Status, response.ContentType = plan.response.Status(), plan.response.Header().Get("Content-Type")
		response.Stream = strings.HasPrefix(strings.ToLower(response.ContentType), "text/event-stream")
	}
	job := &reportJob{
		targets:  targets,
		tctx:     jsplugin.TransformContext{Format: call.Format, Path: call.Path, Model: call.Model, UpstreamModel: call.UpstreamModel, Group: call.Group, Channel: call.Channel, Attempt: call.Attempt, User: call.User, Token: call.Token},
		response: kept,
		size:     size,
		record: reportRecord{
			RequestID:      c.GetString(common.RequestIdKey),
			User:           reportUser{ID: c.GetInt("id"), Username: c.GetString("username")},
			Token:          reportToken{ID: c.GetInt("token_id"), Name: c.GetString("token_name")},
			StartedAt:      started.UnixMilli(),
			DurationMs:     time.Since(started).Milliseconds(),
			RequestPlugins: slices.Clone(pluginRecord),
			Response:       response,
		},
	}
	if info != nil && info.HasSendResponse() {
		firstResponse := info.FirstResponseTime.Sub(info.StartTime).Milliseconds()
		job.record.FirstResponseMs = &firstResponse
	}
	if storage != nil {
		if body, err := storage.Bytes(); err == nil {
			job.body = slices.Clone(body)
		}
	}
	if params, ok := common.GetContextKeyType[*model.RecordConsumeLogParams](c, constant.ContextKeyConsumeLog); ok && params != nil {
		usage := map[string]any{"promptTokens": params.PromptTokens, "completionTokens": params.CompletionTokens}
		other := params.Other.Snapshot()
		for _, names := range consumeLogUsage {
			switch value := other[names[0]].(type) {
			case int, int32, int64, float64:
				usage[names[1]] = value
			}
		}
		job.record.Usage = usage
		job.record.Cost.Quota = params.Quota
	}
	job.record.Cost.USD = float64(job.record.Cost.Quota) / common.QuotaPerUnit
	if apiErr != nil {
		job.record.Error = newReportError(format, apiErr, common.UpstreamAddresses(c))
	}
	reports.push(job)
}

// newReportError is the error a client received, as the record shows it.
func newReportError(format types.RelayFormat, apiErr *types.NewAPIError, upstreamURLs []string) *reportError {
	reported := &reportError{Status: apiErr.StatusCode, Code: apiErr.GetErrorCode()}
	if format == types.RelayFormatClaude {
		claudeErr := apiErr.ToClaudeError(upstreamURLs...)
		reported.Type, reported.Message = claudeErr.Type, claudeErr.Message
	} else {
		openAIErr := apiErr.ToOpenAIError(upstreamURLs...)
		reported.Code, reported.Type, reported.Message = openAIErr.Code, openAIErr.Type, openAIErr.Message
	}
	return reported
}

// run builds the record and calls each instance's report hook in plan order.
// A failure is logged by plugin key, instance id and error class only.
func (job *reportJob) run() {
	defer func() {
		if recovered := recover(); recovered != nil {
			common.SysError(common.LogText("request plugin report panicked: %v", recovered))
		}
	}()
	record := job.record
	if record.RequestPlugins == nil {
		record.RequestPlugins = []relaycommon.RequestPluginRecord{}
	} else {
		record.RequestPlugins = relaycommon.CapRequestPluginRecord(record.RequestPlugins)
	}
	if job.body != nil && gjson.ValidBytes(job.body) {
		view, media := scanMedia(job.body)
		record.Request.Body = view
		for index, item := range media {
			record.Request.Media = append(record.Request.Media, jsplugin.TransformMedia{Index: index, Path: item.path, MimeType: item.mime, Bytes: item.size()})
		}
	}
	if record.Task != nil {
		record.Task.Result = taskResult(job.taskData, job.taskURL)
	}
	if response := record.Response; response != nil && response.Stream {
		response.Events = reportEvents(job.response, response.Truncated)
	} else if response != nil && !response.Truncated {
		response.Body = reportBody(response.ContentType, job.response)
	}
	encoded, err := common.Marshal(record)
	if err != nil {
		common.SysError(common.LogText("request plugin report record failed: %v", err))
		return
	}
	for _, target := range job.targets {
		tctx := job.tctx
		tctx.Instance = jsplugin.TransformInstance{ID: target.instance.ID, Name: target.instance.Name}
		tctx.Config = target.instance.Config
		ctx := jsplugin.WithFetcher(context.Background(), service.RequestPluginFetcher(target.plugin, target.instance.Config))
		if err := target.plugin.CallReport(ctx, tctx, encoded); err != nil {
			class := jsplugin.TransformErrorFailed
			var transformErr *jsplugin.TransformError
			if errors.As(err, &transformErr) {
				class = transformErr.Class
			}
			logger.LogWarn(context.Background(), common.LogText("request plugin instance %s (%s) report failed: %s", target.instance.ID, target.plugin.Meta.Key, class))
		}
	}
}

// reportBody is a whole non-stream response as the record shows it: JSON as
// its value, other text as a string, binary data as nothing.
func reportBody(contentType string, body []byte) json.RawMessage {
	if len(body) == 0 {
		return nil
	}
	mediaType, _, _ := mime.ParseMediaType(contentType)
	isJSON := mediaType == "application/json" || strings.HasSuffix(mediaType, "+json")
	if isJSON && gjson.ValidBytes(body) {
		return body
	}
	textual := isJSON || strings.HasPrefix(mediaType, "text/") || mediaType == "application/xml" || strings.HasSuffix(mediaType, "+xml")
	if !textual || !utf8.Valid(body) {
		return nil
	}
	text, err := common.Marshal(string(body))
	if err != nil {
		return nil
	}
	return text
}

// reportEvents reads an SSE response as its events, data parsed as JSON when
// it parses; [DONE], comments and events without data are left out. A
// truncated stream keeps the whole events before the cut.
func reportEvents(stream []byte, truncated bool) []reportEvent {
	blocks := strings.Split(strings.ReplaceAll(string(stream), "\r\n", "\n"), "\n\n")
	if truncated {
		blocks = blocks[:len(blocks)-1]
	}
	var events []reportEvent
	for _, block := range blocks {
		var event reportEvent
		var data []string
		for line := range strings.SplitSeq(block, "\n") {
			field, value, _ := strings.Cut(line, ":")
			value = strings.TrimPrefix(value, " ")
			switch field {
			case "event":
				event.Event = value
			case "data":
				data = append(data, value)
			}
		}
		payload := strings.Join(data, "\n")
		if data == nil || payload == "[DONE]" {
			continue
		}
		if gjson.Valid(payload) {
			event.Data = json.RawMessage(payload)
		} else {
			event.Data, _ = common.Marshal(payload)
		}
		events = append(events, event)
	}
	return events
}

// reportQueue holds finished requests for the report workers, bounded by
// their number and by the bytes of their request and response data. Pending
// requests are lost when the process stops.
type reportQueue struct {
	jobs     chan *reportJob
	maxBytes int64
	workers  int
	start    sync.Once
	bytes    atomic.Int64
	dropped  atomic.Int64
	// warned is when the last drop warning was written, in Unix nanoseconds.
	warned atomic.Int64
}

var reports = newReportQueue(maxQueuedReports, maxQueuedReportBytes, reportWorkers)

func newReportQueue(records int, maxBytes int64, workers int) *reportQueue {
	return &reportQueue{jobs: make(chan *reportJob, records), maxBytes: maxBytes, workers: workers}
}

// admit reserves size bytes for a request, or drops it when the queue is
// full.
func (q *reportQueue) admit(size int64) bool {
	if len(q.jobs) < cap(q.jobs) {
		if q.bytes.Add(size) <= q.maxBytes {
			return true
		}
		q.bytes.Add(-size)
	}
	q.drop()
	return false
}

// push queues an admitted job without waiting; a full queue drops it.
func (q *reportQueue) push(job *reportJob) {
	q.start.Do(func() {
		for range q.workers {
			go q.work()
		}
	})
	select {
	case q.jobs <- job:
	default:
		q.bytes.Add(-job.size)
		q.drop()
	}
}

func (q *reportQueue) work() {
	for job := range q.jobs {
		job.run()
		q.bytes.Add(-job.size)
	}
}

// drop counts a dropped request and, at most once a minute, writes a warning
// with the number dropped since the last one.
func (q *reportQueue) drop() {
	q.dropped.Add(1)
	now, last := time.Now().UnixNano(), q.warned.Load()
	if now-last < int64(reportDropWarning) || !q.warned.CompareAndSwap(last, now) {
		return
	}
	logger.LogWarn(context.Background(), common.LogText("request plugin report queue is full; %d requests were dropped", q.dropped.Swap(0)))
}
