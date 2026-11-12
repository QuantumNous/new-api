package requestplugin

import (
	"bytes"
	"cmp"
	"context"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// StageReply is the stage name of reply checks in steps and records.
const StageReply = jsplugin.ReplyHook

// Parts of the reply check contract (docs/plugin-api/v1.md).
const (
	// replyMask replaces every masked span; plugins cannot choose it.
	replyMask = "***"
	// replyCallUnits is the new text, in UTF-16 code units, an output of a
	// stream gathers between two calls of the reply hooks; the first call
	// comes with its first text.
	replyCallUnits = 32
	// replyTranscriptMasked is the stop code of an answer whose audio
	// transcript an instance masked: the audio already went out.
	replyTranscriptMasked = "masked"
)

// replyEndpoint reports the endpoints reply checks cover: Chat Completions,
// Responses, Claude Messages and Gemini generateContent and
// streamGenerateContent.
func replyEndpoint(format types.RelayFormat, mode int, path string) bool {
	switch format {
	case types.RelayFormatOpenAI:
		return mode == relayconstant.RelayModeChatCompletions
	case types.RelayFormatOpenAIResponses:
		return mode == relayconstant.RelayModeResponses
	case types.RelayFormatClaude:
		return true
	case types.RelayFormatGemini:
		return strings.HasSuffix(path, ":generateContent") || strings.HasSuffix(path, ":streamGenerateContent")
	}
	return false
}

// Reply starts the reply checks of a channel attempt, and the report capture
// when the attempt brings a report instance: before the attempt's handler
// runs, after its channel is selected. The instances are those of
// the attempt that export reply and match the request's model. The returned
// function ends the checks once the handler returned; call it whether or not
// the attempt succeeded. Without a matching instance, or on an endpoint the
// checks do not cover, the response path stays as it is and the function
// does nothing.
func Reply(c *gin.Context, format types.RelayFormat, info *relaycommon.RelayInfo) func() {
	plan := planOf(c)
	if plan == nil || info == nil {
		return func() {}
	}
	setting, _ := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	group := requestGroup(c)
	// The attempt's channel and settled group may bring report instances.
	// Their capture goes below this check, so a report gets what the client
	// got. A Realtime session reports each response itself.
	if format != types.RelayFormatOpenAIRealtime {
		plan.capture(c, group, info.OriginModelName, setting.RequestPlugins)
	}
	if !plan.replies || !replyEndpoint(format, info.RelayMode, c.Request.URL.Path) {
		return func() {}
	}
	instances := plan.scope(StageReply, group, info.OriginModelName, setting.RequestPlugins)
	if len(instances) == 0 {
		return func() {}
	}
	parent := c.Request.Context()
	ctx, cancel := context.WithCancel(parent)
	writer := &replyWriter{
		ResponseWriter: c.Writer,
		c:              c,
		info:           info,
		format:         format,
		check:          newReplyCheck(ctx, plan, instances),
		parent:         parent,
		cancel:         cancel,
		recordAt:       -1,
	}
	// A stop cancels this context: the handler then ends the attempt as for a
	// client that went away, and the upstream request is canceled.
	c.Request = c.Request.WithContext(ctx)
	c.Writer = writer
	return writer.finish
}

// replyTarget is one instance of a reply check and what it did over the whole
// answer, which the steps and the record show once.
type replyTarget struct {
	instance *request_plugin_setting.Instance
	plugin   *jsplugin.LoadedPlugin
	// skipped is set when the instance let the rest of the answer pass, or
	// failed and its plugin is optional: the text passes it unchanged for the
	// rest of the answer.
	skipped   bool
	action    string
	masked    int
	findings  []relaycommon.RequestPluginFinding
	notice    jsplugin.LocalizedText
	duration  time.Duration
	errClass  string
	detail    string
	rejected  string
	unchecked bool
}

// replyOutput is one answer of a reply: the upstream text the instances have
// not read yet, what each instance holds back, and the released text not sent
// yet.
type replyOutput struct {
	index int
	// received and fed count the upstream text in UTF-16 code units: all of
	// it, and what the instances have read.
	received int
	fed      int
	pending  string
	// ended is set when no more upstream text follows, closed once the
	// instances read the end.
	ended  bool
	closed bool
	// held and offset are, per instance, the text it holds back and the code
	// units of its input it passed on.
	held   []string
	offset []int
	out    string
	// released is what the client got, for the full-text events.
	released strings.Builder
	// deltas is set when the client gets the text as deltas, so released
	// text with no event to carry it gets one.
	deltas bool
	// The Responses or Realtime output part, for the delta events the host
	// writes.
	itemID       string
	outputIndex  int
	contentIndex int
	// responseID and deltaName are the Realtime response and the type of
	// its delta events.
	responseID string
	deltaName  string
	// readonly marks the transcript of Realtime audio: its text is read, not
	// held or rewritten, and a mask on it stops the answer.
	readonly bool
	// marks are, in a whole answer whose output spans several text parts, the
	// byte offsets in its text where each later part starts. The masks move
	// them, so each part gets its own text back.
	marks []int
}

// replyStop is what ended an answer: a plugin's stop, or a failure of an
// instance whose plugin is not optional.
type replyStop struct {
	instance string
	code     string
	message  string
	failed   bool
	class    string
	detail   string
	// text is the text of each output as the earlier instances left it.
	text map[int]string
}

// replyCheck runs the reply hooks of one answer in pipeline order: each
// instance reads what the previous one released.
type replyCheck struct {
	ctx     context.Context
	call    Call
	stream  bool
	targets []*replyTarget
	outputs map[int]*replyOutput
	order   []int
	// parts numbers the Responses output parts by output and content index.
	parts map[[2]int]int
	stop  *replyStop
}

func newReplyCheck(ctx context.Context, plan *Plan, instances []*request_plugin_setting.Instance) *replyCheck {
	check := &replyCheck{ctx: ctx, outputs: map[int]*replyOutput{}, parts: map[[2]int]int{}}
	for _, instance := range instances {
		check.targets = append(check.targets, &replyTarget{instance: instance, plugin: plan.plugins[instance.Plugin]})
	}
	return check
}

func (r *replyCheck) output(index int) *replyOutput {
	output := r.outputs[index]
	if output == nil {
		output = &replyOutput{index: index, held: make([]string, len(r.targets)), offset: make([]int, len(r.targets))}
		r.outputs[index] = output
		r.order = append(r.order, index)
	}
	return output
}

// part is the output of a Responses output part.
func (r *replyCheck) part(outputIndex, contentIndex int) *replyOutput {
	key := [2]int{outputIndex, contentIndex}
	index, known := r.parts[key]
	if !known {
		index = len(r.parts)
		r.parts[key] = index
	}
	output := r.output(index)
	output.outputIndex, output.contentIndex = outputIndex, contentIndex
	return output
}

// add appends upstream text to an output.
func (r *replyCheck) add(output *replyOutput, text string) {
	output.pending += text
	output.received += jsplugin.UTF16Len(text)
	if output.closed && text != "" {
		output.closed = false
	}
}

// markUnchecked records every instance as unable to read the answer.
func (r *replyCheck) markUnchecked() {
	for _, target := range r.targets {
		if target.action == "" {
			target.action, target.unchecked = "unchecked", true
		}
	}
}

// run passes the unread text of batch through the instances in order and
// adds what the last one released to each output's out. An ended output's
// call is final. It returns false when an instance stopped the answer.
func (r *replyCheck) run(batch []*replyOutput) bool {
	inputs := make([]string, len(batch))
	for i, output := range batch {
		inputs[i], output.pending, output.fed = output.pending, "", output.received
	}
	for position, target := range r.targets {
		var outputs []jsplugin.ReplyOutput
		var members []int
		for i, output := range batch {
			text := output.held[position] + inputs[i]
			if target.skipped {
				inputs[i], output.held[position] = text, ""
				continue
			}
			if inputs[i] == "" && !output.ended {
				continue
			}
			outputs = append(outputs, jsplugin.ReplyOutput{Index: output.index, Text: text, Offset: output.offset[position], Final: output.ended})
			members = append(members, i)
		}
		if len(outputs) == 0 {
			continue
		}
		result, err := r.callTarget(target, outputs)
		if err == nil && result.Action == "pass" || err != nil && target.plugin.Meta.Optional {
			target.skipped = true
			for k, i := range members {
				inputs[i], batch[i].held[position] = outputs[k].Text, ""
			}
			continue
		}
		if err != nil || result.Action == "stop" {
			stop := &replyStop{instance: target.instance.ID, code: result.Code, message: result.Message, text: map[int]string{}}
			if err != nil {
				stop.code, stop.failed, stop.class, stop.detail = string(types.ErrorCodeRequestPluginFailed), true, target.errClass, target.detail
			}
			for k, output := range outputs {
				stop.text[output.Index] = outputs[k].Text
			}
			r.stop = stop
			return false
		}
		for k, i := range members {
			release := result
			if batch[i].readonly {
				release.Hold = 0
			}
			released, held, units, applied := releaseReply(outputs[k], release)
			if batch[i].readonly && len(applied) > 0 {
				// The audio of a transcript already went out, so a mask on it
				// stops the answer.
				for _, mask := range applied {
					if mask.Category != "" {
						target.addFinding(jsplugin.TransformFinding{Rule: mask.Category, Category: mask.Category, Count: 1})
					}
				}
				target.action, target.rejected = "stop", replyTranscriptMasked
				stop := &replyStop{instance: target.instance.ID, code: replyTranscriptMasked, text: map[int]string{}}
				for _, output := range outputs {
					stop.text[output.Index] = output.Text
				}
				r.stop = stop
				return false
			}
			if batch[i].marks != nil {
				// A whole answer holds nothing, so the call's text is the input.
				batch[i].marks = shiftMarks(batch[i].marks, outputs[k].Text, applied)
			}
			batch[i].held[position], inputs[i] = held, released
			batch[i].offset[position] += units
			target.masked += len(applied)
			for _, mask := range applied {
				if mask.Category != "" {
					target.addFinding(jsplugin.TransformFinding{Rule: mask.Category, Category: mask.Category, Count: 1})
				}
			}
		}
	}
	for i, output := range batch {
		output.out += inputs[i]
		output.closed = output.closed || output.ended
	}
	return true
}

// passed reports an answer every instance let pass: no hook is called for
// the rest of it.
func (r *replyCheck) passed() bool {
	for _, target := range r.targets {
		if !target.skipped {
			return false
		}
	}
	return true
}

// masked reports an answer whose text an instance masked.
func (r *replyCheck) masked() bool {
	return slices.ContainsFunc(r.targets, func(target *replyTarget) bool { return target.masked > 0 })
}

// releaseAll releases the text every output has not passed on yet, once
// every instance let the answer pass.
func (r *replyCheck) releaseAll() {
	var batch []*replyOutput
	for _, index := range r.order {
		output := r.outputs[index]
		if output.pending != "" || slices.ContainsFunc(output.held, func(held string) bool { return held != "" }) {
			batch = append(batch, output)
		}
	}
	r.run(batch)
}

// callTarget calls one instance's reply hook and keeps what it did for the
// steps and the record.
func (r *replyCheck) callTarget(target *replyTarget, outputs []jsplugin.ReplyOutput) (jsplugin.ReplyResult, error) {
	call := r.call
	tctx := jsplugin.TransformContext{
		Stage:         StageReply,
		Format:        call.Format,
		Path:          call.Path,
		Model:         call.Model,
		UpstreamModel: call.UpstreamModel,
		Group:         call.Group,
		Channel:       call.Channel,
		Attempt:       call.Attempt,
		User:          call.User,
		Token:         call.Token,
		Instance:      jsplugin.TransformInstance{ID: target.instance.ID, Name: target.instance.Name},
		Config:        target.instance.Config,
	}
	ctx := jsplugin.WithFetcher(r.ctx, service.RequestPluginFetcher(target.plugin, target.instance.Config))
	started := time.Now()
	result, err := target.plugin.CallReply(ctx, tctx, r.stream, outputs)
	target.duration += time.Since(started)
	if err != nil {
		target.action, target.errClass = "fail", jsplugin.TransformErrorFailed
		var transformErr *jsplugin.TransformError
		if errors.As(err, &transformErr) {
			target.errClass = transformErr.Class
		}
		target.detail = target.errClass + ": " + err.Error()
		if transformErr != nil && transformErr.Thrown != "" {
			target.detail += ": " + transformErr.Thrown
		}
		if !target.plugin.Meta.Optional {
			target.rejected = string(types.ErrorCodeRequestPluginFailed)
		}
		return result, err
	}
	for _, finding := range result.Findings {
		target.addFinding(finding)
	}
	if len(result.Notice) > 0 {
		target.notice = maps.Clone(result.Notice)
	}
	if result.Action == "stop" {
		target.action, target.rejected = "stop", result.Code
	} else if target.action == "" {
		target.action = "continue"
	}
	return result, nil
}

// addFinding counts a finding by rule and category, at most 64 of them.
func (t *replyTarget) addFinding(finding jsplugin.TransformFinding) {
	for i := range t.findings {
		if t.findings[i].Rule == finding.Rule && t.findings[i].Category == finding.Category {
			t.findings[i].Count += finding.Count
			return
		}
	}
	if len(t.findings) < 64 {
		t.findings = append(t.findings, relaycommon.RequestPluginFinding{Rule: finding.Rule, Category: finding.Category, Count: finding.Count})
	}
}

// steps are the audit steps of the instances that ran or could not read the
// answer, once each.
func (r *replyCheck) steps() []Step {
	var steps []Step
	for _, target := range r.targets {
		if target.action == "" {
			continue
		}
		steps = append(steps, Step{RequestPluginStep: relaycommon.RequestPluginStep{
			Instance:   target.instance.ID,
			Name:       target.instance.Name,
			Plugin:     target.instance.Plugin,
			Version:    target.plugin.Meta.Version,
			Stage:      StageReply,
			Action:     target.action,
			Effects:    target.masked,
			Findings:   slices.Clone(target.findings),
			DurationMS: target.duration.Milliseconds(),
			Error:      target.errClass,
		}, Detail: target.detail})
	}
	return steps
}

// record is the public record of the instances that masked, found or stopped
// something, or could not read the answer.
func (r *replyCheck) record() []relaycommon.RequestPluginRecord {
	var record []relaycommon.RequestPluginRecord
	for _, target := range r.targets {
		entry := relaycommon.RequestPluginRecord{Plugin: target.instance.Plugin, Name: pluginName(target.plugin.Meta), Stage: StageReply, Masked: target.masked, Unchecked: target.unchecked}
		for _, finding := range target.findings {
			index := slices.IndexFunc(entry.Findings, func(count relaycommon.RequestPluginCount) bool { return count.Category == finding.Category })
			if index < 0 {
				entry.Findings = append(entry.Findings, relaycommon.RequestPluginCount{Category: finding.Category, Count: finding.Count})
			} else {
				entry.Findings[index].Count += finding.Count
			}
		}
		if len(target.notice) > 0 {
			entry.Notice = maps.Clone(target.notice)
		}
		if target.rejected != "" {
			entry.Rejected = &relaycommon.RequestPluginRejected{Code: target.rejected}
		}
		if recorded(entry) {
			record = append(record, entry)
		}
	}
	return record
}

// releaseReply applies one instance's result to one output of its call: the
// masks, merged where they overlap, become replyMask, and the last hold code
// units stay back unless the output is final. A mask across that point is
// released whole. It returns the released text, the held text, the code
// units of the input released, and the masks it applied.
func releaseReply(output jsplugin.ReplyOutput, result jsplugin.ReplyResult) (string, string, int, []jsplugin.ReplyMask) {
	var masks []jsplugin.ReplyMask
	for _, mask := range result.Masks {
		if mask.Index == output.Index {
			masks = append(masks, mask)
		}
	}
	slices.SortFunc(masks, func(a, b jsplugin.ReplyMask) int { return cmp.Compare(a.Start, b.Start) })
	var merged []jsplugin.ReplyMask
	for _, mask := range masks {
		if last := len(merged) - 1; last >= 0 && mask.Start < merged[last].End {
			merged[last].End = max(merged[last].End, mask.End)
			continue
		}
		merged = append(merged, mask)
	}
	text := output.Text
	cut := jsplugin.UTF16Len(text)
	if !output.Final {
		cut = max(0, cut-result.Hold)
	}
	for _, mask := range merged {
		if mask.Start < cut && cut < mask.End {
			cut = mask.End
		}
	}
	end := utf16Byte(text, cut, false)
	var released strings.Builder
	var applied []jsplugin.ReplyMask
	from := 0
	for _, mask := range merged {
		start, stop := utf16Byte(text, mask.Start, false), utf16Byte(text, mask.End, true)
		if stop > end {
			break
		}
		released.WriteString(text[from:start])
		released.WriteString(replyMask)
		from = stop
		applied = append(applied, mask)
	}
	released.WriteString(text[from:end])
	return released.String(), text[end:], jsplugin.UTF16Len(text[:end]), applied
}

// shiftMarks moves the part marks of text past the masks applied to it,
// which releaseReply merged and sorted. A mask across a mark stays with the
// part where it starts: the mark moves to the end of its replyMask.
func shiftMarks(marks []int, text string, masks []jsplugin.ReplyMask) []int {
	shifted := slices.Clone(marks)
	// From the last mask back, so each mask's offsets still hold in text.
	for m := len(masks) - 1; m >= 0; m-- {
		start, stop := utf16Byte(text, masks[m].Start, false), utf16Byte(text, masks[m].End, true)
		for i, mark := range marks {
			switch {
			case mark >= stop:
				shifted[i] += len(replyMask) - (stop - start)
			case mark > start:
				shifted[i] = start + len(replyMask)
			}
		}
	}
	return shifted
}

// utf16Byte is the byte offset in text of a UTF-16 offset. Inside a
// surrogate pair it rounds down, or up when up is set.
func utf16Byte(text string, units int, up bool) int {
	count := 0
	for index := 0; index < len(text); {
		if count >= units {
			return index
		}
		r, size := utf8.DecodeRuneInString(text[index:])
		width := 1
		if r >= 0x10000 {
			width = 2
		}
		if count+width > units {
			if up {
				return index + size
			}
			return index
		}
		count += width
		index += size
	}
	return len(text)
}

// replyField is a text member of an answer or a stream event: Path in sjson
// syntax, Text its value, and Present whether the member exists (a finish
// chunk may carry text it did not have).
type replyField struct {
	output  *replyOutput
	path    string
	text    string
	present bool
	// upTo is the output's received count once this text was added.
	upTo int
}

// answerFields reads the answer texts of a non-stream body in format. It
// returns false when the host cannot read the answer.
func (r *replyCheck) answerFields(format types.RelayFormat, body []byte) ([]replyField, bool) {
	answer := gjson.ParseBytes(body)
	if !answer.IsObject() {
		return nil, false
	}
	var fields []replyField
	readable := true
	switch format {
	case types.RelayFormatOpenAI:
		choices := answer.Get("choices")
		if !choices.IsArray() {
			return nil, false
		}
		for j, choice := range choices.Array() {
			content := choice.Get("message.content")
			switch content.Type {
			case gjson.String:
				fields = append(fields, replyField{output: r.output(choiceIndex(choice, j)), path: fmt.Sprintf("choices.%d.message.content", j), text: content.Str, present: true})
			case gjson.Null:
			default:
				// Content parts the host does not read.
				readable = readable && !content.Exists()
			}
		}
	case types.RelayFormatOpenAIResponses:
		items := answer.Get("output")
		if !items.IsArray() {
			return nil, false
		}
		for i, item := range items.Array() {
			if item.Get("type").Str != "message" {
				continue
			}
			for k, part := range item.Get("content").Array() {
				if text := part.Get("text"); part.Get("type").Str == "output_text" && text.Type == gjson.String {
					fields = append(fields, replyField{output: r.part(i, k), path: fmt.Sprintf("output.%d.content.%d.text", i, k), text: text.Str, present: true})
				}
			}
		}
	case types.RelayFormatClaude:
		blocks := answer.Get("content")
		if !blocks.IsArray() {
			return nil, false
		}
		for k, block := range blocks.Array() {
			if text := block.Get("text"); block.Get("type").Str == "text" && text.Type == gjson.String {
				fields = append(fields, replyField{output: r.output(k), path: fmt.Sprintf("content.%d.text", k), text: text.Str, present: true})
			}
		}
	case types.RelayFormatGemini:
		for j, candidate := range answer.Get("candidates").Array() {
			fields = append(fields, geminiFields(r, candidate, j)...)
		}
	default:
		return nil, false
	}
	return fields, readable
}

func choiceIndex(choice gjson.Result, position int) int {
	if index := choice.Get("index"); index.Type == gjson.Number {
		return int(index.Int())
	}
	return position
}

// geminiFields are the text parts of a candidate, thoughts left out; one
// output per candidate.
func geminiFields(r *replyCheck, candidate gjson.Result, position int) []replyField {
	var fields []replyField
	output := r.output(choiceIndex(candidate, position))
	for p, part := range candidate.Get("content.parts").Array() {
		if text := part.Get("text"); text.Type == gjson.String && !part.Get("thought").Bool() {
			fields = append(fields, replyField{output: output, path: fmt.Sprintf("candidates.%d.content.parts.%d.text", position, p), text: text.Str, present: true})
		}
	}
	return fields
}

// whole checks a non-stream answer: one call per instance with every output
// final. It returns the answer to send, nil when an instance stopped it; an
// answer the host cannot read is returned as it is and recorded as
// unchecked.
func (r *replyCheck) whole(format types.RelayFormat, body []byte) []byte {
	fields, readable := r.answerFields(format, body)
	if !readable {
		r.markUnchecked()
		return body
	}
	if len(fields) == 0 {
		return body
	}
	var batch []*replyOutput
	for _, field := range fields {
		if field.output.ended {
			// A later text part of the output starts here.
			field.output.marks = append(field.output.marks, len(field.output.pending))
		}
		r.add(field.output, field.text)
		if !field.output.ended {
			field.output.ended = true
			batch = append(batch, field.output)
		}
	}
	if !r.run(batch) {
		return nil
	}
	return fillFields(body, fields)
}

// fillFields writes each output's released text into its fields. Text that
// passed unchanged leaves them as they are. A whole answer splits it at the
// output's part marks, so each part keeps its own text; otherwise the first
// field takes it and the others are emptied.
func fillFields(body []byte, fields []replyField) []byte {
	for index, first := range fields {
		output := first.output
		if slices.ContainsFunc(fields[:index], func(field replyField) bool { return field.output == output }) {
			continue
		}
		var own []replyField
		var original strings.Builder
		for _, field := range fields[index:] {
			if field.output == output {
				own = append(own, field)
				original.WriteString(field.text)
			}
		}
		value := output.out
		output.out = ""
		output.released.WriteString(value)
		texts := make([]string, len(own))
		switch {
		case value == original.String():
			for i, field := range own {
				texts[i] = field.text
			}
		case len(own) > 1 && len(output.marks) == len(own)-1:
			from := 0
			for i, mark := range output.marks {
				mark = min(max(mark, from), len(value))
				texts[i], from = value[from:mark], mark
			}
			texts[len(own)-1] = value[from:]
		default:
			texts[0] = value
		}
		for i, field := range own {
			if texts[i] == field.text && field.present || texts[i] == "" && !field.present {
				continue
			}
			if next, err := sjson.SetBytes(body, field.path, texts[i]); err == nil {
				body = next
			}
		}
	}
	return body
}

// Modes of a replyWriter.
const (
	replyUndecided = iota
	// replyPassing passes everything on as it is: an error response, an
	// answer the host cannot read, or a finished check.
	replyPassing
	replyStream
	replyWhole
)

// replyWriter runs the reply checks on what the handler writes and passes on
// what they release. It sits between the handler and the report capture, so
// report sees what the client got.
type replyWriter struct {
	gin.ResponseWriter
	c      *gin.Context
	info   *relaycommon.RelayInfo
	format types.RelayFormat
	check  *replyCheck
	parent context.Context
	cancel context.CancelFunc
	mu     sync.Mutex
	mode   int
	// status is the status the handler set and the writer has not passed on.
	status int
	// buffer is the answer so far, or the unfinished event of a stream.
	buffer  []byte
	queue   []*replyEvent
	stopped bool
	// socket is set on a WebSocket, where each event is one message: it
	// sends one to the client. info is then nil when the session keeps the
	// steps and the record itself.
	socket func([]byte)
	// recordAt and stepAt are where the attempt's entries end on info.
	recordAt int
	stepAt   int
	// chunk is the last Chat Completions chunk, for the chunks the host
	// writes.
	chunk gjson.Result
}

// replyEvent is a stream event waiting for its text.
type replyEvent struct {
	raw    []byte
	lines  []string
	data   []byte
	fields []replyField
	full   []replyField
	// after holds, for an event without text, the received count of each
	// output when it arrived; it waits until the instances released that
	// text.
	after map[*replyOutput]int
}

func (w *replyWriter) WriteHeader(code int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	// gin renders with -1 to keep the status as it is.
	if code <= 0 {
		return
	}
	if w.mode == replyUndecided || w.mode == replyWhole {
		w.status = code
		return
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *replyWriter) WriteHeaderNow() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.mode == replyUndecided {
		w.decide()
	}
	if w.mode != replyWhole {
		w.ResponseWriter.WriteHeaderNow()
	}
}

func (w *replyWriter) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.stopped {
		return len(data), nil
	}
	if w.mode == replyUndecided {
		w.decide()
	}
	switch w.mode {
	case replyStream:
		w.buffer = append(w.buffer, data...)
		w.events()
		return len(data), nil
	case replyWhole:
		w.buffer = append(w.buffer, data...)
		if w.wholeComplete() {
			w.finishWhole()
		}
		return len(data), nil
	}
	return w.ResponseWriter.Write(data)
}

func (w *replyWriter) WriteString(text string) (int, error) {
	return w.Write([]byte(text))
}

func (w *replyWriter) Flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.mode == replyUndecided || w.mode == replyWhole || w.stopped {
		return
	}
	w.ResponseWriter.Flush()
}

func (w *replyWriter) Status() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.status != 0 {
		return w.status
	}
	return w.ResponseWriter.Status()
}

func (w *replyWriter) Written() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.ResponseWriter.Written() || len(w.buffer) > 0 || len(w.queue) > 0
}

// Unwrap lets http.ResponseController reach the connection.
func (w *replyWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// decide reads the first response the handler writes: a 2xx event stream
// or JSON body is an answer to check, an error passes on as it is, and any
// other answer, or a compressed one, is recorded as unchecked.
func (w *replyWriter) decide() {
	w.check.call = attemptCall(w.c, w.info)
	w.check.call.Format = string(w.format)
	header := w.ResponseWriter.Header()
	mediaType := strings.ToLower(strings.TrimSpace(strings.Split(header.Get("Content-Type"), ";")[0]))
	status := cmp.Or(w.status, http.StatusOK)
	encoding := strings.ToLower(header.Get("Content-Encoding"))
	switch {
	case status < 200 || status > 299:
		w.mode = replyPassing
	case encoding != "" && encoding != "identity":
		w.mode = replyPassing
		w.check.markUnchecked()
		w.sync()
	case mediaType == "text/event-stream":
		w.mode = replyStream
		w.check.stream = true
	case mediaType == "application/json" || strings.HasSuffix(mediaType, "+json"):
		w.mode = replyWhole
		return
	default:
		w.mode = replyPassing
		w.check.markUnchecked()
		w.sync()
	}
	if w.status != 0 {
		w.ResponseWriter.WriteHeader(w.status)
		w.status = 0
	}
}

// wholeComplete reports a non-stream answer whose bytes all arrived: its
// Content-Length, or else a whole JSON value.
func (w *replyWriter) wholeComplete() bool {
	if length, err := strconv.Atoi(w.ResponseWriter.Header().Get("Content-Length")); err == nil && length >= 0 {
		return len(w.buffer) >= length
	}
	return gjson.ValidBytes(w.buffer)
}

// finishWhole checks a non-stream answer and writes what the client gets.
func (w *replyWriter) finishWhole() {
	body := w.buffer
	w.buffer, w.mode = nil, replyPassing
	status := cmp.Or(w.status, http.StatusOK)
	w.status = 0
	answer := w.check.whole(w.format, body)
	w.sync()
	if w.check.stop != nil {
		w.stopped = true
		apiErr := w.stopError()
		encoded, _ := common.Marshal(replyErrorBody(w.c, w.format, apiErr))
		header := w.ResponseWriter.Header()
		header.Set("Content-Type", "application/json; charset=utf-8")
		header.Set("Content-Length", strconv.Itoa(len(encoded)))
		w.ResponseWriter.WriteHeader(apiErr.StatusCode)
		_, _ = w.ResponseWriter.Write(encoded)
		return
	}
	if w.ResponseWriter.Header().Get("Content-Length") != "" {
		w.ResponseWriter.Header().Set("Content-Length", strconv.Itoa(len(answer)))
	}
	w.ResponseWriter.WriteHeader(status)
	_, _ = w.ResponseWriter.Write(answer)
}

// stopError is the error the client gets for the stop, and logs a failure.
func (w *replyWriter) stopError() *types.NewAPIError {
	stop := w.check.stop
	var apiErr *types.NewAPIError
	if stop.failed {
		logger.LogWarn(w.c, common.LogText("request plugin instance %s (%s) failed at %s: %s", stop.instance, w.targetPlugin(stop.instance), StageReply, stop.class))
		apiErr = types.NewErrorWithStatusCode(errors.New(i18n.T(w.c, i18n.MsgRelayRequestPluginFailed)), types.ErrorCodeRequestPluginFailed, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
	} else {
		message := stop.message
		if message == "" {
			message = i18n.T(w.c, i18n.MsgRelayResponseRejected)
		}
		apiErr = types.NewErrorWithStatusCode(fmt.Errorf("%s (code: %s)", message, stop.code), types.ErrorCodeResponseRejected, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	apiErr.SetMessage(common.MessageWithRequestId(apiErr.Error(), w.c.GetString(common.RequestIdKey)))
	return apiErr
}

func (w *replyWriter) targetPlugin(instance string) string {
	for _, target := range w.check.targets {
		if target.instance.ID == instance {
			return target.instance.Plugin
		}
	}
	return ""
}

// replyErrorBody is an error as the client's format writes it.
func replyErrorBody(c *gin.Context, format types.RelayFormat, apiErr *types.NewAPIError) gin.H {
	upstreamURLs := common.UpstreamAddresses(c)
	if format == types.RelayFormatClaude {
		return gin.H{"type": "error", "error": apiErr.ToClaudeError(upstreamURLs...)}
	}
	return gin.H{"error": apiErr.ToOpenAIError(upstreamURLs...)}
}

// events reads the whole events of the buffer.
func (w *replyWriter) events() {
	for !w.stopped {
		end, size := bytes.Index(w.buffer, []byte("\n\n")), 2
		if crlf := bytes.Index(w.buffer, []byte("\r\n\r\n")); crlf >= 0 && (end < 0 || crlf < end) {
			end, size = crlf, 4
		}
		if end < 0 {
			return
		}
		block := bytes.Clone(w.buffer[:end+size])
		w.buffer = w.buffer[end+size:]
		w.event(block)
	}
}

// event takes one stream event: its text goes to the instances, and the event
// waits in order until they released it.
func (w *replyWriter) event(block []byte) {
	event := &replyEvent{raw: block}
	var data []string
	for line := range strings.SplitSeq(strings.TrimRight(string(block), "\r\n"), "\n") {
		line = strings.TrimSuffix(line, "\r")
		if line == "" {
			continue
		}
		field, value, _ := strings.Cut(line, ":")
		if field == "data" {
			data = append(data, strings.TrimPrefix(value, " "))
			if len(data) == 1 {
				event.lines = append(event.lines, "")
			}
			continue
		}
		event.lines = append(event.lines, line)
	}
	// A comment or a ping carries nothing to keep in order. An empty line in
	// lines stands for the data lines.
	if data == nil && !slices.ContainsFunc(event.lines, func(line string) bool { return !strings.HasPrefix(line, ":") }) {
		w.out(block)
		return
	}
	payload := strings.Join(data, "\n")
	endAll := payload == "[DONE]"
	var ends []*replyOutput
	if !endAll && gjson.Valid(payload) {
		parsed := gjson.Parse(payload)
		if w.format == types.RelayFormatClaude && parsed.Get("type").Str == "ping" {
			w.out(block)
			return
		}
		event.data = []byte(payload)
		event.fields, event.full, ends, endAll = w.eventFields(parsed)
	}
	w.take(event, ends, endAll)
}

// message takes one event of a WebSocket stream: a whole JSON message the
// session already decoded.
func (w *replyWriter) message(payload []byte) {
	event := &replyEvent{raw: payload, lines: []string{""}, data: payload}
	var ends []*replyOutput
	var endAll bool
	event.fields, event.full, ends, endAll = w.eventFields(gjson.ParseBytes(payload))
	w.take(event, ends, endAll)
}

// take passes the text of one stream event to the instances, and queues the
// event until they released it. A transcript is read only: its event goes
// out in order and waits for nothing.
func (w *replyWriter) take(event *replyEvent, ends []*replyOutput, endAll bool) {
	fields := event.fields[:0]
	for _, field := range event.fields {
		w.check.add(field.output, field.text)
		field.upTo = field.output.received
		if !field.output.readonly {
			fields = append(fields, field)
		}
	}
	event.fields = fields
	for _, field := range event.full {
		// An output the client only gets whole is read from this event.
		if field.output.received == 0 && !field.output.closed {
			w.check.add(field.output, field.text)
		}
		field.output.ended = true
	}
	for _, output := range ends {
		output.ended = true
	}
	passed := w.check.passed()
	var batch []*replyOutput
	for _, index := range w.check.order {
		output := w.check.outputs[index]
		if endAll {
			output.ended = true
		}
		switch {
		case output.ended && (!output.closed || output.pending != ""),
			output.pending != "" && (passed || output.fed == 0 || output.received-output.fed >= replyCallUnits),
			len(event.fields) == 0 && output.pending != "" && !output.readonly:
			batch = append(batch, output)
		}
	}
	if len(batch) > 0 && !w.check.run(batch) {
		w.stopStream()
		return
	}
	if !passed && w.check.passed() {
		w.check.releaseAll()
	}
	if len(event.fields) == 0 {
		event.after = map[*replyOutput]int{}
		for _, output := range w.check.outputs {
			if !output.readonly {
				event.after[output] = output.received
			}
		}
	}
	w.queue = append(w.queue, event)
	w.drain(false)
	if w.check.passed() && !w.check.masked() {
		w.passThrough()
	}
	w.sync()
}

// passThrough hands the rest of a stream to the client as the handler writes
// it, once every instance let the answer pass with nothing masked: the
// events waiting go out, then the unfinished one.
func (w *replyWriter) passThrough() {
	w.drain(true)
	w.releaseOut()
	if len(w.buffer) > 0 {
		w.out(w.buffer)
		w.buffer = nil
	}
	w.mode = replyPassing
}

// out writes to the client: one message on a WebSocket, stream bytes
// otherwise.
func (w *replyWriter) out(data []byte) {
	if w.socket != nil {
		w.socket(data)
		return
	}
	_, _ = w.ResponseWriter.Write(data)
}

// eventFields reads the text of a stream event in the client's format: delta
// fields, full-text fields, the outputs it ends, and whether it ends them
// all.
func (w *replyWriter) eventFields(data gjson.Result) (fields, full []replyField, ends []*replyOutput, endAll bool) {
	r := w.check
	switch w.format {
	case types.RelayFormatOpenAI:
		if data.Get("choices").Exists() {
			w.chunk = data
		}
		for j, choice := range data.Get("choices").Array() {
			output := r.output(choiceIndex(choice, j))
			path := fmt.Sprintf("choices.%d.delta.content", j)
			content := choice.Get("delta.content")
			finished := choice.Get("finish_reason").String() != ""
			switch {
			case content.Type == gjson.String:
				output.deltas = true
				fields = append(fields, replyField{output: output, path: path, text: content.Str, present: true})
			case finished && choice.Get("delta").IsObject():
				// The finish chunk carries the text released at the end.
				fields = append(fields, replyField{output: output, path: path})
			}
			if finished {
				ends = append(ends, output)
			}
		}
	case types.RelayFormatOpenAIResponses:
		switch data.Get("type").Str {
		case "response.output_text.delta":
			output := r.part(int(data.Get("output_index").Int()), int(data.Get("content_index").Int()))
			output.deltas, output.itemID = true, data.Get("item_id").Str
			fields = append(fields, replyField{output: output, path: "delta", text: data.Get("delta").Str, present: true})
		case "response.content_part.added":
			if part := data.Get("part"); part.Get("type").Str == "output_text" && part.Get("text").Str != "" {
				output := r.part(int(data.Get("output_index").Int()), int(data.Get("content_index").Int()))
				output.deltas, output.itemID = true, data.Get("item_id").Str
				fields = append(fields, replyField{output: output, path: "part.text", text: part.Get("text").Str, present: true})
			}
		case "response.output_text.done":
			output := r.part(int(data.Get("output_index").Int()), int(data.Get("content_index").Int()))
			full = append(full, replyField{output: output, path: "text", text: data.Get("text").Str, present: true})
		case "response.content_part.done":
			if part := data.Get("part"); part.Get("type").Str == "output_text" {
				output := r.part(int(data.Get("output_index").Int()), int(data.Get("content_index").Int()))
				full = append(full, replyField{output: output, path: "part.text", text: part.Get("text").Str, present: true})
			}
		case "response.output_item.done":
			full = append(full, responsesItemFields(r, data.Get("item"), int(data.Get("output_index").Int()), "item")...)
		case "response.completed", "response.incomplete", "response.failed", "response.done":
			for i, item := range data.Get("response.output").Array() {
				full = append(full, responsesItemFields(r, item, i, fmt.Sprintf("response.output.%d", i))...)
			}
			endAll = true
		}
	case types.RelayFormatOpenAIRealtime:
		fields, full, endAll = r.realtimeFields(data)
	case types.RelayFormatClaude:
		index := int(data.Get("index").Int())
		switch data.Get("type").Str {
		case "content_block_start":
			if block := data.Get("content_block"); block.Get("type").Str == "text" {
				output := r.output(index)
				output.deltas = true
				if text := block.Get("text"); text.Str != "" {
					fields = append(fields, replyField{output: output, path: "content_block.text", text: text.Str, present: true})
				}
			}
		case "content_block_delta":
			if delta := data.Get("delta"); delta.Get("type").Str == "text_delta" {
				output := r.output(index)
				output.deltas = true
				fields = append(fields, replyField{output: output, path: "delta.text", text: delta.Get("text").Str, present: true})
			}
		case "content_block_stop":
			if output := r.outputs[index]; output != nil {
				ends = append(ends, output)
			}
		case "message_delta", "message_stop":
			endAll = true
		}
	case types.RelayFormatGemini:
		for j, candidate := range data.Get("candidates").Array() {
			candidateFields := geminiFields(r, candidate, j)
			for _, field := range candidateFields {
				field.output.deltas = true
			}
			fields = append(fields, candidateFields...)
			if candidate.Get("finishReason").String() != "" {
				ends = append(ends, r.output(choiceIndex(candidate, j)))
			}
		}
	}
	return fields, full, ends, endAll
}

// responsesItemFields are the output_text parts of a Responses message item
// at prefix.
func responsesItemFields(r *replyCheck, item gjson.Result, outputIndex int, prefix string) []replyField {
	if item.Get("type").Str != "message" {
		return nil
	}
	var fields []replyField
	for k, part := range item.Get("content").Array() {
		if text := part.Get("text"); part.Get("type").Str == "output_text" && text.Type == gjson.String {
			fields = append(fields, replyField{output: r.part(outputIndex, k), path: fmt.Sprintf("%s.content.%d.text", prefix, k), text: text.Str, present: true})
		}
	}
	return fields
}

// realtimeFields reads the text of a Realtime server event: the text of an
// answer, and the transcript of its audio, which is read only.
func (r *replyCheck) realtimeFields(data gjson.Result) (fields, full []replyField, endAll bool) {
	part := func(readonly bool) *replyOutput {
		output := r.part(int(data.Get("output_index").Int()), int(data.Get("content_index").Int()))
		output.itemID, output.responseID, output.readonly = data.Get("item_id").Str, data.Get("response_id").Str, readonly
		return output
	}
	switch name := data.Get("type").Str; name {
	case "response.text.delta", "response.output_text.delta":
		output := part(false)
		output.deltas, output.deltaName = true, name
		fields = append(fields, replyField{output: output, path: "delta", text: data.Get("delta").Str, present: true})
	case "response.audio_transcript.delta", "response.output_audio_transcript.delta":
		fields = append(fields, replyField{output: part(true), path: "delta", text: data.Get("delta").Str, present: true})
	case "response.text.done", "response.output_text.done":
		full = append(full, replyField{output: part(false), path: "text", text: data.Get("text").Str, present: true})
	case "response.audio_transcript.done", "response.output_audio_transcript.done":
		full = append(full, replyField{output: part(true), path: "transcript", text: data.Get("transcript").Str, present: true})
	case "response.content_part.added", "response.content_part.done":
		key, readonly, ok := realtimeText(data.Get("part"))
		if !ok {
			break
		}
		text := data.Get("part." + key).Str
		if name == "response.content_part.done" {
			full = append(full, replyField{output: part(readonly), path: "part." + key, text: text, present: true})
		} else if text != "" {
			output := part(readonly)
			output.deltas = output.deltas || !readonly
			fields = append(fields, replyField{output: output, path: "part." + key, text: text, present: true})
		}
	case "response.output_item.done":
		full = realtimeItemFields(r, data.Get("item"), int(data.Get("output_index").Int()), "item", false)
	case "conversation.item.created", "conversation.item.added", "conversation.item.done":
		// An item the answer already wrote to, as the conversation now holds
		// it.
		full = realtimeItemFields(r, data.Get("item"), -1, "item", true)
	case "response.done":
		for i, item := range data.Get("response.output").Array() {
			full = append(full, realtimeItemFields(r, item, i, fmt.Sprintf("response.output.%d", i), false)...)
		}
		endAll = true
	}
	return fields, full, endAll
}

// realtimeText is the text member of a Realtime content part: its text, or
// the transcript of its audio, which is read only.
func realtimeText(part gjson.Result) (key string, readonly, ok bool) {
	switch part.Get("type").Str {
	case "text", "output_text":
		return "text", false, part.Get("text").Type == gjson.String
	case "audio", "output_audio":
		return "transcript", true, part.Get("transcript").Type == gjson.String
	}
	return "", false, false
}

// realtimeItemFields are the text parts of a Realtime message item at
// prefix. known reads only parts whose output the answer already has, found
// by item id.
func realtimeItemFields(r *replyCheck, item gjson.Result, outputIndex int, prefix string, known bool) []replyField {
	if item.Get("type").Str != "message" {
		return nil
	}
	id := item.Get("id").Str
	var fields []replyField
	for k, content := range item.Get("content").Array() {
		key, readonly, ok := realtimeText(content)
		if !ok {
			continue
		}
		var output *replyOutput
		if known {
			for _, index := range r.order {
				if candidate := r.outputs[index]; candidate.itemID == id && id != "" && candidate.contentIndex == k {
					output = candidate
					break
				}
			}
			if output == nil {
				continue
			}
		} else {
			output = r.part(outputIndex, k)
			output.itemID, output.readonly = cmp.Or(output.itemID, id), readonly
		}
		fields = append(fields, replyField{output: output, path: fmt.Sprintf("%s.content.%d.%s", prefix, k, key), text: content.Get(key).Str, present: true})
	}
	return fields
}

// ready reports an event whose text the instances read, or, for an event
// without text, whose earlier text they all released.
func (w *replyWriter) ready(event *replyEvent) bool {
	for _, field := range event.fields {
		if field.output.fed < field.upTo {
			return false
		}
	}
	for output, received := range event.after {
		if received == 0 {
			continue
		}
		if output.fed < received || slices.ContainsFunc(output.held, func(held string) bool { return held != "" }) {
			return false
		}
	}
	return true
}

// drain writes the ready events in order; all writes every event.
func (w *replyWriter) drain(all bool) {
	for len(w.queue) > 0 && !w.stopped {
		event := w.queue[0]
		if !all && !w.ready(event) {
			return
		}
		w.queue = w.queue[1:]
		w.emit(event)
	}
}

// emit writes one event with the released text in its text fields. Before an
// event without text, released text that no event carried goes out in a
// delta event of its own.
func (w *replyWriter) emit(event *replyEvent) {
	if len(event.fields) == 0 {
		w.releaseOut()
	}
	data := event.data
	if len(event.fields) > 0 {
		data = fillFields(slices.Clone(data), event.fields)
	}
	for _, field := range event.full {
		if released := field.output.released.String(); released != field.text {
			if next, err := sjson.SetBytes(data, field.path, released); err == nil {
				data = next
			}
		}
	}
	if bytes.Equal(data, event.data) {
		w.out(event.raw)
		return
	}
	if w.socket != nil {
		w.out(data)
		return
	}
	var block strings.Builder
	for _, line := range event.lines {
		if line == "" {
			block.WriteString("data: ")
			block.Write(data)
		} else {
			block.WriteString(line)
		}
		block.WriteByte('\n')
	}
	block.WriteByte('\n')
	w.out([]byte(block.String()))
}

// releaseOut writes the released text that no event carried in delta events
// of its own.
func (w *replyWriter) releaseOut() {
	for _, index := range w.check.order {
		output := w.check.outputs[index]
		if output.out == "" {
			continue
		}
		if output.deltas {
			w.out(w.deltaEvent(output, output.out))
		}
		output.released.WriteString(output.out)
		output.out = ""
	}
}

// deltaEvent is a delta event in the client's format that carries text of
// output.
func (w *replyWriter) deltaEvent(output *replyOutput, text string) []byte {
	var name string
	var data any
	switch w.format {
	case types.RelayFormatOpenAI:
		data = gin.H{"id": w.chunk.Get("id").Value(), "object": "chat.completion.chunk", "created": w.chunk.Get("created").Value(), "model": w.chunk.Get("model").Value(),
			"choices": []gin.H{{"index": output.index, "delta": gin.H{"content": text}, "finish_reason": nil}}}
	case types.RelayFormatOpenAIResponses:
		name = "response.output_text.delta"
		data = gin.H{"type": name, "item_id": output.itemID, "output_index": output.outputIndex, "content_index": output.contentIndex, "delta": text}
	case types.RelayFormatOpenAIRealtime:
		data = gin.H{"type": cmp.Or(output.deltaName, "response.output_text.delta"), "event_id": "event_" + common.GetUUID(), "response_id": output.responseID,
			"item_id": output.itemID, "output_index": output.outputIndex, "content_index": output.contentIndex, "delta": text}
	case types.RelayFormatClaude:
		name = "content_block_delta"
		data = gin.H{"type": name, "index": output.index, "delta": gin.H{"type": "text_delta", "text": text}}
	default:
		data = gin.H{"candidates": []gin.H{{"index": output.index, "content": gin.H{"role": "model", "parts": []gin.H{{"text": text}}}}}}
	}
	encoded, _ := common.Marshal(data)
	if w.socket != nil {
		return encoded
	}
	if name != "" {
		return []byte("event: " + name + "\ndata: " + string(encoded) + "\n\n")
	}
	return []byte("data: " + string(encoded) + "\n\n")
}

// stopStream ends a stopped stream: an error event in the client's format, as
// mid-stream errors are written, and then nothing more. Canceling the request
// context makes the handler end and settle as for a client that went away
// right after the error. On a WebSocket the session does both.
func (w *replyWriter) stopStream() {
	w.stopped, w.queue, w.buffer = true, nil, nil
	if w.socket != nil {
		// The session ends the response and sends the error.
		w.sync()
		return
	}
	apiErr := w.stopError()
	encoded, _ := common.Marshal(replyErrorBody(w.c, w.format, apiErr))
	if w.format == types.RelayFormatClaude {
		_, _ = w.ResponseWriter.Write([]byte("event: error\ndata: " + string(encoded) + "\n\n"))
	} else {
		_, _ = w.ResponseWriter.Write([]byte("data: " + string(encoded) + "\n\ndata: [DONE]\n\n"))
	}
	w.ResponseWriter.Flush()
	w.sync()
	w.cancel()
}

// sync puts the steps and the record of the reply checks after the attempt's
// other entries on info, where the consume or error log reads them.
func (w *replyWriter) sync() {
	if w.info == nil {
		return
	}
	if w.recordAt < 0 {
		w.recordAt, w.stepAt = len(w.info.RequestPluginRecord), len(w.info.RequestPluginSteps)
	}
	w.info.RequestPluginRecord = append(w.info.RequestPluginRecord[:min(w.recordAt, len(w.info.RequestPluginRecord))], w.check.record()...)
	w.info.RequestPluginSteps = append(w.info.RequestPluginSteps[:min(w.stepAt, len(w.info.RequestPluginSteps))], auditSteps(Outcome{Steps: w.check.steps()})...)
}

// endStream ends the outputs of a stream: the instances read the rest of the
// text, and every event waiting goes out.
func (w *replyWriter) endStream() {
	var batch []*replyOutput
	for _, index := range w.check.order {
		output := w.check.outputs[index]
		output.ended = true
		if !output.closed || output.pending != "" {
			batch = append(batch, output)
		}
	}
	if len(batch) > 0 && !w.check.run(batch) {
		w.stopStream()
		return
	}
	w.drain(true)
	if len(w.buffer) > 0 {
		w.out(w.buffer)
		w.buffer = nil
	}
	w.sync()
}

// finish ends the checks of the attempt: an answer still waiting is checked
// and written, a stream's outputs end and its events go out. After a stop the
// writer stays in place and drops what the handler writes.
func (w *replyWriter) finish() {
	w.mu.Lock()
	switch w.mode {
	case replyWhole:
		w.finishWhole()
	case replyStream:
		if !w.stopped {
			w.endStream()
		}
	case replyUndecided:
		if w.status != 0 {
			w.ResponseWriter.WriteHeader(w.status)
			w.status = 0
		}
	}
	stopped := w.stopped
	w.mode = replyPassing
	w.mu.Unlock()
	if stopped {
		return
	}
	// A writer the handler put on top, such as the event stream's, stays;
	// this one then passes everything on.
	if w.c.Writer == gin.ResponseWriter(w) {
		w.c.Writer = w.ResponseWriter
	}
	w.c.Request = w.c.Request.WithContext(w.parent)
	w.cancel()
}
