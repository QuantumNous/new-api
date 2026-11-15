package requestplugin

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"math/rand/v2"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"golang.org/x/image/webp"
)

// stagePlugin runs every stage as its instance config says: throw, allocate
// without bound, reject at a stage, return the effects listed for the stage,
// or echo what it saw.
const stagePlugin = `export const meta = {apiVersion: 1, key: "rp-stages", name: "Stages", version: "1.2.3", author: {name: "Test"}};
function run(ctx, req) {
  const c = ctx.config;
  if (c.throw === ctx.stage) throw new Error("secret plugin detail");
  if (c.alloc === ctx.stage) { const kept = []; for (;;) kept.push([c]); }
  if (c.reject === ctx.stage) return {action: "reject", code: "blocked.test", message: "Blocked here"};
  let effects = (c.effects && c.effects[ctx.stage]) || [];
  if (c.echo === ctx.stage) {
    effects = effects.concat([{type: "json.patch", ops: [{op: "add", path: "/echo_" + ctx.instance.id, value: {
      format: ctx.format, channel: ctx.channel || null, upstreamModel: ctx.upstreamModel || null,
      headers: req.headers || null, media: req.media || null}}]}]);
  }
  const result = {action: "continue", effects, findings: [{rule: "r1", category: "test", count: 2}]};
  if (c.notice) result.notice = c.notice;
  return result;
}
export function ingress(ctx, req) { return run(ctx, req); }
export function request(ctx, req) { return run(ctx, req); }
export function outbound(ctx, req) { return run(ctx, req); }
export function egress(ctx, req) { return run(ctx, req); }`

// optionalPlugin is stagePlugin declaring meta.optional: a request skips its
// failing instances.
var optionalPlugin = strings.Replace(stagePlugin, `key: "rp-stages", name: "Stages",`, `key: "rp-optional", name: "Optional", optional: true,`, 1)

// egressPlugin exports egress alone.
const egressPlugin = `export const meta = {apiVersion: 1, key: "rp-egress", name: "Egress", version: "1.0.0", author: {name: "Test"}};
export function egress() { return {action: "continue"}; }`

func setupPlugins(t *testing.T, instances string) {
	t.Helper()
	require.NoError(t, i18n.Init())
	for _, source := range []string{stagePlugin, optionalPlugin, egressPlugin} {
		plugin, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key) })
	}
	setInstances(t, instances)
}

func setInstances(t *testing.T, instances string) {
	t.Helper()
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: instances}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: "[]"}))
	})
}

func newContext(body, group string) *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("group", group)
	return c
}

func newInfo(bound ...string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: "gpt",
		RelayFormat:     types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 7, ChannelType: 1, UpstreamModelName: "gpt-up",
			ChannelSetting: dto.ChannelSettings{RequestPlugins: bound},
		},
	}
}

func stepOf(t *testing.T, steps []relaycommon.RequestPluginStep, instance, stage string) relaycommon.RequestPluginStep {
	t.Helper()
	for _, step := range steps {
		if step.Instance == instance && step.Stage == stage {
			return step
		}
	}
	t.Fatalf("no %s step of %s", stage, instance)
	return relaycommon.RequestPluginStep{}
}

func TestPlanScopeOrder(t *testing.T) {
	setupPlugins(t, `[
		{"id":"bound","name":"Bound","plugin":"rp-stages","enabled":true},
		{"id":"group","name":"Group","plugin":"rp-stages","enabled":true,"groups":["vip"]},
		{"id":"off","name":"Off","plugin":"rp-stages","enabled":false,"global":true},
		{"id":"global","name":"Global","plugin":"rp-stages","enabled":true,"global":true,"groups":["vip"]},
		{"id":"egress","name":"Egress","plugin":"rp-egress","enabled":true,"global":true},
		{"id":"gone","name":"Gone","plugin":"rp-missing","enabled":true,"global":true}
	]`)
	plan := NewPlan()
	require.NotNil(t, plan)
	ids := func(stage, group string, bound []string) []string {
		var scoped []string
		for _, instance := range plan.scope(stage, group, "gpt-4o", bound) {
			scoped = append(scoped, instance.ID)
		}
		return scoped
	}

	// Global, then group, then bound; each once; disabled ones never; a
	// plugin without the hook skips the stage; a missing plugin never runs.
	assert.Equal(t, []string{"global", "group", "bound"}, ids(StageOutbound, "vip", []string{"bound", "global", "unknown", "gone", "bound"}))
	assert.Equal(t, []string{"global", "egress", "group"}, ids(StageEgress, "vip", nil))
	assert.Equal(t, []string{"global"}, ids(StageIngress, "default", nil))
}

func TestOutboundEffectsAndAudit(t *testing.T) {
	setupPlugins(t, `[
		{"id":"patch","name":"Patch","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"outbound":[
			{"type":"json.patch","ops":[{"op":"add","path":"/store","value":false}]},
			{"type":"header.patch","set":{"X-Vendor":"one"},"remove":["X-Client-Hint"]}]}}},
		{"id":"seen","name":"Seen","plugin":"rp-stages","enabled":true,"config":{"echo":"outbound"}}
	]`)
	c := newContext(`{}`, "default")
	_, _, apiErr := Ingress(c, types.RelayFormatOpenAI)
	require.Nil(t, apiErr)
	info := newInfo("seen")

	body, apiErr := Outbound(c, info, []byte(`{"model":"gpt-up","messages":[]}`))
	require.Nil(t, apiErr)
	assert.False(t, gjson.GetBytes(body, "store").Bool())
	assert.True(t, gjson.GetBytes(body, "store").Exists())
	// A later instance sees the headers an earlier one queued, and the
	// attempt's channel.
	assert.JSONEq(t, `{"format":"openai","channel":{"id":7,"type":1},"upstreamModel":"gpt-up","headers":{"X-Vendor":"one"},"media":null}`, gjson.GetBytes(body, "echo_seen").Raw)
	require.Len(t, info.RequestPluginHeaders, 1)
	assert.Equal(t, map[string]string{"X-Vendor": "one"}, info.RequestPluginHeaders[0].Set)

	// The bound instance ran its ingress hook late; the global one ran at
	// ingress, before the attempt. Egress waits for the param override.
	assert.Len(t, info.RequestPluginSteps, 3)
	stepOf(t, info.RequestPluginSteps, "seen", StageIngress)
	step := stepOf(t, info.RequestPluginSteps, "patch", StageOutbound)
	assert.Equal(t, relaycommon.RequestPluginStep{Instance: "patch", Name: "Patch", Plugin: "rp-stages", Version: "1.2.3", Stage: StageOutbound, Action: "continue", Effects: 2,
		Findings: []relaycommon.RequestPluginFinding{{Rule: "r1", Category: "test", Count: 2}}, DurationMS: step.DurationMS}, step)

	// Users see what changed, header names without values, and findings
	// without rule ids.
	record, err := common.Marshal(info.RequestPluginRecord)
	require.NoError(t, err)
	assert.JSONEq(t, `{"plugin":"rp-stages","name":{"en":"Stages"},"stage":"outbound",
		"changes":[{"op":"add","path":"store","value":false}],
		"headers":{"set":["x-vendor"],"remove":["x-client-hint"]},
		"findings":[{"category":"test","count":2}]}`, gjson.GetBytes(record, "#(stage==\"outbound\")").Raw)
	assert.NotContains(t, string(record), "one")
	assert.NotContains(t, string(record), "r1")
}

func TestStageGuardsAndFailures(t *testing.T) {
	tests := map[string]struct {
		stage  string
		config string
		class  string
	}{
		"ingress changes model":      {StageIngress, `{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"replace","path":"/model","value":"other"}]}]}}`, errorGuard},
		"ingress changes stream":     {StageIngress, `{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"add","path":"/stream","value":true}]}]}}`, errorGuard},
		"outbound changes billing":   {StageOutbound, `{"effects":{"outbound":[{"type":"json.patch","ops":[{"op":"add","path":"/n","value":4}]}]}}`, errorGuard},
		"egress returns an effect":   {StageEgress, `{"effects":{"egress":[{"type":"json.patch","ops":[{"op":"add","path":"/x","value":1}]}]}}`, errorInvalidEffect},
		"ingress returns a header":   {StageIngress, `{"effects":{"ingress":[{"type":"header.patch","set":{"X-A":"1"}}]}}`, errorInvalidEffect},
		"media placeholder in patch": {StageOutbound, `{"effects":{"outbound":[{"type":"json.patch","ops":[{"op":"add","path":"/x","value":"[media:0]"}]}]}}`, errorInvalidEffect},
		"hook throws":                {StageOutbound, `{"throw":"outbound"}`, jsplugin.TransformErrorThrow},
		"hook runs out of memory":    {StageOutbound, `{"alloc":"outbound"}`, jsplugin.TransformErrorMemory},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			setupPlugins(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":`+tc.config+`}]`)
			body := []byte(`{"model":"gpt","messages":[]}`)
			outcome := NewPlan().Run(context.Background(), Call{Stage: tc.stage, Body: body})
			require.NotNil(t, outcome.Failed)
			assert.Equal(t, tc.class, outcome.Failed.Class)
			assert.Equal(t, body, outcome.Body)
			require.Len(t, outcome.Steps, 1)
			assert.Equal(t, "fail", outcome.Steps[0].Action)
			assert.Equal(t, tc.class, outcome.Steps[0].Error)
		})
	}

	// An ingress json.patch may change a billing member other than model
	// and stream; a late ingress, on the upstream body, may not.
	setupPlugins(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"add","path":"/n","value":2}]}]}}}]`)
	plan := NewPlan()
	body := []byte(`{"model":"gpt"}`)
	outcome := plan.Run(context.Background(), Call{Stage: StageIngress, Bound: []string{"rp"}, Body: body})
	require.Nil(t, outcome.Failed)
	assert.JSONEq(t, `{"model":"gpt","n":2}`, string(outcome.Body))
	plan.ingressRan = map[string]bool{}
	outcome = plan.Run(context.Background(), Call{Stage: StageIngress, Late: true, Bound: []string{"rp"}, Body: body})
	require.NotNil(t, outcome.Failed)
	assert.Equal(t, errorGuard, outcome.Failed.Class)
}

func TestSettleAnswers(t *testing.T) {
	t.Run("egress reject", func(t *testing.T) {
		setupPlugins(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":{"reject":"egress"}}]`)
		c := newContext(`{}`, "default")
		c.Set(planContextKey, NewPlan())
		info := newInfo()
		apiErr := Egress(c, info, []byte(`{"model":"gpt-up"}`))
		require.NotNil(t, apiErr)
		assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
		assert.Equal(t, types.ErrorCodeRequestRejected, apiErr.GetErrorCode())
		assert.True(t, types.IsSkipRetryError(apiErr))
		assert.Equal(t, "Blocked here (code: blocked.test)", apiErr.Error())
		require.NotEmpty(t, info.RequestPluginRecord)
		last := info.RequestPluginRecord[len(info.RequestPluginRecord)-1]
		assert.Equal(t, &relaycommon.RequestPluginRejected{Code: "blocked.test"}, last.Rejected)
		assert.Equal(t, StageEgress, last.Stage)
	})
	t.Run("failure hides plugin text", func(t *testing.T) {
		// A saved list from before plugins decided failures still loads; its
		// required member changes nothing.
		setupPlugins(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"required":false,"global":true,"config":{"throw":"outbound"}}]`)
		c := newContext(`{}`, "default")
		c.Set(planContextKey, NewPlan())
		info := newInfo()
		_, apiErr := Outbound(c, info, []byte(`{"model":"gpt-up"}`))
		require.NotNil(t, apiErr)
		assert.Equal(t, http.StatusInternalServerError, apiErr.StatusCode)
		assert.Equal(t, types.ErrorCodeRequestPluginFailed, apiErr.GetErrorCode())
		assert.True(t, types.IsSkipRetryError(apiErr))
		assert.Equal(t, i18n.T(c, i18n.MsgRelayRequestPluginFailed), apiErr.Error())
		assert.NotContains(t, apiErr.Error(), "secret")
		last := info.RequestPluginRecord[len(info.RequestPluginRecord)-1]
		assert.Equal(t, relaycommon.RequestPluginRecord{Plugin: "rp-stages", Name: map[string]string{"en": "Stages"}, Stage: StageOutbound,
			Rejected: &relaycommon.RequestPluginRejected{Code: "request_plugin_failed"}}, last)
	})
	t.Run("optional plugin failure is dropped and the chain continues", func(t *testing.T) {
		setupPlugins(t, `[
			{"id":"bad","name":"Bad","plugin":"rp-optional","enabled":true,"required":true,"global":true,"config":{"effects":{"outbound":[{"type":"json.patch","ops":[{"op":"add","path":"/n","value":3}]}]}}},
			{"id":"good","name":"Good","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"outbound":[{"type":"json.patch","ops":[{"op":"add","path":"/user","value":"u"}]}]}}}
		]`)
		c := newContext(`{}`, "default")
		c.Set(planContextKey, NewPlan())
		info := newInfo()
		body, apiErr := Outbound(c, info, []byte(`{"model":"gpt-up"}`))
		require.Nil(t, apiErr)
		assert.JSONEq(t, `{"model":"gpt-up","user":"u"}`, string(body))
		failed := stepOf(t, info.RequestPluginSteps, "bad", StageOutbound)
		assert.Equal(t, "fail", failed.Action)
		assert.Equal(t, errorGuard, failed.Error)
		assert.Equal(t, "continue", stepOf(t, info.RequestPluginSteps, "good", StageOutbound).Action)
		// Users see no entry of the skipped instance.
		for _, entry := range info.RequestPluginRecord {
			assert.False(t, entry.Plugin == "rp-optional" && entry.Stage == StageOutbound)
		}
	})
	t.Run("pass-through leaves outbound unchecked", func(t *testing.T) {
		setupPlugins(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":{"throw":"egress"}},
			{"id":"late","name":"Late","plugin":"rp-stages","enabled":true}]`)
		c := newContext(`{"model":"gpt"}`, "default")
		_, _, apiErr := Ingress(c, types.RelayFormatOpenAI)
		require.Nil(t, apiErr)
		storage, err := common.GetBodyStorage(c)
		require.NoError(t, err)
		info := newInfo("late")
		apiErr = PassThrough(c, info, storage)
		// Egress reads the stored body, so its failure still stops the
		// request; the stages that cannot read it do not run.
		require.NotNil(t, apiErr)
		assert.Equal(t, types.ErrorCodeRequestPluginFailed, apiErr.GetErrorCode())
		assert.Equal(t, "unchecked", stepOf(t, info.RequestPluginSteps, "late", StageIngress).Action)
		assert.Equal(t, "unchecked", stepOf(t, info.RequestPluginSteps, "rp", StageOutbound).Action)
		assert.Equal(t, "fail", stepOf(t, info.RequestPluginSteps, "rp", StageEgress).Action)
		name := map[string]string{"en": "Stages"}
		assert.Equal(t, []relaycommon.RequestPluginRecord{
			{Plugin: "rp-stages", Name: name, Stage: StageIngress, Unchecked: true},
			{Plugin: "rp-stages", Name: name, Stage: StageOutbound, Unchecked: true},
			{Plugin: "rp-stages", Name: name, Stage: StageOutbound, Unchecked: true},
			{Plugin: "rp-stages", Name: name, Stage: StageEgress, Rejected: &relaycommon.RequestPluginRejected{Code: "request_plugin_failed"}},
		}, info.RequestPluginRecord)
	})
}

// A body the stage cannot read and an instance whose plugin is gone stop
// nothing: the first is recorded as unchecked, the second does not run.
func TestUnreadableBodyAndMissingPlugin(t *testing.T) {
	setupPlugins(t, `[
		{"id":"gone","name":"Gone","plugin":"rp-missing","enabled":true,"global":true},
		{"id":"egress","name":"Egress","plugin":"rp-egress","enabled":true,"global":true},
		{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":{"throw":"ingress"}}
	]`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", strings.NewReader("--x\r\n"))
	c.Request.Header.Set("Content-Type", "multipart/form-data; boundary=x")
	c.Set("group", "default")

	steps, record, apiErr := Ingress(c, types.RelayFormatOpenAIImage)
	require.Nil(t, apiErr)
	require.Len(t, steps, 1)
	assert.Equal(t, relaycommon.RequestPluginStep{Instance: "rp", Name: "Rp", Plugin: "rp-stages", Version: "1.2.3", Stage: StageIngress, Action: "unchecked"}, steps[0])
	assert.Equal(t, []relaycommon.RequestPluginRecord{{Plugin: "rp-stages", Name: map[string]string{"en": "Stages"}, Stage: StageIngress, Unchecked: true}}, record)
	encoded, err := common.Marshal(record)
	require.NoError(t, err)
	assert.JSONEq(t, `[{"plugin":"rp-stages","name":{"en":"Stages"},"stage":"ingress","unchecked":true}]`, string(encoded))

	// A multipart upstream body: outbound is unchecked, egress cannot read it
	// either, and the instance that ran at ingress does not run late.
	info := newInfo()
	info.SetRequestPluginIngress(steps, record)
	require.Nil(t, PassThrough(c, info, nil))
	var stages []string
	for _, step := range info.RequestPluginSteps {
		assert.Equal(t, "unchecked", step.Action)
		assert.NotEqual(t, "gone", step.Instance)
		stages = append(stages, step.Instance+":"+step.Stage)
	}
	assert.Equal(t, []string{"rp:ingress", "rp:outbound", "egress:egress", "rp:egress"}, stages)

	// A plan whose only enabled instance has no plugin is no plan.
	setInstances(t, `[{"id":"gone","name":"Gone","plugin":"rp-missing","enabled":true,"global":true}]`)
	assert.Nil(t, NewPlan())
}

func TestEmptyConfigurationChangesNothing(t *testing.T) {
	setupPlugins(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":false,"global":true,"config":{"throw":"ingress"}}]`)
	assert.Nil(t, NewPlan())

	body := `{"model":"gpt", "messages" : [ ]}`
	c := newContext(body, "default")
	steps, _, apiErr := Ingress(c, types.RelayFormatOpenAI)
	require.Nil(t, apiErr)
	assert.Nil(t, steps)
	_, planned := c.Get(planContextKey)
	assert.False(t, planned)

	info := newInfo("rp")
	sent := []byte(body)
	out, apiErr := Outbound(c, info, sent)
	require.Nil(t, apiErr)
	assert.Same(t, &sent[0], &out[0])
	assert.Nil(t, Egress(c, info, out))
	assert.Nil(t, info.RequestPluginSteps)
	assert.Nil(t, info.RequestPluginHeaders)
}

func TestIngressWritesBackTheBody(t *testing.T) {
	setupPlugins(t, `[
		{"id":"redact","name":"Redact","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"replace","path":"/messages/0/content","value":"[redacted]"}]}]}}},
		{"id":"late","name":"Late","plugin":"rp-stages","enabled":true,"config":{"echo":"ingress"}}
	]`)
	c := newContext(`{"model":"gpt","messages":[{"role":"user","content":"mail me at a@b.c"}]}`, "default")
	steps, _, apiErr := Ingress(c, types.RelayFormatOpenAI)
	require.Nil(t, apiErr)
	require.Len(t, steps, 1)
	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	stored, err := storage.Bytes()
	require.NoError(t, err)
	assert.JSONEq(t, `{"model":"gpt","messages":[{"role":"user","content":"[redacted]"}]}`, string(stored))

	// The bound instance's ingress hook runs late, on the upstream body of
	// the attempt; the global one, which ran at ingress, does not run again.
	info := newInfo("late")
	info.FinalRequestRelayFormat = types.RelayFormatClaude
	body, apiErr := Outbound(c, info, []byte(`{"model":"gpt-up","messages":[]}`))
	require.Nil(t, apiErr)
	assert.JSONEq(t, `{"format":"claude","channel":{"id":7,"type":1},"upstreamModel":"gpt-up","headers":null,"media":null}`, gjson.GetBytes(body, "echo_late").Raw)
	assert.Equal(t, StageIngress, info.RequestPluginRecord[0].Stage)
	assert.Equal(t, "echo_late", info.RequestPluginRecord[0].Changes[0].Path)
	assert.Equal(t, "late", info.RequestPluginSteps[0].Instance)
	assert.Equal(t, StageIngress, info.RequestPluginSteps[0].Stage)
	for _, step := range info.RequestPluginSteps[1:] {
		assert.NotEqual(t, StageIngress, step.Stage)
	}
}

func TestPatchOverTheBodyLimit(t *testing.T) {
	limit := constant.MaxRequestBodyMB
	constant.MaxRequestBodyMB = 1
	t.Cleanup(func() { constant.MaxRequestBodyMB = limit })
	padding := strings.Repeat("a", 1<<20)
	setupPlugins(t, `[{"id":"grow","name":"Grow","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"add","path":"/padding","value":"`+padding+`"}]}]}}}]`)
	c := newContext(`{"model":"gpt","messages":[]}`, "default")
	_, _, apiErr := Ingress(c, types.RelayFormatOpenAI)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusRequestEntityTooLarge, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeReadRequestBodyFailed, apiErr.GetErrorCode())

	// An outbound patch that grows the upstream body past the limit is
	// refused the same way and is not retried on another channel.
	setupPlugins(t, `[{"id":"grow","name":"Grow","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"outbound":[{"type":"json.patch","ops":[{"op":"add","path":"/padding","value":"`+padding+`"}]}]}}}]`)
	c = newContext(`{"model":"gpt","messages":[]}`, "default")
	_, _, apiErr = Ingress(c, types.RelayFormatOpenAI)
	require.Nil(t, apiErr)
	_, apiErr = Outbound(c, newInfo(), []byte(`{"model":"gpt-up","messages":[]}`))
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusRequestEntityTooLarge, apiErr.StatusCode)
	assert.True(t, types.IsSkipRetryError(apiErr))

	// Copies of the root double the body: the patch stops at the limit
	// instead of building the body, with the same answer.
	copies := make([]string, 40)
	for index := range copies {
		copies[index] = `{"op":"copy","from":"","path":"/k` + strconv.Itoa(index) + `"}`
	}
	setupPlugins(t, `[{"id":"grow","name":"Grow","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[`+strings.Join(copies, ",")+`]}]}}}]`)
	steps, _, apiErr := Ingress(newContext(`{"model":"gpt","messages":[]}`, "default"), types.RelayFormatOpenAI)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusRequestEntityTooLarge, apiErr.StatusCode)
	assert.True(t, types.IsSkipRetryError(apiErr))
	assert.Equal(t, "fail", stepOf(t, steps, "grow", StageIngress).Action)
}

func TestMediaReencode(t *testing.T) {
	noise := image.NewRGBA(image.Rect(0, 0, 256, 256))
	random := rand.New(rand.NewPCG(1, 2))
	for i := range noise.Pix {
		noise.Pix[i] = uint8(random.IntN(256))
	}
	for i := 3; i < len(noise.Pix); i += 4 {
		noise.Pix[i] = 255
	}
	tiny := image.NewRGBA(image.Rect(0, 0, 1, 1))
	tiny.Set(0, 0, color.RGBA{R: 9, A: 255})
	encode := func(img image.Image) string {
		var buffer bytes.Buffer
		require.NoError(t, png.Encode(&buffer, img))
		return base64.StdEncoding.EncodeToString(buffer.Bytes())
	}
	large, small := encode(noise), encode(tiny)
	body := `{"model":"gpt-up","messages":[{"role":"user","content":[
		{"type":"image_url","image_url":{"url":"data:image/png;base64,` + large + `"}},
		{"type":"image","source":{"type":"base64","media_type":"image/png","data":"` + large + `"}},
		{"type":"image_url","image_url":{"url":"data:image/png;base64,` + small + `"}}]}]}`
	setupPlugins(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":{"echo":"outbound","effects":{"outbound":[
		{"type":"media.reencode","media":0,"format":"auto","maxSide":128},
		{"type":"media.reencode","media":1,"format":"jpeg","quality":60},
		{"type":"media.reencode","media":2,"format":"jpeg"}]}}}]`)

	outcome := NewPlan().Run(context.Background(), Call{Stage: StageOutbound, Body: []byte(body)})
	require.Nil(t, outcome.Failed)
	content := gjson.GetBytes(outcome.Body, "messages.0.content")
	url := content.Get("0.image_url.url").Str
	require.True(t, strings.HasPrefix(url, "data:image/jpeg;base64,"))
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(url, "data:image/jpeg;base64,"))
	require.NoError(t, err)
	config, format, err := image.DecodeConfig(bytes.NewReader(decoded))
	require.NoError(t, err)
	assert.Equal(t, "jpeg", format)
	assert.Equal(t, 128, config.Width)
	assert.Equal(t, "image/jpeg", content.Get("1.source.media_type").Str)
	assert.Less(t, len(content.Get("1.source.data").Str), len(large))
	// A re-encode that is not smaller keeps the image.
	assert.Equal(t, "data:image/png;base64,"+small, content.Get("2.image_url.url").Str)
	// The hook saw placeholders, sizes and, at outbound, dimensions.
	assert.JSONEq(t, `[
		{"index":0,"path":"/messages/0/content/0/image_url/url","mimeType":"image/png","bytes":`+strconv.Itoa(len(large)*3/4-strings.Count(large[len(large)-2:], "="))+`,"width":256,"height":256},
		{"index":1,"path":"/messages/0/content/1/source/data","mimeType":"image/png","bytes":`+strconv.Itoa(len(large)*3/4-strings.Count(large[len(large)-2:], "="))+`,"width":256,"height":256},
		{"index":2,"path":"/messages/0/content/2/image_url/url","mimeType":"image/png","bytes":`+strconv.Itoa(len(small)*3/4-strings.Count(small[len(small)-2:], "="))+`,"width":1,"height":1}]`,
		gjson.GetBytes(outcome.Body, "echo_rp.media").Raw)
}

func TestDryRun(t *testing.T) {
	setupPlugins(t, `[
		{"id":"global","name":"Global","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{
			"request":[{"type":"reasoning.set","effort":"high"}],
			"outbound":[{"type":"header.patch","set":{"x-vendor":"one"}}]}}},
		{"id":"bound","name":"Bound","plugin":"rp-optional","enabled":true,"config":{"throw":"egress"}}
	]`)
	result := DryRun(context.Background(), DryRunInput{Format: "openai", Model: "gpt", Group: "default", Channel: &jsplugin.TransformChannel{ID: 1, Type: 1}, Bound: []string{"bound"}, Body: []byte(`{"model":"gpt"}`)})
	assert.Nil(t, result.Rejected)
	assert.Nil(t, result.Failed)
	assert.Equal(t, "high", result.ReasoningEffort)
	assert.Equal(t, map[string]string{"X-Vendor": "one"}, result.Headers.Set)
	// The record users would see is part of the result.
	require.Len(t, result.Record, 7)
	assert.Equal(t, StageRequest, result.Record[1].Stage)
	assert.Equal(t, "high", result.Record[1].ReasoningEffort)
	encoded, err := common.Marshal(result)
	require.NoError(t, err)
	// The administrator sees the thrown text of an optional plugin's failure.
	steps := gjson.GetBytes(encoded, "steps").Array()
	last := steps[len(steps)-1]
	assert.Equal(t, "bound", last.Get("instance").Str)
	assert.Equal(t, "Bound", last.Get("name").Str)
	assert.Contains(t, last.Get("error").Str, "secret plugin detail")

	// An editor's unsaved instance runs alone, whatever its scope.
	result = DryRun(context.Background(), DryRunInput{Format: "openai", Model: "gpt", Body: []byte(`{"model":"gpt"}`), Instance: &request_plugin_setting.Instance{
		ID: "try", Name: "Try", Plugin: "rp-stages", Groups: []string{"vip"},
		Config: json.RawMessage(`{"effects":{"request":[{"type":"reasoning.set","effort":"low"}]}}`),
	}})
	assert.Nil(t, result.Failed)
	assert.Equal(t, "low", result.ReasoningEffort)
	assert.Empty(t, result.Headers.Set)
	for _, step := range result.Steps {
		assert.Equal(t, "try", step.Instance)
	}
}

func TestParamOverrideReply(t *testing.T) {
	tctx := jsplugin.TransformContext{Stage: StageOutbound, Model: "gpt"}
	reply, err := ParamOverride(tctx, []byte(`{"model":"gpt"}`), []byte(`{"operations":[{"mode":"set_header","path":"X-A","value":"1"},{"path":"user","mode":"set","value":"u"}]}`))
	require.NoError(t, err)
	assert.JSONEq(t, `{"body":{"model":"gpt","user":"u"},"headers":{"set":{"x-a":"1"}}}`, string(reply))

	reply, err = ParamOverride(tctx, []byte(`{}`), []byte(`{"operations":[{"mode":"return_error","value":{"message":"Not here","code":"Bad Code!"}}]}`))
	require.NoError(t, err)
	assert.JSONEq(t, `{"reject":{"code":"param_override","message":"Not here"}}`, string(reply))

	// The channel's header override stays out of the plugin's reach: a value
	// an administrator set cannot be read into the body.
	cacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = cacheEnabled })
	model.CacheUpdateChannel(&model.Channel{Id: 990601, HeaderOverride: common.GetPointer(`{"X-Secret":"s3cret"}`)})
	tctx.Channel = &jsplugin.TransformChannel{ID: 990601, Type: 1}
	reply, err = ParamOverride(tctx, []byte(`{"model":"gpt"}`), []byte(`{"operations":[{"mode":"sync_fields","from":"header:x-secret","to":"json:leak"}]}`))
	require.NoError(t, err)
	assert.JSONEq(t, `{"body":{"model":"gpt"}}`, string(reply))
}

func TestPublicRecord(t *testing.T) {
	long := strings.Repeat("x", 100)
	setupPlugins(t, `[{"id":"rp","name":"Hidden name","plugin":"rp-stages","enabled":true,"global":true,"config":{
		"notice":{"en":"Personal data was hidden","zh":"已隐藏个人信息"},
		"effects":{"ingress":[{"type":"json.patch","ops":[
			{"op":"replace","path":"/messages/1/content","value":"`+long+`"},
			{"op":"add","path":"/temperature","value":0.5},
			{"op":"remove","path":"/metadata"},
			{"op":"move","from":"/a/b","path":"/c"},
			{"op":"test","path":"/model","value":"gpt"},
			{"op":"add","path":"/tools","value":[{"x":1},{"y":2}]},
			{"op":"add","path":"/extra","value":{"p":1,"q":2,"r":3}},
			{"op":"add","path":"/messages/-","value":{"role":"user","content":"x"}},
			{"op":"replace","path":"/messages/0/content","value":"short text"}]}]}}}]`)
	body := []byte(`{"model":"gpt","messages":[{"role":"system","content":"s"},{"role":"user","content":"my mail is a@b.c"}],"metadata":{"k":"v"},"a":{"b":1}}`)

	outcome := NewPlan().Run(context.Background(), Call{Stage: StageIngress, Body: body})
	require.Nil(t, outcome.Failed)
	record, err := common.Marshal(outcome.Record)
	require.NoError(t, err)
	assert.JSONEq(t, `[{"plugin":"rp-stages","name":{"en":"Stages"},"stage":"ingress","changes":[
		{"op":"replace","path":"messages[1].content","type":"string","length":100},
		{"op":"add","path":"temperature","value":0.5},
		{"op":"remove","path":"metadata"},
		{"op":"move","from":"a.b","path":"c"},
		{"op":"add","path":"tools","type":"array","length":2},
		{"op":"add","path":"extra","type":"object","length":3},
		{"op":"add","path":"messages[-]","type":"object","length":2},
		{"op":"replace","path":"messages[0].content","value":"short text"}],
		"findings":[{"category":"test","count":2}],
		"notice":{"en":"Personal data was hidden","zh":"已隐藏个人信息"}}]`, string(record))
	// Old values and matched text never appear.
	assert.NotContains(t, string(record), "a@b.c")
	assert.NotContains(t, string(record), `"v"`)
}

func TestPublicRecordCaps(t *testing.T) {
	ops := make([]requestpatch.Operation, 25)
	for index := range ops {
		ops[index] = requestpatch.Operation{Op: "add", Path: "/k" + strconv.Itoa(index), Value: []byte("1")}
	}
	changes, more := describeChanges([]requestpatch.Effect{{Type: requestpatch.EffectJSONPatch, Ops: ops}}, []byte(`{}`), []byte(`{}`))
	assert.Len(t, changes, 20)
	assert.Equal(t, 5, more)
	assert.Len(t, []rune(dottedPath("/"+strings.Repeat("a", 300), []byte(`{}`))), 256)

	entries := make([]relaycommon.RequestPluginRecord, 40)
	for index := range entries {
		entries[index] = relaycommon.RequestPluginRecord{Plugin: "p", Stage: StageIngress, Findings: []relaycommon.RequestPluginCount{{Count: 1}}}
	}
	capped := relaycommon.CapRequestPluginRecord(entries)
	require.Len(t, capped, 33)
	assert.Equal(t, relaycommon.RequestPluginRecord{Truncated: 8}, capped[32])

	notice := map[string]string{"en": strings.Repeat("n", 200), "zh": strings.Repeat("字", 200)}
	for index := range entries {
		entries[index].Notice = notice
	}
	capped = relaycommon.CapRequestPluginRecord(entries)
	encoded, err := common.Marshal(capped)
	require.NoError(t, err)
	assert.LessOrEqual(t, len(encoded), 8<<10)
	assert.Equal(t, 40-(len(capped)-1), capped[len(capped)-1].Truncated)
}

func TestMediaReencodeLosslessWebP(t *testing.T) {
	source := image.NewNRGBA(image.Rect(0, 0, 192, 128))
	for y := range 128 {
		for x := range 192 {
			source.SetNRGBA(x, y, color.NRGBA{R: uint8(x), G: uint8(y * 2), B: uint8((x + y) % 7 * 30), A: 255})
		}
	}
	var buffer bytes.Buffer
	require.NoError(t, (&png.Encoder{CompressionLevel: png.NoCompression}).Encode(&buffer, source))
	original := buffer.Len()
	body := `{"model":"gpt-up","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"data:image/png;base64,` + base64.StdEncoding.EncodeToString(buffer.Bytes()) + `"}}]}]}`
	setupPlugins(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"outbound":[
		{"type":"media.reencode","media":0,"format":"webp"}]}}}]`)

	outcome := NewPlan().Run(context.Background(), Call{Stage: StageOutbound, Body: []byte(body)})
	require.Nil(t, outcome.Failed)
	url := gjson.GetBytes(outcome.Body, "messages.0.content.0.image_url.url").Str
	require.True(t, strings.HasPrefix(url, "data:image/webp;base64,"))
	encoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(url, "data:image/webp;base64,"))
	require.NoError(t, err)
	assert.Less(t, len(encoded), original)
	decoded, err := webp.Decode(bytes.NewReader(encoded))
	require.NoError(t, err)
	require.Equal(t, source.Bounds(), decoded.Bounds())
	for y := range 128 {
		for x := range 192 {
			require.Equal(t, source.NRGBAAt(x, y), color.NRGBAModel.Convert(decoded.At(x, y)), "pixel %d,%d", x, y)
		}
	}
	require.Len(t, outcome.Record, 1)
	assert.Equal(t, []relaycommon.RequestPluginMediaChange{{Index: 0,
		From: relaycommon.RequestPluginMediaForm{Mime: "image/png", Bytes: original},
		To:   relaycommon.RequestPluginMediaForm{Mime: "image/webp", Bytes: len(encoded)}, Lossless: true}}, outcome.Record[0].Media)
}

// netPlugin posts to its instance's service from ingress and report. The
// service is its url config value; target, a plain string, sends ingress
// elsewhere. report posts {ctx, record}, or a summary of a large record.
const netPlugin = `export const meta = {apiVersion: 1, key: "rp-net", name: "Net", version: "1.0.0", author: {name: "Test"},
  configSchema: {type: "object", properties: {
    url: {type: "string", title: "URL", format: "url"},
    target: {type: "string", title: "Target"},
    fail: {type: "boolean", title: "Fail"},
    summary: {type: "boolean", title: "Summary"},
  }}};
export function ingress(ctx, req) {
  const response = utils.fetch({url: ctx.config.target || ctx.config.url, method: "POST", body: JSON.stringify(req.body)});
  return {action: "continue", findings: [{rule: "status", count: response.status}]};
}
export function report(ctx, record) {
  if (ctx.config.fail) throw new Error("report failed for " + record.requestId);
  const response = record.response;
  const sent = ctx.config.summary
    ? {instance: ctx.instance.id, events: (response.events || []).length, hasBody: "body" in response, bytes: response.bytes, truncated: response.truncated}
    : {instance: ctx.instance.id, ctx, record};
  utils.fetch({url: ctx.config.url, method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(sent)});
}`

// serviceRequest is one request the instance's service received.
type serviceRequest struct {
	Method string
	Path   string
	Body   string
}

// newService starts the instance's service: /redirect answers 302, every
// other path 200. Each request it receives goes to the returned channel.
func newService(t *testing.T) (*httptest.Server, chan serviceRequest) {
	t.Helper()
	received := make(chan serviceRequest, 16)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		received <- serviceRequest{Method: r.Method, Path: r.URL.Path, Body: string(body)}
		if r.URL.Path == "/redirect" {
			http.Redirect(w, r, "/elsewhere", http.StatusFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(server.Close)
	return server, received
}

func registerNetPlugin(t *testing.T) {
	t.Helper()
	plugin, err := jsplugin.DefaultRegistry.Register(netPlugin, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key) })
}

func receive(t *testing.T, received chan serviceRequest) serviceRequest {
	t.Helper()
	select {
	case request := <-received:
		return request
	case <-time.After(10 * time.Second):
		t.Fatal("the service received nothing")
		return serviceRequest{}
	}
}

// Ingress may POST to the hosts of the instance's url config values and the
// plugin's allowedHosts only, and gets a redirect as it is.
func TestStageFetchTargets(t *testing.T) {
	server, received := newService(t)
	tests := map[string]struct {
		target string
		status int
		failed string
	}{
		"the url config value":      {status: http.StatusOK},
		"the same host, redirected": {target: server.URL + "/redirect", status: http.StatusFound},
		"another host":              {target: "https://not-allowed.example/x", failed: `plugin request host "not-allowed.example" is not allowed`},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			setupPlugins(t, `[]`)
			registerNetPlugin(t)
			config, err := common.Marshal(map[string]any{"url": server.URL + "/check", "target": tc.target})
			require.NoError(t, err)
			setInstances(t, `[{"id":"net","name":"Net","plugin":"rp-net","enabled":true,"global":true,"config":`+string(config)+`}]`)

			outcome := NewPlan().Run(context.Background(), Call{Stage: StageIngress, Body: []byte(`{"model":"gpt","input":"hello"}`)})
			if tc.failed != "" {
				require.NotNil(t, outcome.Failed)
				assert.Contains(t, outcome.Failed.Detail, tc.failed)
				assert.Empty(t, received)
				return
			}
			require.Nil(t, outcome.Failed)
			assert.Equal(t, []relaycommon.RequestPluginFinding{{Rule: "status", Count: tc.status}}, outcome.Steps[0].Findings)
			request := receive(t, received)
			assert.Equal(t, http.MethodPost, request.Method)
			assert.JSONEq(t, `{"model":"gpt","input":"hello"}`, request.Body)
			assert.Empty(t, received, "the redirect was not followed")
		})
	}
}

// reportContext is a finished request's context as the relay leaves it, and
// the recorder of what the client received.
func reportContext(t *testing.T, body string, started time.Time) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("group", "default")
	c.Set(common.RequestIdKey, "req-1")
	c.Set("id", 5)
	c.Set("username", "alice")
	c.Set("token_id", 9)
	c.Set("token_name", "ci")
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "gpt")
	common.SetContextKey(c, constant.ContextKeyRequestStartTime, started)
	return c, recorder
}

// A finished request reaches the report hooks of the channel's instances in
// plan order, after the response: a failing hook leaves the next one and the
// response alone.
func TestReportSuccess(t *testing.T) {
	server, received := newService(t)
	setupPlugins(t, `[]`)
	registerNetPlugin(t)
	setInstances(t, `[
		{"id":"patch","name":"Patch","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"add","path":"/patched","value":true}]}]}}},
		{"id":"bad","name":"Bad","plugin":"rp-net","enabled":true,"config":{"url":"`+server.URL+`/bad","fail":true}},
		{"id":"sink","name":"Sink","plugin":"rp-net","enabled":true,"config":{"url":"`+server.URL+`/report"}},
		{"id":"other","name":"Other channel","plugin":"rp-net","enabled":true,"config":{"url":"`+server.URL+`/other"}}
	]`)
	consumeLogs := common.LogConsumeEnabled
	common.LogConsumeEnabled = false
	t.Cleanup(func() { common.LogConsumeEnabled = consumeLogs })

	started := time.Now().Add(-time.Second)
	c, recorder := reportContext(t, `{"model":"gpt","messages":[{"role":"user","content":[{"type":"text","text":"hi"},{"type":"image_url","image_url":{"url":"data:image/png;base64,iVBORw0KGgo="}}]}]}`, started)
	steps, record, apiErr := Ingress(c, types.RelayFormatOpenAI)
	require.Nil(t, apiErr)
	info := newInfo("bad", "sink")
	info.SetRequestPluginIngress(steps, record)
	info.StartTime, info.FirstResponseTime = started, started.Add(120*time.Millisecond)

	other := model.NewLogOther()
	other.SetPublic("cache_tokens", 3)
	other.SetPublic("model_ratio", 1.5)
	model.RecordConsumeLog(c, 5, model.RecordConsumeLogParams{PromptTokens: 10, CompletionTokens: 4, Quota: 1500, Other: other})
	// The channel attempt brings the report instances: it starts the capture.
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{RequestPlugins: []string{"bad", "sink"}})
	Reply(c, types.RelayFormatOpenAI, info)()
	c.JSON(http.StatusOK, gin.H{"id": "chatcmpl-1", "object": "chat.completion"})
	Report(c, types.RelayFormatOpenAI, info, nil, nil)

	request := receive(t, received)
	assert.Equal(t, "/report", request.Path)
	assert.JSONEq(t, `{"id":"chatcmpl-1","object":"chat.completion"}`, recorder.Body.String())
	sent := gjson.Parse(request.Body)
	assert.JSONEq(t, `{"stage":"report","format":"openai","path":"/v1/chat/completions","model":"gpt","upstreamModel":"gpt-up","group":"default",
		"channel":{"id":7,"type":1},"attempt":0,"user":{"id":5,"username":"alice"},"token":{"id":9,"name":"ci"},
		"instance":{"id":"sink","name":"Sink"},"config":{"url":"`+server.URL+`/report"}}`, sent.Get("ctx").Raw)
	assert.JSONEq(t, `{
		"requestId":"req-1","user":{"id":5,"username":"alice"},"token":{"id":9,"name":"ci"},
		"startedAt":`+strconv.FormatInt(started.UnixMilli(), 10)+`,"durationMs":`+sent.Get("record.durationMs").Raw+`,"firstResponseMs":120,
		"request":{"body":{"model":"gpt","patched":true,"messages":[{"role":"user","content":[{"type":"text","text":"hi"},{"type":"image_url","image_url":{"url":"[media:0]"}}]}]},
			"media":[{"index":0,"path":"/messages/0/content/1/image_url/url","mimeType":"image/png","bytes":8}]},
		"response":{"status":200,"contentType":"application/json; charset=utf-8","stream":false,"body":{"id":"chatcmpl-1","object":"chat.completion"},
			"bytes":`+strconv.Itoa(recorder.Body.Len())+`,"truncated":false},
		"usage":{"promptTokens":10,"completionTokens":4,"cacheTokens":3},
		"cost":{"quota":1500,"usd":0.003},
		"requestPlugins":[{"plugin":"rp-stages","name":{"en":"Stages"},"stage":"ingress","changes":[{"op":"add","path":"patched","value":true}],"findings":[{"category":"test","count":2}]}]
	}`, sent.Get("record").Raw)
	assert.GreaterOrEqual(t, sent.Get("record.durationMs").Int(), int64(1000))
	assert.Empty(t, received)
}

// The record carries the error the client received, SSE events, and what a
// capture past 1 MiB keeps.
func TestReportResponses(t *testing.T) {
	event := func(size int) string { return "data: \"" + strings.Repeat("x", size) + "\"\n\n" }
	tests := map[string]struct {
		summary bool
		write   func(c *gin.Context)
		apiErr  *types.NewAPIError
		want    string
	}{
		"upstream error": {
			write: func(c *gin.Context) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": gin.H{"message": "upstream overloaded", "type": "server_error", "code": "overloaded"}})
			},
			apiErr: types.WithOpenAIError(types.OpenAIError{Message: "upstream overloaded", Type: "server_error", Code: "overloaded"}, http.StatusServiceUnavailable),
			want: `{"status":503,"contentType":"application/json; charset=utf-8","stream":false,"body":{"error":{"message":"upstream overloaded","type":"server_error","code":"overloaded"}},"bytes":BYTES,"truncated":false,
				"error":{"status":503,"code":"overloaded","type":"server_error","message":"upstream overloaded"},"cost":{"quota":0,"usd":0}}`,
		},
		"stream events": {
			write: func(c *gin.Context) {
				c.Writer.Header().Set("Content-Type", "text/event-stream")
				_, _ = c.Writer.WriteString("data: {\"a\":1}\n\n: PING\n\nevent: message\ndata: not json\n\ndata: [DONE]\n\n")
			},
			want: `{"status":200,"contentType":"text/event-stream","stream":true,"events":[{"data":{"a":1}},{"event":"message","data":"not json"}],"bytes":BYTES,"truncated":false,
				"cost":{"quota":0,"usd":0}}`,
		},
		"truncated stream keeps whole events": {
			summary: true,
			write: func(c *gin.Context) {
				c.Writer.Header().Set("Content-Type", "text/event-stream")
				for range 3 {
					_, _ = c.Writer.WriteString(event(400_000))
				}
			},
			want: `{"events":2,"hasBody":false,"bytes":1200030,"truncated":true}`,
		},
		"truncated body is left out": {
			summary: true,
			write: func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"text": strings.Repeat("y", 1_100_000)})
			},
			want: `{"events":0,"hasBody":false,"bytes":1100011,"truncated":true}`,
		},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			server, received := newService(t)
			setupPlugins(t, `[]`)
			registerNetPlugin(t)
			config, err := common.Marshal(map[string]any{"url": server.URL + "/report", "target": server.URL + "/ingress", "summary": tc.summary})
			require.NoError(t, err)
			setInstances(t, `[{"id":"sink","name":"Sink","plugin":"rp-net","enabled":true,"global":true,"config":`+string(config)+`}]`)
			started := time.Now()
			c, recorder := reportContext(t, `{"model":"gpt","input":"hello"}`, started)
			_, _, apiErr := Ingress(c, types.RelayFormatOpenAI)
			require.Nil(t, apiErr)
			info := newInfo()
			info.StartTime, info.FirstResponseTime = started, started.Add(-time.Second)
			tc.write(c)
			Report(c, types.RelayFormatOpenAI, info, nil, tc.apiErr)

			assert.Equal(t, "/ingress", receive(t, received).Path)
			sent := gjson.Parse(receive(t, received).Body)
			if tc.summary {
				assert.JSONEq(t, `{"instance":"sink",`+strings.TrimPrefix(tc.want, "{"), sent.Raw)
				return
			}
			record := sent.Get("record")
			assert.False(t, record.Get("usage").Exists(), "nothing was billed")
			assert.False(t, record.Get("firstResponseMs").Exists(), "nothing was sent")
			got := map[string]json.RawMessage{}
			record.Get("response").ForEach(func(key, value gjson.Result) bool {
				got[key.Str] = json.RawMessage(value.Raw)
				return true
			})
			for _, member := range []string{"error", "cost"} {
				if value := record.Get(member); value.Exists() {
					got[member] = json.RawMessage(value.Raw)
				}
			}
			encoded, err := common.Marshal(got)
			require.NoError(t, err)
			assert.JSONEq(t, strings.ReplaceAll(tc.want, "BYTES", strconv.Itoa(recorder.Body.Len())), string(encoded))
		})
	}
}

// A full queue drops a finished request instead of blocking the request.
func TestReportQueueDropsWhenFull(t *testing.T) {
	queue := newReportQueue(1, 100, 0)
	require.True(t, queue.admit(60))
	queue.push(&reportJob{size: 60})
	assert.False(t, queue.admit(1), "every record slot is taken")
	// A job admitted while another took the last slot is dropped too.
	queue.bytes.Add(5)
	queue.push(&reportJob{size: 5})
	assert.Len(t, queue.jobs, 1)
	assert.Equal(t, int64(60), queue.bytes.Load())

	bounded := newReportQueue(4, 100, 0)
	require.True(t, bounded.admit(60))
	assert.False(t, bounded.admit(41), "the bytes are taken")
	assert.True(t, bounded.admit(40))
}

// replyPlugin checks replies as its instance config says: throw, pass at
// once or on a word, stop on a word, mask words, hold text back in streams,
// or tell who and where it ran. Called with "later" after passing at once, it
// throws.
const replyPlugin = `export const meta = {apiVersion: 1, key: "rp-reply", name: "Reply", version: "1.0.0", author: {name: "Test"}};
export function reply(ctx, res) {
  const c = ctx.config;
  if (c.throw) throw new Error("secret reply detail");
  if (c.pass) {
    if (res.outputs.some((output) => output.text.includes("later"))) throw new Error("called after a pass");
    return {action: "pass"};
  }
  const result = {action: "continue", mask: [], hold: res.stream ? (c.hold || 0) : 0};
  for (const output of res.outputs) {
    if (c.passOn && output.text.includes(c.passOn)) return {action: "pass"};
    if (c.stop && output.text.includes(c.stop)) {
      const stop = {action: "stop", code: "reply.blocked"};
      if (c.message) stop.message = c.message;
      return stop;
    }
    for (const word of c.words || []) {
      for (let i = output.text.indexOf(word); i >= 0; i = output.text.indexOf(word, i + 1)) {
        result.mask.push({index: output.index, start: i, end: i + word.length, category: "word"});
      }
    }
  }
  if (c.who) result.notice = {en: [ctx.user.id, ctx.user.username, ctx.token ? ctx.token.name : "none", ctx.stage, ctx.format].join("/")};
  return result;
}`

// optionalReplyPlugin is replyPlugin declaring meta.optional.
var optionalReplyPlugin = strings.Replace(replyPlugin, `key: "rp-reply", name: "Reply",`, `key: "rp-reply-optional", name: "Optional reply", optional: true,`, 1)

func setupReplyPlugins(t *testing.T, instances string) {
	t.Helper()
	for _, source := range []string{replyPlugin, optionalReplyPlugin} {
		plugin, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key) })
	}
	setupPlugins(t, instances)
}

// replyContext is a relay request on path from user alice with token ci,
// past its ingress stage.
func replyContext(t *testing.T, path string, format types.RelayFormat) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("group", "default")
	c.Set("id", 5)
	c.Set("username", "alice")
	c.Set("token_id", 9)
	c.Set("token_name", "ci")
	c.Set(common.RequestIdKey, "req-1")
	_, _, apiErr := Ingress(c, format)
	require.Nil(t, apiErr)
	return c, recorder
}

func replyInfo(format types.RelayFormat, mode int) *relaycommon.RelayInfo {
	info := newInfo()
	info.RelayFormat, info.RelayMode = format, mode
	return info
}

// writeAnswer writes a non-stream JSON answer the way the handlers do: its
// length, the status, then the body in parts.
func writeAnswer(c *gin.Context, body string) {
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.Header().Set("Content-Length", strconv.Itoa(len(body)))
	c.Writer.WriteHeader(http.StatusOK)
	_, _ = c.Writer.Write([]byte(body[:10]))
	_, _ = c.Writer.Write([]byte(body[10:]))
}

func chatAnswer(content string) string {
	encoded, _ := common.Marshal(gin.H{"id": "chatcmpl-1", "object": "chat.completion",
		"choices": []gin.H{{"index": 0, "message": gin.H{"role": "assistant", "content": content}, "finish_reason": "stop"}}})
	return string(encoded)
}

func chatChunk(content string, finish string) string {
	choice := gin.H{"index": 0, "delta": gin.H{"content": content}}
	if finish != "" {
		choice = gin.H{"index": 0, "delta": gin.H{}, "finish_reason": finish}
	}
	encoded, _ := common.Marshal(gin.H{"id": "chatcmpl-1", "object": "chat.completion.chunk", "created": 1, "model": "gpt", "choices": []gin.H{choice}})
	return "data: " + string(encoded) + "\n\n"
}

// sseData returns the data of each event of a stream.
func sseData(body string) []string {
	var data []string
	for line := range strings.SplitSeq(body, "\n") {
		if value, ok := strings.CutPrefix(line, "data: "); ok {
			data = append(data, value)
		}
	}
	return data
}

// chatText joins the delta text of a Chat Completions stream.
func chatText(body string) string {
	var text strings.Builder
	for _, data := range sseData(body) {
		text.WriteString(gjson.Get(data, "choices.0.delta.content").Str)
	}
	return text.String()
}

func TestReplyLeavesThePathAloneWithoutReplyInstances(t *testing.T) {
	setupReplyPlugins(t, `[
		{"id":"stages","name":"Stages","plugin":"rp-stages","enabled":true,"global":true},
		{"id":"other","name":"Other","plugin":"rp-reply","enabled":true,"global":true,"models":["other-model"],"config":{"words":["a"]}},
		{"id":"off","name":"Off","plugin":"rp-reply","enabled":false,"global":true,"config":{"words":["a"]}}
	]`)
	for _, test := range []struct {
		name   string
		path   string
		format types.RelayFormat
		mode   int
	}{
		{"models do not match", "/v1/chat/completions", types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions},
		{"endpoint not covered", "/v1/embeddings", types.RelayFormatOpenAI, relayconstant.RelayModeEmbeddings},
		{"gemini count tokens", "/v1beta/models/gpt:countTokens", types.RelayFormatGemini, relayconstant.RelayModeGemini},
	} {
		t.Run(test.name, func(t *testing.T) {
			c, recorder := replyContext(t, test.path, test.format)
			writer, request := c.Writer, c.Request
			finish := Reply(c, test.format, replyInfo(test.format, test.mode))
			// No wrapper and no new request context: the response path is the
			// one of a request without reply checks.
			assert.True(t, c.Writer == writer)
			assert.True(t, c.Request == request)
			writeAnswer(c, chatAnswer("a b a"))
			finish()
			assert.True(t, c.Writer == writer)
			assert.Equal(t, chatAnswer("a b a"), recorder.Body.String())
		})
	}
}

func TestReplyMasksNonStreamAnswers(t *testing.T) {
	setupReplyPlugins(t, `[
		{"id":"first","name":"First","plugin":"rp-reply","enabled":true,"global":true,"models":["gpt"],"config":{"words":["alpha"]}},
		{"id":"second","name":"Second","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["beta"],"stop":"alpha","who":true}}
	]`)
	c, recorder := replyContext(t, "/v1/chat/completions", types.RelayFormatOpenAI)
	writer, parent := c.Writer, c.Request.Context()
	info := replyInfo(types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	finish := Reply(c, types.RelayFormatOpenAI, info)
	assert.False(t, c.Writer == writer)
	writeAnswer(c, chatAnswer("alpha and beta, alphabet"))
	finish()

	// The second instance reads what the first released: it never sees alpha.
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, chatAnswer("*** and ***, ***bet"), recorder.Body.String())
	assert.Equal(t, strconv.Itoa(recorder.Body.Len()), recorder.Header().Get("Content-Length"))
	assert.True(t, c.Writer == writer)
	assert.Equal(t, parent, c.Request.Context())

	require.Len(t, info.RequestPluginRecord, 2)
	assert.Equal(t, relaycommon.RequestPluginRecord{Plugin: "rp-reply", Name: map[string]string{"en": "Reply"}, Stage: StageReply, Masked: 2,
		Findings: []relaycommon.RequestPluginCount{{Category: "word", Count: 2}}}, info.RequestPluginRecord[0])
	assert.Equal(t, 1, info.RequestPluginRecord[1].Masked)
	assert.Equal(t, map[string]string{"en": "5/alice/ci/reply/openai"}, map[string]string(info.RequestPluginRecord[1].Notice))
	first := stepOf(t, info.RequestPluginSteps, "first", StageReply)
	assert.Equal(t, "continue", first.Action)
	assert.Equal(t, 2, first.Effects)
	assert.Equal(t, []relaycommon.RequestPluginFinding{{Rule: "word", Category: "word", Count: 2}}, first.Findings)
	assert.Len(t, info.RequestPluginSteps, 2)
}

func TestReplyStopsNonStreamAnswers(t *testing.T) {
	setupReplyPlugins(t, `[
		{"id":"policy","name":"Policy","plugin":"rp-reply","enabled":true,"global":true,"config":{"stop":"forbidden","message":"Not allowed"}},
		{"id":"plain","name":"Plain","plugin":"rp-reply","enabled":true,"global":true,"config":{"stop":"blocked"}}
	]`)
	for _, test := range []struct{ content, message, instance string }{
		{"a forbidden answer", "Not allowed (code: reply.blocked) (request id: req-1)", "policy"},
		{"a blocked answer", "Response stopped by policy (code: reply.blocked) (request id: req-1)", "plain"},
	} {
		c, recorder := replyContext(t, "/v1/chat/completions", types.RelayFormatOpenAI)
		info := replyInfo(types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
		finish := Reply(c, types.RelayFormatOpenAI, info)
		writeAnswer(c, chatAnswer(test.content))
		finish()

		assert.Equal(t, http.StatusBadRequest, recorder.Code)
		assert.Equal(t, "response_rejected", gjson.Get(recorder.Body.String(), "error.code").Str)
		assert.Equal(t, test.message, gjson.Get(recorder.Body.String(), "error.message").Str)
		assert.NotContains(t, recorder.Body.String(), test.content)
		assert.Equal(t, strconv.Itoa(recorder.Body.Len()), recorder.Header().Get("Content-Length"))
		assert.Equal(t, "stop", stepOf(t, info.RequestPluginSteps, test.instance, StageReply).Action)
		last := info.RequestPluginRecord[len(info.RequestPluginRecord)-1]
		assert.Equal(t, &relaycommon.RequestPluginRejected{Code: "reply.blocked"}, last.Rejected)
		// A stop leaves the handler a writer that drops what it still writes.
		_, _ = c.Writer.Write([]byte("late"))
		assert.NotContains(t, recorder.Body.String(), "late")
	}
}

func TestReplyFailures(t *testing.T) {
	setupReplyPlugins(t, `[
		{"id":"skip","name":"Skip","plugin":"rp-reply-optional","enabled":true,"global":true,"config":{"throw":true}},
		{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["beta"]}},
		{"id":"broken","name":"Broken","plugin":"rp-reply","enabled":true,"global":true,"models":["broken"],"config":{"throw":true}}
	]`)
	// An optional plugin's failure skips its instance; the text passes on.
	c, recorder := replyContext(t, "/v1/chat/completions", types.RelayFormatOpenAI)
	info := replyInfo(types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	finish := Reply(c, types.RelayFormatOpenAI, info)
	writeAnswer(c, chatAnswer("alpha beta"))
	finish()
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, chatAnswer("alpha ***"), recorder.Body.String())
	skipped := stepOf(t, info.RequestPluginSteps, "skip", StageReply)
	assert.Equal(t, "fail", skipped.Action)
	assert.Equal(t, jsplugin.TransformErrorThrow, skipped.Error)
	require.Len(t, info.RequestPluginRecord, 1)
	assert.Equal(t, 1, info.RequestPluginRecord[0].Masked)

	// Any other failure stops the answer.
	c, recorder = replyContext(t, "/v1/chat/completions", types.RelayFormatOpenAI)
	info = replyInfo(types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	info.OriginModelName = "broken"
	finish = Reply(c, types.RelayFormatOpenAI, info)
	writeAnswer(c, chatAnswer("alpha beta"))
	finish()
	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.Equal(t, "request_plugin_failed", gjson.Get(recorder.Body.String(), "error.code").Str)
	assert.NotContains(t, recorder.Body.String(), "secret reply detail")
	assert.Equal(t, "fail", stepOf(t, info.RequestPluginSteps, "broken", StageReply).Action)
	last := info.RequestPluginRecord[len(info.RequestPluginRecord)-1]
	assert.Equal(t, &relaycommon.RequestPluginRejected{Code: "request_plugin_failed"}, last.Rejected)
}

func TestReplyUnchecked(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["alpha"]}}]`)
	for _, test := range []struct {
		name      string
		header    map[string]string
		body      string
		unchecked bool
	}{
		{"plain text", map[string]string{"Content-Type": "text/plain"}, "alpha", true},
		{"compressed", map[string]string{"Content-Type": "application/json", "Content-Encoding": "gzip"}, "\x1f\x8balpha", true},
		{"content parts", map[string]string{"Content-Type": "application/json"}, `{"choices":[{"message":{"content":[{"type":"text","text":"alpha"}]}}]}`, true},
		{"not an answer", map[string]string{"Content-Type": "application/json"}, `["alpha"]`, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			c, recorder := replyContext(t, "/v1/chat/completions", types.RelayFormatOpenAI)
			info := replyInfo(types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
			finish := Reply(c, types.RelayFormatOpenAI, info)
			for name, value := range test.header {
				c.Writer.Header().Set(name, value)
			}
			c.Writer.WriteHeader(http.StatusOK)
			_, _ = c.Writer.Write([]byte(test.body))
			finish()
			assert.Equal(t, test.body, recorder.Body.String())
			require.Len(t, info.RequestPluginRecord, 1)
			assert.Equal(t, relaycommon.RequestPluginRecord{Plugin: "rp-reply", Name: map[string]string{"en": "Reply"}, Stage: StageReply, Unchecked: true}, info.RequestPluginRecord[0])
			assert.Equal(t, "unchecked", stepOf(t, info.RequestPluginSteps, "mask", StageReply).Action)
		})
	}

	// An error response is no answer: nothing runs and nothing is logged.
	c, recorder := replyContext(t, "/v1/chat/completions", types.RelayFormatOpenAI)
	info := replyInfo(types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	finish := Reply(c, types.RelayFormatOpenAI, info)
	c.JSON(http.StatusTooManyRequests, gin.H{"error": gin.H{"message": "alpha"}})
	finish()
	assert.Equal(t, http.StatusTooManyRequests, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "alpha")
	assert.Empty(t, info.RequestPluginRecord)
	assert.Empty(t, info.RequestPluginSteps)
}

func TestReplyStreamHoldsTextAcrossChunks(t *testing.T) {
	setupReplyPlugins(t, `[
		{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["secret"],"hold":8}},
		{"id":"more","name":"More","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["here"],"hold":4}}
	]`)
	c, recorder := replyContext(t, "/v1/chat/completions", types.RelayFormatOpenAI)
	info := replyInfo(types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	finish := Reply(c, types.RelayFormatOpenAI, info)
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	write := func(text string) { _, _ = c.Writer.Write([]byte(text)) }

	first := chatChunk("The first part of this answer is long enough to check. The sec", "")
	write(first[:20])
	write(first[20:])
	// The text before the hold went out at once.
	assert.Contains(t, chatText(recorder.Body.String()), "The first part")
	assert.NotContains(t, chatText(recorder.Body.String()), "The sec")
	write(": keep-alive\n\n")
	write(chatChunk("ret is here", ""))
	write(chatChunk("", "stop"))
	write(`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[],"usage":{"total_tokens":3}}` + "\n\n")
	write("data: [DONE]\n\n")
	finish()

	body := recorder.Body.String()
	assert.Equal(t, "The first part of this answer is long enough to check. The *** is ***", chatText(body))
	assert.NotContains(t, body, "secret")
	assert.Contains(t, body, ": keep-alive\n\n")
	data := sseData(body)
	require.GreaterOrEqual(t, len(data), 3)
	// Events without text wait behind the held text and keep their order.
	assert.Equal(t, "stop", gjson.Get(data[len(data)-3], "choices.0.finish_reason").Str)
	assert.Equal(t, int64(3), gjson.Get(data[len(data)-2], "usage.total_tokens").Int())
	assert.Equal(t, "[DONE]", data[len(data)-1])
	assert.Equal(t, 1, stepOf(t, info.RequestPluginSteps, "mask", StageReply).Effects)
	assert.Equal(t, 1, stepOf(t, info.RequestPluginSteps, "more", StageReply).Effects)
	assert.Len(t, info.RequestPluginSteps, 2)
}

func TestReplyStreamCallsOnTheFirstText(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["secret"]}}]`)
	c, recorder := replyContext(t, "/v1/chat/completions", types.RelayFormatOpenAI)
	info := replyInfo(types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	finish := Reply(c, types.RelayFormatOpenAI, info)
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	write := func(text string) { _, _ = c.Writer.Write([]byte(text)) }

	// The first text is checked at once, short as it is.
	write(chatChunk("Hi", ""))
	assert.Equal(t, "Hi", chatText(recorder.Body.String()))
	// Later text waits until 32 code units gathered.
	write(chatChunk(" there, secret", ""))
	assert.Equal(t, "Hi", chatText(recorder.Body.String()))
	write(chatChunk(" and some more text to pass 32", ""))
	assert.Equal(t, "Hi there, *** and some more text to pass 32", chatText(recorder.Body.String()))
	write(chatChunk("", "stop"))
	write("data: [DONE]\n\n")
	finish()
	assert.Equal(t, "Hi there, *** and some more text to pass 32", chatText(recorder.Body.String()))
}

// An instance that lets the answer pass is called once; with nothing masked
// the rest of the stream goes out as the handler writes it, unread.
func TestReplyPassHandsTheStreamOver(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"off","name":"Off","plugin":"rp-reply","enabled":true,"global":true,"config":{"pass":true}}]`)
	c, recorder := replyContext(t, "/v1/chat/completions", types.RelayFormatOpenAI)
	info := replyInfo(types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	finish := Reply(c, types.RelayFormatOpenAI, info)
	writer := c.Writer.(*replyWriter)
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	var sent strings.Builder
	write := func(text string) {
		sent.WriteString(text)
		_, _ = c.Writer.Write([]byte(text))
	}

	next := chatChunk(" and later text", "")
	write(chatChunk("Hi", "") + next[:20])
	// The unfinished event went out with the first one.
	assert.Equal(t, sent.String(), recorder.Body.String())
	assert.Equal(t, replyPassing, writer.mode)
	write(next[20:])
	write("data: {not json\n\n")
	write(chatChunk(" more later text", ""))
	write(chatChunk("", "stop"))
	write("data: [DONE]\n\n")
	finish()

	assert.Equal(t, sent.String(), recorder.Body.String())
	assert.Len(t, info.RequestPluginSteps, 1)
	step := stepOf(t, info.RequestPluginSteps, "off", StageReply)
	assert.Equal(t, "continue", step.Action)
	assert.Empty(t, step.Error)
	assert.Empty(t, info.RequestPluginRecord)
}

// A pass after a mask: the rest of the text is released as it comes, and the
// events that repeat the whole text still match what the client got.
func TestReplyPassAfterAMask(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["secret"],"hold":4,"passOn":"PASS"}}]`)
	c, recorder := replyContext(t, "/v1/responses", types.RelayFormatOpenAIResponses)
	info := replyInfo(types.RelayFormatOpenAIResponses, relayconstant.RelayModeResponses)
	finish := Reply(c, types.RelayFormatOpenAIResponses, info)
	writer := c.Writer.(*replyWriter)
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	deltas := []string{"my secret plan ", "then PASS and a tail long enough to call", " and the end"}
	text := strings.Join(deltas, "")
	part := `{"type":"output_text","text":"` + text + `","annotations":[]}`
	item := `{"type":"message","id":"msg_1","role":"assistant","content":[` + part + `]}`
	write := func(name, data string) {
		_, _ = c.Writer.Write([]byte("event: " + name + "\ndata: " + data + "\n\n"))
	}
	delta := func(text string) string {
		return `{"type":"response.output_text.delta","item_id":"msg_1","output_index":0,"content_index":0,"delta":"` + text + `"}`
	}
	sentText := func() string {
		var sent strings.Builder
		for _, data := range sseData(recorder.Body.String()) {
			if event := gjson.Parse(data); event.Get("type").Str == "response.output_text.delta" {
				sent.WriteString(event.Get("delta").Str)
			}
		}
		return sent.String()
	}
	write("response.content_part.added", `{"type":"response.content_part.added","item_id":"msg_1","output_index":0,"content_index":0,"part":{"type":"output_text","text":""}}`)
	write("response.output_text.delta", delta(deltas[0]))
	assert.Equal(t, "my *** p", sentText())
	write("response.output_text.delta", delta(deltas[1]))
	// The pass released the held text unchanged.
	assert.Equal(t, "my *** plan "+deltas[1], sentText())
	// Later text goes out at once, short as it is; the events are still read.
	write("response.output_text.delta", delta(deltas[2]))
	want := "my *** plan " + deltas[1] + deltas[2]
	assert.Equal(t, want, sentText())
	assert.Equal(t, replyStream, writer.mode)
	write("response.output_text.done", `{"type":"response.output_text.done","item_id":"msg_1","output_index":0,"content_index":0,"text":"`+text+`"}`)
	write("response.content_part.done", `{"type":"response.content_part.done","item_id":"msg_1","output_index":0,"content_index":0,"part":`+part+`}`)
	write("response.output_item.done", `{"type":"response.output_item.done","output_index":0,"item":`+item+`}`)
	write("response.completed", `{"type":"response.completed","response":{"id":"resp_1","output":[`+item+`]}}`)
	finish()

	full := map[string]string{}
	for _, data := range sseData(recorder.Body.String()) {
		event := gjson.Parse(data)
		switch event.Get("type").Str {
		case "response.output_text.done":
			full["done"] = event.Get("text").Str
		case "response.content_part.done":
			full["part"] = event.Get("part.text").Str
		case "response.output_item.done":
			full["item"] = event.Get("item.content.0.text").Str
		case "response.completed":
			full["completed"] = event.Get("response.output.0.content.0.text").Str
		}
	}
	assert.Equal(t, want, sentText())
	assert.Equal(t, map[string]string{"done": want, "part": want, "item": want, "completed": want}, full)
	assert.NotContains(t, recorder.Body.String(), "secret")
	assert.Equal(t, "continue", stepOf(t, info.RequestPluginSteps, "mask", StageReply).Action)
	require.Len(t, info.RequestPluginRecord, 1)
	assert.Equal(t, 1, info.RequestPluginRecord[0].Masked)
}

func TestReplyStopsStreams(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"policy","name":"Policy","plugin":"rp-reply","enabled":true,"global":true,"config":{"stop":"forbidden"}}]`)
	c, recorder := replyContext(t, "/v1/chat/completions", types.RelayFormatOpenAI)
	info := replyInfo(types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions)
	finish := Reply(c, types.RelayFormatOpenAI, info)
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	write := func(text string) { _, _ = c.Writer.Write([]byte(text)) }
	write(chatChunk("A harmless opening that is long enough to be checked. ", ""))
	write(chatChunk("Then the forbidden part follows, also long enough.", ""))
	// The handler ends as for a client that went away; what it still writes
	// is dropped.
	require.Error(t, c.Request.Context().Err())
	write(chatChunk("more text after the stop", ""))
	write("data: [DONE]\n\n")
	finish()

	body := recorder.Body.String()
	data := sseData(body)
	require.Len(t, data, 3)
	assert.Equal(t, "A harmless opening that is long enough to be checked. ", gjson.Get(data[0], "choices.0.delta.content").Str)
	assert.Equal(t, "response_rejected", gjson.Get(data[1], "error.code").Str)
	assert.Equal(t, "Response stopped by policy (code: reply.blocked) (request id: req-1)", gjson.Get(data[1], "error.message").Str)
	assert.Equal(t, "[DONE]", data[2])
	assert.NotContains(t, body, "forbidden")
	assert.Equal(t, &relaycommon.RequestPluginRejected{Code: "reply.blocked"}, info.RequestPluginRecord[0].Rejected)
}

func TestReplyRewritesResponsesFullTexts(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["secret"],"hold":2}}]`)
	c, recorder := replyContext(t, "/v1/responses", types.RelayFormatOpenAIResponses)
	info := replyInfo(types.RelayFormatOpenAIResponses, relayconstant.RelayModeResponses)
	finish := Reply(c, types.RelayFormatOpenAIResponses, info)
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	text := "my secret plan is long enough to be checked at once"
	part := `{"type":"output_text","text":"` + text + `","annotations":[]}`
	item := `{"type":"message","id":"msg_1","role":"assistant","content":[` + part + `]}`
	for _, event := range [][2]string{
		{"response.output_item.added", `{"type":"response.output_item.added","output_index":0,"item":{"type":"message","id":"msg_1","content":[]}}`},
		{"response.content_part.added", `{"type":"response.content_part.added","item_id":"msg_1","output_index":0,"content_index":0,"part":{"type":"output_text","text":""}}`},
		{"response.output_text.delta", `{"type":"response.output_text.delta","item_id":"msg_1","output_index":0,"content_index":0,"delta":"` + text[:30] + `"}`},
		{"response.output_text.delta", `{"type":"response.output_text.delta","item_id":"msg_1","output_index":0,"content_index":0,"delta":"` + text[30:] + `"}`},
		{"response.output_text.done", `{"type":"response.output_text.done","item_id":"msg_1","output_index":0,"content_index":0,"text":"` + text + `"}`},
		{"response.content_part.done", `{"type":"response.content_part.done","item_id":"msg_1","output_index":0,"content_index":0,"part":` + part + `}`},
		{"response.output_item.done", `{"type":"response.output_item.done","output_index":0,"item":` + item + `}`},
		{"response.completed", `{"type":"response.completed","response":{"id":"resp_1","output":[` + item + `]}}`},
	} {
		_, _ = c.Writer.Write([]byte("event: " + event[0] + "\n"))
		_, _ = c.Writer.Write([]byte("data: " + event[1]))
		_, _ = c.Writer.Write([]byte("\n\n"))
	}
	finish()

	body := recorder.Body.String()
	masked := "my *** plan is long enough to be checked at once"
	assert.NotContains(t, body, "secret")
	var deltas strings.Builder
	full := map[string]string{}
	for _, data := range sseData(body) {
		event := gjson.Parse(data)
		switch event.Get("type").Str {
		case "response.output_text.delta":
			deltas.WriteString(event.Get("delta").Str)
		case "response.output_text.done":
			full["done"] = event.Get("text").Str
		case "response.content_part.done":
			full["part"] = event.Get("part.text").Str
		case "response.output_item.done":
			full["item"] = event.Get("item.content.0.text").Str
		case "response.completed":
			full["completed"] = event.Get("response.output.0.content.0.text").Str
		}
	}
	assert.Equal(t, masked, deltas.String())
	assert.Equal(t, map[string]string{"done": masked, "part": masked, "item": masked, "completed": masked}, full)
	assert.Contains(t, body, "event: response.output_text.done\n")
	assert.Equal(t, 1, info.RequestPluginRecord[0].Masked)
}

func TestReplyClaudeStreamReleasesHeldTextBeforeTheBlockEnds(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["secret"],"hold":16}}]`)
	c, recorder := replyContext(t, "/v1/messages", types.RelayFormatClaude)
	info := replyInfo(types.RelayFormatClaude, relayconstant.RelayModeChatCompletions)
	finish := Reply(c, types.RelayFormatClaude, info)
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	for _, event := range [][2]string{
		{"message_start", `{"type":"message_start","message":{"id":"msg_1","content":[]}}`},
		{"content_block_start", `{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`},
		{"ping", `{"type":"ping"}`},
		{"content_block_delta", `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"This reply is long enough to be checked and ends with a secret"}}`},
		{"content_block_stop", `{"type":"content_block_stop","index":0}`},
		{"message_delta", `{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":9}}`},
		{"message_stop", `{"type":"message_stop"}`},
	} {
		_, _ = c.Writer.Write([]byte("event: " + event[0] + "\n"))
		_, _ = c.Writer.Write([]byte("data: " + event[1] + "\n"))
		_, _ = c.Writer.Write([]byte("\n\n"))
	}
	finish()

	body := recorder.Body.String()
	var text strings.Builder
	var kinds []string
	for _, data := range sseData(body) {
		event := gjson.Parse(data)
		kinds = append(kinds, event.Get("type").Str)
		text.WriteString(event.Get("delta.text").Str)
	}
	assert.Equal(t, "This reply is long enough to be checked and ends with a ***", text.String())
	assert.Equal(t, []string{"message_start", "content_block_start", "ping", "content_block_delta", "content_block_delta", "content_block_stop", "message_delta", "message_stop"}, kinds)
	assert.Contains(t, body, "event: content_block_delta\ndata: ")
}

func TestReplyDryRun(t *testing.T) {
	setupReplyPlugins(t, `[
		{"id":"skip","name":"Skip","plugin":"rp-reply-optional","enabled":true,"global":true,"models":["optional"],"config":{"throw":true}},
		{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["alpha"],"who":true}},
		{"id":"policy","name":"Policy","plugin":"rp-reply","enabled":true,"global":true,"models":["stop"],"config":{"stop":"beta","message":"No beta"}},
		{"id":"broken","name":"Broken","plugin":"rp-reply","enabled":true,"global":true,"models":["broken"],"config":{"throw":true}},
		{"id":"elsewhere","name":"Elsewhere","plugin":"rp-reply","enabled":true,"global":true,"models":["other"],"config":{"throw":true}}
	]`)
	reply := "alpha beta"
	run := func(model string) (DryRunResult, gjson.Result) {
		result := DryRun(context.Background(), DryRunInput{Format: "openai", Model: model, Group: "default", User: jsplugin.TransformUser{ID: 1, Username: "admin"},
			Body: []byte(`{"model":"gpt","reasoning_effort":"medium"}`), Reply: &reply})
		encoded, err := common.Marshal(result)
		require.NoError(t, err)
		return result, gjson.ParseBytes(encoded)
	}

	// The instances of other models do not run; the user is the admin and
	// there is no token.
	result, encoded := run("gpt")
	assert.Nil(t, result.Failed)
	assert.JSONEq(t, `{"text":"*** beta","stopped":null}`, encoded.Get("reply").Raw)
	assert.Equal(t, "medium", encoded.Get("reasoning_effort_before").Str)
	require.Len(t, result.Record, 1)
	assert.Equal(t, 1, result.Record[0].Masked)
	assert.Equal(t, map[string]string{"en": "1/admin/none/reply/openai"}, map[string]string(result.Record[0].Notice))
	require.Len(t, result.Steps, 1)
	assert.Equal(t, StageReply, result.Steps[0].Stage)

	// A plugin's stop: the text as the earlier instances left it.
	result, encoded = run("stop")
	assert.Nil(t, result.Failed)
	assert.JSONEq(t, `{"text":"*** beta","stopped":{"instance":"policy","code":"reply.blocked","message":"No beta"}}`, encoded.Get("reply").Raw)

	// A failure that stops the answer is the failure, not a stop.
	result, encoded = run("broken")
	require.NotNil(t, result.Failed)
	assert.Equal(t, "broken", result.Failed.Instance)
	assert.Contains(t, encoded.Get("failed.error").Str, "secret reply detail")
	assert.JSONEq(t, `{"text":"*** beta","stopped":null}`, encoded.Get("reply").Raw)

	// An optional plugin's failure skips the instance.
	result, encoded = run("optional")
	assert.Nil(t, result.Failed)
	assert.JSONEq(t, `{"text":"*** beta","stopped":null}`, encoded.Get("reply").Raw)
	assert.Contains(t, encoded.Get(`steps.#(instance=="skip").error`).Str, "secret reply detail")

	// A modifier's effort comes first; none at all is "".
	result = DryRun(context.Background(), DryRunInput{Format: "openai", Model: "gpt", ModifierEffort: "low", Body: []byte(`{"reasoning_effort":"medium"}`)})
	assert.Equal(t, "low", result.ReasoningEffortBefore)
	assert.Nil(t, result.Reply)
	result = DryRun(context.Background(), DryRunInput{Format: "openai", Model: "gpt", Body: []byte(`{"model":"gpt"}`)})
	encodedNone, err := common.Marshal(result)
	require.NoError(t, err)
	assert.True(t, gjson.GetBytes(encodedNone, "reasoning_effort_before").Exists())
	assert.Equal(t, "", gjson.GetBytes(encodedNone, "reasoning_effort_before").Str)
	assert.False(t, gjson.GetBytes(encodedNone, "reply").Exists())

	// An unsaved instance runs on every model.
	result = DryRun(context.Background(), DryRunInput{Format: "claude", Model: "gpt", Body: []byte(`{"model":"gpt"}`), Reply: &reply,
		Instance: &request_plugin_setting.Instance{ID: "try", Name: "Try", Plugin: "rp-reply", Models: []string{"other"}, Config: []byte(`{"words":["beta"]}`)}})
	assert.JSONEq(t, `{"text":"alpha ***","stopped":null}`, string(result.Reply))
}

func TestReplyDryRunAfterARejection(t *testing.T) {
	setupReplyPlugins(t, `[
		{"id":"reject","name":"Reject","plugin":"rp-stages","enabled":true,"global":true,"config":{"reject":"ingress"}},
		{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["alpha"]}}
	]`)
	reply := "alpha"
	result := DryRun(context.Background(), DryRunInput{Format: "openai", Model: "gpt", Body: []byte(`{"model":"gpt"}`), Reply: &reply})
	require.NotNil(t, result.Rejected)
	encoded, err := common.Marshal(result)
	require.NoError(t, err)
	assert.Equal(t, gjson.Null, gjson.GetBytes(encoded, "reply").Type)
	assert.True(t, gjson.GetBytes(encoded, "reply").Exists())
}

func TestPlanScopeModels(t *testing.T) {
	setupPlugins(t, `[
		{"id":"any","name":"Any","plugin":"rp-stages","enabled":true,"global":true,"models":[]},
		{"id":"listed","name":"Listed","plugin":"rp-stages","enabled":true,"global":true,"models":["gpt-4o","claude"]}
	]`)
	plan := NewPlan()
	require.NotNil(t, plan)
	ids := func(model string) []string {
		var scoped []string
		for _, instance := range plan.scope(StageRequest, "default", model, nil) {
			scoped = append(scoped, instance.ID)
		}
		return scoped
	}
	assert.Equal(t, []string{"any", "listed"}, ids("gpt-4o"))
	// Modifiers do not count; the match is exact.
	assert.Equal(t, []string{"any", "listed"}, ids("gpt-4o@effort:high"))
	assert.Equal(t, []string{"any"}, ids("gpt-4o-mini"))
	assert.Equal(t, []string{"any"}, ids("GPT-4O"))
}

func TestStageContextCarriesUserAndToken(t *testing.T) {
	setupPlugins(t, `[{"id":"echo","name":"Echo","plugin":"rp-stages","enabled":true,"global":true}]`)
	c := newContext(`{"model":"gpt"}`, "default")
	user, token := requester(c)
	assert.Equal(t, jsplugin.TransformUser{}, user)
	assert.Nil(t, token)
	c.Set("id", 5)
	c.Set("username", "alice")
	c.Set("token_id", 9)
	c.Set("token_name", "ci")
	call := attemptCall(c, newInfo())
	assert.Equal(t, jsplugin.TransformUser{ID: 5, Username: "alice"}, call.User)
	assert.Equal(t, &jsplugin.TransformToken{ID: 9, Name: "ci"}, call.Token)
}

func TestReplyNonStreamFormats(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["alpha"]}}]`)
	for _, test := range []struct {
		format types.RelayFormat
		path   string
		mode   int
		text   string
	}{
		{types.RelayFormatOpenAIResponses, "/v1/responses", relayconstant.RelayModeResponses, "output.0.content.0.text"},
		{types.RelayFormatClaude, "/v1/messages", relayconstant.RelayModeChatCompletions, "content.0.text"},
		{types.RelayFormatGemini, "/v1beta/models/gemini:generateContent", relayconstant.RelayModeGemini, "candidates.0.content.parts.0.text"},
	} {
		t.Run(string(test.format), func(t *testing.T) {
			c, recorder := replyContext(t, test.path, test.format)
			info := replyInfo(test.format, test.mode)
			finish := Reply(c, test.format, info)
			writeAnswer(c, string(replyAnswer(test.format, "gpt", "alpha beta")))
			finish()
			assert.Equal(t, "*** beta", gjson.Get(recorder.Body.String(), test.text).Str)
			assert.Equal(t, 1, info.RequestPluginRecord[0].Masked)
		})
	}
}

func TestReplyGeminiStreamSkipsThoughts(t *testing.T) {
	setupReplyPlugins(t, `[{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":{"words":["alpha"]}}]`)
	c, recorder := replyContext(t, "/v1beta/models/gemini:streamGenerateContent", types.RelayFormatGemini)
	info := replyInfo(types.RelayFormatGemini, relayconstant.RelayModeGemini)
	finish := Reply(c, types.RelayFormatGemini, info)
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	_, _ = c.Writer.Write([]byte(`data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"thinking about alpha","thought":true},{"text":"the alpha answer"}]}}]}` + "\n\n"))
	_, _ = c.Writer.Write([]byte(`data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":" ends here"}]},"finishReason":"STOP"}]}` + "\n\n"))
	finish()
	var answer strings.Builder
	data := sseData(recorder.Body.String())
	require.Len(t, data, 2)
	assert.Equal(t, "thinking about alpha", gjson.Get(data[0], "candidates.0.content.parts.0.text").Str)
	for _, event := range data {
		for _, part := range gjson.Get(event, "candidates.0.content.parts").Array() {
			if !part.Get("thought").Bool() {
				answer.WriteString(part.Get("text").Str)
			}
		}
	}
	assert.Equal(t, "the *** answer ends here", answer.String())
}

// formPlugin shows, on request, what its hooks read.
const formPlugin = `export const meta = {apiVersion: 1, key: "rp-form", name: "Form", version: "1.0.0", author: {name: "Test"}};
export function ingress(ctx, req) {
  if (ctx.config.show) return {action: "reject", code: "seen", message: String(req.form) + " " + ctx.format + " " + JSON.stringify(req.body)};
  return {action: "continue"};
}
export function egress(ctx, req) {
  return {action: "reject", code: "seen", message: ctx.format + " " + JSON.stringify(req.body)};
}`

func registerFormPlugin(t *testing.T) {
	t.Helper()
	plugin, err := jsplugin.DefaultRegistry.Register(formPlugin, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key) })
}

// testForm is a multipart body with text fields, a repeated one, and a file
// whose bytes are not text.
func testForm(t *testing.T) (string, []byte) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-1"))
	require.NoError(t, writer.WriteField("prompt", "call 555 now"))
	file, err := writer.CreateFormFile("image", "a.png")
	require.NoError(t, err)
	_, err = file.Write([]byte{0x89, 'P', 'N', 'G', 0, 0xff, '\r', '\n', '-', '-', 0xfe})
	require.NoError(t, err)
	require.NoError(t, writer.WriteField("tag", "one"))
	require.NoError(t, writer.WriteField("tag", "two"))
	require.NoError(t, writer.Close())
	return writer.FormDataContentType(), body.Bytes()
}

func storedBody(t *testing.T, c *gin.Context) []byte {
	t.Helper()
	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	body, err := storage.Bytes()
	require.NoError(t, err)
	return body
}

func TestFormBodyIngress(t *testing.T) {
	setupPlugins(t, `[]`)
	registerFormPlugin(t)
	contentType, raw := testForm(t)
	formContext := func() *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(raw))
		c.Request.Header.Set("Content-Type", contentType)
		c.Set("group", "default")
		return c
	}

	// The hooks read the text fields as an object; the file is left out.
	setInstances(t, `[{"id":"show","name":"Show","plugin":"rp-form","enabled":true,"global":true,"config":{"show":true}}]`)
	_, _, apiErr := Ingress(formContext(), types.RelayFormatOpenAIImage)
	require.NotNil(t, apiErr)
	assert.Equal(t, `true openai_image {"model":"gpt-image-1","prompt":"call 555 now","tag":["one","two"]} (code: seen)`, apiErr.Err.Error())

	// Replaced values are written into the form again; every other part,
	// the file included, keeps its bytes, order and boundary.
	setInstances(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[
		{"op":"replace","path":"/prompt","value":"call [phone]"},{"op":"replace","path":"/tag/1","value":"2"}]}]}}}]`)
	c := formContext()
	steps, record, apiErr := Ingress(c, types.RelayFormatOpenAIImage)
	require.Nil(t, apiErr)
	assert.Equal(t, "continue", steps[0].Action)
	patched := storedBody(t, c)
	assert.Equal(t, strings.Replace(strings.Replace(string(raw), "call 555 now", "call [phone]", 1), "two", "2", 1), string(patched))
	assert.Equal(t, int64(len(patched)), c.Request.ContentLength)
	assert.Equal(t, contentType, c.Request.Header.Get("Content-Type"))
	form, err := common.ParseMultipartFormReusable(c)
	require.NoError(t, err)
	assert.Equal(t, []string{"call [phone]"}, form.Value["prompt"])
	assert.Equal(t, []string{"one", "2"}, form.Value["tag"])
	file, err := form.File["image"][0].Open()
	require.NoError(t, err)
	content, err := io.ReadAll(file)
	require.NoError(t, err)
	assert.Equal(t, []byte{0x89, 'P', 'N', 'G', 0, 0xff, '\r', '\n', '-', '-', 0xfe}, content)
	var paths []string
	for _, change := range record[0].Changes {
		paths = append(paths, change.Path)
	}
	assert.Equal(t, []string{"prompt", "tag[1]"}, paths)

	// A form no hook changed keeps its bytes.
	setInstances(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true}]`)
	c = formContext()
	_, _, apiErr = Ingress(c, types.RelayFormatOpenAIImage)
	require.Nil(t, apiErr)
	assert.Equal(t, raw, storedBody(t, c))

	// Anything but a replace that sets a text field to a string fails the
	// instance and leaves the form as it was.
	for _, ops := range []string{
		`[{"op":"add","path":"/extra","value":"x"}]`,
		`[{"op":"remove","path":"/prompt"}]`,
		`[{"op":"replace","path":"/prompt","value":1}]`,
		`[{"op":"replace","path":"/tag","value":"x"}]`,
	} {
		setInstances(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":`+ops+`}]}}}]`)
		c = formContext()
		steps, _, apiErr = Ingress(c, types.RelayFormatOpenAIImage)
		require.NotNil(t, apiErr, ops)
		assert.Equal(t, types.ErrorCodeRequestPluginFailed, apiErr.GetErrorCode(), ops)
		assert.Equal(t, errorInvalidEffect, steps[0].Error, ops)
		assert.Equal(t, raw, storedBody(t, c), ops)
	}
}

func TestTaskSubmissionStages(t *testing.T) {
	setupPlugins(t, `[
		{"id":"in","name":"In","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"replace","path":"/prompt","value":"clean"}]}]}}},
		{"id":"late","name":"Late","plugin":"rp-stages","enabled":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"replace","path":"/duration","value":10}]}]}}}
	]`)
	registerFormPlugin(t)
	c := newContext(`{"model":"veo","prompt":"secret","duration":5}`, "default")
	c.Request.URL.Path = "/v1/videos"

	changed, steps, record, apiErr := SubmitIngress(c, types.RelayFormatTask, "veo")
	require.Nil(t, apiErr)
	assert.True(t, changed)
	assert.JSONEq(t, `{"model":"veo","prompt":"clean","duration":5}`, string(storedBody(t, c)))
	info := newInfo("late")
	info.OriginModelName = "veo"
	info.RelayFormat = types.RelayFormatTask
	info.SetRequestPluginIngress(steps, record)

	// A late ingress runs on the client body before the attempt is priced,
	// so it may change what sets the price.
	changed, apiErr = TaskAttempt(c, info)
	require.Nil(t, apiErr)
	assert.True(t, changed)
	assert.JSONEq(t, `{"model":"veo","prompt":"clean","duration":10}`, string(storedBody(t, c)))
	assert.Equal(t, "continue", stepOf(t, info.RequestPluginSteps, "late", StageIngress).Action)

	// The next attempt, on a channel without it, starts from the body the
	// request's ingress left; the one after changes nothing.
	unbound := newInfo()
	unbound.OriginModelName = "veo"
	changed, apiErr = TaskAttempt(c, unbound)
	require.Nil(t, apiErr)
	assert.True(t, changed)
	assert.JSONEq(t, `{"model":"veo","prompt":"clean","duration":5}`, string(storedBody(t, c)))
	changed, apiErr = TaskAttempt(c, unbound)
	require.Nil(t, apiErr)
	assert.False(t, changed)

	// Egress reads the body the task plugin built, as format task, and
	// returns its bytes.
	setInstances(t, `[{"id":"final","name":"Final","plugin":"rp-form","enabled":true,"global":true}]`)
	c = newContext(`{"model":"veo","prompt":"secret"}`, "default")
	_, _, _, apiErr = SubmitIngress(c, types.RelayFormatOpenAIResponses, "veo")
	require.Nil(t, apiErr)
	_, apiErr = TaskEgress(c, unbound, strings.NewReader(`{"input":"built"}`))
	require.NotNil(t, apiErr)
	assert.Equal(t, `task {"input":"built"} (code: seen)`, apiErr.Err.Error())
	// A body that is not JSON is unchecked.
	unbound.RequestPluginSteps = nil
	reader, apiErr := TaskEgress(c, unbound, strings.NewReader("--x\r\nbinary"))
	require.Nil(t, apiErr)
	sent, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Equal(t, "--x\r\nbinary", string(sent))
	assert.Equal(t, "unchecked", stepOf(t, unbound.RequestPluginSteps, "final", StageEgress).Action)

	// On Midjourney the members its model derives from stay as they are.
	setInstances(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"replace","path":"/action","value":"VARIATION"}]}]}}}]`)
	c = newContext(`{"action":"UPSCALE","prompt":"a cat"}`, "default")
	_, steps, _, apiErr = SubmitIngress(c, types.RelayFormatMjProxy, "mj_upscale")
	require.NotNil(t, apiErr)
	assert.Equal(t, errorGuard, steps[0].Error)
}

func TestUnavailablePlugin(t *testing.T) {
	setupPlugins(t, `[
		{"id":"gone","name":"Gone","plugin":"rp-missing","enabled":true,"global":true},
		{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true}
	]`)
	// rp-stages is listed but loaded: it runs as before.
	SetUnloadedPlugins(map[string]string{"rp-missing": "compile: unexpected token", "rp-stages": "an older failure"})
	t.Cleanup(func() { SetUnloadedPlugins(nil) })
	body := `{"model":"gpt","messages":[]}`

	// An enabled plugin that did not load fails every request in scope.
	steps, record, apiErr := Ingress(newContext(body, "default"), types.RelayFormatOpenAI)
	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeRequestPluginFailed, apiErr.GetErrorCode())
	assert.Equal(t, http.StatusInternalServerError, apiErr.StatusCode)
	assert.Equal(t, []relaycommon.RequestPluginStep{{Instance: "gone", Name: "Gone", Plugin: "rp-missing", Stage: StageIngress, Action: "fail", Error: "unavailable"}}, steps)
	assert.Equal(t, []relaycommon.RequestPluginRecord{{Plugin: "rp-missing", Name: map[string]string{"en": "rp-missing"}, Stage: StageIngress,
		Rejected: &relaycommon.RequestPluginRejected{Code: string(types.ErrorCodeRequestPluginFailed)}}}, record)
	// It fails even a body no hook can read.
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", strings.NewReader("raw"))
	c.Request.Header.Set("Content-Type", "application/octet-stream")
	_, _, apiErr = Ingress(c, types.RelayFormatOpenAIAudio)
	require.NotNil(t, apiErr)

	// One the channel binds fails that attempt, not the request's ingress.
	setInstances(t, `[
		{"id":"gone","name":"Gone","plugin":"rp-missing","enabled":true},
		{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true}
	]`)
	c = newContext(body, "default")
	steps, record, apiErr = Ingress(c, types.RelayFormatOpenAI)
	require.Nil(t, apiErr)
	assert.Equal(t, "continue", stepOf(t, steps, "rp", StageIngress).Action)
	info := newInfo("gone")
	info.SetRequestPluginIngress(steps, record)
	_, apiErr = Outbound(c, info, []byte(body))
	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeRequestPluginFailed, apiErr.GetErrorCode())
	assert.Equal(t, "unavailable", stepOf(t, info.RequestPluginSteps, "gone", StageIngress).Error)
	for _, stage := range []string{StageEgress, StageReply} {
		assert.False(t, slices.ContainsFunc(NewPlan().scope(stage, "default", "gpt", []string{"gone"}), func(instance *request_plugin_setting.Instance) bool {
			return instance.ID == "gone"
		}), "only ingress has it in scope")
	}

	// A plugin switched off or deleted is not on the sync: it is skipped.
	SetUnloadedPlugins(map[string]string{})
	setInstances(t, `[{"id":"gone","name":"Gone","plugin":"rp-missing","enabled":true,"global":true}]`)
	assert.Nil(t, NewPlan())
}

func TestJSONBodyAsTheGatewayParsesIt(t *testing.T) {
	setupPlugins(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":{"reject":"egress",
		"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"replace","path":"/messages/0/content","value":"[redacted]"}]}]}}}]`)
	for _, contentType := range []string{"application/jsonl", "application/json; charset=utf-8", "application/vnd.test+json"} {
		t.Run(contentType, func(t *testing.T) {
			c := newContext(`{"model":"gpt","messages":[{"role":"user","content":"secret"}]}`, "default")
			c.Request.Header.Set("Content-Type", contentType)
			steps, _, apiErr := Ingress(c, types.RelayFormatOpenAI)
			require.Nil(t, apiErr)
			assert.Equal(t, "continue", stepOf(t, steps, "rp", StageIngress).Action)
			assert.JSONEq(t, `{"model":"gpt","messages":[{"role":"user","content":"[redacted]"}]}`, string(storedBody(t, c)))

			// A pass-through channel forwards the stored body; egress reads it.
			storage, err := common.GetBodyStorage(c)
			require.NoError(t, err)
			apiErr = PassThrough(c, newInfo(), storage)
			require.NotNil(t, apiErr)
			assert.Equal(t, types.ErrorCodeRequestRejected, apiErr.GetErrorCode())
		})
	}
}

func TestReplyGeminiPartsKeepTheirPlaces(t *testing.T) {
	answer := `{"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"alpha one"},{"inlineData":{"mimeType":"image/png","data":"AAAA"}},{"text":"two alpha"}]},"finishReason":"STOP"}]}`
	for _, test := range []struct {
		name, config string
		parts        []string
	}{
		{"pass", `{"pass":true}`, nil},
		{"no change", `{"words":["omega"]}`, nil},
		{"masks", `{"words":["alpha"]}`, []string{"*** one", "", "two ***"}},
		{"mask across parts", `{"words":["onetwo"]}`, []string{"alpha ***", "", " alpha"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			setupReplyPlugins(t, `[{"id":"mask","name":"Mask","plugin":"rp-reply","enabled":true,"global":true,"config":`+test.config+`}]`)
			c, recorder := replyContext(t, "/v1beta/models/gemini:generateContent", types.RelayFormatGemini)
			finish := Reply(c, types.RelayFormatGemini, replyInfo(types.RelayFormatGemini, relayconstant.RelayModeGemini))
			writeAnswer(c, answer)
			finish()
			if test.parts == nil {
				assert.Equal(t, answer, recorder.Body.String())
				return
			}
			parts := gjson.Get(recorder.Body.String(), "candidates.0.content.parts").Array()
			require.Len(t, parts, 3)
			for i, text := range test.parts {
				assert.Equal(t, text, parts[i].Get("text").Str)
			}
			assert.Equal(t, "AAAA", parts[1].Get("inlineData.data").Str)
		})
	}
}

func TestAutoGroupScopesBySettledGroup(t *testing.T) {
	setupPlugins(t, `[{"id":"vip","name":"Vip","plugin":"rp-stages","enabled":true,"groups":["vip"],"config":{"echo":"outbound"}}]`)
	c := newContext(`{"model":"gpt","messages":[]}`, "auto")
	steps, _, apiErr := Ingress(c, types.RelayFormatOpenAI)
	require.Nil(t, apiErr)
	assert.Empty(t, steps, "the group is settled only when the channel is selected")

	common.SetContextKey(c, constant.ContextKeyAutoGroup, "vip")
	info := newInfo()
	body, apiErr := Outbound(c, info, []byte(`{"model":"gpt-up","messages":[]}`))
	require.Nil(t, apiErr)
	assert.Equal(t, "continue", stepOf(t, info.RequestPluginSteps, "vip", StageIngress).Action, "its ingress hook runs late")
	assert.True(t, gjson.GetBytes(body, "echo_vip").Exists())
}

// The plugin master switch covers task and provider plugin channels only:
// with it off, an enabled instance still processes relay requests.
func TestMasterSwitchOffKeepsRequestProcessing(t *testing.T) {
	setupPlugins(t, `[{"id":"rp","name":"Rp","plugin":"rp-stages","enabled":true,"global":true,"config":{"effects":{"ingress":[{"type":"json.patch","ops":[{"op":"add","path":"/patched","value":true}]}]}}}]`)
	enabled := jsplugin.DefaultRegistry.Enabled()
	jsplugin.DefaultRegistry.SetEnabled(false)
	t.Cleanup(func() { jsplugin.DefaultRegistry.SetEnabled(enabled) })
	// With the switch off the plugin sync finds no plugin in the routing
	// generation and lists them all.
	SetUnloadedPlugins(map[string]string{"rp-stages": ""})
	t.Cleanup(func() { SetUnloadedPlugins(nil) })

	c := newContext(`{"model":"gpt","messages":[]}`, "default")
	steps, _, apiErr := Ingress(c, types.RelayFormatOpenAI)
	require.Nil(t, apiErr)
	require.Len(t, steps, 1)
	assert.Equal(t, "continue", steps[0].Action)
	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	stored, err := storage.Bytes()
	require.NoError(t, err)
	assert.JSONEq(t, `{"model":"gpt","messages":[],"patched":true}`, string(stored))
}
