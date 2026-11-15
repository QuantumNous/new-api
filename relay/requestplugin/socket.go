package requestplugin

import (
	"bytes"
	"context"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// Bounds of what a Realtime session keeps for its log.
const (
	maxRealtimeRecord = 32
	maxRealtimeSteps  = 64
	// maxRealtimeCancels bounds the response.cancel events whose upstream
	// errors the session still drops.
	maxRealtimeCancels = 8
)

// SocketIngress takes the execution plan of one Responses WebSocket
// response.create and runs the ingress stage on its stored body, as Ingress
// does for an HTTP request. changed reports a patched body, which the caller
// decodes again. The plan stays on c for the later stages, the reply check
// and the report.
func SocketIngress(c *gin.Context, format types.RelayFormat) (bool, []relaycommon.RequestPluginStep, []relaycommon.RequestPluginRecord, *types.NewAPIError) {
	plan := NewPlan()
	if plan == nil {
		return false, nil, nil, nil
	}
	plan.socket = true
	return plan.ingress(c, format, common.GetContextKeyString(c, constant.ContextKeyOriginalModel))
}

// SocketResponse is the reply check and the report capture of one response
// of a Responses WebSocket: the events of the response go to the client
// through it.
type SocketResponse struct {
	writer  *replyWriter
	capture *responseCapture
	send    func([]byte)
	stopErr *types.NewAPIError
}

// ResponsesSocket starts the reply check and the report capture of one
// Responses WebSocket response, once its upstream request is sent. send
// writes one event to the client. It returns nil when no instance checks the
// reply and none may report it: the session then sends every event itself.
func ResponsesSocket(c *gin.Context, info *relaycommon.RelayInfo, send func([]byte)) *SocketResponse {
	plan := planOf(c)
	if plan == nil || info == nil {
		return nil
	}
	call := attemptCall(c, info)
	plan.capture(c, call.Group, call.Model, call.Bound)
	socket := &SocketResponse{capture: plan.response, send: send}
	if plan.replies {
		if instances := plan.scope(StageReply, call.Group, call.Model, call.Bound); len(instances) > 0 {
			call.Format = string(types.RelayFormatOpenAIResponses)
			check := newReplyCheck(c.Request.Context(), plan, instances)
			check.call, check.stream = call, true
			socket.writer = &replyWriter{c: c, info: info, format: types.RelayFormatOpenAIResponses, check: check, mode: replyStream, recordAt: -1, socket: socket.out}
		}
	}
	if socket.writer == nil && socket.capture == nil {
		return nil
	}
	return socket
}

// out sends one event to the client and keeps it for the report.
func (s *SocketResponse) out(message []byte) {
	s.send(message)
	if s.capture != nil {
		s.capture.event(message)
	}
}

// Event passes one event of the response to the client once the reply check
// released its text. After a stop it drops the event.
func (s *SocketResponse) Event(message []byte) {
	w := s.writer
	switch {
	case w == nil || w.mode == replyPassing && !w.stopped:
		s.out(message)
	case !w.stopped:
		w.message(message)
	}
}

// Terminal checks the event that ends the response and returns it as the
// client gets it, for the session to send; the events released before it go
// out first. It returns nil when the check stopped the response.
func (s *SocketResponse) Terminal(message []byte) []byte {
	if w := s.writer; w != nil && w.stopped {
		return nil
	} else if w != nil && w.mode != replyPassing {
		// The last event released is the terminal one; the session sends it.
		var last []byte
		w.socket = func(data []byte) {
			if last != nil {
				s.out(last)
			}
			last = data
		}
		w.message(message)
		if !w.stopped {
			w.endStream()
		}
		w.socket = s.out
		if w.stopped {
			if last != nil {
				s.out(last)
			}
			return nil
		}
		if last != nil {
			message = last
		}
	}
	if s.capture != nil {
		s.capture.event(message)
	}
	return message
}

// Finish ends the check of a response that ended without its terminal
// event: the rest of the text is checked and the events waiting go out.
func (s *SocketResponse) Finish() {
	if w := s.writer; w != nil && w.mode != replyPassing && !w.stopped {
		w.endStream()
	}
}

// Stopped returns the error the client gets for a response an instance
// stopped, and nil for any other.
func (s *SocketResponse) Stopped() *types.NewAPIError {
	if s == nil || s.writer == nil || !s.writer.stopped {
		return nil
	}
	if s.stopErr == nil {
		s.stopErr = s.writer.stopError()
	}
	return s.stopErr
}

// StartRealtime takes the execution plan of a Realtime session. Its
// instances run on the session's events once the session knows its channel
// (NewRealtime).
func StartRealtime(c *gin.Context) {
	if plan := NewPlan(); plan != nil {
		c.Set(planContextKey, plan)
	}
}

// Realtime runs the request plugins of one Realtime session: the ingress
// stage on the text the client sends, the reply check on the text of each
// response, and a report per response. The client reader calls ClientEvent
// and the upstream reader ServerEvent, at the same time.
type Realtime struct {
	c        *gin.Context
	ctx      context.Context
	plan     *Plan
	call     Call
	tctx     jsplugin.TransformContext
	request  string
	ingress  []*request_plugin_setting.Instance
	reply    []*request_plugin_setting.Instance
	reports  []reportTarget
	toClient func([]byte)
	toTarget func([]byte)

	// audioSeen belongs to the client reader.
	audioSeen bool

	// These belong to the upstream reader.
	responses map[string]*realtimeResponse
	cancels   []string
	stopping  int

	mu     sync.Mutex
	closed bool
	steps  []relaycommon.RequestPluginStep
	record []relaycommon.RequestPluginRecord
	// pending are the entries since the last report.
	pending []relaycommon.RequestPluginRecord
}

// realtimeResponse is one response of a Realtime session.
type realtimeResponse struct {
	id      string
	started time.Time
	writer  *replyWriter
	capture *responseCapture
	stopErr *types.NewAPIError
}

// stopped returns the error the client got for a response an instance
// stopped, and nil for any other.
func (response *realtimeResponse) stopped() *types.NewAPIError {
	if response.writer == nil || !response.writer.stopped {
		return nil
	}
	if response.stopErr == nil {
		response.stopErr = response.writer.stopError()
	}
	return response.stopErr
}

// NewRealtime starts the request plugins of a Realtime session on its
// channel. toClient and toTarget write one event to the client and to the
// upstream. It returns nil when no instance runs at ingress, checks the
// reply or may report: the session then relays its events untouched.
func NewRealtime(c *gin.Context, info *relaycommon.RelayInfo, toClient, toTarget func([]byte)) *Realtime {
	plan := planOf(c)
	if plan == nil || info == nil {
		return nil
	}
	call := attemptCall(c, info)
	r := &Realtime{c: c, ctx: c.Request.Context(), plan: plan, request: c.GetString(common.RequestIdKey), toClient: toClient, toTarget: toTarget, responses: map[string]*realtimeResponse{}}
	r.ingress = plan.scope(StageIngress, call.Group, call.Model, call.Bound)
	if plan.replies {
		r.reply = plan.scope(StageReply, call.Group, call.Model, call.Bound)
	}
	if plan.reports {
		for _, instance := range plan.scope(jsplugin.ReportHook, call.Group, call.Model, call.Bound) {
			r.reports = append(r.reports, reportTarget{plugin: plan.plugins[instance.Plugin], instance: instance})
		}
	}
	if len(r.ingress) == 0 && len(r.reply) == 0 && len(r.reports) == 0 {
		return nil
	}
	call.Format = string(types.RelayFormatOpenAIRealtime)
	r.call = call
	r.tctx = jsplugin.TransformContext{Format: call.Format, Path: call.Path, Model: call.Model, UpstreamModel: call.UpstreamModel, Group: call.Group, Channel: call.Channel, User: call.User, Token: call.Token}
	return r
}

// ClientEvent runs the ingress stage on a client event that carries text:
// session.update, conversation.item.create and response.create. eventType
// is the type the session already read. patched is the event with the
// instances' changes, nil when they changed nothing; dropped reports an
// event they rejected, which the client got an error event for. Any other
// event passes as it is, unread.
func (r *Realtime) ClientEvent(eventType string, message []byte) (patched []byte, dropped bool) {
	if len(r.ingress) == 0 {
		return nil, false
	}
	var members [][2]string
	switch eventType {
	case "input_audio_buffer.append":
		if !r.audioSeen {
			r.audioSeen = true
			r.audioUnchecked()
		}
		return nil, false
	case "session.update":
		members = [][2]string{{"instructions", "session.instructions"}}
	case "conversation.item.create":
		members = [][2]string{{"input", "item"}}
	case "response.create":
		members = [][2]string{{"instructions", "response.instructions"}, {"input", "response.input"}}
	default:
		return nil, false
	}
	view, audio := realtimeView(message, members)
	if view == nil || r.isClosed() {
		return nil, false
	}
	call := r.call
	call.Stage, call.Format, call.Body = StageIngress, string(types.RelayFormatOpenAIResponses), view
	outcome := r.plan.Run(r.ctx, call)
	r.add(auditSteps(outcome), outcome.Record)
	apiErr := settle(r.c, outcome)
	if apiErr == nil && !bytes.Equal(outcome.Body, view) {
		var err error
		if patched, err = realtimeWriteBack(message, outcome.Body, members, audio); err != nil {
			logger.LogWarn(r.c, common.LogText("request plugin changes to a Realtime %s event were refused: %v", eventType, err))
			apiErr = settle(r.c, Outcome{Failed: &Failure{Class: errorInvalidEffect, Detail: err.Error()}})
		}
	}
	if apiErr != nil {
		r.toClient(realtimeError(apiErr, gjson.GetBytes(message, "event_id").Str))
		return nil, true
	}
	return patched, false
}

// realtimeView is the Responses-shaped body of a client event's text:
// members maps each view member to its path in the event. The audio of
// input items stays out of the view; audio holds each part it left out.
func realtimeView(message []byte, members [][2]string) ([]byte, map[string]string) {
	var view []byte
	var audio map[string]string
	for _, member := range members {
		value := gjson.GetBytes(message, member[1])
		if !value.Exists() {
			continue
		}
		raw := value.Raw
		if member[0] == "input" {
			if value.IsObject() {
				raw = "[" + raw + "]"
			}
			for i, item := range gjson.Parse(raw).Array() {
				for k, part := range item.Get("content").Array() {
					if data := part.Get("audio"); data.Exists() {
						path := strconv.Itoa(i) + ".content." + strconv.Itoa(k) + ".audio"
						if audio == nil {
							audio = map[string]string{}
						}
						audio[path] = data.Raw
						raw, _ = sjson.Delete(raw, path)
					}
				}
			}
		}
		if view == nil {
			view = []byte("{}")
		}
		view, _ = sjson.SetRawBytes(view, member[0], []byte(raw))
	}
	return view, audio
}

// realtimeWriteBack writes the patched view members back to the client
// event, with the audio the view left out.
func realtimeWriteBack(message, patched []byte, members [][2]string, audio map[string]string) ([]byte, error) {
	for _, member := range members {
		value := gjson.GetBytes(patched, member[0])
		if !value.Exists() {
			if gjson.GetBytes(message, member[1]).Exists() {
				return nil, errRealtimeMember(member[0])
			}
			continue
		}
		raw := value.Raw
		if member[0] == "input" {
			for path, data := range audio {
				if !gjson.Get(raw, strings.TrimSuffix(path, ".audio")).IsObject() {
					return nil, errRealtimeMember(member[0])
				}
				raw, _ = sjson.SetRaw(raw, path, data)
			}
			if member[1] == "item" {
				// conversation.item.create holds one item.
				items := gjson.Parse(raw).Array()
				if len(items) != 1 {
					return nil, errRealtimeMember(member[0])
				}
				raw = items[0].Raw
			}
		}
		var err error
		if message, err = sjson.SetRawBytes(message, member[1], []byte(raw)); err != nil {
			return nil, err
		}
	}
	return message, nil
}

type errRealtimeMember string

func (e errRealtimeMember) Error() string {
	return "a Realtime event keeps the shape of its " + string(e)
}

// realtimeError is a Realtime error event for a client event the instances
// stopped, or for a response they stopped (eventID "").
func realtimeError(apiErr *types.NewAPIError, eventID string) []byte {
	openAIErr := apiErr.ToOpenAIError()
	errorObject := gin.H{"type": openAIErr.Type, "code": openAIErr.Code, "message": openAIErr.Message, "param": openAIErr.Param}
	if eventID != "" {
		errorObject["event_id"] = eventID
	}
	encoded, _ := common.Marshal(gin.H{"type": "error", "event_id": "event_" + common.GetUUID(), "error": errorObject})
	return encoded
}

// audioUnchecked records, once per session, that the ingress instances do
// not check its audio input.
func (r *Realtime) audioUnchecked() {
	steps := make([]relaycommon.RequestPluginStep, 0, len(r.ingress))
	record := make([]relaycommon.RequestPluginRecord, 0, len(r.ingress))
	for _, instance := range r.ingress {
		step := relaycommon.RequestPluginStep{Instance: instance.ID, Name: instance.Name, Plugin: instance.Plugin, Stage: StageIngress, Action: "unchecked"}
		entry := relaycommon.RequestPluginRecord{Plugin: instance.Plugin, Name: map[string]string{"en": instance.Plugin}, Stage: StageIngress, Unchecked: true, Audio: true}
		if plugin := r.plan.plugins[instance.Plugin]; plugin != nil {
			step.Version, entry.Name = plugin.Meta.Version, pluginName(plugin.Meta)
		}
		steps, record = append(steps, step), append(record, entry)
	}
	r.add(steps, record)
}

// add keeps steps and record entries for the session's log and its next
// report, within their bounds: entries past the bound are counted in a last
// {truncated: n}.
func (r *Realtime) add(steps []relaycommon.RequestPluginStep, record []relaycommon.RequestPluginRecord) {
	if len(steps) == 0 && len(record) == 0 {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.steps = append(r.steps, steps[:min(len(steps), maxRealtimeSteps-len(r.steps))]...)
	r.record = appendCapped(r.record, record)
	if len(r.reports) > 0 {
		r.pending = appendCapped(r.pending, record)
	}
}

func appendCapped(record, entries []relaycommon.RequestPluginRecord) []relaycommon.RequestPluginRecord {
	for _, entry := range entries {
		switch {
		case len(record) < maxRealtimeRecord:
			record = append(record, entry)
		case len(record) == maxRealtimeRecord:
			record = append(record, relaycommon.RequestPluginRecord{Truncated: 1})
		default:
			record[len(record)-1].Truncated++
		}
	}
	return record
}

// Close ends the session's plugin work and puts its steps and record on
// info, where the consume log reads them. Events after it pass untouched.
func (r *Realtime) Close(info *relaycommon.RelayInfo) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.closed = true
	info.RequestPluginSteps = append(info.RequestPluginSteps, r.steps...)
	info.RequestPluginRecord = append(info.RequestPluginRecord, r.record...)
}

func (r *Realtime) isClosed() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.closed
}

// ServerEvent passes one upstream event to the client: the text of each
// response through its reply check, and the events of each response to its
// report, which runs at response.done. eventType is the type the session
// already read; usage and quota are what a response.done was billed, nil
// and 0 for any other event. Audio deltas are never read.
func (r *Realtime) ServerEvent(eventType string, message []byte, usage *dto.RealtimeUsage, quota int) {
	if len(r.reply) == 0 && len(r.reports) == 0 || r.isClosed() {
		r.toClient(message)
		return
	}
	switch {
	case eventType == "response.audio.delta" || eventType == "response.output_audio.delta":
		// The audio of a stopped response is dropped; only then is the
		// event read for its response.
		if r.stopping > 0 {
			if response := r.responseOf(message); response != nil && response.stopped() != nil {
				return
			}
		}
		r.toClient(message)
		return
	case eventType == "error" && len(r.cancels) > 0:
		// An error about a response.cancel the session sent is its own.
		if index := slices.Index(r.cancels, gjson.GetBytes(message, "error.event_id").Str); index >= 0 {
			r.cancels = slices.Delete(r.cancels, index, index+1)
			return
		}
	case eventType == "response.created":
		response := r.start(gjson.GetBytes(message, "response.id").Str)
		r.event(response, eventType, message)
		return
	case eventType == "response.done":
		if response := r.responseOf(message); response != nil {
			r.done(response, message, usage, quota)
			return
		}
	case strings.HasPrefix(eventType, "response."):
		if response := r.responseOf(message); response != nil {
			r.event(response, eventType, message)
			return
		}
	case strings.HasPrefix(eventType, "conversation.item."):
		if response := r.itemResponse(message); response != nil {
			r.event(response, eventType, message)
			return
		}
	}
	r.toClient(message)
}

// start begins the check and the capture of a response.
func (r *Realtime) start(id string) *realtimeResponse {
	response := &realtimeResponse{id: id, started: time.Now()}
	if len(r.reports) > 0 {
		response.capture = &responseCapture{socket: true}
	}
	if len(r.reply) > 0 {
		check := newReplyCheck(r.ctx, r.plan, r.reply)
		check.call, check.stream = r.call, true
		response.writer = &replyWriter{c: r.c, format: types.RelayFormatOpenAIRealtime, check: check, mode: replyStream, recordAt: -1,
			socket: func(message []byte) { response.out(r, message) }}
	}
	r.responses[id] = response
	return response
}

// out sends one event of a response to the client and keeps it for the
// report.
func (response *realtimeResponse) out(r *Realtime, message []byte) {
	r.toClient(message)
	if response.capture != nil {
		response.capture.event(message)
	}
}

// responseOf is the response an event belongs to. While one response runs,
// which is the common case, the event is not read for it.
func (r *Realtime) responseOf(message []byte) *realtimeResponse {
	if len(r.responses) == 1 {
		for _, response := range r.responses {
			return response
		}
	}
	id := gjson.GetBytes(message, "response_id").Str
	if id == "" {
		id = gjson.GetBytes(message, "response.id").Str
	}
	return r.responses[id]
}

// itemResponse is the response whose check reads the item of a
// conversation.item event: one that wrote text to it and still checks it.
func (r *Realtime) itemResponse(message []byte) *realtimeResponse {
	var id string
	for _, response := range r.responses {
		w := response.writer
		if w == nil || w.mode == replyPassing && !w.stopped {
			continue
		}
		if id == "" {
			if id = gjson.GetBytes(message, "item.id").Str; id == "" {
				return nil
			}
		}
		for _, output := range w.check.outputs {
			if output.itemID == id {
				return response
			}
		}
	}
	return nil
}

// event passes one event of a response through its check.
func (r *Realtime) event(response *realtimeResponse, eventType string, message []byte) {
	w := response.writer
	switch {
	case w == nil || w.mode == replyPassing && !w.stopped:
		response.out(r, message)
	case w.stopped:
		// An item as the conversation holds it shows what the client got.
		if strings.HasPrefix(eventType, "conversation.item.") {
			response.out(r, w.released(message))
		}
	default:
		w.message(message)
		if w.stopped {
			r.stop(response, true)
		}
	}
}

// done ends a response at its response.done: the check reads the rest of
// its text, and the report gets the response.
func (r *Realtime) done(response *realtimeResponse, message []byte, usage *dto.RealtimeUsage, quota int) {
	w := response.writer
	switch {
	case w != nil && w.stopped:
		response.out(r, w.released(message))
		r.stopping--
	case w != nil && w.mode != replyPassing:
		w.message(message)
		if !w.stopped {
			w.endStream()
		}
		if w.stopped {
			r.stop(response, false)
			response.out(r, w.released(message))
			r.stopping--
		}
	default:
		response.out(r, message)
	}
	delete(r.responses, response.id)
	if w != nil {
		r.add(auditSteps(Outcome{Steps: w.check.steps()}), w.check.record())
	}
	r.report(response, usage, quota)
}

// stop ends a response an instance stopped: the client gets an error event
// and, while the response runs, the upstream a response.cancel. Its other
// events are dropped until its response.done.
func (r *Realtime) stop(response *realtimeResponse, cancel bool) {
	r.stopping++
	response.out(r, realtimeError(response.stopped(), ""))
	if !cancel {
		return
	}
	id := "event_" + common.GetUUID()
	if len(r.cancels) == maxRealtimeCancels {
		r.cancels = r.cancels[1:]
	}
	r.cancels = append(r.cancels, id)
	encoded, _ := common.Marshal(gin.H{"type": "response.cancel", "event_id": id, "response_id": response.id})
	r.toTarget(encoded)
}

// released is a Realtime event with the text of each output the check read
// set to what the client got.
func (w *replyWriter) released(message []byte) []byte {
	_, full, _ := w.check.realtimeFields(gjson.ParseBytes(message))
	for _, field := range full {
		if released := field.output.released.String(); released != field.text {
			if next, err := sjson.SetBytes(message, field.path, released); err == nil {
				message = next
			}
		}
	}
	return message
}

// report queues the report of a finished response: the events the client
// got, its usage, its quota and the entries since the last report.
func (r *Realtime) report(response *realtimeResponse, usage *dto.RealtimeUsage, quota int) {
	if response.capture == nil {
		return
	}
	capture := response.capture
	kept, written := capture.kept[:len(capture.kept):len(capture.kept)], capture.written
	if !reports.admit(int64(len(kept))) {
		return
	}
	r.mu.Lock()
	pending := r.pending
	r.pending = nil
	r.mu.Unlock()
	job := &reportJob{
		targets:  r.reports,
		tctx:     r.tctx,
		response: kept,
		size:     int64(len(kept)),
		record: reportRecord{
			RequestID:      r.request,
			StartedAt:      response.started.UnixMilli(),
			DurationMs:     time.Since(response.started).Milliseconds(),
			RequestPlugins: pending,
			Response:       &reportResponse{Status: 200, Stream: true, Bytes: written, Truncated: written > int64(len(kept))},
			Cost:           reportCost{Quota: quota, USD: float64(quota) / common.QuotaPerUnit},
		},
	}
	job.record.User = reportUser{ID: r.call.User.ID, Username: r.call.User.Username}
	if token := r.call.Token; token != nil {
		job.record.Token = reportToken{ID: token.ID, Name: token.Name}
	}
	if usage != nil {
		job.record.Usage = map[string]any{
			"promptTokens":     usage.InputTokens,
			"completionTokens": usage.OutputTokens,
			"cacheTokens":      usage.InputTokenDetails.CachedTokens,
			"textInput":        usage.InputTokenDetails.TextTokens,
			"textOutput":       usage.OutputTokenDetails.TextTokens,
			"audioInput":       usage.InputTokenDetails.AudioTokens,
			"audioOutput":      usage.OutputTokenDetails.AudioTokens,
		}
	}
	if apiErr := response.stopped(); apiErr != nil {
		job.record.Error = newReportError(types.RelayFormatOpenAIRealtime, apiErr, nil)
		job.record.Response.Status = apiErr.StatusCode
	}
	reports.push(job)
}
