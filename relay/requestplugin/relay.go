package requestplugin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const planContextKey = "request_plugin_plan"

func planOf(c *gin.Context) *Plan {
	if c == nil {
		return nil
	}
	plan, _ := c.Value(planContextKey).(*Plan)
	return plan
}

// Ingress takes the execution plan of a relay request and runs the ingress
// stage on the stored client body, before the body is parsed. Patched bytes
// replace the stored body, so parsing, the billing estimate, retries and the
// later stages read them. It returns the audit steps and the public record
// for RelayInfo.SetRequestPluginIngress. When an instance may report the
// request, it starts capturing the response for Report.
func Ingress(c *gin.Context, format types.RelayFormat) ([]relaycommon.RequestPluginStep, []relaycommon.RequestPluginRecord, *types.NewAPIError) {
	plan := NewPlan()
	if plan == nil {
		return nil, nil, nil
	}
	_, steps, record, apiErr := plan.ingress(c, format, common.GetContextKeyString(c, constant.ContextKeyOriginalModel))
	return steps, record, apiErr
}

// SubmitIngress takes the execution plan of a task or Midjourney submission
// and runs the ingress stage on its stored client body, once, before the
// body is decoded past model routing, validated and priced. format is the
// client's protocol: task, mj_proxy, or the openai_responses and
// openai_image bridges of task plugins; model is the model the request was
// routed to. changed reports a patched body, which the caller decodes
// again. It returns the audit steps and the public record for
// RelayInfo.SetRequestPluginIngress.
func SubmitIngress(c *gin.Context, format types.RelayFormat, model string) (bool, []relaycommon.RequestPluginStep, []relaycommon.RequestPluginRecord, *types.NewAPIError) {
	plan := NewPlan()
	if plan == nil {
		return false, nil, nil, nil
	}
	plan.submission = &submission{format: string(format)}
	return plan.ingress(c, format, model)
}

func (p *Plan) ingress(c *gin.Context, format types.RelayFormat, model string) (bool, []relaycommon.RequestPluginStep, []relaycommon.RequestPluginRecord, *types.NewAPIError) {
	c.Set(planContextKey, p)
	if p.reports {
		p.response = &responseCapture{ResponseWriter: c.Writer}
		c.Writer = p.response
	}
	group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	if len(p.scope(StageIngress, group, model, nil)) == 0 {
		return false, nil, nil, nil
	}
	read := readStageBody(c)
	user, token := requester(c)
	outcome := p.Run(c.Request.Context(), Call{
		Stage:  StageIngress,
		Format: string(format),
		Path:   c.Request.URL.Path,
		Model:  model,
		Group:  group,
		User:   user,
		Token:  token,
		Body:   read.body,
		form:   read.form,
	})
	steps := auditSteps(outcome)
	if apiErr := settle(c, outcome); apiErr != nil {
		return false, steps, outcome.Record, apiErr
	}
	if read.body == nil || bytes.Equal(outcome.Body, read.body) {
		return false, steps, outcome.Record, nil
	}
	if err := read.replace(c, outcome.Body); err != nil {
		return false, steps, outcome.Record, storeBodyError(err)
	}
	return true, steps, outcome.Record, nil
}

// submission is the state of a task or Midjourney submission.
type submission struct {
	// format is the client's protocol.
	format string
	// base is the client body the request's ingress left, kept while an
	// attempt's late ingress changed the stored body; the next attempt
	// starts from it.
	base []byte
	// stored is set once the task is stored: it reports at its final state,
	// not at submit.
	stored bool
}

// TaskAttempt runs the late ingress hooks of a task or Midjourney
// submission attempt on the client body, before the attempt validates and
// prices it: those of the attempt's channel, and of a group settled at
// channel selection, that did not run at the request's ingress. Each
// attempt starts from the body the request's ingress left. changed reports
// that the stored body differs from the one the previous attempt read,
// which the caller decodes again.
func TaskAttempt(c *gin.Context, info *relaycommon.RelayInfo) (bool, *types.NewAPIError) {
	plan := planOf(c)
	if plan == nil || plan.submission == nil {
		return false, nil
	}
	changed := false
	if base := plan.submission.base; base != nil {
		plan.submission.base = nil
		if err := replaceStoredBody(c, base); err != nil {
			return false, storeBodyError(err)
		}
		changed = true
	}
	call := attemptCall(c, info)
	call.Stage, call.Late, call.Unpriced = StageIngress, true, true
	if !slices.ContainsFunc(plan.scope(StageIngress, call.Group, call.Model, call.Bound), func(instance *request_plugin_setting.Instance) bool {
		return !plan.ingressRan[instance.ID]
	}) {
		return changed, nil
	}
	read := readStageBody(c)
	call.Body, call.form = read.body, read.form
	outcome := plan.Run(c.Request.Context(), call)
	info.RequestPluginSteps = append(info.RequestPluginSteps, auditSteps(outcome)...)
	info.RequestPluginRecord = append(info.RequestPluginRecord, outcome.Record...)
	if apiErr := settle(c, outcome); apiErr != nil {
		return changed, apiErr
	}
	if read.body == nil || bytes.Equal(outcome.Body, read.body) {
		return changed, nil
	}
	base := read.raw
	if err := read.replace(c, outcome.Body); err != nil {
		return changed, storeBodyError(err)
	}
	plan.submission.base = base
	return true, nil
}

// TaskEgress runs the egress stage on the upstream body a task submission
// attempt built, before it is sent. It changes nothing; an instance can
// only stop the request. A body that is not JSON, such as a multipart body
// the plugin built, is recorded as unchecked. It returns a reader of the
// same bytes.
func TaskEgress(c *gin.Context, info *relaycommon.RelayInfo, body io.Reader) (io.Reader, *types.NewAPIError) {
	plan := planOf(c)
	if plan == nil {
		return body, nil
	}
	call := attemptCall(c, info)
	// The upstream body is the vendor's, whatever protocol the client used.
	call.Stage, call.Format = StageEgress, string(types.RelayFormatTask)
	if len(plan.scope(StageEgress, call.Group, call.Model, call.Bound)) == 0 {
		return body, nil
	}
	var raw []byte
	if body != nil {
		var err error
		if raw, err = io.ReadAll(body); err != nil {
			return nil, types.NewError(err, types.ErrorCodeReadRequestBodyFailed, types.ErrOptionWithSkipRetry())
		}
		body = bytes.NewReader(raw)
	}
	if gjson.ValidBytes(raw) {
		call.Body = raw
	}
	outcome := plan.Run(c.Request.Context(), call)
	info.RequestPluginSteps = append(info.RequestPluginSteps, auditSteps(outcome)...)
	info.RequestPluginRecord = append(info.RequestPluginRecord, outcome.Record...)
	if apiErr := settle(c, outcome); apiErr != nil {
		return nil, apiErr
	}
	return body, nil
}

// TaskError is the task error of a request plugin's rejection or failure:
// a local error, which never counts against the channel.
func TaskError(apiErr *types.NewAPIError) *dto.TaskError {
	if apiErr == nil {
		return nil
	}
	return &dto.TaskError{Code: string(apiErr.GetErrorCode()), Message: apiErr.Err.Error(), StatusCode: apiErr.StatusCode, LocalError: true, Error: apiErr.Err}
}

// Stopped reports a task error a request plugin's rejection or failure
// caused; it is neither retried nor hidden from the client.
func Stopped(taskErr *dto.TaskError) bool {
	return taskErr != nil && (taskErr.Code == string(types.ErrorCodeRequestRejected) || taskErr.Code == string(types.ErrorCodeRequestPluginFailed))
}

// stageBody is the stored client body as the stage hooks read it.
type stageBody struct {
	storage common.BodyStorage
	raw     []byte
	// body is the JSON body, or the JSON object of the text fields of a
	// multipart form body (form set); nil when the hooks cannot read it.
	body []byte
	form *formBody
}

// readStageBody reads the stored client body. A read error is cached, so
// parsing the request reports it next; a body the hooks cannot read is
// left to parsing as well.
func readStageBody(c *gin.Context) stageBody {
	var read stageBody
	boundary := formBoundary(c.Request.Header.Get("Content-Type"))
	if boundary == "" && !jsonRequest(c) {
		return read
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return read
	}
	raw, err := storage.Bytes()
	if err != nil {
		return read
	}
	read.storage, read.raw = storage, raw
	if boundary == "" {
		if gjson.ValidBytes(raw) {
			read.body = raw
		}
		return read
	}
	if form, view, err := readForm(boundary, raw); err == nil {
		read.body, read.form = view, form
	}
	return read
}

// replace stores the client body with the stage's patched body: JSON as it
// is, a form view written back into the form body.
func (b stageBody) replace(c *gin.Context, patched []byte) error {
	if b.form != nil {
		var err error
		if patched, err = b.form.rebuild(patched); err != nil {
			return err
		}
	}
	return replaceStoredBody(c, patched)
}

// storeBodyError is the error of a patched body that could not be stored:
// 413 when the patch made it larger than the request body limit, as for a
// client body over it.
func storeBodyError(err error) *types.NewAPIError {
	if errors.Is(err, common.ErrRequestBodyTooLarge) {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusRequestEntityTooLarge, types.ErrOptionWithSkipRetry())
	}
	return types.NewError(err, types.ErrorCodeReadRequestBodyFailed, types.ErrOptionWithSkipRetry())
}

func replaceStoredBody(c *gin.Context, body []byte) error {
	maxMB := constant.MaxRequestBodyMB
	if maxMB <= 0 {
		maxMB = 128
	}
	if int64(len(body)) > int64(maxMB)<<20 {
		return common.ErrRequestBodyTooLarge
	}
	stored, err := common.CreateBodyStorage(body)
	if err != nil {
		return err
	}
	if previous, ok := c.Get(common.KeyBodyStorage); ok {
		if storage, ok := previous.(common.BodyStorage); ok {
			_ = storage.Close()
		}
	}
	c.Set(common.KeyBodyStorage, stored)
	c.Set(common.KeyRequestBody, nil)
	c.Request.Body = io.NopCloser(stored)
	c.Request.ContentLength = int64(len(body))
	c.Request.MultipartForm = nil
	return nil
}

// Request runs the request stage of a channel attempt on the client request,
// after model mapping. modifierEffort is the effort an @ modifier set, ""
// if none. It returns the reasoning.set to apply the way an @effort modifier
// applies, or nil when there is none or the effort the client or a modifier
// set stands.
func Request(c *gin.Context, info *relaycommon.RelayInfo, modifierEffort string) (*requestpatch.Effect, *types.NewAPIError) {
	plan := planOf(c)
	if plan == nil {
		return nil, nil
	}
	call := attemptCall(c, info)
	if len(plan.scope(StageRequest, call.Group, call.Model, call.Bound)) == 0 {
		return nil, nil
	}
	body, err := common.Marshal(info.Request)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeJsonMarshalFailed, types.ErrOptionWithSkipRetry())
	}
	current := modifierEffort
	if current == "" {
		current, _ = relaycommon.ReasoningEffortFromJSON(info.RelayFormat, body)
	}
	summary := summarize(body)
	summary.ReasoningEffort = current
	call.Stage, call.Format, call.Body, call.Summary, call.Effort = StageRequest, string(info.RelayFormat), body, &summary, current
	outcome := plan.Run(c.Request.Context(), call)
	info.RequestPluginSteps = append(info.RequestPluginSteps, auditSteps(outcome)...)
	info.RequestPluginRecord = append(info.RequestPluginRecord, outcome.Record...)
	if apiErr := settle(c, outcome); apiErr != nil {
		return nil, apiErr
	}
	return outcome.Reasoning, nil
}

// attemptStages run on the upstream body of each channel attempt: the
// ingress hooks of the attempt's instances that did not run at the request's
// ingress, then outbound, then egress.
var attemptStages = []struct {
	stage string
	late  bool
}{{StageIngress, true}, {StageOutbound, false}, {StageEgress, false}}

// Outbound runs the late ingress hooks and the outbound stage on the
// upstream JSON body of a channel attempt, before the channel param
// override, which has the last word. It returns the body for the override;
// the header.patch effects wait on info for ApplyHeaderOverride.
func Outbound(c *gin.Context, info *relaycommon.RelayInfo, body []byte) ([]byte, *types.NewAPIError) {
	plan := planOf(c)
	if plan == nil {
		return body, nil
	}
	call := attemptCall(c, info)
	call.Body = body
	// Egress runs on the body the param override leaves.
	for _, attempt := range attemptStages[:2] {
		call.Stage, call.Late = attempt.stage, attempt.late
		outcome := plan.Run(c.Request.Context(), call)
		info.RequestPluginSteps = append(info.RequestPluginSteps, auditSteps(outcome)...)
		info.RequestPluginRecord = append(info.RequestPluginRecord, outcome.Record...)
		if apiErr := settle(c, outcome); apiErr != nil {
			return nil, apiErr
		}
		call.Body, call.Headers = outcome.Body, outcome.Headers
	}
	info.RequestPluginHeaders = call.Headers
	return call.Body, nil
}

// Egress runs the egress stage on the final upstream JSON body of a channel
// attempt, after the channel param override. It changes nothing; an
// instance can only stop the request.
func Egress(c *gin.Context, info *relaycommon.RelayInfo, body []byte) *types.NewAPIError {
	plan := planOf(c)
	if plan == nil {
		return nil
	}
	call := attemptCall(c, info)
	call.Stage, call.Body, call.Headers = StageEgress, body, info.RequestPluginHeaders
	outcome := plan.Run(c.Request.Context(), call)
	info.RequestPluginSteps = append(info.RequestPluginSteps, auditSteps(outcome)...)
	info.RequestPluginRecord = append(info.RequestPluginRecord, outcome.Record...)
	return settle(c, outcome)
}

// PassThrough runs the attempt stages of a channel attempt whose upstream
// body no effect can change: the stored client body of a pass-through
// channel, or a body that is not JSON (storage nil). Each late ingress and
// outbound instance in scope is recorded as unchecked and does not run;
// egress checks the stored body when it is JSON.
func PassThrough(c *gin.Context, info *relaycommon.RelayInfo, storage common.BodyStorage) *types.NewAPIError {
	plan := planOf(c)
	if plan == nil {
		return nil
	}
	call := attemptCall(c, info)
	for _, attempt := range attemptStages {
		call.Stage, call.Late = attempt.stage, attempt.late
		if attempt.stage == StageEgress && storage != nil && jsonRequest(c) && len(plan.scope(StageEgress, call.Group, call.Model, call.Bound)) > 0 {
			if body, err := storage.Bytes(); err == nil && gjson.ValidBytes(body) {
				call.Body = body
			}
		}
		outcome := plan.Run(c.Request.Context(), call)
		info.RequestPluginSteps = append(info.RequestPluginSteps, auditSteps(outcome)...)
		info.RequestPluginRecord = append(info.RequestPluginRecord, outcome.Record...)
		if apiErr := settle(c, outcome); apiErr != nil {
			return apiErr
		}
	}
	return nil
}

func attemptCall(c *gin.Context, info *relaycommon.RelayInfo) Call {
	call := Call{
		Format:  string(info.GetFinalRequestRelayFormat()),
		Path:    c.Request.URL.Path,
		Model:   info.OriginModelName,
		Group:   common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		Attempt: info.RetryIndex,
	}
	if plan := planOf(c); plan != nil && plan.submission != nil {
		call.Format = plan.submission.format
	}
	call.User, call.Token = requester(c)
	if info.ChannelMeta != nil {
		call.UpstreamModel = info.UpstreamModelName
		call.Channel = &jsplugin.TransformChannel{ID: info.ChannelId, Type: info.ChannelType}
		call.Bound = info.ChannelSetting.RequestPlugins
	}
	return call
}

// requester is the user and the token of a request, as the report record
// has them; the token is nil when the request has none.
func requester(c *gin.Context) (jsplugin.TransformUser, *jsplugin.TransformToken) {
	user := jsplugin.TransformUser{ID: c.GetInt("id"), Username: c.GetString("username")}
	if id := c.GetInt("token_id"); id > 0 {
		return user, &jsplugin.TransformToken{ID: id, Name: c.GetString("token_name")}
	}
	return user, nil
}

func jsonRequest(c *gin.Context) bool {
	contentType := strings.ToLower(c.ContentType())
	return contentType == "application/json" || strings.HasSuffix(contentType, "+json")
}

func auditSteps(outcome Outcome) []relaycommon.RequestPluginStep {
	steps := make([]relaycommon.RequestPluginStep, 0, len(outcome.Steps))
	for _, step := range outcome.Steps {
		steps = append(steps, step.RequestPluginStep)
	}
	return steps
}

// settle logs the failed steps and turns a rejection or a failure that stops
// the request into the client error. Neither the log nor a failure carries plugin text;
// a rejection shows the plugin's message.
func settle(c *gin.Context, outcome Outcome) *types.NewAPIError {
	for _, step := range outcome.Steps {
		if step.Error != "" {
			logger.LogWarn(c, common.LogText("request plugin instance %s (%s) failed at %s: %s", step.Instance, step.Plugin, step.Stage, step.Error))
		}
	}
	if rejected := outcome.Rejected; rejected != nil {
		service.RequestPolicy(c).AddEvent(service.PolicyEvent{ErrorCode: string(types.ErrorCodeRequestRejected), ErrorSource: "local", Decision: service.PolicyDecision{Action: "stop", Reason: "local_rejection", Source: "plugin"}, Health: "unchanged"})
		message := rejected.Message
		if message == "" {
			message = i18n.T(c, i18n.MsgRelayRequestRejected)
		}
		return types.NewErrorWithStatusCode(fmt.Errorf("%s (code: %s)", message, rejected.Code), types.ErrorCodeRequestRejected, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if outcome.Failed != nil {
		return types.NewErrorWithStatusCode(errors.New(i18n.T(c, i18n.MsgRelayRequestPluginFailed)), types.ErrorCodeRequestPluginFailed, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
	}
	return nil
}

// summarize computes the request stage summary of a client request body in
// any chat format: OpenAI messages, Responses input, Claude messages and
// system, Gemini contents and system instruction.
func summarize(body []byte) jsplugin.TransformSummary {
	var summary jsplugin.TransformSummary
	request := gjson.ParseBytes(body)
	messages, content := request.Get("messages"), "content"
	if !messages.Exists() {
		if contents := request.Get("contents"); contents.Exists() {
			messages, content = contents, "parts"
		} else {
			messages = request.Get("input")
		}
	}
	if messages.Type == gjson.String {
		length, _ := contentText(messages)
		summary.MessageCount, summary.LastUserTextLength, summary.TotalTextLength = 1, length, length
	}
	if messages.IsArray() {
		messages.ForEach(func(_, message gjson.Result) bool {
			summary.MessageCount++
			length, image := contentText(message.Get(content))
			summary.TotalTextLength += length
			summary.HasImages = summary.HasImages || image
			if message.Get("role").Str == "user" {
				summary.LastUserTextLength = length
			}
			return true
		})
	}
	for _, path := range []string{"system", "instructions", "systemInstruction.parts", "system_instruction.parts"} {
		length, _ := contentText(request.Get(path))
		summary.TotalTextLength += length
	}
	request.Get("tools").ForEach(func(_, tool gjson.Result) bool {
		declarations := tool.Get("functionDeclarations")
		if !declarations.Exists() {
			declarations = tool.Get("function_declarations")
		}
		if declarations.IsArray() {
			summary.ToolCount += len(declarations.Array())
		} else {
			summary.ToolCount++
		}
		return true
	})
	return summary
}

// contentText measures one message content, a string or an array of parts:
// its text length in characters and whether a part is an image.
func contentText(content gjson.Result) (int, bool) {
	if content.Type == gjson.String {
		return utf8.RuneCountInString(content.Str), false
	}
	length, image := 0, false
	content.ForEach(func(_, part gjson.Result) bool {
		switch part.Get("type").Str {
		case "image_url", "input_image", "image":
			image = true
		}
		if text := part.Get("text"); text.Type == gjson.String {
			length += utf8.RuneCountInString(text.Str)
		}
		for _, mimePath := range []string{"inlineData.mimeType", "inline_data.mime_type", "fileData.mimeType", "file_data.mime_type"} {
			if strings.HasPrefix(part.Get(mimePath).Str, "image/") {
				image = true
			}
		}
		return true
	})
	return length, image
}

// DryRunInput is a dry run: Body is a request already in Format, run through
// every stage with the saved instances and the bindings of a channel.
type DryRunInput struct {
	Format  string
	Path    string
	Model   string
	Group   string
	Channel *jsplugin.TransformChannel
	Bound   []string
	Body    []byte
	// ModifierEffort is the reasoning effort the modifiers of Model set, ""
	// if none.
	ModifierEffort string
	// User runs the dry run; a dry run has no token.
	User jsplugin.TransformUser
	// Reply, when set, is an answer text the reply checks run on, as on a
	// non-stream answer in Format.
	Reply *string
	// Instance, when set, is the only instance that runs, on every request,
	// instead of the saved ones: an editor tries its settings before saving.
	Instance *request_plugin_setting.Instance
}

// DryRunReply is the answer text after the reply checks of a dry run, and
// the plugin's stop if one stopped it.
type DryRunReply struct {
	Text    string     `json:"text"`
	Stopped *Rejection `json:"stopped"`
}

type DryRunHeaders struct {
	Set    map[string]string `json:"set"`
	Remove []string          `json:"remove"`
}

// DryRunResult is what a dry run did. Steps and Failed show the error text,
// which a relay request never logs; Record is what a user's log shows.
type DryRunResult struct {
	Rejected        *Rejection                        `json:"rejected"`
	Failed          *Failure                          `json:"failed"`
	Steps           []Step                            `json:"steps"`
	Record          []relaycommon.RequestPluginRecord `json:"record"`
	Body            json.RawMessage                   `json:"body"`
	Headers         DryRunHeaders                     `json:"headers"`
	ReasoningEffort string                            `json:"reasoning_effort,omitempty"`
	// ReasoningEffortBefore is the effort before any plugin ran: a modifier's,
	// else the request body's, "" when neither sets one.
	ReasoningEffortBefore string `json:"reasoning_effort_before"`
	// Reply is a DryRunReply when the input has a reply, null when the
	// request stopped before it.
	Reply json.RawMessage `json:"reply,omitempty"`
}

// DryRun runs the four stages on input without sending or charging
// anything. It stops at a rejection or a failure that stops the request.
func DryRun(ctx context.Context, input DryRunInput) DryRunResult {
	result := DryRunResult{Steps: []Step{}, Record: []relaycommon.RequestPluginRecord{}, Body: input.Body, Headers: DryRunHeaders{Set: map[string]string{}, Remove: []string{}}}
	result.ReasoningEffortBefore = input.ModifierEffort
	if result.ReasoningEffortBefore == "" {
		result.ReasoningEffortBefore, _ = relaycommon.ReasoningEffortFromJSON(types.RelayFormat(input.Format), input.Body)
	}
	if input.Reply != nil {
		result.Reply, _ = common.Marshal(DryRunReply{Text: *input.Reply})
	}
	plan := NewPlan()
	if input.Instance != nil {
		instance := *input.Instance
		// An unsaved instance runs on every model.
		instance.Enabled, instance.Global, instance.Models = true, true, nil
		plan = newPlanOf([]request_plugin_setting.Instance{instance})
	}
	if plan == nil {
		return result
	}
	call := Call{Format: input.Format, Path: input.Path, Model: input.Model, UpstreamModel: input.Model, Group: input.Group, User: input.User, Body: input.Body}
	stages := append([]struct {
		stage string
		late  bool
	}{{StageIngress, false}, {StageRequest, false}}, attemptStages...)
	for _, run := range stages {
		call.Stage, call.Late, call.Summary, call.Effort = run.stage, run.late, nil, ""
		if run.stage != StageIngress || run.late {
			call.Channel, call.Bound = input.Channel, input.Bound
		}
		if run.stage == StageRequest {
			call.Effort = input.ModifierEffort
			if call.Effort == "" {
				call.Effort, _ = relaycommon.ReasoningEffortFromJSON(types.RelayFormat(input.Format), call.Body)
			}
			summary := summarize(call.Body)
			summary.ReasoningEffort = call.Effort
			call.Summary = &summary
		}
		outcome := plan.Run(ctx, call)
		result.Steps = append(result.Steps, outcome.Steps...)
		result.Record = append(result.Record, outcome.Record...)
		if outcome.Rejected != nil || outcome.Failed != nil {
			result.Rejected, result.Failed = outcome.Rejected, outcome.Failed
			break
		}
		if outcome.Reasoning != nil {
			result.ReasoningEffort = outcome.Reasoning.Effort
		}
		call.Body, call.Headers = outcome.Body, outcome.Headers
	}
	result.Body = call.Body
	if input.Reply != nil {
		result.Reply = []byte("null")
		if result.Rejected == nil && result.Failed == nil {
			call.Channel, call.Bound = input.Channel, input.Bound
			result.Reply, _ = common.Marshal(dryRunReply(ctx, plan, call, *input.Reply, &result))
		}
	}
	result.Record = relaycommon.CapRequestPluginRecord(result.Record)
	for _, effect := range call.Headers {
		for _, name := range effect.Remove {
			name = http.CanonicalHeaderKey(strings.TrimSpace(name))
			delete(result.Headers.Set, name)
			if !slices.Contains(result.Headers.Remove, name) {
				result.Headers.Remove = append(result.Headers.Remove, name)
			}
		}
		for name, value := range effect.Set {
			name = http.CanonicalHeaderKey(strings.TrimSpace(name))
			result.Headers.Set[name] = value
			result.Headers.Remove = slices.DeleteFunc(result.Headers.Remove, func(removed string) bool { return removed == name })
		}
	}
	return result
}

// dryRunReply runs the reply checks of a dry run on text as the non-stream
// answer of a relay request, and adds their steps and record to result. A
// failure that stops the answer sets result.Failed; the text is then as the
// earlier instances left it.
func dryRunReply(ctx context.Context, plan *Plan, call Call, text string, result *DryRunResult) DryRunReply {
	reply := DryRunReply{Text: text}
	format := types.RelayFormat(call.Format)
	instances := plan.scope(StageReply, call.Group, call.Model, call.Bound)
	answer := replyAnswer(format, call.UpstreamModel, text)
	if len(instances) == 0 || answer == nil {
		return reply
	}
	check := newReplyCheck(ctx, plan, instances)
	check.call = call
	check.whole(format, answer)
	result.Steps = append(result.Steps, check.steps()...)
	result.Record = append(result.Record, check.record()...)
	switch stop := check.stop; {
	case stop == nil:
		if output := check.outputs[0]; output != nil {
			reply.Text = output.released.String()
		}
	case stop.failed:
		reply.Text = stop.text[0]
		result.Failed = &Failure{Instance: stop.instance, Class: stop.class, Detail: stop.detail}
	default:
		reply.Text = stop.text[0]
		reply.Stopped = &Rejection{Instance: stop.instance, Code: stop.code, Message: stop.message}
	}
	return reply
}

// replyAnswer is a non-stream answer in format whose only output is text;
// nil for a format reply checks do not cover.
func replyAnswer(format types.RelayFormat, model, text string) []byte {
	var answer gin.H
	switch format {
	case types.RelayFormatOpenAI:
		answer = gin.H{"id": "chatcmpl-dry-run", "object": "chat.completion", "created": 0, "model": model,
			"choices": []gin.H{{"index": 0, "message": gin.H{"role": "assistant", "content": text}, "finish_reason": "stop"}}}
	case types.RelayFormatOpenAIResponses:
		answer = gin.H{"id": "resp_dry_run", "object": "response", "status": "completed", "model": model,
			"output": []gin.H{{"type": "message", "id": "msg_dry_run", "status": "completed", "role": "assistant",
				"content": []gin.H{{"type": "output_text", "text": text, "annotations": []any{}}}}}}
	case types.RelayFormatClaude:
		answer = gin.H{"id": "msg_dry_run", "type": "message", "role": "assistant", "model": model,
			"content": []gin.H{{"type": "text", "text": text}}, "stop_reason": "end_turn"}
	case types.RelayFormatGemini:
		answer = gin.H{"candidates": []gin.H{{"index": 0, "content": gin.H{"role": "model", "parts": []gin.H{{"text": text}}}, "finishReason": "STOP"}}, "modelVersion": model}
	default:
		return nil
	}
	encoded, err := common.Marshal(answer)
	if err != nil {
		return nil
	}
	return encoded
}
