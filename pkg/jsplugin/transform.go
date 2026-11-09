package jsplugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"sync/atomic"
	"unicode/utf8"

	"github.com/Calcium-Ion/moejs"
)

// TransformStages are the stage hooks of the request processing part, in the
// order a request meets them.
var TransformStages = []string{"ingress", "request", "outbound", "egress"}

// ReportHook is the export that receives a finished request, off the request
// path. It gives a plugin a request processing part, as a stage hook does,
// but it is not a stage: it runs once per request and has no effects.
const ReportHook = "report"

// ReplyHook is the export that reads the model's answer as it reaches the
// client and may stop it or mask parts of it, never write into it. It gives
// a plugin a request processing part, as a stage hook does.
const ReplyHook = "reply"

// Limits on a stage hook result, part of the published plugin contract
// (docs/plugin-api/v1.md).
const (
	maxTransformFindings      = 64
	maxTransformTextRunes     = 256
	maxTransformNoticeRunes   = 200
	maxTransformNoticeLocales = 8
)

// Limits on a reply hook result, part of the published plugin contract.
const (
	maxReplyHold  = 8192
	maxReplyMasks = 1024
)

var transformCodePattern = regexp.MustCompile(`^[a-z0-9_.-]{1,64}$`)

// HasTransformPart reports whether the plugin exports a stage hook.
func (m Meta) HasTransformPart() bool {
	return len(m.transformHooks) > 0
}

// TransformHooks returns the stage hooks the plugin exports, in
// TransformStages order, then ReplyHook and ReportHook when it exports them;
// nil when it has no request processing part.
func (m Meta) TransformHooks() []string {
	return slices.Clone(m.transformHooks)
}

// TransformHooks returns the stage hooks the plugin exports, in
// TransformStages order, then ReplyHook and ReportHook when it exports them;
// nil when it has no request processing part.
func (p *LoadedPlugin) TransformHooks() []string {
	return p.Meta.TransformHooks()
}

type TransformChannel struct {
	ID   int `json:"id"`
	Type int `json:"type"`
}

type TransformInstance struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// TransformUser is the user a request comes from.
type TransformUser struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
}

// TransformToken is the API token a request comes with.
type TransformToken struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// TransformContext is the ctx a stage hook receives. Config is the instance
// config with the schema defaults applied (ValidateConfig).
type TransformContext struct {
	Stage         string            `json:"stage"`
	Format        string            `json:"format"`
	Path          string            `json:"path"`
	Model         string            `json:"model"`
	UpstreamModel string            `json:"upstreamModel,omitempty"`
	Group         string            `json:"group"`
	Channel       *TransformChannel `json:"channel,omitempty"`
	Attempt       int               `json:"attempt"`
	User          TransformUser     `json:"user"`
	// Token is nil when the request has none.
	Token    *TransformToken   `json:"token,omitempty"`
	Instance TransformInstance `json:"instance"`
	Config   json.RawMessage   `json:"config"`
	// Media gives the hook's utils the request's attachments; nil when the
	// stage offers none.
	Media MediaSource `json:"-"`
	// keywordFields are the plugin's keywords format properties.
	keywordFields []string
}

type TransformMedia struct {
	Index    int    `json:"index"`
	Path     string `json:"path"`
	MimeType string `json:"mimeType"`
	Bytes    int    `json:"bytes"`
	Width    int    `json:"width,omitempty"`
	Height   int    `json:"height,omitempty"`
}

type TransformSummary struct {
	MessageCount       int    `json:"messageCount"`
	ToolCount          int    `json:"toolCount"`
	LastUserTextLength int    `json:"lastUserTextLength"`
	TotalTextLength    int    `json:"totalTextLength"`
	HasImages          bool   `json:"hasImages"`
	ReasoningEffort    string `json:"reasoningEffort"`
}

// TransformRequest is the req a stage hook receives.
type TransformRequest struct {
	Body    json.RawMessage   `json:"body"`
	Headers map[string]string `json:"headers,omitempty"`
	Media   []TransformMedia  `json:"media,omitempty"`
	Summary *TransformSummary `json:"summary,omitempty"`
	// Form marks a Body that holds the text fields of a multipart form body.
	Form bool `json:"form,omitempty"`
}

type TransformFinding struct {
	Rule     string `json:"rule"`
	Category string `json:"category,omitempty"`
	Path     string `json:"path,omitempty"`
	Count    int    `json:"count"`
}

// TransformResult is a stage hook result whose shape CallTransform checked.
type TransformResult struct {
	Action   string          // "continue" or "reject"
	Effects  json.RawMessage // raw JSON array, nil when absent; the caller decodes per stage
	Findings []TransformFinding
	Code     string
	Message  string
	RuleID   string
	// Notice is the plugin's plain explanation of what it did, which the host
	// shows users in the log; nil when absent.
	Notice LocalizedText
}

// Classes of a TransformError.
const (
	TransformErrorThrow    = "throw"
	TransformErrorTimeout  = "timeout"
	TransformErrorMemory   = "memory"
	TransformErrorCanceled = "canceled"
	TransformErrorResult   = "invalid_result"
	TransformErrorFailed   = "error"
)

// TransformError is a failed CallTransform. Its text names the plugin, the
// hook, the class and, for an invalid result, the member at fault, never a
// value: stage hooks read request bodies, and errors reach logs.
type TransformError struct {
	Plugin string
	Hook   string
	Class  string
	// Thrown is the message a throwing hook threw. It may quote the request,
	// so it is not part of Error; only an administrator's dry run shows it.
	Thrown string
	reason string
	cause  error
}

func (e *TransformError) Error() string {
	switch e.Class {
	case TransformErrorThrow:
		return fmt.Sprintf("plugin %s hook %s threw an error", e.Plugin, e.Hook)
	case TransformErrorTimeout:
		return fmt.Sprintf("plugin %s hook %s timed out", e.Plugin, e.Hook)
	case TransformErrorMemory:
		return fmt.Sprintf("plugin %s hook %s ran past its memory limit", e.Plugin, e.Hook)
	case TransformErrorCanceled:
		return fmt.Sprintf("plugin %s hook %s was canceled", e.Plugin, e.Hook)
	case TransformErrorResult:
		return fmt.Sprintf("plugin %s hook %s returned an invalid result: %s", e.Plugin, e.Hook, e.reason)
	}
	if e.reason != "" {
		return fmt.Sprintf("plugin %s hook %s failed: %s", e.Plugin, e.Hook, e.reason)
	}
	return fmt.Sprintf("plugin %s hook %s failed", e.Plugin, e.Hook)
}

func (e *TransformError) Unwrap() error {
	return e.cause
}

type transformContextKey struct{}

// CallTransform runs one stage hook, tctx.Stage, and validates the result
// shape. tctx.Config, req.Body and req.Headers are passed to JavaScript
// without copies, so the caller must not change them afterwards. Every error
// is a *TransformError. utils.fetch uses the Fetcher of ctx in ingress and
// egress; request and outbound have no network.
func (p *LoadedPlugin) CallTransform(ctx context.Context, tctx TransformContext, req TransformRequest) (TransformResult, error) {
	failure := &TransformError{Plugin: p.Meta.Key, Hook: tctx.Stage, Class: TransformErrorFailed}
	if !slices.Contains(TransformStages, tctx.Stage) || !slices.Contains(p.Meta.transformHooks, tctx.Stage) {
		failure.reason = "the plugin does not export it"
		return TransformResult{}, failure
	}
	request := map[string]any{"body": RawJSON(req.Body)}
	if req.Headers != nil {
		request["headers"] = req.Headers
	}
	if req.Form {
		request["form"] = true
	}
	if len(req.Media) > 0 {
		media := make([]any, 0, len(req.Media))
		for _, item := range req.Media {
			entry := map[string]any{"index": item.Index, "path": item.Path, "mimeType": item.MimeType, "bytes": item.Bytes}
			if item.Width > 0 {
				entry["width"] = item.Width
			}
			if item.Height > 0 {
				entry["height"] = item.Height
			}
			media = append(media, entry)
		}
		request["media"] = media
	}
	if summary := req.Summary; summary != nil {
		request["summary"] = map[string]any{
			"messageCount":       summary.MessageCount,
			"toolCount":          summary.ToolCount,
			"lastUserTextLength": summary.LastUserTextLength,
			"totalTextLength":    summary.TotalTextLength,
			"hasImages":          summary.HasImages,
			"reasoningEffort":    summary.ReasoningEffort,
		}
	}
	if tctx.Stage != "ingress" && tctx.Stage != "egress" {
		ctx = WithFetcher(ctx, nil)
	}
	// utils.paramOverride reads the stage from tctx.
	tctx.keywordFields = p.Meta.ConfigSchema.KeywordFields()
	callCtx := context.WithValue(ctx, transformContextKey{}, &tctx)
	result, effects, err := p.Engine.CallPathWithMemberJSON(callCtx, 0, "effects", tctx.Stage, nil, p.transformHookContext(&tctx), request)
	if err != nil {
		failure.classify(err)
		return TransformResult{}, failure
	}
	decoded, reason := decodeTransformResult(result, effects)
	if reason != "" {
		failure.Class, failure.reason = TransformErrorResult, reason
		return TransformResult{}, failure
	}
	return decoded, nil
}

// CallReport runs the report hook with tctx.Stage "report" on record, the JSON
// of a finished request. The return value is ignored. utils.fetch uses the
// Fetcher of ctx. Every error is a *TransformError.
func (p *LoadedPlugin) CallReport(ctx context.Context, tctx TransformContext, record json.RawMessage) error {
	failure := &TransformError{Plugin: p.Meta.Key, Hook: ReportHook, Class: TransformErrorFailed}
	if !slices.Contains(p.Meta.transformHooks, ReportHook) {
		failure.reason = "the plugin does not export it"
		return failure
	}
	tctx.Stage = ReportHook
	tctx.keywordFields = p.Meta.ConfigSchema.KeywordFields()
	callCtx := context.WithValue(ctx, transformContextKey{}, &tctx)
	if _, _, err := p.Engine.call(callCtx, callOptions{discardResult: true}, ReportHook, nil, p.transformHookContext(&tctx), RawJSON(record)); err != nil {
		failure.classify(err)
		return failure
	}
	return nil
}

// transformHookContext is the ctx argument of a stage, reply or report hook.
func (p *LoadedPlugin) transformHookContext(tctx *TransformContext) map[string]any {
	config := p.hookConfig(tctx)
	if len(config) == 0 {
		config = json.RawMessage("{}")
	}
	hookCtx := map[string]any{
		"stage":    tctx.Stage,
		"format":   tctx.Format,
		"path":     tctx.Path,
		"model":    tctx.Model,
		"group":    tctx.Group,
		"attempt":  tctx.Attempt,
		"user":     map[string]any{"id": tctx.User.ID, "username": tctx.User.Username},
		"instance": map[string]any{"id": tctx.Instance.ID, "name": tctx.Instance.Name},
		"config":   RawJSON(config),
	}
	if tctx.Token != nil {
		hookCtx["token"] = map[string]any{"id": tctx.Token.ID, "name": tctx.Token.Name}
	}
	if tctx.UpstreamModel != "" {
		hookCtx["upstreamModel"] = tctx.UpstreamModel
	}
	if tctx.Channel != nil {
		hookCtx["channel"] = map[string]any{"id": tctx.Channel.ID, "type": tctx.Channel.Type}
	}
	return hookCtx
}

// classify sets the class of a failed hook call from its error.
func (e *TransformError) classify(err error) {
	e.cause = err
	var hookErr *HookError
	switch {
	case errors.As(err, &hookErr):
		e.Class, e.Thrown = TransformErrorThrow, hookErr.Message
	case errors.Is(err, moejs.ErrMemoryLimit):
		e.Class = TransformErrorMemory
	case errors.Is(err, errCallTimeout), errors.Is(err, ErrCallAdmissionTimeout), errors.Is(err, context.DeadlineExceeded):
		e.Class = TransformErrorTimeout
	case errors.Is(err, context.Canceled):
		e.Class = TransformErrorCanceled
	}
}

// decodeTransformResult checks a stage hook result: {action: "continue",
// effects?, findings?} or {action: "reject", code, message?, ruleId?,
// findings?}. The reason it returns names the member at fault, never its
// value.
func decodeTransformResult(result any, effects json.RawMessage) (TransformResult, string) {
	object, ok := result.(map[string]any)
	if !ok {
		return TransformResult{}, "the result must be an object"
	}
	action, _ := object["action"].(string)
	decoded := TransformResult{Action: action}
	var reason string
	if decoded.Notice, decoded.Findings, reason = decodeNoticeAndFindings(object); reason != "" {
		return TransformResult{}, reason
	}
	switch action {
	case "continue":
		if err := allowMembers(object, "", "action", "effects", "findings", "notice"); err != nil {
			return TransformResult{}, err.Error()
		}
		if object["effects"] != nil {
			if _, isArray := object["effects"].([]any); !isArray {
				return TransformResult{}, "effects must be an array"
			}
			decoded.Effects = effects
		}
	case "reject":
		if err := allowMembers(object, "", "action", "code", "message", "ruleId", "findings", "notice"); err != nil {
			return TransformResult{}, err.Error()
		}
		code, err := optionalString(object, "code", "")
		if err != nil || !transformCodePattern.MatchString(code) {
			return TransformResult{}, "code must match " + transformCodePattern.String()
		}
		decoded.Code = code
		for _, member := range []struct {
			name   string
			target *string
		}{{"message", &decoded.Message}, {"ruleId", &decoded.RuleID}} {
			text, err := optionalString(object, member.name, "")
			if err != nil || utf8.RuneCountInString(text) > maxTransformTextRunes {
				return TransformResult{}, fmt.Sprintf("%s must be a string of at most %d characters", member.name, maxTransformTextRunes)
			}
			*member.target = text
		}
	default:
		return TransformResult{}, `action must be "continue" or "reject"`
	}
	return decoded, ""
}

// decodeNoticeAndFindings reads the notice and findings members a stage or
// reply hook result shares.
func decodeNoticeAndFindings(object map[string]any) (LocalizedText, []TransformFinding, string) {
	var notice LocalizedText
	var findings []TransformFinding
	if object["notice"] != nil {
		var err error
		notice, err = decodeLocalizedText(object["notice"], "notice", maxTransformNoticeRunes)
		if err != nil || len(notice) > maxTransformNoticeLocales {
			return nil, nil, fmt.Sprintf(`notice must be a string or a locale object with "en", at most %d locales of at most %d characters`, maxTransformNoticeLocales, maxTransformNoticeRunes)
		}
	}
	if object["findings"] == nil {
		return notice, nil, ""
	}
	items, isArray := object["findings"].([]any)
	if !isArray {
		return nil, nil, "findings must be an array"
	}
	if len(items) > maxTransformFindings {
		return nil, nil, fmt.Sprintf("findings must not exceed %d entries", maxTransformFindings)
	}
	for index, item := range items {
		subject := fmt.Sprintf("findings[%d]", index)
		finding, isObject := item.(map[string]any)
		if !isObject {
			return nil, nil, subject + " must be an object"
		}
		if err := allowMembers(finding, subject, "rule", "category", "path", "count"); err != nil {
			return nil, nil, err.Error()
		}
		var entry TransformFinding
		for _, member := range []struct {
			name     string
			target   *string
			required bool
		}{{"rule", &entry.Rule, true}, {"category", &entry.Category, false}, {"path", &entry.Path, false}} {
			text, err := optionalString(finding, member.name, subject)
			if err != nil || (member.required && text == "") || utf8.RuneCountInString(text) > maxTransformTextRunes {
				return nil, nil, fmt.Sprintf("%s.%s must be a string of at most %d characters", subject, member.name, maxTransformTextRunes)
			}
			*member.target = text
		}
		count, isInteger := integerValue(finding["count"])
		if !isInteger || count < 0 {
			return nil, nil, subject + ".count must be a non-negative integer"
		}
		entry.Count = int(count)
		findings = append(findings, entry)
	}
	return notice, findings, ""
}

// ReplyOutput is one answer a reply hook reads: Text is what this instance
// has not passed on yet, Offset the UTF-16 code units of the answer it
// passed on before Text, and Final that no more text follows.
type ReplyOutput struct {
	Index  int
	Text   string
	Offset int
	Final  bool
}

// ReplyMask is a span of one output's Text to replace, in UTF-16 code units.
type ReplyMask struct {
	Index    int
	Start    int
	End      int
	Category string
}

// ReplyResult is a reply hook result whose shape CallReply checked.
type ReplyResult struct {
	Action   string // "continue", "pass" or "stop"
	Masks    []ReplyMask
	Hold     int
	Findings []TransformFinding
	Notice   LocalizedText
	Code     string
	Message  string
}

// CallReply runs the reply hook with tctx.Stage "reply" on outputs and checks
// the result: each mask names an output of the call and lies within its
// text. utils.fetch uses the Fetcher of ctx. Every error is a
// *TransformError.
func (p *LoadedPlugin) CallReply(ctx context.Context, tctx TransformContext, stream bool, outputs []ReplyOutput) (ReplyResult, error) {
	failure := &TransformError{Plugin: p.Meta.Key, Hook: ReplyHook, Class: TransformErrorFailed}
	if !slices.Contains(p.Meta.transformHooks, ReplyHook) {
		failure.reason = "the plugin does not export it"
		return ReplyResult{}, failure
	}
	tctx.Stage = ReplyHook
	items := make([]any, 0, len(outputs))
	lengths := make(map[int]int, len(outputs))
	for _, output := range outputs {
		items = append(items, map[string]any{"index": output.Index, "text": output.Text, "offset": output.Offset, "final": output.Final})
		lengths[output.Index] = UTF16Len(output.Text)
	}
	tctx.keywordFields = p.Meta.ConfigSchema.KeywordFields()
	callCtx := context.WithValue(ctx, transformContextKey{}, &tctx)
	result, _, err := p.Engine.call(callCtx, callOptions{}, ReplyHook, nil, p.transformHookContext(&tctx), map[string]any{"stream": stream, "outputs": items})
	if err != nil {
		failure.classify(err)
		return ReplyResult{}, failure
	}
	decoded, reason := decodeReplyResult(result, lengths)
	if reason != "" {
		failure.Class, failure.reason = TransformErrorResult, reason
		return ReplyResult{}, failure
	}
	return decoded, nil
}

// decodeReplyResult checks a reply hook result: {action: "continue", mask?,
// hold?, findings?, notice?} or {action: "stop", code, message?, findings?,
// notice?}. lengths are the UTF-16 lengths of the texts by output index. The
// reason it returns names the member at fault, never its value.
func decodeReplyResult(result any, lengths map[int]int) (ReplyResult, string) {
	object, ok := result.(map[string]any)
	if !ok {
		return ReplyResult{}, "the result must be an object"
	}
	action, _ := object["action"].(string)
	decoded := ReplyResult{Action: action}
	var reason string
	if decoded.Notice, decoded.Findings, reason = decodeNoticeAndFindings(object); reason != "" {
		return ReplyResult{}, reason
	}
	switch action {
	case "continue":
		if err := allowMembers(object, "", "action", "mask", "hold", "findings", "notice"); err != nil {
			return ReplyResult{}, err.Error()
		}
		if object["hold"] != nil {
			hold, isInteger := integerValue(object["hold"])
			if !isInteger || hold < 0 || hold > maxReplyHold {
				return ReplyResult{}, fmt.Sprintf("hold must be an integer from 0 to %d", maxReplyHold)
			}
			decoded.Hold = int(hold)
		}
		if object["mask"] == nil {
			return decoded, ""
		}
		items, isArray := object["mask"].([]any)
		if !isArray || len(items) > maxReplyMasks {
			return ReplyResult{}, fmt.Sprintf("mask must be an array of at most %d entries", maxReplyMasks)
		}
		for index, item := range items {
			subject := fmt.Sprintf("mask[%d]", index)
			mask, isObject := item.(map[string]any)
			if !isObject {
				return ReplyResult{}, subject + " must be an object"
			}
			if err := allowMembers(mask, subject, "index", "start", "end", "category"); err != nil {
				return ReplyResult{}, err.Error()
			}
			output, isInteger := integerValue(mask["index"])
			length, known := lengths[int(output)]
			if !isInteger || !known {
				return ReplyResult{}, subject + ".index must be the index of an output of the call"
			}
			start, startInteger := integerValue(mask["start"])
			end, endInteger := integerValue(mask["end"])
			if !startInteger || !endInteger || start < 0 || start >= end || end > int64(length) {
				return ReplyResult{}, subject + " must satisfy 0 <= start < end <= text.length"
			}
			category, err := optionalString(mask, "category", subject)
			if err != nil || utf8.RuneCountInString(category) > maxTransformTextRunes {
				return ReplyResult{}, fmt.Sprintf("%s.category must be a string of at most %d characters", subject, maxTransformTextRunes)
			}
			decoded.Masks = append(decoded.Masks, ReplyMask{Index: int(output), Start: int(start), End: int(end), Category: category})
		}
	case "pass":
		if err := allowMembers(object, "", "action"); err != nil {
			return ReplyResult{}, err.Error()
		}
	case "stop":
		if err := allowMembers(object, "", "action", "code", "message", "findings", "notice"); err != nil {
			return ReplyResult{}, err.Error()
		}
		code, err := optionalString(object, "code", "")
		if err != nil || !transformCodePattern.MatchString(code) {
			return ReplyResult{}, "code must match " + transformCodePattern.String()
		}
		decoded.Code = code
		message, err := optionalString(object, "message", "")
		if err != nil || utf8.RuneCountInString(message) > maxTransformTextRunes {
			return ReplyResult{}, fmt.Sprintf("message must be a string of at most %d characters", maxTransformTextRunes)
		}
		decoded.Message = message
	default:
		return ReplyResult{}, `action must be "continue", "pass" or "stop"`
	}
	return decoded, ""
}

// UTF16Len is the length of text in UTF-16 code units, as JavaScript counts
// a string.
func UTF16Len(text string) int {
	length := 0
	for _, r := range text {
		length++
		if r >= 0x10000 {
			length++
		}
	}
	return length
}

// ParamOverrideFunc runs the host parameter override for utils.paramOverride
// with the calling hook's context. result is the JSON text utils.paramOverride
// returns to JS: {body, headers?} or {reject}.
type ParamOverrideFunc func(ctx TransformContext, body json.RawMessage, override json.RawMessage) (result json.RawMessage, err error)

var paramOverrideFunc atomic.Pointer[ParamOverrideFunc]

// SetParamOverrideFunc sets the function utils.paramOverride calls; nil
// removes it.
func SetParamOverrideFunc(fn ParamOverrideFunc) {
	if fn == nil {
		paramOverrideFunc.Store(nil)
		return
	}
	paramOverrideFunc.Store(&fn)
}

// paramOverride is utils.paramOverride(body, override): the host parameter
// override, in an outbound hook only. The Go function bounds its own work.
func (c *runtimeCall) paramOverride(r *moejs.Realm, body, override moejs.Value) (moejs.Value, error) {
	if c.transform == nil || c.transform.Stage != "outbound" || c.hook != "outbound" {
		return moejs.Undefined(), fmt.Errorf("utils.paramOverride is not available in %s", c.hook)
	}
	fn := paramOverrideFunc.Load()
	if fn == nil {
		return moejs.Undefined(), fmt.Errorf("utils.paramOverride is not available on this host")
	}
	texts := make([]json.RawMessage, 0, 2)
	for _, argument := range []struct {
		name  string
		value moejs.Value
	}{{"body", body}, {"override", override}} {
		isArray, err := r.IsArray(argument.value)
		if err != nil {
			return moejs.Undefined(), err
		}
		if !argument.value.IsObject() || isArray {
			return moejs.Undefined(), r.TypeError("utils.paramOverride %s must be an object", argument.name)
		}
		text, err := c.runtime.AppendJSON(nil, argument.value)
		if err != nil {
			return moejs.Undefined(), err
		}
		texts = append(texts, text)
	}
	result, err := (*fn)(*c.transform, texts[0], texts[1])
	if err != nil {
		return moejs.Undefined(), err
	}
	return c.runtime.ParseJSONString(string(result))
}
