// Package requestplugin runs the request processing plugins of a relay
// request: the instances in scope at each stage, their checked effects, the
// failure policy of their plugins and the audit record.
package requestplugin

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"regexp"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"
	"github.com/tidwall/gjson"
)

const (
	StageIngress  = "ingress"
	StageRequest  = "request"
	StageOutbound = "outbound"
	StageEgress   = "egress"
)

// stageEffects are the effect types each stage may return. egress is
// read-only.
var stageEffects = map[string][]string{
	StageIngress:  {requestpatch.EffectJSONPatch, requestpatch.EffectMediaText},
	StageRequest:  {requestpatch.EffectReasoningSet},
	StageOutbound: {requestpatch.EffectJSONPatch, requestpatch.EffectHeaderPatch, requestpatch.EffectMediaReencode, requestpatch.EffectMediaText},
	StageEgress:   nil,
}

// Audit error classes besides the jsplugin.TransformError classes.
const (
	errorInvalidEffect = "invalid_effect"
	errorGuard         = "guard"
	errorMedia         = "media"
	errorUnavailable   = "unavailable"
)

// unavailableLogged is when each unavailable instance was last logged.
var unavailableLogged sync.Map

// logUnavailable logs an instance whose plugin did not load, at most once a
// minute per instance.
func logUnavailable(instance *request_plugin_setting.Instance, loadErr string) {
	now := time.Now()
	if last, ok := unavailableLogged.Load(instance.ID); ok && now.Sub(last.(time.Time)) < time.Minute {
		return
	}
	unavailableLogged.Store(instance.ID, now)
	common.SysError(common.LogText("request plugin instance %s (%s) is unavailable, its requests fail: plugin not loaded: %s", instance.ID, instance.Plugin, loadErr))
}

var mediaPlaceholder = regexp.MustCompile(`\[media:\d+\]`)

// Plan is the execution plan of one request: the enabled instances in option
// order and the plugins they named when the request started. Every stage and
// every retry of the request uses it, so a settings change only reaches new
// requests. A request runs its stages one after another; a Plan is not safe
// for concurrent use.
type Plan struct {
	instances []request_plugin_setting.Instance
	// plugins maps a plugin key to its loaded plugin, nil when it is missing,
	// disabled or has no request processing part.
	plugins map[string]*jsplugin.LoadedPlugin
	// ingressRan holds the instances in scope at the request's ingress.
	ingressRan map[string]bool
	// reports is set when an instance's plugin exports the report hook;
	// response then captures what the gateway writes to the client.
	reports  bool
	response *responseCapture
	// replies is set when an instance's plugin exports the reply hook.
	replies bool
	// unavailable maps the key of a plugin this node should run but has not
	// loaded to its load error; its instances fail the request at ingress.
	unavailable map[string]string
	// submission is set on a task submission.
	submission *submission
	// media is the attachment text the request's hooks read.
	media requestMedia
}

// NewPlan takes the plan of a new request: nil when no enabled instance has
// an available plugin. The instances of a plugin that is missing, disabled
// or has no request processing part do not run. Those of a plugin that is
// enabled but did not load stay in the plan as unavailable.
func NewPlan() *Plan {
	return newPlanOf(request_plugin_setting.GetInstances())
}

// unloadedPlugins maps the key of each plugin the last plugin sync found
// enabled and active but could not load to its load error.
var unloadedPlugins atomic.Pointer[map[string]string]

// SetUnloadedPlugins publishes what the plugin sync found: the enabled,
// active plugins it could not load, with their load errors.
func SetUnloadedPlugins(plugins map[string]string) {
	plugins = maps.Clone(plugins)
	unloadedPlugins.Store(&plugins)
}

// unavailablePlugin returns the load error of a plugin the node should run
// but has not loaded; ok is false for a plugin that is loaded, disabled or
// deleted, or when the plugin master switch is off.
func unavailablePlugin(key string) (string, bool) {
	unloaded := unloadedPlugins.Load()
	if unloaded == nil || !jsplugin.DefaultRegistry.Enabled() {
		return "", false
	}
	loadErr, ok := (*unloaded)[key]
	if !ok {
		return "", false
	}
	if loaded, _ := jsplugin.DefaultRegistry.Get(key); loaded != nil {
		return "", false
	}
	return loadErr, true
}

// newPlanOf is the plan of instances, in their order.
func newPlanOf(instances []request_plugin_setting.Instance) *Plan {
	var plan *Plan
	var plugins map[string]*jsplugin.LoadedPlugin
	for _, instance := range instances {
		if !instance.Enabled {
			continue
		}
		if plugins == nil {
			plugins = map[string]*jsplugin.LoadedPlugin{}
		}
		plugin, seen := plugins[instance.Plugin]
		if !seen {
			if plugin, _ = jsplugin.DefaultRegistry.Get(instance.Plugin); plugin != nil && !plugin.Meta.HasTransformPart() {
				plugin = nil
			}
			plugins[instance.Plugin] = plugin
		}
		loadErr, unavailable := "", false
		if plugin == nil {
			if loadErr, unavailable = unavailablePlugin(instance.Plugin); !unavailable {
				continue
			}
		}
		if plan == nil {
			plan = &Plan{plugins: plugins, ingressRan: map[string]bool{}, unavailable: map[string]string{}}
		}
		plan.instances = append(plan.instances, instance)
		if unavailable {
			plan.unavailable[instance.Plugin] = loadErr
			continue
		}
		plan.reports = plan.reports || slices.Contains(plugin.TransformHooks(), jsplugin.ReportHook)
		plan.replies = plan.replies || slices.Contains(plugin.TransformHooks(), jsplugin.ReplyHook)
	}
	return plan
}

// scope returns the instances that run at stage for a request for model, in
// order: the global ones, then those of group, then the channel's bound ids;
// each once. One whose plugin lacks the stage hook does not run, nor one whose
// models leave out model. An unavailable plugin's instance is in scope at
// ingress only, where it fails the request.
func (p *Plan) scope(stage, group, model string, bound []string) []*request_plugin_setting.Instance {
	if p == nil {
		return nil
	}
	base := reasoning.ParseModelModifiers(model).Base
	var scoped []*request_plugin_setting.Instance
	add := func(instance *request_plugin_setting.Instance) {
		if slices.Contains(scoped, instance) {
			return
		}
		if plugin := p.plugins[instance.Plugin]; plugin == nil && stage != StageIngress || plugin != nil && !slices.Contains(plugin.TransformHooks(), stage) {
			return
		}
		// The models are matched without the @ modifiers of the client's
		// name, and as written for a model whose real name has an @.
		if len(instance.Models) > 0 && !slices.Contains(instance.Models, base) && !slices.Contains(instance.Models, model) {
			return
		}
		scoped = append(scoped, instance)
	}
	for i := range p.instances {
		if p.instances[i].Global {
			add(&p.instances[i])
		}
	}
	if group != "" {
		for i := range p.instances {
			if slices.Contains(p.instances[i].Groups, group) {
				add(&p.instances[i])
			}
		}
	}
	for _, id := range bound {
		for i := range p.instances {
			if p.instances[i].ID == id {
				add(&p.instances[i])
				break
			}
		}
	}
	return scoped
}

// Call is one stage run.
type Call struct {
	Stage string
	// Late runs the ingress hooks of an attempt's instances that were not in
	// scope at the request's ingress, a channel's or a group settled at
	// channel selection, on the attempt's upstream body.
	Late          bool
	Format        string
	Path          string
	Model         string
	UpstreamModel string
	Group         string
	Channel       *jsplugin.TransformChannel
	// Bound are the channel's request_plugins ids; nil at the request's
	// ingress, which runs before channel selection.
	Bound []string
	// Unpriced marks the late ingress of a task attempt: it runs on the
	// client body before the attempt is priced, so billing fields may change.
	Unpriced bool
	Attempt  int
	User     jsplugin.TransformUser
	// Token is nil when the request has none.
	Token *jsplugin.TransformToken
	// Effort is the reasoning effort the client or an @ model modifier set,
	// which a reasoning.set without override leaves; request stage only.
	Effort string
	// Body is the JSON body of the stage; nil when the host cannot pass one
	// (not JSON, or sent unchanged): every instance in scope is then
	// recorded as unchecked and does not run.
	Body []byte
	// Headers are the header.patch effects earlier outbound steps of this
	// attempt queued.
	Headers []requestpatch.Effect
	// Summary is the request stage summary.
	Summary *jsplugin.TransformSummary
	// form is set when Body is the text fields of a multipart form body.
	form *formBody
}

// Step is the audit record of one instance run, with the error text an
// administrator's dry run shows, which is never logged.
type Step struct {
	relaycommon.RequestPluginStep
	// Detail is the error class and text.
	Detail string `json:"error,omitempty"`
}

type Rejection struct {
	Instance string `json:"instance"`
	Code     string `json:"code"`
	Message  string `json:"message"`
}

type Failure struct {
	Instance string `json:"instance"`
	Class    string `json:"-"`
	Detail   string `json:"error"`
}

// Outcome is the result of a stage run. Body and Headers hold the committed
// changes of every instance that ran; a failed instance of an optional
// plugin changes nothing.
type Outcome struct {
	Body    []byte
	Headers []requestpatch.Effect
	// Reasoning is the reasoning.set the request stage applies, the last one
	// the client's or a modifier's effort does not keep out.
	Reasoning *requestpatch.Effect
	Steps     []Step
	// Record is the public record of the instances that changed the request,
	// found something or stopped it.
	Record   []relaycommon.RequestPluginRecord
	Rejected *Rejection
	Failed   *Failure
}

// Run runs call.Stage on the instances in scope. It stops at the first
// rejection or failure of an instance whose plugin is not optional.
func (p *Plan) Run(ctx context.Context, call Call) Outcome {
	outcome := Outcome{Body: call.Body, Headers: call.Headers}
	for _, instance := range p.scope(call.Stage, call.Group, call.Model, call.Bound) {
		if call.Stage == StageIngress {
			if call.Late && p.ingressRan[instance.ID] {
				continue
			}
			if !call.Late {
				p.ingressRan[instance.ID] = true
			}
		}
		plugin := p.plugins[instance.Plugin]
		if plugin == nil {
			// The node should run the plugin but did not load it: nothing can
			// tell whether skipping it is safe.
			loadErr := p.unavailable[instance.Plugin]
			logUnavailable(instance, loadErr)
			outcome.Steps = append(outcome.Steps, Step{
				RequestPluginStep: relaycommon.RequestPluginStep{Instance: instance.ID, Name: instance.Name, Plugin: instance.Plugin, Stage: call.Stage, Action: "fail", Error: errorUnavailable},
				Detail:            errorUnavailable + ": " + loadErr,
			})
			outcome.Record = append(outcome.Record, relaycommon.RequestPluginRecord{Plugin: instance.Plugin, Name: map[string]string{"en": instance.Plugin}, Stage: call.Stage,
				Rejected: &relaycommon.RequestPluginRejected{Code: string(types.ErrorCodeRequestPluginFailed)}})
			outcome.Failed = &Failure{Instance: instance.ID, Class: errorUnavailable, Detail: errorUnavailable + ": " + loadErr}
			return outcome
		}
		step := Step{RequestPluginStep: relaycommon.RequestPluginStep{Instance: instance.ID, Name: instance.Name, Plugin: instance.Plugin, Version: plugin.Meta.Version, Stage: call.Stage}}
		entry := relaycommon.RequestPluginRecord{Plugin: instance.Plugin, Name: pluginName(plugin.Meta), Stage: call.Stage}
		if outcome.Body == nil {
			step.Action, entry.Unchecked = "unchecked", true
			outcome.Steps = append(outcome.Steps, step)
			outcome.Record = append(outcome.Record, entry)
			continue
		}
		started := time.Now()
		next, class, err := p.runInstance(ctx, call, instance, plugin, outcome.Body, outcome.Headers)
		step.DurationMS = time.Since(started).Milliseconds()
		for _, finding := range next.findings {
			step.Findings = append(step.Findings, relaycommon.RequestPluginFinding{Rule: finding.Rule, Category: finding.Category, Count: finding.Count})
		}
		if err != nil {
			step.Action, step.Error, step.Detail = "fail", class, class+": "+err.Error()
			var transformErr *jsplugin.TransformError
			if errors.As(err, &transformErr) && transformErr.Thrown != "" {
				step.Detail += ": " + transformErr.Thrown
			}
			outcome.Steps = append(outcome.Steps, step)
			// The host cannot tell whether skipping the instance is safe;
			// an optional plugin says it is.
			if !plugin.Meta.Optional {
				entry.Rejected = &relaycommon.RequestPluginRejected{Code: string(types.ErrorCodeRequestPluginFailed)}
				outcome.Record = append(outcome.Record, entry)
				outcome.Failed = &Failure{Instance: instance.ID, Class: class, Detail: step.Detail}
				return outcome
			}
			continue
		}
		next.record.Plugin, next.record.Name, next.record.Stage = entry.Plugin, entry.Name, entry.Stage
		if next.reject != nil {
			step.Action, step.RuleID = "reject", next.reject.RuleID
			outcome.Steps = append(outcome.Steps, step)
			next.record.Rejected = &relaycommon.RequestPluginRejected{Code: next.reject.Code}
			outcome.Record = append(outcome.Record, next.record)
			outcome.Rejected = &Rejection{Instance: instance.ID, Code: next.reject.Code, Message: next.reject.Message}
			return outcome
		}
		step.Action, step.Effects = "continue", next.effects
		outcome.Steps = append(outcome.Steps, step)
		if recorded(next.record) {
			outcome.Record = append(outcome.Record, next.record)
		}
		outcome.Body = next.body
		outcome.Headers = append(outcome.Headers, next.headers...)
		if next.reasoning != nil {
			outcome.Reasoning = next.reasoning
		}
	}
	return outcome
}

// change is what one instance asked for, checked and ready to commit, with
// its public record.
type change struct {
	body      []byte
	headers   []requestpatch.Effect
	reasoning *requestpatch.Effect
	effects   int
	findings  []jsplugin.TransformFinding
	reject    *jsplugin.TransformResult
	record    relaycommon.RequestPluginRecord
}

// runInstance calls one instance on body and checks its effects. The error
// class names the failure for the audit.
func (p *Plan) runInstance(ctx context.Context, call Call, instance *request_plugin_setting.Instance, plugin *jsplugin.LoadedPlugin, body []byte, headers []requestpatch.Effect) (change, string, error) {
	view, media := body, []inlineMedia(nil)
	if call.form == nil {
		view, media = scanMedia(body)
	}
	request := jsplugin.TransformRequest{Body: view, Summary: call.Summary, Form: call.form != nil}
	if call.Stage == StageOutbound || call.Stage == StageEgress {
		request.Headers = queuedHeaders(headers)
	}
	for index, item := range media {
		entry := jsplugin.TransformMedia{Index: index, Path: item.path, MimeType: item.mime, Bytes: item.size()}
		if call.Stage == StageOutbound {
			entry.Width, entry.Height = item.dimensions()
		}
		request.Media = append(request.Media, entry)
	}
	hookCtx := ctx
	if call.Stage == StageIngress || call.Stage == StageEgress {
		// They may reach the instance's own service, such as a moderation API.
		hookCtx = jsplugin.WithFetcher(ctx, service.RequestPluginFetcher(plugin, instance.Config))
	}
	attachments := newCallMedia(&p.media, view, media, call.form)
	result, err := plugin.CallTransform(hookCtx, jsplugin.TransformContext{
		Stage:         call.Stage,
		Format:        call.Format,
		Path:          call.Path,
		Model:         call.Model,
		UpstreamModel: call.UpstreamModel,
		Group:         call.Group,
		Channel:       call.Channel,
		Attempt:       call.Attempt,
		User:          call.User,
		Token:         call.Token,
		Instance:      jsplugin.TransformInstance{ID: instance.ID, Name: instance.Name},
		// Saving the instance validated its config and applied the defaults.
		Config: instance.Config,
		Media:  attachments,
	}, request)
	if err != nil {
		class := jsplugin.TransformErrorFailed
		var transformErr *jsplugin.TransformError
		if errors.As(err, &transformErr) {
			class = transformErr.Class
		}
		return change{}, class, err
	}

	next := change{body: body, findings: result.Findings}
	for _, finding := range result.Findings {
		next.record.Findings = append(next.record.Findings, relaycommon.RequestPluginCount{Category: finding.Category, Count: finding.Count})
	}
	next.record.Attachments, next.record.MoreAttachments = attachments.record()
	if len(result.Notice) > 0 {
		next.record.Notice = maps.Clone(result.Notice)
	}
	if result.Action == "reject" {
		next.reject = &result
		return next, "", nil
	}
	if len(result.Effects) == 0 {
		return next, "", nil
	}
	// Decoding refuses an effect the stage does not allow.
	effects, err := requestpatch.DecodeTransformEffects(result.Effects, stageEffects[call.Stage]...)
	if err == nil && call.form != nil {
		err = checkFormEffects(effects)
	}
	if err != nil {
		return change{}, errorInvalidEffect, err
	}
	next.effects = len(effects)
	// mediaOps are the json.patch operations of media.reencode and
	// media.text effects.
	var mediaOps []requestpatch.Operation
	var rewritten []int
	var patches []requestpatch.Effect
	refused := false
	for index, effect := range effects {
		switch effect.Type {
		case requestpatch.EffectReasoningSet:
			if effort, err := reasoning.ParseEffort(effect.Effort); err != nil || effort == "" {
				return change{}, errorInvalidEffect, fmt.Errorf("effects[%d].effort is not a reasoning effort", index)
			}
			if call.Effort == "" || effect.Override {
				next.reasoning = &effects[index]
				next.record.ReasoningEffort = effect.Effort
			}
		case requestpatch.EffectMediaReencode:
			if effect.Media < 0 || effect.Media >= len(media) {
				return change{}, errorInvalidEffect, fmt.Errorf("effects[%d].media %d does not exist", index, effect.Media)
			}
			ops, reencode, err := reencodeMedia(ctx, media[effect.Media], effect)
			if err != nil {
				return change{}, errorMedia, fmt.Errorf("effects[%d]: %w", index, err)
			}
			mediaOps = append(mediaOps, ops...)
			if reencode != nil {
				reencode.Index = effect.Media
				next.record.Media = append(next.record.Media, *reencode)
			}
		case requestpatch.EffectMediaText:
			if !attachments.exists(effect.Media) {
				return change{}, errorInvalidEffect, fmt.Errorf("effects[%d].media %d does not exist", index, effect.Media)
			}
			// Only a text file of the body can take new text; a PDF, a DOCX
			// file, an image or a form file would have to be written anew. Text
			// written from part of a file would drop the rest. Either way the
			// file goes on as it is, and the record says so.
			if effect.Media >= len(media) || !rewritable(media[effect.Media]) || attachments.readInPart(mediaRef(effect.Media)) {
				attachments.markNotRewritable(mediaRef(effect.Media))
				refused = true
				continue
			}
			ops, err := mediaTextOps(media[effect.Media], effect.Text)
			if err != nil {
				return change{}, errorInvalidEffect, fmt.Errorf("effects[%d]: %w", index, err)
			}
			mediaOps = append(mediaOps, ops...)
			rewritten = append(rewritten, effect.Media)
		case requestpatch.EffectJSONPatch:
			for _, op := range effect.Ops {
				if mediaPlaceholder.Match(op.Value) {
					return change{}, errorInvalidEffect, fmt.Errorf("effects[%d]: a json.patch value must not contain a media placeholder", index)
				}
			}
			patches = append(patches, effect)
		case requestpatch.EffectHeaderPatch:
			patches = append(patches, effect)
			next.headers = append(next.headers, effect)
		}
	}
	if refused {
		next.record.Attachments, next.record.MoreAttachments = attachments.record()
	}
	// Media effects apply first: they address media by the paths the plugin
	// saw.
	if len(mediaOps) > 0 {
		patches = append([]requestpatch.Effect{{Type: requestpatch.EffectJSONPatch, Ops: mediaOps}}, patches...)
	}
	if len(patches) == 0 {
		return next, "", nil
	}
	if next.body, _, err = requestpatch.Apply(body, nil, patches, relaycommon.IsRequestPluginProtectedHeader); err != nil {
		return change{}, errorInvalidEffect, err
	}
	if call.form != nil {
		if err = call.form.check(body, next.body); err != nil {
			return change{}, errorInvalidEffect, err
		}
	}
	if call.Stage == StageIngress {
		// Routing, rate limits and the billing estimate already read them.
		guarded := []string{"model", "stream"}
		if call.Format == string(types.RelayFormatMjProxy) {
			// A Midjourney submission's model derives from these.
			guarded = append(guarded, "action", "customId", "content")
		}
		for _, field := range guarded {
			if gjson.GetBytes(body, field).Raw != gjson.GetBytes(next.body, field).Raw {
				return change{}, errorGuard, fmt.Errorf("ingress effects must not change %s", field)
			}
		}
	}
	if call.Stage == StageOutbound || call.Late && !call.Unpriced {
		if err = relaycommon.SameBillingFields(body, next.body); err != nil {
			return change{}, errorGuard, err
		}
	}
	next.record.Changes, next.record.MoreChanges = describeChanges(effects, body, next.body)
	next.record.Headers = describeHeaders(next.headers)
	if len(rewritten) > 0 {
		for _, index := range rewritten {
			attachments.markRewritten(mediaRef(index))
		}
		next.record.Attachments, next.record.MoreAttachments = attachments.record()
	}
	return next, "", nil
}

// queuedHeaders are the business headers queued header.patch effects set, as
// a stage hook reads them. The adaptor builds its own headers after the body,
// so these are the only upstream headers known at outbound.
func queuedHeaders(effects []requestpatch.Effect) map[string]string {
	headers := map[string]string{}
	if len(effects) == 0 {
		return headers
	}
	_, header, err := requestpatch.Apply(nil, nil, effects, nil)
	if err != nil {
		return headers
	}
	for name := range header {
		headers[name] = header.Get(name)
	}
	return headers
}
