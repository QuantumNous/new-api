package jsplugin

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	providerMeta = `apiVersion: 1, key: "vendor", name: "Vendor", version: "1.0.0", author: {name: "Test"}`
	providerTask = `
export function buildSubmitRequest(ctx) { return {url: ctx.baseUrl + "/submit"}; }
export function parseSubmitResponse(ctx, resp) { return {taskId: resp.body.id}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/task"}; }
export function parseTaskResult(ctx, body) { return body; }
`
	providerConverters = `
export function convertRequest(ctx, req) { return {body: req.body}; }
export function convertResponse(ctx, resp) { return {body: resp.body}; }
export function convertStreamEvent(ctx, input) { return {}; }
`
)

func providerPlugin(relay, source string) string {
	return `export const meta = {` + providerMeta + `, relay: ` + relay + `};` + source
}

func compileProviderPlugin(t *testing.T, relay, source string) *LoadedPlugin {
	t.Helper()
	plugin, err := CompilePlugin(providerPlugin(relay, source), Options{})
	require.NoError(t, err)
	return plugin
}

const simpleRelay = `[{incoming_path: "/v1/chat/completions", upstream_path: "/v1/chat/completions"}]`

func TestPluginParts(t *testing.T) {
	relayOnly := compileProviderPlugin(t, simpleRelay, "")
	assert.True(t, relayOnly.Meta.HasProviderPart())
	assert.False(t, relayOnly.Meta.HasTaskPart())

	both, err := CompilePlugin(`export const meta = {`+providerMeta+`, models: ["m"], fetchMode: "per_task", relay: `+simpleRelay+`};`+providerTask, Options{})
	require.NoError(t, err)
	assert.True(t, both.Meta.HasProviderPart())
	assert.True(t, both.Meta.HasTaskPart())

	taskOnly, err := CompilePlugin(`export const meta = {`+providerMeta+`, models: ["m"], fetchMode: "per_task"};`+providerTask, Options{})
	require.NoError(t, err)
	assert.False(t, taskOnly.Meta.HasProviderPart())
	assert.True(t, taskOnly.Meta.HasTaskPart())

	assert.False(t, taskOnly.Meta.HasTransformPart())
	assert.Nil(t, taskOnly.TransformHooks())

	// The stage hooks come back in stage order, whatever the export order.
	transformOnly, err := CompilePlugin(`export const meta = {`+providerMeta+`};
export function egress() { return {action: "continue"}; }
export function ingress() { return {action: "continue"}; }`, Options{})
	require.NoError(t, err)
	assert.False(t, transformOnly.Meta.HasTaskPart())
	assert.False(t, transformOnly.Meta.HasProviderPart())
	assert.True(t, transformOnly.Meta.HasTransformPart())
	assert.Equal(t, []string{"ingress", "egress"}, transformOnly.TransformHooks())

	_, err = CompilePlugin(`export const meta = {`+providerMeta+`};`, Options{})
	require.ErrorContains(t, err, "has no task part")
	_, err = CompilePlugin(`export const meta = {`+providerMeta+`, relay: []};`, Options{})
	require.ErrorContains(t, err, "has no task part")
	_, err = CompilePlugin(`export const meta = {`+providerMeta+`}; export const outbound = {};`, Options{})
	require.ErrorContains(t, err, `export "outbound" is not a function`)
}

func TestPluginWithoutTaskPartRejectsTaskFields(t *testing.T) {
	parts := map[string]struct{ meta, exports string }{
		"provider part":  {`, relay: ` + simpleRelay, ""},
		"transform part": {"", `export function ingress() {}`},
	}
	for part, plugin := range parts {
		for _, field := range []string{
			`routes: []`, `protocols: []`, `fetchMode: "per_task"`, `submitResponseTypes: ["json"]`, `usageSchema: {}`,
			`usageExamples: []`, `usageProfiles: []`, `auth: "api_key"`, `channelTypes: [1999]`, `upstreams: ["vendor"]`,
		} {
			t.Run(part+" "+field, func(t *testing.T) {
				_, err := CompilePlugin(`export const meta = {`+providerMeta+plugin.meta+`, `+field+`};`+plugin.exports, Options{})
				require.ErrorContains(t, err, "belongs to the task part")
			})
		}
	}
}

func TestOnlyRelayHooksNeedRelayRoutes(t *testing.T) {
	credentialHooks := []string{"login", "refresh", "revoke", "signRequest", "exchangeKey", "checkKey", "scheduled"}
	balanceHooks := []string{"buildBalanceRequest", "parseBalance"}
	for _, hook := range ProviderHooks {
		t.Run(hook, func(t *testing.T) {
			exports := `export function ` + hook + `() {}`
			if slices.Contains(balanceHooks, hook) {
				exports = `export function buildBalanceRequest() {} export function parseBalance() {}`
			}
			_, err := CompilePlugin(`export const meta = {`+providerMeta+`, models: ["m"], fetchMode: "per_task"};`+providerTask+exports, Options{})
			if slices.Contains(credentialHooks, hook) || slices.Contains(balanceHooks, hook) {
				require.NoError(t, err, "a credential hook serves the task part too")
				return
			}
			require.ErrorContains(t, err, "needs meta.relay routes")
		})
	}
	_, err := CompilePlugin(providerPlugin(simpleRelay, `export function parseBalance() {}`), Options{})
	require.ErrorContains(t, err, "must export both buildBalanceRequest and parseBalance")
	_, err = CompilePlugin(providerPlugin(simpleRelay, `export const login = 1;`), Options{})
	require.ErrorContains(t, err, "is not a function")
	_, err = CompilePlugin(`export const meta = {`+providerMeta+`}; export function ingress() {} export function login() {}`, Options{})
	require.ErrorContains(t, err, "needs a task part or meta.relay routes")
}

func TestRelayRouteValidation(t *testing.T) {
	for name, tc := range map[string]struct{ relay, message string }{
		"not an array":         {`{}`, "must be an array"},
		"not an object":        {`["/v1"]`, "must be an object"},
		"unknown key":          {`[{incoming_path: "/v1/x", upstream_path: "/x", extra: 1}]`, `unknown field "extra"`},
		"unknown auth key":     {`[{incoming_path: "/v1/x", upstream_path: "/x", auth: {type: "none", extra: 1}}]`, `unknown field "extra"`},
		"wrong member type":    {`[{incoming_path: 1, upstream_path: "/x"}]`, "wrong type"},
		"no incoming path":     {`[{upstream_path: "/x"}]`, "relay[0].incoming_path is required"},
		"no upstream path":     {`[{incoming_path: "/v1/x"}]`, "relay[0].upstream_path is required"},
		"unknown converter":    {`[{incoming_path: "/v1/x", upstream_path: "/x", converter: "made_up"}]`, "is not registered"},
		"plugin on realtime":   {`[{incoming_path: "/v1/realtime", upstream_path: "/x", converter: "plugin"}]`, "does not support incoming_path"},
		"plugin balance":       {`[{incoming_path: "/v1/dashboard/billing/credit_grants", upstream_path: "/x", converter: "plugin"}]`, "does not support incoming_path"},
		"plugin pass through":  {`[{incoming_path: "/v1/responses", upstream_path: "/x", converter: "plugin", pass_through_body_enabled: true}]`, "pass_through_body_enabled"},
		"chained none":         {`[{incoming_path: "/v1/chat/completions", upstream_path: "/x", converter: "none+plugin"}]`, "must chain a registered converter other than none"},
		"chained plugin":       {`[{incoming_path: "/v1/chat/completions", upstream_path: "/x", converter: "plugin+plugin"}]`, "must chain a registered converter other than none"},
		"chained unknown":      {`[{incoming_path: "/v1/chat/completions", upstream_path: "/x", converter: "made_up+plugin"}]`, "is not registered"},
		"chained wrong path":   {`[{incoming_path: "/v1/messages", upstream_path: "/x", converter: "openai_chat_completions_to_anthropic_messages+plugin"}]`, "does not match incoming_path"},
		"chained pass through": {`[{incoming_path: "/v1/chat/completions", upstream_path: "/x", converter: "openai_chat_completions_to_anthropic_messages+plugin", pass_through_body_enabled: true}]`, "pass_through_body_enabled"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := CompilePlugin(providerPlugin(tc.relay, providerConverters), Options{})
			require.ErrorContains(t, err, tc.message)
		})
	}
}

func TestPluginConverterNeedsAllHooksAndARoute(t *testing.T) {
	route := `[{incoming_path: "/v1/chat/completions", upstream_path: "/generate", converter: "plugin"}]`
	plugin := compileProviderPlugin(t, route, providerConverters)
	assert.Equal(t, "plugin", plugin.Meta.Relay[0].Converter)
	config := plugin.Meta.RelayConfig()
	require.NoError(t, config.Validate(), "the relay sees a native route it can validate")
	assert.Equal(t, "none", config.Routes[0].Converter)
	assert.Equal(t, "plugin", plugin.Meta.Relay[0].Converter, "RelayConfig leaves the manifest as it was")

	chained := `[{incoming_path: "/v1/chat/completions", upstream_path: "/generate", converter: " openai_chat_completions_to_gemini_generate_content+plugin "}]`
	config = compileProviderPlugin(t, chained, providerConverters).Meta.RelayConfig()
	require.NoError(t, config.Validate())
	assert.Equal(t, "openai_chat_completions_to_gemini_generate_content", config.Routes[0].Converter, "a chained route runs its registered converter")

	for _, hook := range providerConvertHooks {
		_, err := CompilePlugin(providerPlugin(route, strings.Replace(providerConverters, "function "+hook, "function other"+hook, 1)), Options{})
		require.ErrorContains(t, err, "does not export "+hook)
		_, err = CompilePlugin(providerPlugin(chained, strings.Replace(providerConverters, "function "+hook, "function other"+hook, 1)), Options{})
		require.ErrorContains(t, err, "does not export "+hook)
		_, err = CompilePlugin(providerPlugin(simpleRelay, `export function `+hook+`() {}`), Options{})
		require.ErrorContains(t, err, "no relay route that calls it uses converter")
	}
	for _, incoming := range []string{"/v1/responses", "/v1/responses/compact", "/v1/messages", "/v1beta/models/{model}:generateContent", "/v1beta/models/{model}:streamGenerateContent",
		"/v1beta/models/{model}:embedContent", "/v1/embeddings", "/v1/rerank", "/v1/completions", "/v1/images/generations", "/v1/images/edits",
		"/v1/audio/speech", "/v1/audio/transcriptions", "/v1/audio/translations", "/v1/alpha/search", "/v1/tools/search", "/v1/tools/fetch"} {
		compileProviderPlugin(t, `[{incoming_path: "`+incoming+`", upstream_path: "/g", converter: "plugin"}]`, providerConverters)
	}
}

func TestModelListRouteNeedsConvertResponseAlone(t *testing.T) {
	const (
		list            = `{incoming_path: "/v1/models", upstream_path: "/models?page=1", converter: "plugin"}`
		chat            = `{incoming_path: "/v1/chat/completions", upstream_path: "/generate", converter: "plugin"}`
		convertResponse = `export function convertResponse() { return {body: {data: []}}; }`
	)
	plugin := compileProviderPlugin(t, `[`+list+`]`, convertResponse)
	route, ok := plugin.Meta.ModelListRoute()
	require.True(t, ok)
	assert.Equal(t, "plugin", route.Converter)
	config := plugin.Meta.RelayConfig()
	require.NoError(t, config.Validate(), "the model list request is built from a native route")
	assert.Equal(t, "none", config.Routes[0].Converter)
	compileProviderPlugin(t, `[`+list+`, `+chat+`]`, providerConverters)

	_, err := CompilePlugin(providerPlugin(`[`+list+`]`, ``), Options{})
	require.ErrorContains(t, err, "does not export convertResponse")
	for _, hook := range []string{"convertRequest", "convertStreamEvent"} {
		_, err = CompilePlugin(providerPlugin(`[`+list+`]`, convertResponse+`export function `+hook+`() {}`), Options{})
		require.ErrorContains(t, err, "exports "+hook+" but no relay route that calls it")
		_, err = CompilePlugin(providerPlugin(`[`+list+`, `+chat+`]`, strings.Replace(providerConverters, "function "+hook, "function other"+hook, 1)), Options{})
		require.ErrorContains(t, err, "does not export "+hook)
	}
}

func TestRelayConfigAcceptsAdvancedCustomConverters(t *testing.T) {
	plugin := compileProviderPlugin(t, `[
		{incoming_path: "/v1/chat/completions", upstream_path: "/{model}/generate", converter: "openai_chat_completions_to_openai_responses", models: ["re:^a-"], auth: {type: "header", name: "X-Key", value: "{api_key}"}},
		{incoming_path: "/v1/chat/completions", upstream_path: "/other"},
		{incoming_path: "/v1/models", upstream_path: "/v1/models"}
	]`, "")

	route, ok := plugin.Meta.RelayRoute("/v1/chat/completions", "a-1")
	require.True(t, ok)
	assert.Equal(t, "/{model}/generate", route.UpstreamPath)
	route, ok = plugin.Meta.RelayRoute("/v1/chat/completions", "b-1")
	require.True(t, ok)
	assert.Equal(t, "/other", route.UpstreamPath)
	_, ok = plugin.Meta.RelayRoute("/v1/embeddings", "a-1")
	assert.False(t, ok)
}

func TestCredentialLine(t *testing.T) {
	credential := Credential{Plugin: "vendor", Data: json.RawMessage(`{"token":"secret-data"}`), Headers: map[string]string{"X-Secret": "secret-header"}, Query: map[string]string{"q": "secret-query"}, ExpiresAt: 1730000000, AccountID: "acct", Label: "user@example.com"}

	line, err := credential.Line()
	require.NoError(t, err)
	assert.NotContains(t, line, "\n")
	parsed, ok := ParseCredential(line)
	require.True(t, ok)
	assert.Equal(t, CredentialType, parsed.Type)
	assert.Equal(t, "vendor", parsed.Plugin)
	assert.JSONEq(t, `{"token":"secret-data"}`, string(parsed.Data))
	assert.Equal(t, credential.Headers, parsed.Headers)
	assert.Equal(t, credential.Query, parsed.Query)

	redacted := RedactCredentialLines("static-key\n" + line)
	assert.Contains(t, redacted, "static-key\n")
	assert.Contains(t, redacted, "user@example.com")
	assert.Contains(t, redacted, "acct")
	assert.NotContains(t, redacted, "secret")

	_, err = Credential{Plugin: "vendor", Data: json.RawMessage(`"` + strings.Repeat("a", MaxCredentialBytes) + `"`)}.Line()
	require.ErrorContains(t, err, "exceeds")
}

func TestParseCredentialLeavesOtherKeysAlone(t *testing.T) {
	for _, line := range []string{
		"sk-plain",
		`{"type":"service_account","project_id":"p"}`,
		`{"type":"plugin_credential"}`,
		`{"type":"plugin_credential","plugin":`,
		`["plugin_credential"]`,
	} {
		_, ok := ParseCredential(line)
		assert.False(t, ok, line)
	}
	const static = `{"type":"service_account","note":"plugin_credential"}`
	assert.Equal(t, static, RedactCredentialLines(static))
}

func TestCredentialExpiry(t *testing.T) {
	now := time.Unix(1000, 0)
	assert.False(t, Credential{}.ExpiresWithin(now, time.Hour), "no expiry never expires")
	assert.True(t, Credential{ExpiresAt: 1020}.ExpiresWithin(now, 30*time.Second))
	assert.False(t, Credential{ExpiresAt: 1040}.ExpiresWithin(now, 30*time.Second))
	assert.True(t, Credential{ExpiresAt: 999}.ExpiresWithin(now, 0))
}

func loginStep(t *testing.T, step string) (LoginStep, error) {
	t.Helper()
	plugin := compileProviderPlugin(t, simpleRelay, `export function login(ctx, input) { return `+step+`; }`)
	return plugin.CallLogin(context.Background(), "https://api.vendor.example", LoginContext{}, nil, nil)
}

func TestLoginContextAndInput(t *testing.T) {
	plugin := compileProviderPlugin(t, simpleRelay, `
export function login(ctx, input) {
  return {type: "paste", url: "https://auth.example/" + ctx.login.codeChallengeMethod + "?v=" + encodeURIComponent(JSON.stringify([ctx.baseUrl, ctx.login, ctx.credential, input]))};
}`)
	step, err := plugin.CallLogin(context.Background(), "https://api.vendor.example", LoginContext{
		State: "s", Nonce: "n", CodeVerifier: "v", CodeChallenge: "c", RedirectURI: "https://gw/cb", Session: json.RawMessage(`{"device":"d"}`),
	}, json.RawMessage(`{"old":1}`), map[string]any{"poll": true})

	require.NoError(t, err)
	assert.Contains(t, step.URL, "https://auth.example/S256?v=")
	assert.Contains(t, step.URL, `%22session%22%3A%7B%22device%22%3A%22d%22%7D`)
	assert.Contains(t, step.URL, `%7B%22old%22%3A1%7D`)
	assert.Contains(t, step.URL, `%7B%22poll%22%3Atrue%7D`)
}

func TestLoginStepsDecode(t *testing.T) {
	step, err := loginStep(t, `{type: "redirect", url: "https://auth.example/a", issuer: "https://auth.example", session: {a: 1}}`)
	require.NoError(t, err)
	assert.Equal(t, LoginStep{Type: LoginStepRedirect, URL: "https://auth.example/a", Issuer: "https://auth.example", Session: json.RawMessage(`{"a":1}`)}, step)

	step, err = loginStep(t, `{type: "paste", url: "https://auth.example/a", hint: {en: "Paste", zh: "粘贴"}}`)
	require.NoError(t, err)
	assert.Equal(t, LocalizedText{"en": "Paste", "zh": "粘贴"}, step.Hint)
	assert.Nil(t, step.Session, "no session keeps the current one")

	step, err = loginStep(t, `{type: "pending", session: null}`)
	require.NoError(t, err)
	assert.Equal(t, "null", string(step.Session), "null clears the session")

	step, err = loginStep(t, `{type: "device", userCode: "ABCD", verificationUri: "https://auth.example/d", verificationUriComplete: "https://auth.example/d?c=ABCD", interval: 7, expiresIn: 600}`)
	require.NoError(t, err)
	assert.Equal(t, 7, step.Interval)
	assert.Equal(t, 600, step.ExpiresIn)

	step, err = loginStep(t, `{type: "fields", fields: [{name: "api_token", label: "Token", type: "password", required: true, description: {en: "From the console"}}, {name: "note", label: "Note"}]}`)
	require.NoError(t, err)
	assert.Equal(t, "password", step.Fields[0].Type)
	assert.True(t, step.Fields[0].Required)
	assert.Equal(t, "text", step.Fields[1].Type)

	step, err = loginStep(t, `{type: "done", credential: {token: "t"}, headers: {"X-A": "1"}, query: {q: "1"}, expiresAt: 1730000000, accountId: " acct ", label: "me"}`)
	require.NoError(t, err)
	require.NotNil(t, step.Result)
	assert.JSONEq(t, `{"token":"t"}`, string(step.Result.Credential))
	assert.Equal(t, "acct", step.Result.AccountID)
	assert.EqualValues(t, 1730000000, step.Result.ExpiresAt)
}

func TestLoginStepsRejected(t *testing.T) {
	session := `"` + strings.Repeat("s", MaxLoginSessionBytes) + `"`
	for name, tc := range map[string]struct{ step, message string }{
		"not an object":        {`"redirect"`, "must be an object"},
		"no type":              {`{}`, "type must be one of"},
		"unknown type":         {`{type: "wait"}`, "is not a login step"},
		"unknown member":       {`{type: "pending", extra: 1}`, `unknown member "extra"`},
		"hint on redirect":     {`{type: "redirect", url: "https://a.example", hint: "x"}`, `unknown member "hint"`},
		"session on done":      {`{type: "done", credential: {}, session: 1}`, `unknown member "session"`},
		"no url":               {`{type: "redirect"}`, "url is required"},
		"script url":           {`{type: "redirect", url: "javascript:alert(1)"}`, "absolute http(s) URL"},
		"relative url":         {`{type: "paste", url: "/login"}`, "absolute http(s) URL"},
		"url with credentials": {`{type: "redirect", url: "https://user:pass@a.example"}`, "absolute http(s) URL"},
		"url with spaces":      {`{type: "redirect", url: "https://a.example/ x"}`, "absolute http(s) URL"},
		"no user code":         {`{type: "device", verificationUri: "https://a.example"}`, "userCode"},
		"fractional interval":  {`{type: "pending", interval: 1.5}`, "whole seconds"},
		"long expiry":          {`{type: "device", userCode: "A", verificationUri: "https://a.example", expiresIn: 3601}`, "whole seconds"},
		"no fields":            {`{type: "fields", fields: []}`, "array of 1 to"},
		"repeated field":       {`{type: "fields", fields: [{name: "a", label: "A"}, {name: "a", label: "B"}]}`, "is repeated"},
		"field without label":  {`{type: "fields", fields: [{name: "a"}]}`, "label"},
		"unknown field type":   {`{type: "fields", fields: [{name: "a", label: "A", type: "file"}]}`, "must be text, password or textarea"},
		"oversized session":    {`{type: "pending", session: ` + session + `}`, "session exceeds"},
		"no credential":        {`{type: "done"}`, "credential is required"},
		"bad expiry":           {`{type: "done", credential: {}, expiresAt: -1}`, "expiresAt"},
		"multi-line label":     {`{type: "done", credential: {}, label: "a\nb"}`, "single-line"},
		"protected header":     {`{type: "done", credential: {}, headers: {Host: "x"}}`, "is not allowed"},
		"control in query":     {`{type: "done", credential: {}, query: {a: "b\nc"}}`, "is invalid"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := loginStep(t, tc.step)
			require.ErrorContains(t, err, tc.message)
		})
	}
}

func TestRefreshResults(t *testing.T) {
	call := func(result string) (CredentialResult, error) {
		plugin := compileProviderPlugin(t, simpleRelay, `export function refresh(ctx) { return `+result+`; }`)
		return plugin.CallRefresh(context.Background(), CredentialContext{BaseURL: "https://api.vendor.example", Credential: json.RawMessage(`{"t":1}`)})
	}
	result, err := call(`{credential: {t: ctx.credential.t + 1}, expiresAt: 5}`)
	require.NoError(t, err)
	assert.JSONEq(t, `{"t":2}`, string(result.Credential))
	result, err = call(`{relogin: true}`)
	require.NoError(t, err)
	assert.True(t, result.Relogin)
	_, err = call(`{relogin: false}`)
	require.ErrorContains(t, err, "must be exactly")
	_, err = call(`{relogin: true, credential: {}}`)
	require.ErrorContains(t, err, "must be exactly")
	_, err = call(`{}`)
	require.ErrorContains(t, err, "credential is required")
}

func TestScheduledContextAndResult(t *testing.T) {
	plugin := compileProviderPlugin(t, simpleRelay, `
export function scheduled(ctx) {
  if (ctx.baseUrl !== "https://api.vendor.example" || ctx.config.region !== "test") throw new Error("missing channel context");
  if (ctx.reason === "timer") {
    if (ctx.credential !== null || ctx.apiKey !== "static-key" || ctx.token.access !== "token" || "disabledReason" in ctx) throw new Error("invalid static key context");
    return {};
  }
  if (ctx.reason !== "disabled" || ctx.keyStatus !== "auto_disabled" || ctx.disabledReason !== "Quota exhausted" || ctx.apiKey !== "" || "token" in ctx) throw new Error("invalid credential context");
  return {next: 90, credential: {remaining: ctx.credential.remaining - 1}, balance: {amount: 12, currency: "usd"}, keyStatus: "enabled", notify: {EN: " Restored ", zh: "已恢复"}};
}`)
	assert.True(t, plugin.HasProviderHook("scheduled"))
	result, err := plugin.CallScheduled(t.Context(), ScheduledContext{
		CredentialContext: CredentialContext{BaseURL: "https://api.vendor.example", APIKey: "static-key", Config: json.RawMessage(`{"region":"test"}`), Token: json.RawMessage(`{"access":"token"}`)},
		Reason:            "timer", KeyStatus: "enabled", DisabledReason: "stale reason",
	})
	require.NoError(t, err)
	assert.Equal(t, time.Hour, result.Next)
	assert.Nil(t, result.Credential)
	assert.Nil(t, result.Balance)
	assert.Empty(t, result.KeyStatus)
	assert.Nil(t, result.Notify)

	result, err = plugin.CallScheduled(t.Context(), ScheduledContext{
		CredentialContext: CredentialContext{BaseURL: "https://api.vendor.example", Credential: json.RawMessage(`{"remaining":2}`), Config: json.RawMessage(`{"region":"test"}`)},
		Reason:            "disabled", KeyStatus: "auto_disabled", DisabledReason: "Quota exhausted",
	})
	require.NoError(t, err)
	assert.Equal(t, 90*time.Second, result.Next)
	assert.JSONEq(t, `{"remaining":1}`, string(result.Credential))
	require.NotNil(t, result.Balance)
	require.NotNil(t, result.Balance.Amount)
	assert.Equal(t, 12.0, *result.Balance.Amount)
	assert.Equal(t, "USD", result.Balance.Currency)
	assert.Equal(t, "enabled", result.KeyStatus)
	assert.Equal(t, LocalizedText{"en": "Restored", "zh": "已恢复"}, result.Notify)
}

func TestScheduledResultValidation(t *testing.T) {
	for _, tc := range []struct {
		name, expression string
		next             time.Duration
	}{
		{"default", `{}`, time.Hour},
		{"lower clamp", `{next: -1}`, time.Minute},
		{"minimum", `{next: 60}`, time.Minute},
		{"fractional seconds", `{next: 90.5}`, 90*time.Second + 500*time.Millisecond},
		{"maximum", `{next: 86400}`, 24 * time.Hour},
		{"upper clamp", `{next: 1e100}`, 24 * time.Hour},
	} {
		t.Run(tc.name, func(t *testing.T) {
			plugin := compileProviderPlugin(t, simpleRelay, `export function scheduled() { return `+tc.expression+`; }`)
			result, err := plugin.CallScheduled(t.Context(), ScheduledContext{})
			require.NoError(t, err)
			assert.Equal(t, tc.next, result.Next)
		})
	}
	for _, tc := range []struct{ name, expression, message string }{
		{"non-object", `null`, "must be an object"},
		{"unknown member", `{other: true}`, "unknown member"},
		{"string next", `{next: "60"}`, "finite seconds"},
		{"null next", `{next: null}`, "finite seconds"},
		{"NaN next", `{next: NaN}`, "finite seconds"},
		{"infinite next", `{next: Infinity}`, "finite seconds"},
		{"manual status", `{keyStatus: "disabled"}`, "keyStatus"},
		{"null status", `{keyStatus: null}`, "keyStatus"},
		{"non-object balance", `{balance: null}`, "must be an object"},
		{"missing currency", `{balance: {amount: 1}}`, "currency"},
		{"empty balance", `{balance: {}}`, "must have an amount"},
		{"invalid window", `{balance: {windows: [{name: "Hourly", used: "1", limit: 10}]}}`, "finite number"},
		{"unknown balance field", `{balance: {unlimited: true, other: 1}}`, "unknown member"},
		{"empty notify", `{notify: ""}`, "non-empty"},
		{"notify without English", `{notify: {zh: "已恢复"}}`, "en"},
		{"notify byte limit", `{notify: "好".repeat(400)}`, "1024 bytes"},
		{"notify total limit", `{notify: {en: "a".repeat(600), zh: "b".repeat(600)}}`, "1024 bytes"},
		{"credential size", `{credential: "a".repeat(65536)}`, "65536 bytes"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			plugin := compileProviderPlugin(t, simpleRelay, `export function scheduled() { return `+tc.expression+`; }`)
			result, err := plugin.CallScheduled(t.Context(), ScheduledContext{CredentialContext: CredentialContext{Credential: json.RawMessage(`{}`)}})
			require.ErrorContains(t, err, tc.message)
			assert.Equal(t, ScheduledResult{}, result)
		})
	}
	plugin := compileProviderPlugin(t, simpleRelay, `export function scheduled() { return {credential: null}; }`)
	result, err := plugin.CallScheduled(t.Context(), ScheduledContext{CredentialContext: CredentialContext{Credential: json.RawMessage(`{}`)}})
	require.NoError(t, err)
	assert.Equal(t, "null", string(result.Credential))
	_, err = plugin.CallScheduled(t.Context(), ScheduledContext{CredentialContext: CredentialContext{APIKey: "static-key"}})
	require.ErrorContains(t, err, "requires a plugin credential")

	plugin = compileProviderPlugin(t, simpleRelay, `export function scheduled() { throw new Error("vendor failed"); }`)
	result, err = plugin.CallScheduled(t.Context(), ScheduledContext{})
	require.Error(t, err)
	assert.Equal(t, ScheduledResult{}, result)
	canceled, cancel := context.WithCancel(t.Context())
	cancel()
	_, err = plugin.CallScheduled(canceled, ScheduledContext{})
	require.Error(t, err)
}

func TestCredentialHooksSeeTheCredentialOnlyWhereAllowed(t *testing.T) {
	plugin := compileProviderPlugin(t, simpleRelay, `
export function signRequest(ctx, req) { return {headers: {"X-Seen": JSON.stringify([ctx.credential, ctx.apiKey, req.method, req.url, req.bodySha256])}, query: {signed: "1"}}; }
export function prepareRequest(ctx) { return Object.keys(ctx).join() === "baseUrl,config" && ctx.baseUrl ? null : {effects: [{type: "unknown"}]}; }
export function credentialRejected(ctx) { return Object.keys(ctx).join() === "baseUrl,config"; }
`)
	signed, err := plugin.CallSignRequest(context.Background(), CredentialContext{BaseURL: "b", Credential: json.RawMessage(`{"t":1}`)}, "POST", "https://u/x", map[string]string{"A": "1"}, "abc")
	require.NoError(t, err)
	assert.Equal(t, `[{"t":1},"","POST","https://u/x","abc"]`, signed.Headers["X-Seen"])
	assert.Equal(t, "1", signed.Query["signed"])

	prepared, err := plugin.CallPrepareRequest(context.Background(), HookContext{BaseURL: "b"}, PrepareInput{Body: []byte(`{}`)})
	require.NoError(t, err)
	assert.Nil(t, prepared.Effects)

	rejected, err := plugin.CallCredentialRejected(context.Background(), HookContext{BaseURL: "b"}, 403, nil, "")
	require.NoError(t, err)
	assert.True(t, rejected)
}

func TestSignRequestResultRules(t *testing.T) {
	call := func(result string) error {
		plugin := compileProviderPlugin(t, simpleRelay, `export function signRequest() { return `+result+`; }`)
		_, err := plugin.CallSignRequest(context.Background(), CredentialContext{}, "GET", "https://u", nil, "")
		return err
	}
	require.NoError(t, call(`{}`))
	require.ErrorContains(t, call(`null`), "must be an object")
	require.ErrorContains(t, call(`{body: "x"}`), `unknown member "body"`)
	require.ErrorContains(t, call(`{headers: {Host: "x"}}`), "is not allowed")
	require.ErrorContains(t, call(`{headers: {"X-A": 1}}`), "must be a string")
}

func TestPrepareRequestReturnsEffectsAsText(t *testing.T) {
	plugin := compileProviderPlugin(t, simpleRelay, `
export function prepareRequest(ctx, req) {
  if (req.model === "none") return undefined;
  if (req.model === "empty") return {};
  if (req.model === "bad") return {body: {}};
  return {effects: [{type: "json.patch", ops: [{op: "add", path: "/seen", value: [req.path, req.upstreamPath, req.stream, req.body.a, req.headers["X-A"]]}]}]};
}`)
	input := PrepareInput{Path: "/in", UpstreamPath: "/up", Model: "m", Stream: true, Body: []byte(`{"a":1}`), Headers: map[string]string{"X-A": "h"}}
	text, err := plugin.CallPrepareRequest(context.Background(), HookContext{BaseURL: "b"}, input)
	require.NoError(t, err)
	assert.JSONEq(t, `[{"type":"json.patch","ops":[{"op":"add","path":"/seen","value":["/in","/up",true,1,"h"]}]}]`, string(text.Effects))

	for _, model := range []string{"none", "empty"} {
		input.Model = model
		text, err = plugin.CallPrepareRequest(context.Background(), HookContext{BaseURL: "b"}, input)
		require.NoError(t, err)
		assert.Nil(t, text.Effects)
	}
	input.Model = "bad"
	_, err = plugin.CallPrepareRequest(context.Background(), HookContext{BaseURL: "b"}, input)
	require.ErrorContains(t, err, `unknown member "body"`)
}

func TestConvertHooks(t *testing.T) {
	plugin := compileProviderPlugin(t, `[{incoming_path: "/v1/chat/completions", upstream_path: "/g", converter: "plugin"}]`, `
export function convertRequest(ctx, req) {
  if (req.form) return {body: {form: req.form, model: req.model, hasBody: "body" in req}};
  if (req.model === "result") return req.body;
  return {body: {prompt: req.body.messages[0].content, stream: req.stream}};
}
export function convertResponse(ctx, resp) {
  if (resp.status === 201) return {body: {member: "body" in resp ? "body" : "bodyBase64"}};
  if (resp.status === 202) return {bodyBase64: resp.bodyBase64, contentType: "audio/mpeg"};
  if (resp.status === 203) return JSON.parse(resp.body);
  if (resp.status === 204) return {body: "plain"};
  return {body: {status: resp.status, type: resp.headers["Content-Type"], body: JSON.parse(resp.body)}};
}
export function convertStreamEvent(ctx, input) {
  if (input.done) return {events: [{data: "[DONE]"}], state: null};
  if (input.data === "skip") return {};
  if (input.data === "bad") return {events: [{event: "a\nb", data: "x"}]};
  if (input.data === "many") return {events: Array.from({length: 1025}, () => ({data: "x"}))};
  return {events: [{event: input.event, data: {count: (ctx.state || 0) + 1, text: input.data}}, {data: input.data}], state: (ctx.state || 0) + 1};
}`)
	ctx := context.Background()
	converted, err := plugin.CallConvertRequest(ctx, HookContext{BaseURL: "b"}, ConvertInput{Body: []byte(`{"messages":[{"content":"hi"}]}`), Model: "m", Stream: true})
	require.NoError(t, err)
	assert.JSONEq(t, `{"prompt":"hi","stream":true}`, string(converted.Body))
	assert.Empty(t, converted.ContentType)
	assert.Empty(t, converted.Path)

	converted, err = plugin.CallConvertRequest(ctx, HookContext{BaseURL: "b"}, ConvertInput{Model: "m", Form: &RequestForm{
		Fields: map[string][]string{"model": {"m"}, "language": {"en", "fr"}},
		Files:  []RequestFile{{Field: "file", Filename: "a.wav", ContentType: "audio/wav", Size: 4}},
	}})
	require.NoError(t, err)
	assert.JSONEq(t, `{"form":{"fields":{"model":"m","language":["en","fr"]},"files":[{"field":"file","filename":"a.wav","contentType":"audio/wav","size":4}]},"model":"m","hasBody":false}`,
		string(converted.Body), "a form request has no body")

	for name, tc := range map[string]struct {
		result string
		want   ConvertedRequest
		err    string
	}{
		"text body": {result: `{"body":"a=1","contentType":"application/x-www-form-urlencoded"}`, want: ConvertedRequest{Body: []byte("a=1"), ContentType: "application/x-www-form-urlencoded"}},
		"form": {result: `{"form":{"fields":{"a":"1","b":["2","3"]},"files":[{"field":"upload","from":"file","filename":"a.wav","contentType":"audio/wav"},{"field":"more","from":"image[]#1"}]},"path":"/x"}`, want: ConvertedRequest{
			Form: &ConvertedForm{Fields: map[string][]string{"a": {"1"}, "b": {"2", "3"}}, Files: []ConvertedFormFile{
				{Field: "upload", From: "file", Filename: "a.wav", ContentType: "audio/wav"}, {Field: "more", From: "image[]#1"},
			}},
			Path: "/x",
		}},
		"file":                {result: `{"file":"file","contentType":"audio/wav"}`, want: ConvertedRequest{File: "file", ContentType: "audio/wav"}},
		"native response":     {result: `{"body":"x","nativeResponse":true}`, want: ConvertedRequest{Body: []byte("x"), NativeResponse: true}},
		"native not a bool":   {result: `{"body":"x","nativeResponse":"yes"}`, err: "nativeResponse must be a boolean"},
		"native websocket":    {result: `{"websocket":{},"nativeResponse":true}`, err: "with websocket has only websocket and state"},
		"nothing":             {result: `{}`, err: "must have exactly one of body, form and file"},
		"body and file":       {result: `{"body":"x","file":"file"}`, err: "must have only one of body, form, file and websocket"},
		"form and file":       {result: `{"form":{},"file":"file"}`, err: "must have only one of body, form, file and websocket"},
		"bad content type":    {result: `{"body":"x","contentType":"a\nb"}`, err: "contentType is invalid"},
		"form content type":   {result: `{"form":{},"contentType":"multipart/form-data"}`, err: "with a form has no contentType"},
		"form unknown member": {result: `{"form":{"parts":[]}}`, err: `unknown member "parts"`},
		"field not a string":  {result: `{"form":{"fields":{"a":1}}}`, err: `field "a" must be a string or an array of strings`},
		"file without from":   {result: `{"form":{"files":[{"field":"f"}]}}`, err: "files[0] from is invalid"},
		"file name breaks":    {result: `{"form":{"files":[{"field":"a\r\nb","from":"f"}]}}`, err: "files[0] field is invalid"},
		"file not a string":   {result: `{"file":3}`, err: "file must name a client file"},
		"file unknown member": {result: `{"form":{"files":[{"field":"f","from":"f","size":1}]}}`, err: `unknown member "size"`},
	} {
		t.Run(name, func(t *testing.T) {
			converted, err := plugin.CallConvertRequest(ctx, HookContext{BaseURL: "b"}, ConvertInput{Body: []byte(tc.result), Model: "result"})
			if tc.err != "" {
				require.ErrorContains(t, err, tc.err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, converted)
		})
	}

	reply, upstreamErr, err := plugin.CallConvertResponse(ctx, HookContext{BaseURL: "b", Path: "/p"}, 200, map[string]string{"Content-Type": "application/json"}, []byte(`{"a":1}`))
	require.NoError(t, err)
	assert.Nil(t, upstreamErr)
	assert.JSONEq(t, `{"status":200,"type":"application/json","body":{"a":1}}`, string(reply.Body))
	assert.Equal(t, "application/json", reply.ContentType, "the default content type")
	reply, _, err = plugin.CallConvertResponse(ctx, HookContext{BaseURL: "b", Path: "/p"}, 204, nil, nil)
	require.NoError(t, err)
	assert.Equal(t, "plain", string(reply.Body))

	audio := []byte{0xff, 0xf3, 0x00, 0x80, 0xc4, 0x00}
	reply, _, err = plugin.CallConvertResponse(ctx, HookContext{BaseURL: "b", Path: "/p"}, 202, map[string]string{"Content-Type": "audio/mpeg"}, audio)
	require.NoError(t, err)
	assert.Equal(t, ConvertedResponse{Body: audio, ContentType: "audio/mpeg"}, reply, "bytes pass through base64 unchanged")

	for contentType, member := range map[string]string{
		"application/json; charset=utf-8":   "body",
		"application/problem+json":          "body",
		"text/plain":                        "body",
		"text/event-stream":                 "body",
		"application/xml":                   "body",
		"application/atom+xml":              "body",
		"application/x-ndjson":              "body",
		"application/x-www-form-urlencoded": "body",
		"":                                  "body",
		"audio/mpeg":                        "bodyBase64",
		"application/octet-stream":          "bodyBase64",
		"image/png":                         "bodyBase64",
	} {
		reply, _, err := plugin.CallConvertResponse(ctx, HookContext{BaseURL: "b", Path: "/p"}, 201, map[string]string{"content-type": contentType}, []byte("text"))
		require.NoError(t, err, contentType)
		assert.JSONEq(t, `{"member":"`+member+`"}`, string(reply.Body), contentType)
	}
	reply, _, err = plugin.CallConvertResponse(ctx, HookContext{BaseURL: "b", Path: "/p"}, 201, nil, audio)
	require.NoError(t, err)
	assert.JSONEq(t, `{"member":"bodyBase64"}`, string(reply.Body), "a body without a content type that is not UTF-8")

	for result, want := range map[string]string{
		`{"body":"x","bodyBase64":"eA=="}`:    "must have exactly one of body and bodyBase64",
		`{"bodyBase64":"%%%"}`:                "bodyBase64 is not base64",
		`{"bodyBase64":1}`:                    "bodyBase64 must be a string",
		`{"body":"x","contentType":"a\r\nb"}`: "contentType is invalid",
		`{}`:                                  "body is required",
		`{"body":"x","extra":1}`:              `unknown member "extra"`,
	} {
		_, _, err := plugin.CallConvertResponse(ctx, HookContext{BaseURL: "b", Path: "/p"}, 203, nil, []byte(result))
		require.ErrorContains(t, err, want, result)
	}
	reply, _, err = plugin.CallConvertResponse(ctx, HookContext{BaseURL: "b", Path: "/p"}, 203, nil, []byte(`{"body":"x","contentType":"text/plain"}`))
	require.NoError(t, err)
	assert.Equal(t, ConvertedResponse{Body: []byte("x"), ContentType: "text/plain"}, reply)

	events, state, upstreamErr, err := plugin.CallConvertStreamEvent(ctx, HookContext{BaseURL: "b", Path: "/p"}, &StreamEvent{Event: "delta", Data: "hi"}, false)
	require.NoError(t, err)
	assert.Nil(t, upstreamErr)
	assert.Equal(t, "1", string(state))
	require.Len(t, events.Events, 2)
	assert.Equal(t, "delta", events.Events[0].Event)
	assert.JSONEq(t, `{"count":1,"text":"hi"}`, events.Events[0].Data)
	assert.Equal(t, StreamEvent{Data: "hi"}, events.Events[1])

	events, state, _, err = plugin.CallConvertStreamEvent(ctx, HookContext{BaseURL: "b", Path: "/p", State: json.RawMessage("4")}, &StreamEvent{Data: "next"}, false)
	require.NoError(t, err)
	assert.Equal(t, "5", string(state))
	assert.JSONEq(t, `{"count":5,"text":"next"}`, events.Events[0].Data)

	events, state, _, err = plugin.CallConvertStreamEvent(ctx, HookContext{BaseURL: "b", Path: "/p", State: json.RawMessage("5")}, &StreamEvent{Data: "skip"}, false)
	require.NoError(t, err)
	assert.Empty(t, events.Events)
	assert.Equal(t, "5", string(state), "a result without state keeps it")

	events, state, _, err = plugin.CallConvertStreamEvent(ctx, HookContext{BaseURL: "b", Path: "/p", State: json.RawMessage("5")}, nil, true)
	require.NoError(t, err)
	assert.Equal(t, []StreamEvent{{Data: "[DONE]"}}, events.Events)
	assert.Equal(t, "null", string(state))

	_, _, _, err = plugin.CallConvertStreamEvent(ctx, HookContext{BaseURL: "b", Path: "/p"}, &StreamEvent{Data: "bad"}, false)
	require.ErrorContains(t, err, "single-line")
	_, _, _, err = plugin.CallConvertStreamEvent(ctx, HookContext{BaseURL: "b", Path: "/p"}, &StreamEvent{Data: "many"}, false)
	require.ErrorContains(t, err, "more than 1024")
}

func TestConvertRequestPath(t *testing.T) {
	plugin := compileProviderPlugin(t, `[{incoming_path: "/v1/chat/completions", upstream_path: "/g", converter: "plugin"}]`, `
export function convertRequest(ctx, req) { return {body: "x", path: JSON.parse(req.model)}; }
export function convertResponse() { return {body: "x"}; }
export function convertStreamEvent() { return {}; }`)
	for _, path := range []string{"/v1/generate", "/v1/stream-endpoint?alt=sse", "/v1/models/a:generate?x=%2F"} {
		quoted, err := json.Marshal(path)
		require.NoError(t, err)
		converted, err := plugin.CallConvertRequest(context.Background(), HookContext{BaseURL: "b"}, ConvertInput{Body: []byte(`{}`), Model: string(quoted)})
		require.NoError(t, err, path)
		assert.Equal(t, path, converted.Path)
	}
	converted, err := plugin.CallConvertRequest(context.Background(), HookContext{BaseURL: "b"}, ConvertInput{Body: []byte(`{}`), Model: "null"})
	require.NoError(t, err)
	assert.Empty(t, converted.Path, "null keeps the route's upstream_path")
	for _, path := range []string{`""`, `"relative"`, `"//evil.example/x"`, `"https://x/y"`, `"/a/../b"`, `"/a/%2e%2e/b"`, `"/a/.."`, `"/a#frag"`, `"/a\u0000"`, `3`} {
		_, err := plugin.CallConvertRequest(context.Background(), HookContext{BaseURL: "b"}, ConvertInput{Body: []byte(`{}`), Model: path})
		require.ErrorContains(t, err, "convertRequest result path must start with a single /", path)
	}
}

func TestConvertHooksReturnUpstreamErrors(t *testing.T) {
	plugin := compileProviderPlugin(t, `[{incoming_path: "/v1/chat/completions", upstream_path: "/g", converter: "plugin"}]`, `
export function convertRequest() { return {body: "x"}; }
export function convertResponse(ctx, resp) { return JSON.parse(resp.body); }
export function convertStreamEvent(ctx, input) { return JSON.parse(input.data); }`)
	ctx := context.Background()
	long := strings.Repeat("é", 5000)
	for name, tc := range map[string]struct {
		result string
		want   *UpstreamError
		err    string
	}{
		"full":             {result: `{"error":{"status":429,"message":"slow down","type":"rate_limit","code":"1302"}}`, want: &UpstreamError{Status: 429, Message: "slow down", Type: "rate_limit", Code: "1302"}},
		"message only":     {result: `{"error":{"message":"bad"}}`, want: &UpstreamError{Message: "bad"}},
		"null error":       {result: `{"error":null,"body":"y"}`},
		"long message":     {result: `{"error":{"message":"` + long + `","code":"` + strings.Repeat("c", 300) + `"}}`, want: &UpstreamError{Message: strings.Repeat("é", 4096), Code: strings.Repeat("c", 256)}},
		"status too low":   {result: `{"error":{"status":200,"message":"x"}}`, err: "status must be an integer from 400 to 599"},
		"status too high":  {result: `{"error":{"status":600,"message":"x"}}`, err: "status must be an integer from 400 to 599"},
		"fraction":         {result: `{"error":{"status":429.5,"message":"x"}}`, err: "status must be an integer from 400 to 599"},
		"no message":       {result: `{"error":{"status":429}}`, err: "message must be a non-empty string"},
		"blank message":    {result: `{"error":{"message":"  "}}`, err: "message must be a non-empty string"},
		"unknown member":   {result: `{"error":{"message":"x","detail":"y"}}`, err: `unknown member "detail"`},
		"not an object":    {result: `{"error":"x"}`, err: "error must be an object"},
		"with other parts": {result: `{"error":{"message":"x"},"body":"y"}`, err: "error must be the only member"},
		"code not string":  {result: `{"error":{"message":"x","code":1302}}`, err: "code must be a string"},
	} {
		t.Run(name, func(t *testing.T) {
			_, upstreamErr, err := plugin.CallConvertResponse(ctx, HookContext{BaseURL: "b", Path: "/p"}, 200, nil, []byte(tc.result))
			if tc.err != "" {
				require.ErrorContains(t, err, tc.err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tc.want, upstreamErr)
			}

			events, state, upstreamErr, err := plugin.CallConvertStreamEvent(ctx, HookContext{BaseURL: "b", Path: "/p", State: json.RawMessage(`{"kept":true}`)}, &StreamEvent{Data: strings.Replace(tc.result, `"body":"y"`, `"events":[]`, 1)}, false)
			if tc.err != "" {
				require.ErrorContains(t, err, strings.Replace(tc.err, "convertResponse", "convertStreamEvent", 1))
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, upstreamErr)
			if tc.want != nil {
				assert.Empty(t, events)
				assert.JSONEq(t, `{"kept":true}`, string(state), "an error keeps the state")
			}
		})
	}
}

// ingress, egress and report reach the instance's own service with GET, HEAD
// and POST; request and outbound have no network. report gets ctx with stage
// "report" and the record, and its return value is ignored.
func TestFetchInRequestProcessingHooks(t *testing.T) {
	plugin, err := CompilePlugin(`export const meta = {apiVersion: 1, key: "observe", name: "Observe", version: "1.0.0", author: {name: "Test"}};
function send(ctx, value) {
  utils.fetch({url: "https://hooks.example/" + ctx.stage, method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({stage: ctx.stage, instance: ctx.instance.id, value})});
}
export function ingress(ctx, req) { send(ctx, req.body); return {action: "continue"}; }
export function request(ctx, req) { send(ctx, req.body); return {action: "continue"}; }
export function outbound(ctx, req) { send(ctx, req.body); return {action: "continue"}; }
export function egress(ctx, req) { send(ctx, req.body); return {action: "continue"}; }
export function report(ctx, record) {
  if (record.fail) throw new Error("secret " + record.requestId);
  send(ctx, record);
  return () => 1;
}`, Options{})
	require.NoError(t, err)
	assert.Equal(t, []string{"ingress", "request", "outbound", "egress", ReportHook}, plugin.TransformHooks())
	var requests []FetchRequest
	ctx := WithFetcher(context.Background(), func(_ context.Context, request FetchRequest) (FetchResponse, error) {
		requests = append(requests, request)
		return FetchResponse{Status: 200, Body: []byte(`{}`)}, nil
	})
	tctx := TransformContext{Instance: TransformInstance{ID: "rp_1"}}
	for _, stage := range TransformStages {
		tctx.Stage = stage
		_, err := plugin.CallTransform(ctx, tctx, TransformRequest{Body: json.RawMessage(`{"model":"m"}`)})
		if stage == "request" || stage == "outbound" {
			var transformErr *TransformError
			require.ErrorAs(t, err, &transformErr, stage)
			assert.Equal(t, "utils.fetch is not available in "+stage, transformErr.Thrown)
			continue
		}
		require.NoError(t, err, stage)
	}
	tctx.Stage = ""
	require.NoError(t, plugin.CallReport(ctx, tctx, json.RawMessage(`{"requestId":"req-1"}`)))
	require.Len(t, requests, 3)
	for index, stage := range []string{"ingress", "egress", ReportHook} {
		assert.Equal(t, "POST", requests[index].Method)
		assert.Equal(t, "https://hooks.example/"+stage, requests[index].URL)
		assert.Equal(t, stage, requests[index].Hook)
	}
	assert.JSONEq(t, `{"stage":"ingress","instance":"rp_1","value":{"model":"m"}}`, requests[0].Body)
	assert.JSONEq(t, `{"stage":"report","instance":"rp_1","value":{"requestId":"req-1"}}`, requests[2].Body)

	// A throw is a classed failure; its text stays out of the error.
	err = plugin.CallReport(ctx, tctx, json.RawMessage(`{"requestId":"req-2","fail":true}`))
	var transformErr *TransformError
	require.ErrorAs(t, err, &transformErr)
	assert.Equal(t, TransformErrorThrow, transformErr.Class)
	assert.Equal(t, "plugin observe hook report threw an error", err.Error())
	// report is not a stage.
	_, err = plugin.CallTransform(ctx, TransformContext{Stage: ReportHook}, TransformRequest{Body: json.RawMessage(`{}`)})
	require.ErrorContains(t, err, "plugin observe hook report failed: the plugin does not export it")

	// A plugin that only reports has a request processing part.
	reporter, err := CompilePlugin(`export const meta = {apiVersion: 1, key: "reporter", name: "Reporter", version: "1.0.0", author: {name: "Test"}};
export function report() {}`, Options{})
	require.NoError(t, err)
	assert.True(t, reporter.Meta.HasTransformPart())
	assert.Equal(t, []string{ReportHook}, reporter.TransformHooks())
}

func TestFetchPostInCredentialHooks(t *testing.T) {
	const post = `utils.fetch({url: "https://auth.example/token", method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: "grant_type=refresh_token"})`
	plugin := compileProviderPlugin(t, `[{incoming_path: "/v1/chat/completions", upstream_path: "/g", converter: "plugin"}]`, `
export function login() { return {type: "done", credential: `+post+`.body}; }
export function refresh() { return {credential: `+post+`.body}; }
export function scheduled() { return {credential: `+post+`.body}; }
export function revoke() { `+post+`; }
export function signRequest() { `+post+`; return {}; }
export function prepareRequest() { `+post+`; }
export function credentialRejected() { `+post+`; return true; }
export function convertRequest() { `+post+`; return {body: "x"}; }
export function convertResponse() { `+post+`; return {body: "x"}; }
export function convertStreamEvent() { `+post+`; return {}; }
`)
	var requests []FetchRequest
	ctx := WithFetcher(context.Background(), func(_ context.Context, request FetchRequest) (FetchResponse, error) {
		requests = append(requests, request)
		return FetchResponse{Status: 200, Headers: map[string]string{"Content-Type": "application/json"}, Body: []byte(`{"ok":true}`)}, nil
	})

	step, err := plugin.CallLogin(ctx, "b", LoginContext{}, nil, nil)
	require.NoError(t, err)
	assert.JSONEq(t, `{"ok":true}`, string(step.Result.Credential))
	result, err := plugin.CallRefresh(ctx, CredentialContext{})
	require.NoError(t, err)
	assert.JSONEq(t, `{"ok":true}`, string(result.Credential))
	require.NoError(t, plugin.CallRevoke(ctx, CredentialContext{}))
	scheduled, err := plugin.CallScheduled(ctx, ScheduledContext{CredentialContext: CredentialContext{Credential: json.RawMessage(`{}`)}})
	require.NoError(t, err)
	assert.JSONEq(t, `{"ok":true}`, string(scheduled.Credential))
	require.Len(t, requests, 4)
	assert.Equal(t, "POST", requests[0].Method)
	assert.Equal(t, "grant_type=refresh_token", requests[0].Body)

	for name, call := range map[string]func() error{
		"signRequest": func() error {
			_, err := plugin.CallSignRequest(ctx, CredentialContext{}, "GET", "https://u", nil, "")
			return err
		},
		"prepareRequest": func() error {
			_, err := plugin.CallPrepareRequest(ctx, HookContext{BaseURL: "b"}, PrepareInput{Body: []byte(`{}`)})
			return err
		},
		"credentialRejected": func() error {
			_, err := plugin.CallCredentialRejected(ctx, HookContext{BaseURL: "b"}, 403, nil, "")
			return err
		},
		"convertRequest": func() error {
			_, err := plugin.CallConvertRequest(ctx, HookContext{BaseURL: "b"}, ConvertInput{Body: []byte(`{}`), Model: "m"})
			return err
		},
		"convertResponse": func() error {
			_, _, err := plugin.CallConvertResponse(ctx, HookContext{BaseURL: "b", Path: "/p"}, 200, nil, nil)
			return err
		},
		"convertStreamEvent": func() error {
			_, _, _, err := plugin.CallConvertStreamEvent(ctx, HookContext{BaseURL: "b", Path: "/p"}, &StreamEvent{Data: "x"}, false)
			return err
		},
	} {
		t.Run(name, func(t *testing.T) {
			require.ErrorContains(t, call(), "utils.fetch")
		})
	}
	assert.Len(t, requests, 4, "no other hook reached the network")
}

func TestFetchBodyRules(t *testing.T) {
	plugin := compileProviderPlugin(t, simpleRelay, `
export function login(ctx, request) { return {type: "done", credential: utils.fetch(request).status}; }
export function signRequest() { utils.fetch({url: "https://auth.example/x", body: "b"}); return {}; }`)
	ctx := WithFetcher(context.Background(), func(context.Context, FetchRequest) (FetchResponse, error) {
		return FetchResponse{Status: 200, Body: []byte(`{}`)}, nil
	})
	const url = `"url":"https://auth.example/x"`
	for name, tc := range map[string]struct{ request, message string }{
		"body on GET":    {`{` + url + `,"body":"b"}`, "body requires method POST"},
		"body on HEAD":   {`{` + url + `,"method":"HEAD","body":"b"}`, "body requires method POST"},
		"body an object": {`{` + url + `,"method":"POST","body":{}}`, "body must be a string"},
		"PUT":            {`{` + url + `,"method":"PUT"}`, "supports only GET, HEAD and POST"},
		"DELETE":         {`{` + url + `,"method":"DELETE"}`, "supports only GET, HEAD and POST"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := plugin.CallLogin(ctx, "b", LoginContext{}, nil, json.RawMessage(tc.request))
			require.ErrorContains(t, err, tc.message)
		})
	}
	oversized, err := json.Marshal(map[string]string{"url": "https://auth.example/x", "method": "POST", "body": strings.Repeat("a", MaxFetchBodyBytes+1)})
	require.NoError(t, err)
	_, err = plugin.CallLogin(ctx, "b", LoginContext{}, nil, json.RawMessage(oversized))
	require.ErrorContains(t, err, "body exceeds")
	_, err = plugin.CallSignRequest(ctx, CredentialContext{}, "GET", "https://u", nil, "")
	require.ErrorContains(t, err, `unsupported member "body"`)
}

const transformMeta = `export const meta = {` + providerMeta + `, configSchema: {type: "object", properties: {
  limit: {type: "integer", title: "Limit", default: 3},
}}};`

func TestCallTransformResults(t *testing.T) {
	plugin, err := CompilePlugin(transformMeta+`
export function ingress(ctx, req) {
  if (req.body.throw) throw new Error("matched " + req.body.text);
  return req.body.result;
}`, Options{})
	require.NoError(t, err)
	tooManyFindings := `[` + strings.TrimSuffix(strings.Repeat(`{"rule":"r","count":1},`, 65), ",") + `]`
	for name, tc := range map[string]struct {
		body   string
		want   TransformResult
		effect string
		reason string
	}{
		"continue with effects and findings": {
			body: `{"result":{"action":"continue","effects":[{"type":"json.patch","ops":[{"op":"add","path":"/b","value":{"z":1,"a":2}}]}],"findings":[{"rule":"email","category":"pii","path":"/messages/0/content","count":2}]}}`,
			want: TransformResult{Action: "continue", Findings: []TransformFinding{{Rule: "email", Category: "pii", Path: "/messages/0/content", Count: 2}}},
			// The effects keep the member order the plugin wrote.
			effect: `[{"type":"json.patch","ops":[{"op":"add","path":"/b","value":{"z":1,"a":2}}]}]`,
		},
		"continue alone":     {body: `{"result":{"action":"continue"}}`, want: TransformResult{Action: "continue"}},
		"notice as a string": {body: `{"result":{"action":"continue","notice":" Removed 2 email addresses "}}`, want: TransformResult{Action: "continue", Notice: LocalizedText{"en": "Removed 2 email addresses"}}},
		"notice by locale": {
			body: `{"result":{"action":"reject","code":"x","notice":{"en":"Blocked a keyword","zh-cn":"拦截了关键词"}}}`,
			want: TransformResult{Action: "reject", Code: "x", Notice: LocalizedText{"en": "Blocked a keyword", "zh-CN": "拦截了关键词"}},
		},
		"notice without en":   {body: `{"result":{"action":"continue","notice":{"zh":"拦截"}}}`, reason: "notice must be a string or a locale object"},
		"notice too long":     {body: `{"result":{"action":"continue","notice":"` + strings.Repeat("a", 201) + `"}}`, reason: "notice must be a string or a locale object"},
		"notice of 9 locales": {body: `{"result":{"action":"continue","notice":{"en":"a","de":"a","fr":"a","es":"a","it":"a","ja":"a","ko":"a","ru":"a","zh":"a"}}}`, reason: "notice must be a string or a locale object"},
		"notice not text":     {body: `{"result":{"action":"continue","notice":1}}`, reason: "notice must be a string or a locale object"},
		"reject with code":    {body: `{"result":{"action":"reject","code":"blocked.word-1","message":"Not allowed","ruleId":"r1"}}`, want: TransformResult{Action: "reject", Code: "blocked.word-1", Message: "Not allowed", RuleID: "r1"}},
		"reject with findings": {
			body: `{"result":{"action":"reject","code":"moderation.flagged","ruleId":"hate","findings":[{"rule":"hate","category":"hate","count":2}]}}`,
			want: TransformResult{Action: "reject", Code: "moderation.flagged", RuleID: "hate", Findings: []TransformFinding{{Rule: "hate", Category: "hate", Count: 2}}},
		},
		"bad code":          {body: `{"result":{"action":"reject","code":"Blocked Word"}}`, reason: "code must match"},
		"missing code":      {body: `{"result":{"action":"reject"}}`, reason: "code must match"},
		"message too long":  {body: `{"result":{"action":"reject","code":"x","message":"` + strings.Repeat("a", 257) + `"}}`, reason: "message must be a string of at most 256 characters"},
		"effects on reject": {body: `{"result":{"action":"reject","code":"x","effects":[]}}`, reason: `result has unknown member "effects"`},
		"too many findings": {body: `{"result":{"action":"continue","findings":` + tooManyFindings + `}}`, reason: "findings must not exceed 64 entries"},
		"finding count":     {body: `{"result":{"action":"continue","findings":[{"rule":"r","count":-1}]}}`, reason: "findings[0].count must be a non-negative integer"},
		"non-array effects": {body: `{"result":{"action":"continue","effects":{}}}`, reason: "effects must be an array"},
		"unknown action":    {body: `{"result":{"action":"allow"}}`, reason: `action must be "continue" or "reject"`},
		"not an object":     {body: `{"result":"continue"}`, reason: "the result must be an object"},
	} {
		t.Run(name, func(t *testing.T) {
			result, err := plugin.CallTransform(context.Background(), TransformContext{Stage: "ingress"}, TransformRequest{Body: json.RawMessage(tc.body)})
			if tc.reason != "" {
				var transformErr *TransformError
				require.ErrorAs(t, err, &transformErr)
				assert.Equal(t, TransformErrorResult, transformErr.Class)
				assert.ErrorContains(t, err, "plugin vendor hook ingress returned an invalid result: "+tc.reason)
				return
			}
			require.NoError(t, err)
			if tc.effect != "" {
				assert.Equal(t, tc.effect, string(result.Effects))
			}
			result.Effects = nil
			assert.Equal(t, tc.want, result)
		})
	}

	// A throw names the plugin and the hook; what it threw, which may quote
	// the request, stays out of the error text.
	_, err = plugin.CallTransform(context.Background(), TransformContext{Stage: "ingress"}, TransformRequest{Body: json.RawMessage(`{"throw":true,"text":"user@example.com"}`)})
	var transformErr *TransformError
	require.ErrorAs(t, err, &transformErr)
	assert.Equal(t, TransformErrorThrow, transformErr.Class)
	assert.Equal(t, "plugin vendor hook ingress threw an error", err.Error())
	assert.Contains(t, transformErr.Thrown, "matched user@example.com")

	_, err = plugin.CallTransform(context.Background(), TransformContext{Stage: "egress"}, TransformRequest{Body: json.RawMessage(`{}`)})
	require.ErrorContains(t, err, "plugin vendor hook egress failed: the plugin does not export it")

	timed, err := CompilePlugin(transformMeta+`export function ingress() { for (;;) {} }`, Options{Timeout: 50 * time.Millisecond})
	require.NoError(t, err)
	_, err = timed.CallTransform(context.Background(), TransformContext{Stage: "ingress"}, TransformRequest{Body: json.RawMessage(`{}`)})
	require.ErrorAs(t, err, &transformErr)
	assert.Equal(t, TransformErrorTimeout, transformErr.Class)

	hungry, err := CompilePlugin(transformMeta+`export function ingress(ctx) { let garbage; for (;;) garbage = [ctx]; }`, Options{})
	require.NoError(t, err)
	_, err = hungry.CallTransform(context.Background(), TransformContext{Stage: "ingress"}, TransformRequest{Body: json.RawMessage(`{}`)})
	require.ErrorAs(t, err, &transformErr)
	assert.Equal(t, TransformErrorMemory, transformErr.Class)
	assert.Equal(t, "plugin vendor hook ingress ran past its memory limit", err.Error())
}

func TestCallTransformPassesContextAndRequest(t *testing.T) {
	plugin, err := CompilePlugin(transformMeta+`
export function request(ctx, req) { return {action: "continue", effects: [{ctx, req, fetch: typeof utils.fetch}]}; }`, Options{})
	require.NoError(t, err)
	config, err := plugin.ValidateConfig(nil)
	require.NoError(t, err)
	result, err := plugin.CallTransform(context.Background(), TransformContext{
		Stage: "request", Format: "openai", Path: "/v1/chat/completions", Model: "gpt", UpstreamModel: "gpt-up",
		Group: "vip", Channel: &TransformChannel{ID: 7, Type: 1}, Attempt: 1,
		User: TransformUser{ID: 5, Username: "alice"}, Token: &TransformToken{ID: 9, Name: "ci"},
		Instance: TransformInstance{ID: "rp_1", Name: "Limit"}, Config: config,
	}, TransformRequest{
		Body:    json.RawMessage(`{"messages":[{"role":"user","content":"[media:0]"}]}`),
		Media:   []TransformMedia{{Index: 0, Path: "/messages/0/content", MimeType: "image/png", Bytes: 10}},
		Summary: &TransformSummary{MessageCount: 1, HasImages: true},
	})
	require.NoError(t, err)
	assert.JSONEq(t, `[{"fetch":"function",
		"ctx":{"stage":"request","format":"openai","path":"/v1/chat/completions","model":"gpt","upstreamModel":"gpt-up","group":"vip",
			"channel":{"id":7,"type":1},"attempt":1,"user":{"id":5,"username":"alice"},"token":{"id":9,"name":"ci"},
			"instance":{"id":"rp_1","name":"Limit"},"config":{"limit":3}},
		"req":{"body":{"messages":[{"role":"user","content":"[media:0]"}]},
			"media":[{"index":0,"path":"/messages/0/content","mimeType":"image/png","bytes":10}],
			"summary":{"messageCount":1,"toolCount":0,"lastUserTextLength":0,"totalTextLength":0,"hasImages":true,"reasoningEffort":""}}}]`, string(result.Effects))
}

func TestUtilsParamOverrideOnlyInOutbound(t *testing.T) {
	t.Cleanup(func() { SetParamOverrideFunc(nil) })
	plugin, err := CompilePlugin(transformMeta+`
function run(req) { return {action: "continue", effects: [utils.paramOverride(req.body, {operations: [{path: "x", mode: "set", value: 1}]})]}; }
export function ingress(ctx, req) { return run(req); }
export function outbound(ctx, req) { return run(req); }`, Options{})
	require.NoError(t, err)
	call := func(stage string) (TransformResult, error) {
		return plugin.CallTransform(context.Background(), TransformContext{Stage: stage, Model: "gpt"}, TransformRequest{Body: json.RawMessage(`{"model":"gpt","b":1,"a":2}`)})
	}

	var seenStage, seenBody, seenOverride string
	SetParamOverrideFunc(func(ctx TransformContext, body, override json.RawMessage) (json.RawMessage, error) {
		seenStage, seenBody, seenOverride = ctx.Stage+" "+ctx.Model, string(body), string(override)
		return json.RawMessage(`{"body":{"model":"gpt","x":1},"headers":{"set":{"X-A":"b"}}}`), nil
	})
	result, err := call("outbound")
	require.NoError(t, err)
	assert.JSONEq(t, `[{"body":{"model":"gpt","x":1},"headers":{"set":{"X-A":"b"}}}]`, string(result.Effects))
	assert.Equal(t, "outbound gpt", seenStage)
	assert.Equal(t, `{"model":"gpt","b":1,"a":2}`, seenBody, "the body keeps its member order")
	assert.Equal(t, `{"operations":[{"path":"x","mode":"set","value":1}]}`, seenOverride)

	var transformErr *TransformError
	_, err = call("ingress")
	require.ErrorAs(t, err, &transformErr)
	assert.Contains(t, transformErr.Thrown, "utils.paramOverride is not available in ingress")

	SetParamOverrideFunc(nil)
	_, err = call("outbound")
	require.ErrorAs(t, err, &transformErr)
	assert.Contains(t, transformErr.Thrown, "utils.paramOverride is not available on this host")
}

const replyMeta = `export const meta = {` + providerMeta + `};`

func TestReplyHookIsARequestProcessingPart(t *testing.T) {
	plugin, err := CompilePlugin(replyMeta+`export function reply() { return {action: "continue"}; }`, Options{})
	require.NoError(t, err)
	assert.True(t, plugin.Meta.HasTransformPart())
	assert.Equal(t, []string{ReplyHook}, plugin.TransformHooks())

	plugin, err = CompilePlugin(replyMeta+`export function ingress() {} export function reply() {} export function report() {}`, Options{})
	require.NoError(t, err)
	assert.Equal(t, []string{"ingress", ReplyHook, ReportHook}, plugin.TransformHooks())
}

func TestCallReplyPassesContextAndOutputs(t *testing.T) {
	plugin, err := CompilePlugin(replyMeta+`export function reply(ctx, res) { throw new Error(JSON.stringify({ctx, res, fetch: typeof utils.fetch})); }`, Options{})
	require.NoError(t, err)
	_, err = plugin.CallReply(context.Background(), TransformContext{
		Stage: "ingress", Format: "claude", Path: "/v1/messages", Model: "claude", UpstreamModel: "claude-up", Group: "vip",
		Channel: &TransformChannel{ID: 7, Type: 14}, Attempt: 1, User: TransformUser{ID: 1, Username: "admin"},
		Instance: TransformInstance{ID: "rp_1", Name: "Mask"},
	}, true, []ReplyOutput{{Index: 0, Text: "héllo 😀", Offset: 12, Final: true}})
	var transformErr *TransformError
	require.ErrorAs(t, err, &transformErr)
	thrown := transformErr.Thrown[strings.Index(transformErr.Thrown, "{"):]
	assert.JSONEq(t, `{"fetch":"function",
		"ctx":{"stage":"reply","format":"claude","path":"/v1/messages","model":"claude","upstreamModel":"claude-up","group":"vip",
			"channel":{"id":7,"type":14},"attempt":1,"user":{"id":1,"username":"admin"},"instance":{"id":"rp_1","name":"Mask"},"config":{}},
		"res":{"stream":true,"outputs":[{"index":0,"text":"héllo 😀","offset":12,"final":true}]}}`, thrown)
}

func TestCallReplyResults(t *testing.T) {
	plugin, err := CompilePlugin(replyMeta+`export function reply(ctx, res) { return JSON.parse(ctx.instance.name); }`, Options{})
	require.NoError(t, err)
	outputs := []ReplyOutput{{Index: 0, Text: "a😀b"}, {Index: 2, Text: "xyz"}}
	for name, tc := range map[string]struct {
		result string
		want   ReplyResult
		reason string
	}{
		"continue alone": {result: `{"action":"continue"}`, want: ReplyResult{Action: "continue"}},
		"masks and hold": {
			result: `{"action":"continue","hold":8192,"mask":[{"index":0,"start":1,"end":3,"category":"emoji"},{"index":2,"start":0,"end":3}],"findings":[{"rule":"r","count":1}],"notice":"Masked"}`,
			want: ReplyResult{Action: "continue", Hold: 8192, Masks: []ReplyMask{{Index: 0, Start: 1, End: 3, Category: "emoji"}, {Index: 2, Start: 0, End: 3}},
				Findings: []TransformFinding{{Rule: "r", Count: 1}}, Notice: LocalizedText{"en": "Masked"}},
		},
		"stop":              {result: `{"action":"stop","code":"policy.blocked","message":"No"}`, want: ReplyResult{Action: "stop", Code: "policy.blocked", Message: "No"}},
		"pass":              {result: `{"action":"pass"}`, want: ReplyResult{Action: "pass"}},
		"pass with hold":    {result: `{"action":"pass","hold":0}`, reason: `result has unknown member "hold"`},
		"pass with mask":    {result: `{"action":"pass","mask":[]}`, reason: `result has unknown member "mask"`},
		"pass with notice":  {result: `{"action":"pass","notice":"x"}`, reason: `result has unknown member "notice"`},
		"hold too long":     {result: `{"action":"continue","hold":8193}`, reason: "hold must be an integer from 0 to 8192"},
		"negative hold":     {result: `{"action":"continue","hold":-1}`, reason: "hold must be an integer from 0 to 8192"},
		"mask past text":    {result: `{"action":"continue","mask":[{"index":0,"start":0,"end":5}]}`, reason: "mask[0] must satisfy 0 <= start < end <= text.length"},
		"empty mask":        {result: `{"action":"continue","mask":[{"index":0,"start":2,"end":2}]}`, reason: "mask[0] must satisfy 0 <= start < end <= text.length"},
		"unknown output":    {result: `{"action":"continue","mask":[{"index":1,"start":0,"end":1}]}`, reason: "mask[0].index must be the index of an output of the call"},
		"mask member":       {result: `{"action":"continue","mask":[{"index":0,"start":0,"end":1,"text":"x"}]}`, reason: `mask[0] result has unknown member "text"`},
		"too many masks":    {result: `{"action":"continue","mask":[` + strings.TrimSuffix(strings.Repeat(`{"index":2,"start":0,"end":1},`, 1025), ",") + `]}`, reason: "mask must be an array of at most 1024 entries"},
		"replacement":       {result: `{"action":"continue","text":"rewritten"}`, reason: `result has unknown member "text"`},
		"stop without code": {result: `{"action":"stop"}`, reason: "code must match"},
		"stop with mask":    {result: `{"action":"stop","code":"x","mask":[]}`, reason: `result has unknown member "mask"`},
		"reject":            {result: `{"action":"reject","code":"x"}`, reason: `action must be "continue", "pass" or "stop"`},
	} {
		t.Run(name, func(t *testing.T) {
			result, err := plugin.CallReply(context.Background(), TransformContext{Instance: TransformInstance{Name: tc.result}}, false, outputs)
			if tc.reason != "" {
				var transformErr *TransformError
				require.ErrorAs(t, err, &transformErr)
				assert.Equal(t, TransformErrorResult, transformErr.Class)
				assert.ErrorContains(t, err, "plugin vendor hook reply returned an invalid result: "+tc.reason)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, result)
		})
	}
}

// samplePlugin is a request plugin whose meta.samples is samples.
func samplePlugin(samples string) string {
	return `export const meta = {` + providerMeta + `, samples: ` + samples + `};
export function ingress() { return {action: "continue"}; }`
}

func TestSamplesLoadAsWritten(t *testing.T) {
	plugin, err := CompilePlugin(samplePlugin(`[
		{name: "Plain chat", lang: "en", format: "openai", body: {model: "gpt", messages: [{role: "user", content: [{type: "text", text: "What is this?"}, "[sample-image]"]}]}, reply: "A cat"},
		{name: {en: "Any", zh: "任意"}, format: "gemini", body: {contents: [{parts: [{text: "hi"}]}]}}
	]`), Options{})
	require.NoError(t, err)
	encoded, err := common.Marshal(plugin.Meta.Samples)
	require.NoError(t, err)
	assert.JSONEq(t, `[
		{"name":{"en":"Plain chat"},"lang":"en","format":"openai","body":{"model":"gpt","messages":[{"role":"user","content":[{"type":"text","text":"What is this?"},"[sample-image]"]}]},"reply":"A cat"},
		{"name":{"en":"Any","zh":"任意"},"format":"gemini","body":{"contents":[{"parts":[{"text":"hi"}]}]}}
	]`, string(encoded))
	// The body keeps the member order the plugin wrote.
	assert.True(t, strings.HasPrefix(string(plugin.Meta.Samples[0].Body), `{"model":"gpt","messages"`))
}

func TestSamplesCarryTextOnly(t *testing.T) {
	body := func(content string) string {
		return `[{name: "S", format: "openai", body: {messages: [{role: "user", content: ` + content + `}]}}]`
	}
	nine := strings.TrimSuffix(strings.Repeat(`{name: "S", format: "openai", body: {}},`, 9), ",")
	fourEnglish := strings.TrimSuffix(strings.Repeat(`{name: "S", lang: "en", format: "openai", body: {}},`, 4), ",")
	fourAny := strings.TrimSuffix(strings.Repeat(`{name: "S", format: "openai", body: {}},`, 4), ",")
	for name, tc := range map[string]struct{ samples, reason string }{
		"data URL":           {body(`" DATA:image/png;base64,AAAA"`), "plugin meta samples[0].body.messages[0].content: samples must not carry data: URLs"},
		"base64":             {body(`"` + strings.Repeat("QUJD", 25) + `"`), "plugin meta samples[0].body.messages[0].content: samples must not carry base64 data"},
		"link":               {body(`[{type: "image_url", image_url: {url: " https://example.com/cat.png "}}]`), "plugin meta samples[0].body.messages[0].content[0].image_url.url: samples must not be links"},
		"media placeholder":  {body(`"look at [media:0]"`), "plugin meta samples[0].body.messages[0].content: samples must not carry media placeholders"},
		"inlineData":         {body(`[{inlineData: {mimeType: "image/png"}}]`), "plugin meta samples[0].body.messages[0].content[0].inlineData: samples must not carry media"},
		"inline_data":        {body(`[{inline_data: {}}]`), "plugin meta samples[0].body.messages[0].content[0].inline_data: samples must not carry media"},
		"fileData":           {body(`[{fileData: {}}]`), "plugin meta samples[0].body.messages[0].content[0].fileData: samples must not carry media"},
		"file_data":          {body(`[{file_data: {}}]`), "plugin meta samples[0].body.messages[0].content[0].file_data: samples must not carry media"},
		"data with type":     {body(`[{source: {data: "abc", media_type: "image/png"}}]`), "plugin meta samples[0].body.messages[0].content[0].source.data: samples must not carry media"},
		"data with mimeType": {body(`[{data: "abc", mimeType: "image/png"}]`), "plugin meta samples[0].body.messages[0].content[0].data: samples must not carry media"},
		"base64 type":        {body(`[{source: {type: "base64"}}]`), "plugin meta samples[0].body.messages[0].content[0].source.type: samples must not carry base64 media"},
		"image not an item":  {body(`"[sample-image]"`), "plugin meta samples[0].body.messages[0].content: [sample-image] must be a whole element of a content or parts array"},
		"image in a text":    {body(`["see [sample-image]"]`), "plugin meta samples[0].body.messages[0].content[0]: [sample-image] must be a whole element of a content or parts array"},
		"reply link":         {`[{name: "S", format: "openai", body: {}, reply: "https://example.com"}]`, "plugin meta samples[0].reply: samples must not be links"},
		"reply too long":     {`[{name: "S", format: "openai", body: {}, reply: "` + strings.Repeat("a", 4097) + `"}]`, "plugin meta samples[0].reply must be a non-empty string of at most 4096 bytes"},
		"body too large":     {`[{name: "S", format: "openai", body: {text: "` + strings.Repeat("a b ", 4096) + `"}}]`, "plugin meta samples[0].body must not exceed 16384 bytes"},
		"name too long":      {`[{name: "` + strings.Repeat("n", 65) + `", format: "openai", body: {}}]`, "plugin meta samples[0].name"},
		"unknown format":     {`[{name: "S", format: "openai_image", body: {}}]`, "plugin meta samples[0].format must be one of openai, openai_responses, claude, gemini"},
		"unknown member":     {`[{name: "S", format: "openai", body: {}, config: {}}]`, `plugin meta samples[0] has unknown member "config"`},
		"bad lang":           {`[{name: "S", lang: "en-US", format: "openai", body: {}}]`, "plugin meta samples[0].lang must be a base language code"},
		"too many":           {`[` + nine + `]`, "plugin meta samples must not exceed 8 entries"},
		"too many per lang":  {`[` + fourEnglish + `]`, "plugin meta samples[3]: at most 3 samples may share a lang"},
		"too many any lang":  {`[` + fourAny + `]`, "plugin meta samples[3]: at most 3 samples may share a lang"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := CompilePlugin(samplePlugin(tc.samples), Options{})
			require.Error(t, err)
			assert.ErrorContains(t, err, tc.reason)
		})
	}

	// Three per language and three for any language fit together.
	threeEach := strings.TrimSuffix(strings.Repeat(`{name: "S", lang: "en", format: "openai", body: {}},{name: "S", format: "openai", body: {}},`, 3), ",")
	_, err := CompilePlugin(samplePlugin(`[`+threeEach+`]`), Options{})
	require.NoError(t, err)

	// Samples belong to the request processing part.
	_, err = CompilePlugin(`export const meta = {`+providerMeta+`, samples: []};`+providerTask, Options{})
	require.ErrorContains(t, err, "plugin vendor meta samples belongs to the request processing part")
}

func TestLocalizedTextFallbackIsDeterministic(t *testing.T) {
	for _, tc := range []struct {
		name string
		text LocalizedText
		lang string
		want string
	}{
		{name: "exact locale ignores case", text: LocalizedText{"en": "en", "zh": "zh", "zh-TW": "zh-TW"}, lang: "zh-tw", want: "zh-TW"},
		{name: "bare language beats regional locales", text: LocalizedText{"en": "en", "zh": "zh", "zh-TW": "zh-TW"}, lang: "zh-CN", want: "zh"},
		{name: "first regional locale in sorted order", text: LocalizedText{"en": "en", "zh-TW": "zh-TW", "zh-CN": "zh-CN"}, lang: "zh-SG", want: "zh-CN"},
		{name: "bare request picks a regional locale", text: LocalizedText{"en": "en", "zh-TW": "zh-TW", "zh-CN": "zh-CN"}, lang: "zh", want: "zh-CN"},
		{name: "other language falls back to en", text: LocalizedText{"en": "en", "ja": "ja"}, lang: "fr-FR", want: "en"},
		{name: "empty language falls back to en", text: LocalizedText{"en": "en", "zh": "zh"}, lang: "", want: "en"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, tc.text.Text(tc.lang))
		})
	}
}
