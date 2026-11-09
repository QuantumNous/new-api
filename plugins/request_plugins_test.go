package plugins_test

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/requestplugin"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// runRequestPlugin validates config against the plugin's schema, as the host
// does when an instance is saved, and runs one stage hook of a built-in
// request processing plugin.
func runRequestPlugin(t *testing.T, key, stage, config string, req jsplugin.TransformRequest) jsplugin.TransformResult {
	t.Helper()
	plugin, found := jsplugin.DefaultRegistry.Generation().Get(key)
	require.True(t, found, key)
	validated, err := plugin.ValidateConfig(json.RawMessage(config))
	require.NoError(t, err)
	result, err := plugin.CallTransform(t.Context(), jsplugin.TransformContext{
		Stage:         stage,
		Format:        "openai",
		Path:          "/v1/chat/completions",
		Model:         "gpt-test",
		UpstreamModel: "gpt-test",
		Group:         "default",
		Instance:      jsplugin.TransformInstance{ID: "rp_test0001", Name: "test"},
		Config:        validated,
	}, req)
	require.NoError(t, err)
	return result
}

// applyEffects applies a result's effects to body and headers through the
// host's own decoder, so every effect also passes the host's checks.
func applyEffects(t *testing.T, body string, result jsplugin.TransformResult) (string, http.Header) {
	t.Helper()
	if result.Effects == nil {
		return body, http.Header{}
	}
	effects, err := requestpatch.DecodeTransformEffects(result.Effects, requestpatch.EffectJSONPatch, requestpatch.EffectHeaderPatch)
	require.NoError(t, err)
	patched, header, err := requestpatch.Apply([]byte(body), http.Header{}, effects, requestpatch.IsProtectedHeader)
	require.NoError(t, err)
	return string(patched), header
}

func TestRequestFilterPlugin(t *testing.T) {
	const config = `{"rules": [
		{"id": "falcon", "type": "keyword", "pattern": "Project Falcon"},
		{"id": "secret", "type": "regex", "pattern": "secret-\\d{4}"},
		{"id": "alpha", "type": "keyword", "pattern": "ALPHA", "caseSensitive": true},
		{"id": "go-style", "type": "regex", "pattern": "(?i)drop\\s+table", "caseSensitive": true}
	], "message": "This topic is not allowed"}`
	cases := []struct {
		name   string
		stage  string
		body   string
		ruleID string
	}{
		{"chat keyword in a text part, any case", "ingress", `{"model": "gpt-test", "messages": [{"role": "user", "content": [{"type": "text", "text": "tell me about project falcon"}, {"type": "image_url", "image_url": {"url": "[media:0]"}}]}]}`, "falcon"},
		{"chat regex in a tool message", "ingress", `{"model": "gpt-test", "messages": [{"role": "user", "content": "hi"}, {"role": "tool", "tool_call_id": "c1", "content": "found secret-1234"}]}`, "secret"},
		{"responses input item", "ingress", `{"model": "gpt-test", "input": [{"role": "user", "content": [{"type": "input_text", "text": "code secret-0042"}]}]}`, "secret"},
		{"responses instructions", "ingress", `{"model": "gpt-test", "instructions": "Mention Project Falcon", "input": "hello"}`, "falcon"},
		{"responses string input", "ingress", `{"model": "gpt-test", "input": "PROJECT FALCON status"}`, "falcon"},
		{"claude system blocks", "ingress", `{"model": "claude-test", "system": [{"type": "text", "text": "secret-7777"}], "messages": [{"role": "user", "content": "hi"}]}`, "secret"},
		{"claude tool result", "ingress", `{"model": "claude-test", "messages": [{"role": "user", "content": [{"type": "tool_result", "tool_use_id": "t1", "content": [{"type": "text", "text": "Project Falcon notes"}]}]}]}`, "falcon"},
		{"gemini contents", "ingress", `{"contents": [{"role": "user", "parts": [{"text": "see secret-1111"}, {"inlineData": {"mimeType": "image/png", "data": "[media:0]"}}]}]}`, "secret"},
		{"gemini system instruction", "ingress", `{"contents": [{"role": "user", "parts": [{"text": "hi"}]}], "systemInstruction": {"parts": [{"text": "project falcon"}]}}`, "falcon"},
		{"image prompt", "ingress", `{"model": "gpt-image-1", "prompt": "a poster for Project Falcon"}`, "falcon"},
		{"case sensitive keyword matches exact case", "ingress", `{"messages": [{"role": "user", "content": "ALPHA team"}]}`, "alpha"},
		{"leading (?i) makes a regex case-insensitive", "ingress", `{"messages": [{"role": "user", "content": "DROP  TABLE users"}]}`, "go-style"},
		{"case sensitive keyword skips other cases", "ingress", `{"messages": [{"role": "user", "content": "alpha team"}]}`, ""},
		{"model, ids and roles are not scanned", "ingress", `{"model": "project falcon", "user": "secret-1234", "messages": [{"role": "user", "name": "secret-5678", "content": "hello"}]}`, ""},
		{"egress checks the final body", "egress", `{"model": "claude-test", "system": "Project Falcon", "messages": [{"role": "user", "content": "hi"}]}`, "falcon"},
		{"egress passes a clean body", "egress", `{"model": "gpt-test", "messages": [{"role": "user", "content": "hello"}]}`, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := runRequestPlugin(t, "request-filter", tc.stage, config, jsplugin.TransformRequest{Body: json.RawMessage(tc.body)})
			if tc.ruleID == "" {
				assert.Equal(t, "continue", result.Action)
				assert.Nil(t, result.Effects)
				return
			}
			assert.Equal(t, "reject", result.Action)
			assert.Equal(t, "request_filtered", result.Code)
			assert.Equal(t, tc.ruleID, result.RuleID)
			assert.Equal(t, "This topic is not allowed", result.Message)
		})
	}

	t.Run("saving compiles every regular expression rule", func(t *testing.T) {
		plugin, found := jsplugin.DefaultRegistry.Generation().Get("request-filter")
		require.True(t, found)
		_, err := plugin.ValidateConfig(json.RawMessage(`{"rules": [
			{"id": "k", "pattern": "a(b"},
			{"id": "r1", "type": "regex", "pattern": "(?i)drop\\s+table"}
		]}`))
		require.NoError(t, err)
		_, err = plugin.ValidateConfig(json.RawMessage(`{"rules": [
			{"id": "r1", "type": "regex", "pattern": "a+"},
			{"id": "r2", "type": "regex", "pattern": "a(b"}
		]}`))
		require.Error(t, err)
		assert.Contains(t, err.Error(), `Rule "r2" has an invalid regular expression`)
	})

	t.Run("without a message the host's default applies", func(t *testing.T) {
		result := runRequestPlugin(t, "request-filter", "ingress", `{"rules": [{"id": "k", "pattern": "blocked"}]}`,
			jsplugin.TransformRequest{Body: json.RawMessage(`{"prompt": "blocked words"}`)})
		assert.Equal(t, "reject", result.Action)
		assert.Equal(t, "k", result.RuleID)
		assert.Empty(t, result.Message)
	})

	t.Run("a rule without an id is named by its position", func(t *testing.T) {
		result := runRequestPlugin(t, "request-filter", "ingress", `{"rules": [{"id": "k", "pattern": "allowed"}, {"id": "", "pattern": "blocked"}]}`,
			jsplugin.TransformRequest{Body: json.RawMessage(`{"prompt": "blocked words"}`)})
		assert.Equal(t, "reject", result.Action)
		assert.Equal(t, "rule-2", result.RuleID)
	})
}

func TestRequestRedactPlugin(t *testing.T) {
	chat := func(text string) string {
		encoded, err := common.Marshal(map[string]any{"model": "gpt-test", "messages": []any{map[string]any{"role": "user", "content": text}}})
		require.NoError(t, err)
		return string(encoded)
	}
	cases := []struct {
		name       string
		categories string
		text       string
		redacted   string
		findings   []jsplugin.TransformFinding
	}{
		{
			name: "email", categories: `["email"]`,
			text:     "mail alice.smith+test@example.co.uk now",
			redacted: "mail [REDACTED] now",
			findings: []jsplugin.TransformFinding{{Rule: "email", Category: "email", Count: 1}},
		},
		{name: "not an email: asset names and bare hosts", categories: `["email"]`, text: "use icon@2x.png and user@localhost"},
		{
			name: "phone: mainland mobile, grouped, and E.164", categories: `["phone"]`,
			text:     "call 13812345678, 138 1234 5678 or +14155552671",
			redacted: "call [REDACTED], [REDACTED] or [REDACTED]",
			findings: []jsplugin.TransformFinding{{Rule: "phone", Category: "phone", Count: 3}},
		},
		{name: "not a phone: wrong prefix, sums and longer numbers", categories: `["phone"]`, text: "order 12812345678, 1+23456789, id 2024138123456789"},
		{
			name: "id card with a valid check code", categories: `["id_card"]`,
			text:     "身份证11010519491231002X，备用440306199003071232",
			redacted: "身份证[REDACTED]，备用[REDACTED]",
			findings: []jsplugin.TransformFinding{{Rule: "id_card", Category: "id_card", Count: 2}},
		},
		{name: "not an id card: bad check code", categories: `["id_card"]`, text: "身份证440306199003071233"},
		{
			name: "bank card passing Luhn, plain and grouped", categories: `["bank_card"]`,
			text:     "card 6222021234567890128 or 4111 1111 1111 1111",
			redacted: "card [REDACTED] or [REDACTED]",
			findings: []jsplugin.TransformFinding{{Rule: "bank_card", Category: "bank_card", Count: 2}},
		},
		{name: "not a bank card: Luhn fails or a timestamp", categories: `["bank_card"]`, text: "card 4111111111111112 at 1730000000000"},
		{
			name: "api keys and bearer tokens", categories: `["api_key"]`,
			text:     "key sk-proj-abc123DEF456ghi789JKL0 and Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.abc123",
			redacted: "key [REDACTED] and Authorization: Bearer [REDACTED]",
			findings: []jsplugin.TransformFinding{{Rule: "api_key", Category: "api_key", Count: 2}},
		},
		{name: "not an api key: prose", categories: `["api_key"]`, text: "sk-learn-is-a-python-library-name, Bearer of bad news"},
		{
			name: "ipv4", categories: `["ipv4"]`,
			text:     "server 192.168.1.20 is down",
			redacted: "server [REDACTED] is down",
			findings: []jsplugin.TransformFinding{{Rule: "ipv4", Category: "ipv4", Count: 1}},
		},
		{name: "not an ipv4: versions and loopback", categories: `["ipv4"]`, text: "version 1.2.3.4.5, v10.0.0.1, 127.0.0.1, 0.0.0.0"},
		{
			name: "an email is replaced whole before the phone rule", categories: `["email", "phone"]`,
			text:     "qq 13812345678@qq.com",
			redacted: "qq [REDACTED]",
			findings: []jsplugin.TransformFinding{{Rule: "email", Category: "email", Count: 1}},
		},
		{
			name: "custom rules with their own and the default replacement", categories: `[]`,
			text:     "EMP-123456 filed TICKET-42 and ticket-7",
			redacted: "[EMPLOYEE] filed [REDACTED] and [REDACTED]",
			findings: []jsplugin.TransformFinding{
				{Rule: "employee", Category: "custom", Count: 1},
				{Rule: "ticket", Category: "custom", Count: 2},
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			config := `{"categories": ` + tc.categories + `, "rules": [
				{"id": "employee", "pattern": "EMP-\\d{6}", "replacement": "[EMPLOYEE]"},
				{"id": "ticket", "pattern": "(?i)ticket-\\d+"}
			]}`
			body := chat(tc.text)
			result := runRequestPlugin(t, "request-redact", "ingress", config, jsplugin.TransformRequest{Body: json.RawMessage(body)})
			require.Equal(t, "continue", result.Action)
			assert.Equal(t, tc.findings, result.Findings)
			patched, _ := applyEffects(t, body, result)
			expected := tc.text
			if tc.redacted != "" {
				expected = tc.redacted
			}
			assert.JSONEq(t, chat(expected), patched)
		})
	}

	t.Run("replaces only text values, in every format", func(t *testing.T) {
		body := `{
			"model": "a@example.com",
			"system": [{"type": "text", "text": "owner a@example.com"}],
			"messages": [
				{"role": "user", "content": [
					{"type": "image_url", "image_url": {"url": "[media:0]"}},
					{"type": "tool_result", "tool_use_id": "t1", "content": "call 13812345678"}
				]}
			],
			"input": [{"role": "user", "content": [{"type": "input_text", "text": "b@example.com"}]}, {"type": "function_call_output", "call_id": "c1", "output": "c@example.com"}],
			"contents": [{"parts": [{"text": "d@example.com"}, {"inline_data": {"mime_type": "image/png", "data": "[media:1]"}}]}],
			"systemInstruction": {"parts": [{"text": "13812345678"}]}
		}`
		result := runRequestPlugin(t, "request-redact", "ingress", `{}`, jsplugin.TransformRequest{Body: json.RawMessage(body)})
		assert.Equal(t, []jsplugin.TransformFinding{
			{Rule: "email", Category: "email", Count: 4},
			{Rule: "phone", Category: "phone", Count: 2},
		}, result.Findings)
		patched, _ := applyEffects(t, body, result)
		assert.JSONEq(t, `{
			"model": "a@example.com",
			"system": [{"type": "text", "text": "owner [REDACTED]"}],
			"messages": [
				{"role": "user", "content": [
					{"type": "image_url", "image_url": {"url": "[media:0]"}},
					{"type": "tool_result", "tool_use_id": "t1", "content": "call [REDACTED]"}
				]}
			],
			"input": [{"role": "user", "content": [{"type": "input_text", "text": "[REDACTED]"}]}, {"type": "function_call_output", "call_id": "c1", "output": "[REDACTED]"}],
			"contents": [{"parts": [{"text": "[REDACTED]"}, {"inline_data": {"mime_type": "image/png", "data": "[media:1]"}}]}],
			"systemInstruction": {"parts": [{"text": "[REDACTED]"}]}
		}`, patched)
	})

	t.Run("saving compiles every custom rule", func(t *testing.T) {
		plugin, found := jsplugin.DefaultRegistry.Generation().Get("request-redact")
		require.True(t, found)
		_, err := plugin.ValidateConfig(json.RawMessage(`{"rules": [{"id": "employee", "pattern": "(?i)emp-\\d{6}"}]}`))
		require.NoError(t, err)
		_, err = plugin.ValidateConfig(json.RawMessage(`{"rules": [{"id": "employee", "pattern": "EMP-\\d{6}"}, {"id": "r3", "pattern": "[unclosed"}]}`))
		require.Error(t, err)
		assert.Contains(t, err.Error(), `Rule "r3" has an invalid regular expression`)
	})

	t.Run("a custom rule without an id is named by its position", func(t *testing.T) {
		result := runRequestPlugin(t, "request-redact", "ingress", `{"categories": [], "rules": [{"pattern": "EMP-\\d{6}"}]}`,
			jsplugin.TransformRequest{Body: json.RawMessage(chat("EMP-123456"))})
		assert.Equal(t, []jsplugin.TransformFinding{{Rule: "rule-1", Category: "custom", Count: 1}}, result.Findings)
	})

	t.Run("a clean request gets no effects", func(t *testing.T) {
		result := runRequestPlugin(t, "request-redact", "ingress", `{}`, jsplugin.TransformRequest{Body: json.RawMessage(chat("hello"))})
		assert.Equal(t, "continue", result.Action)
		assert.JSONEq(t, `[]`, string(result.Effects))
		assert.Empty(t, result.Findings)
	})

	egress := []struct {
		name   string
		config string
		text   string
		ruleID string
	}{
		{"sensitive text brought back is rejected", `{}`, "call [REDACTED] or 13812345678", "phone"},
		{"a custom rule is checked too", `{"rules": [{"id": "employee", "pattern": "EMP-\\d{6}"}]}`, "EMP-123456", "employee"},
		{"redacted text passes", `{}`, "call [REDACTED]", ""},
		{"the final check can be off", `{"finalCheck": "off"}`, "call 13812345678", ""},
	}
	for _, tc := range egress {
		t.Run("egress: "+tc.name, func(t *testing.T) {
			result := runRequestPlugin(t, "request-redact", "egress", tc.config, jsplugin.TransformRequest{Body: json.RawMessage(chat(tc.text))})
			if tc.ruleID == "" {
				assert.Equal(t, "continue", result.Action)
				return
			}
			assert.Equal(t, "reject", result.Action)
			assert.Equal(t, "sensitive_content", result.Code)
			assert.Equal(t, tc.ruleID, result.RuleID)
		})
	}
}

func TestParamOverridePlugin(t *testing.T) {
	// The host adapter in miniature: the channel parameter override with a
	// condition context built from the hook's ctx.
	calls := 0
	jsplugin.SetParamOverrideFunc(func(tctx jsplugin.TransformContext, body, override json.RawMessage) (json.RawMessage, error) {
		calls++
		var overrideMap map[string]any
		if err := common.Unmarshal(override, &overrideMap); err != nil {
			return nil, err
		}
		conditionContext := map[string]any{
			"model":           tctx.UpstreamModel,
			"original_model":  tctx.Model,
			"header_override": map[string]any{},
		}
		result, err := relaycommon.ApplyParamOverride(body, overrideMap, conditionContext)
		if returnErr, ok := relaycommon.AsParamOverrideReturnError(err); ok {
			return common.Marshal(map[string]any{"reject": map[string]any{"code": returnErr.Code, "message": returnErr.Message}})
		}
		if err != nil {
			return nil, err
		}
		reply := map[string]any{"body": json.RawMessage(result)}
		if headers, _ := conditionContext["header_override"].(map[string]any); len(headers) > 0 {
			reply["headers"] = map[string]any{"set": headers}
		}
		return common.Marshal(reply)
	})
	t.Cleanup(func() { jsplugin.SetParamOverrideFunc(nil) })

	const body = `{"model": "gpt-test", "temperature": 1, "metadata": {"user": "u1"}, "messages": [
		{"role": "user", "content": [{"type": "text", "text": "what is this"}, {"type": "image_url", "image_url": {"url": "[media:0]"}}]}
	]}`
	cases := []struct {
		name     string
		override string
		body     string
		header   map[string]string
	}{
		{
			name:     "set under a condition and delete",
			override: `{"operations": [{"path": "temperature", "mode": "set", "value": 0.2, "conditions": [{"path": "model", "mode": "prefix", "value": "gpt-"}]}, {"path": "metadata", "mode": "delete"}]}`,
			body:     `{"model": "gpt-test", "temperature": 0.2, "messages": [{"role": "user", "content": [{"type": "text", "text": "what is this"}, {"type": "image_url", "image_url": {"url": "[media:0]"}}]}]}`,
		},
		{
			name:     "a condition that does not hold changes nothing",
			override: `{"operations": [{"path": "temperature", "mode": "set", "value": 0.2, "conditions": [{"path": "model", "mode": "prefix", "value": "claude-"}]}]}`,
			body:     body,
		},
		{
			name:     "prepend a message beside an image",
			override: `{"operations": [{"path": "messages", "mode": "prepend", "value": [{"role": "system", "content": "Be brief"}]}]}`,
			body:     `{"model": "gpt-test", "temperature": 1, "metadata": {"user": "u1"}, "messages": [{"role": "system", "content": "Be brief"}, {"role": "user", "content": [{"type": "text", "text": "what is this"}, {"type": "image_url", "image_url": {"url": "[media:0]"}}]}]}`,
		},
		{
			name:     "legacy key-value shape",
			override: `{"top_p": 0.5}`,
			body:     `{"model": "gpt-test", "temperature": 1, "top_p": 0.5, "metadata": {"user": "u1"}, "messages": [{"role": "user", "content": [{"type": "text", "text": "what is this"}, {"type": "image_url", "image_url": {"url": "[media:0]"}}]}]}`,
		},
		{
			name:     "header change",
			override: `{"operations": [{"path": "X-Request-Source", "mode": "set_header", "value": "new-api"}]}`,
			body:     body,
			header:   map[string]string{"X-Request-Source": "new-api"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := runRequestPlugin(t, "param-override", "outbound", `{"override": `+tc.override+`}`, jsplugin.TransformRequest{Body: json.RawMessage(body)})
			require.Equal(t, "continue", result.Action)
			// A patch value may not carry a media placeholder, so unchanged
			// parts of the body are never rewritten.
			assert.NotContains(t, string(result.Effects), "[media:")
			patched, header := applyEffects(t, body, result)
			assert.JSONEq(t, tc.body, patched)
			for name, value := range tc.header {
				assert.Equal(t, value, header.Get(name))
			}
			if tc.header == nil {
				assert.Empty(t, header)
			}
		})
	}

	rejects := []struct {
		name     string
		override string
		code     string
		message  string
	}{
		{"return_error with its code", `{"operations": [{"mode": "return_error", "value": {"message": "Model not allowed", "code": "Model_Blocked"}}]}`, "model_blocked", "Model not allowed"},
		{"return_error with the default code", `{"operations": [{"mode": "return_error", "value": "Not allowed"}]}`, "invalid_request", "Not allowed"},
		{"a code the result cannot carry", `{"operations": [{"mode": "return_error", "value": {"message": "No", "code": "blocked by policy!"}}]}`, "param_override_rejected", "No"},
	}
	for _, tc := range rejects {
		t.Run(tc.name, func(t *testing.T) {
			result := runRequestPlugin(t, "param-override", "outbound", `{"override": `+tc.override+`}`, jsplugin.TransformRequest{Body: json.RawMessage(body)})
			assert.Equal(t, "reject", result.Action)
			assert.Equal(t, tc.code, result.Code)
			assert.Equal(t, tc.message, result.Message)
		})
	}

	t.Run("an empty override does nothing", func(t *testing.T) {
		calls = 0
		result := runRequestPlugin(t, "param-override", "outbound", `{}`, jsplugin.TransformRequest{Body: json.RawMessage(body)})
		assert.Equal(t, "continue", result.Action)
		assert.Nil(t, result.Effects)
		assert.Zero(t, calls)
	})
}

func TestAutoReasoningPlugin(t *testing.T) {
	const rules = `[
		{"minTools": 1, "effort": "high"},
		{"minTotalChars": 2000, "minMessages": 3, "effort": "medium"},
		{"hasImages": true, "effort": "low"},
		{"minLastUserChars": 500, "effort": "xhigh"}
	]`
	cases := []struct {
		name     string
		config   string
		summary  jsplugin.TransformSummary
		effort   string
		override bool
	}{
		{"the first matching rule wins", `{"rules": ` + rules + `}`, jsplugin.TransformSummary{ToolCount: 2, MessageCount: 5, TotalTextLength: 9000}, "high", false},
		{"every condition of a rule must hold", `{"rules": ` + rules + `}`, jsplugin.TransformSummary{MessageCount: 2, TotalTextLength: 9000, LastUserTextLength: 600}, "xhigh", false},
		{"a rule for images", `{"rules": ` + rules + `}`, jsplugin.TransformSummary{MessageCount: 1, HasImages: true}, "low", false},
		{"the default when no rule matches", `{"rules": ` + rules + `, "defaultEffort": "minimal"}`, jsplugin.TransformSummary{MessageCount: 1}, "minimal", false},
		{"no default leaves the request alone", `{"rules": ` + rules + `}`, jsplugin.TransformSummary{MessageCount: 1}, "", false},
		{"the request's own effort is kept", `{"rules": ` + rules + `}`, jsplugin.TransformSummary{ToolCount: 2, ReasoningEffort: "low"}, "", false},
		{"the request's own effort is replaced when asked", `{"rules": ` + rules + `, "overrideClient": true}`, jsplugin.TransformSummary{ToolCount: 2, ReasoningEffort: "low"}, "high", true},
		{"the highest effort caps a rule", `{"rules": [{"effort": "max"}], "maxEffort": "high"}`, jsplugin.TransformSummary{}, "high", false},
		{"the lowest effort raises the default", `{"defaultEffort": "none", "minEffort": "low"}`, jsplugin.TransformSummary{}, "low", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			summary := tc.summary
			result := runRequestPlugin(t, "auto-reasoning", "request", tc.config, jsplugin.TransformRequest{
				Body:    json.RawMessage(`{"model": "gpt-test", "messages": []}`),
				Summary: &summary,
			})
			require.Equal(t, "continue", result.Action)
			if tc.effort == "" {
				assert.Nil(t, result.Effects)
				return
			}
			effects, err := requestpatch.DecodeTransformEffects(result.Effects, requestpatch.EffectReasoningSet)
			require.NoError(t, err)
			require.Len(t, effects, 1)
			assert.Equal(t, tc.effort, effects[0].Effort)
			assert.Equal(t, tc.override, effects[0].Override)
		})
	}
}

func TestImageCompressPlugin(t *testing.T) {
	media := []jsplugin.TransformMedia{
		{Index: 0, Path: "/messages/0/content/1/image_url/url", MimeType: "image/png", Bytes: 600000, Width: 1000, Height: 1000},
		{Index: 1, Path: "/messages/0/content/2/image_url/url", MimeType: "image/jpeg", Bytes: 100000, Width: 4096, Height: 1000},
		{Index: 2, Path: "/messages/0/content/3/image_url/url", MimeType: "image/webp", Bytes: 100000, Width: 1024, Height: 768},
		{Index: 3, Path: "/messages/0/content/4/file/file_data", MimeType: "application/pdf", Bytes: 900000},
	}
	cases := []struct {
		name    string
		config  string
		effects []requestpatch.Effect
	}{
		{
			name:   "lossless by default: WebP, no quality, no resizing",
			config: `{}`,
			effects: []requestpatch.Effect{
				{Type: requestpatch.EffectMediaReencode, Media: 0, Format: "webp"},
			},
		},
		{
			name:   "lossless qualifies images by size only",
			config: `{"mode": "lossless", "minBytes": 50000, "maxSide": 512}`,
			effects: []requestpatch.Effect{
				{Type: requestpatch.EffectMediaReencode, Media: 0, Format: "webp"},
				{Type: requestpatch.EffectMediaReencode, Media: 1, Format: "webp"},
				{Type: requestpatch.EffectMediaReencode, Media: 2, Format: "webp"},
			},
		},
		{
			name:   "lossy: large files and long sides",
			config: `{"mode": "lossy", "minBytes": 500000, "maxSide": 2048, "format": "jpeg", "quality": 80}`,
			effects: []requestpatch.Effect{
				{Type: requestpatch.EffectMediaReencode, Media: 0, Format: "jpeg", Quality: 80, MaxSide: 2048},
				{Type: requestpatch.EffectMediaReencode, Media: 1, Format: "jpeg", Quality: 80, MaxSide: 2048},
			},
		},
		{
			name:   "lossy defaults",
			config: `{"mode": "lossy"}`,
			effects: []requestpatch.Effect{
				{Type: requestpatch.EffectMediaReencode, Media: 0, Format: "auto", Quality: 85, MaxSide: 2048},
				{Type: requestpatch.EffectMediaReencode, Media: 1, Format: "auto", Quality: 85, MaxSide: 2048},
			},
		},
		{
			name:    "lossy with higher thresholds",
			config:  `{"mode": "lossy", "minBytes": 1000000, "maxSide": 4096}`,
			effects: []requestpatch.Effect{},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := runRequestPlugin(t, "image-compress", "outbound", tc.config, jsplugin.TransformRequest{
				Body:  json.RawMessage(`{"model": "gpt-test", "messages": []}`),
				Media: media,
			})
			require.Equal(t, "continue", result.Action)
			effects, err := requestpatch.DecodeTransformEffects(result.Effects, requestpatch.EffectMediaReencode)
			require.NoError(t, err)
			assert.Equal(t, tc.effects, effects)
		})
	}
}

// moderationCall is one request the fake moderation API received.
type moderationCall struct {
	Authorization string
	Body          map[string]any
}

// runModeration runs the content-moderation ingress hook through the host's
// fetch path against a fake moderation API that answers status and reply.
func runModeration(t *testing.T, config map[string]any, format, path, body string, status int, reply string) (jsplugin.TransformResult, []moderationCall, error) {
	t.Helper()
	var calls []moderationCall
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/v1/moderations", r.URL.Path)
		raw, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		call := moderationCall{Authorization: r.Header.Get("Authorization")}
		require.NoError(t, common.Unmarshal(raw, &call.Body))
		calls = append(calls, call)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(reply))
	}))
	t.Cleanup(server.Close)

	plugin, found := jsplugin.DefaultRegistry.Generation().Get("content-moderation")
	require.True(t, found)
	config = maps.Clone(config)
	config["url"] = server.URL + "/v1/moderations"
	raw, err := common.Marshal(config)
	require.NoError(t, err)
	validated, err := plugin.ValidateConfig(raw)
	require.NoError(t, err)
	ctx := jsplugin.WithFetcher(t.Context(), service.RequestPluginFetcher(plugin, validated))
	result, err := plugin.CallTransform(ctx, jsplugin.TransformContext{
		Stage:    "ingress",
		Format:   format,
		Path:     path,
		Model:    "gpt-test",
		Group:    "default",
		Instance: jsplugin.TransformInstance{ID: "rp_test0001", Name: "test"},
		Config:   validated,
	}, jsplugin.TransformRequest{Body: json.RawMessage(body)})
	return result, calls, err
}

// moderationResult is a moderation API reply with one result per categories
// map; a result is flagged when any of its categories is true.
func moderationResult(results ...map[string]bool) string {
	type result struct {
		Flagged    bool            `json:"flagged"`
		Categories map[string]bool `json:"categories"`
	}
	reply := struct {
		ID      string   `json:"id"`
		Model   string   `json:"model"`
		Results []result `json:"results"`
	}{ID: "modr-1", Model: "omni-moderation-latest"}
	for _, categories := range results {
		reply.Results = append(reply.Results, result{Flagged: slices.Contains(slices.Collect(maps.Values(categories)), true), Categories: categories})
	}
	encoded, _ := common.Marshal(reply)
	return string(encoded)
}

func TestContentModerationPlugin(t *testing.T) {
	const chat = `{"model":"gpt-test","messages":[
		{"role":"system","content":"Be brief"},
		{"role":"user","content":"first question"},
		{"role":"assistant","content":"an answer"},
		{"role":"user","content":[{"type":"text","text":"second"},{"type":"image_url","image_url":{"url":"[media:0]"}},{"type":"text","text":"question"}]}
	]}`
	clean := moderationResult(map[string]bool{"hate": false, "violence": false})
	flagged := moderationResult(map[string]bool{"harassment": false, "violence": true, "violence/graphic": true, "hate": true})
	defaults := map[string]any{"apiKey": "sk-test"}

	t.Run("flagged text is rejected", func(t *testing.T) {
		result, calls, err := runModeration(t, defaults, "openai", "/v1/chat/completions", chat, http.StatusOK, flagged)
		require.NoError(t, err)
		assert.Equal(t, jsplugin.TransformResult{
			Action:  "reject",
			Code:    "moderation.flagged",
			RuleID:  "hate",
			Message: "The request was flagged by content moderation",
			Findings: []jsplugin.TransformFinding{
				{Rule: "hate", Category: "hate", Count: 1},
				{Rule: "violence", Category: "violence", Count: 1},
				{Rule: "violence/graphic", Category: "violence/graphic", Count: 1},
			},
		}, result)
		require.Len(t, calls, 1)
		assert.Equal(t, "Bearer sk-test", calls[0].Authorization)
		assert.Equal(t, map[string]any{"input": "second\nquestion", "model": "omni-moderation-latest"}, calls[0].Body)
	})
	t.Run("clean text continues", func(t *testing.T) {
		result, calls, err := runModeration(t, defaults, "openai", "/v1/chat/completions", chat, http.StatusOK, clean)
		require.NoError(t, err)
		assert.Equal(t, jsplugin.TransformResult{Action: "continue"}, result)
		assert.Len(t, calls, 1)
	})
	t.Run("only listed categories block", func(t *testing.T) {
		config := map[string]any{"categories": []string{"violence", "sexual"}}
		result, calls, err := runModeration(t, config, "openai", "/v1/chat/completions", chat, http.StatusOK, moderationResult(map[string]bool{"hate": true}))
		require.NoError(t, err)
		assert.Equal(t, "continue", result.Action)
		require.Len(t, calls, 1)
		assert.Empty(t, calls[0].Authorization, "no API key, no Authorization header")

		result, _, err = runModeration(t, config, "openai", "/v1/chat/completions", chat, http.StatusOK, flagged)
		require.NoError(t, err)
		assert.Equal(t, "reject", result.Action)
		assert.Equal(t, "violence", result.RuleID)
		assert.Equal(t, []jsplugin.TransformFinding{{Rule: "violence", Category: "violence", Count: 1}}, result.Findings)
	})
	t.Run("all user messages", func(t *testing.T) {
		config := map[string]any{"scope": "all_user", "model": ""}
		reply := moderationResult(map[string]bool{"violence": true}, map[string]bool{"violence": true, "hate": false})
		result, calls, err := runModeration(t, config, "openai", "/v1/chat/completions", chat, http.StatusOK, reply)
		require.NoError(t, err)
		assert.Equal(t, []jsplugin.TransformFinding{{Rule: "violence", Category: "violence", Count: 2}}, result.Findings)
		require.Len(t, calls, 1)
		assert.Equal(t, map[string]any{"input": []any{"first question", "second\nquestion"}}, calls[0].Body, "an empty model is left out")
	})
	t.Run("user text of each format", func(t *testing.T) {
		tests := []struct {
			format, path, body string
			input              any
		}{
			{"openai_responses", "/v1/responses", `{"input":[{"role":"user","content":[{"type":"input_text","text":"hello"}]},{"type":"function_call_output","call_id":"c","output":"x"}]}`, "hello"},
			{"openai_responses", "/v1/responses", `{"input":"plain"}`, "plain"},
			{"claude", "/v1/messages", `{"system":"s","messages":[{"role":"user","content":[{"type":"text","text":"hi"},{"type":"tool_result","tool_use_id":"t","content":"x"}]}]}`, "hi"},
			{"gemini", "/v1beta/models/gemini:generateContent", `{"contents":[{"role":"user","parts":[{"text":"bonjour"}]},{"role":"model","parts":[{"text":"salut"}]}]}`, "bonjour"},
			{"openai", "/v1/completions", `{"prompt":["one","two"]}`, "two"},
			{"embedding", "/v1/embeddings", `{"input":"embed me"}`, "embed me"},
			{"openai_image", "/v1/images/generations", `{"prompt":"a cat"}`, "a cat"},
		}
		for _, tc := range tests {
			_, calls, err := runModeration(t, defaults, tc.format, tc.path, tc.body, http.StatusOK, clean)
			require.NoError(t, err, tc.body)
			require.Len(t, calls, 1, tc.body)
			assert.Equal(t, tc.input, calls[0].Body["input"], tc.body)
		}
	})
	t.Run("no call without user text", func(t *testing.T) {
		for _, tc := range []struct{ format, path, body string }{
			{"openai", "/v1/moderations", `{"input":"check me"}`},
			{"openai", "/v1/chat/completions", `{"messages":[{"role":"system","content":"only system"},{"role":"user","content":"  "}]}`},
			{"openai_audio", "/v1/audio/speech", `{"input":"speak"}`},
		} {
			result, calls, err := runModeration(t, defaults, tc.format, tc.path, tc.body, http.StatusOK, flagged)
			require.NoError(t, err, tc.body)
			assert.Equal(t, "continue", result.Action, tc.body)
			assert.Empty(t, calls, tc.body)
		}
	})
	t.Run("a failing API fails the instance", func(t *testing.T) {
		for _, tc := range []struct {
			status int
			reply  string
			want   string
		}{
			{http.StatusInternalServerError, `{"error":{"message":"down"}}`, "moderation API returned HTTP 500"},
			{http.StatusOK, `{"id":"modr-1"}`, "moderation API returned no results"},
			{http.StatusOK, `not json`, "moderation API returned no results"},
		} {
			_, calls, err := runModeration(t, defaults, "openai", "/v1/chat/completions", chat, tc.status, tc.reply)
			var transformErr *jsplugin.TransformError
			require.ErrorAs(t, err, &transformErr, tc.reply)
			assert.Equal(t, jsplugin.TransformErrorThrow, transformErr.Class)
			assert.Contains(t, transformErr.Thrown, tc.want)
			assert.NotContains(t, transformErr.Thrown, "question", "the error leaves the request text out")
			assert.Len(t, calls, 1)
		}
	})
}

// runReplyHook validates config as the host does when an instance is saved
// and calls the reply hook of a built-in plugin on one output.
func runReplyHook(t *testing.T, key, config string, stream, final bool, text string) jsplugin.ReplyResult {
	t.Helper()
	plugin, found := jsplugin.DefaultRegistry.Generation().Get(key)
	require.True(t, found, key)
	validated, err := plugin.ValidateConfig(json.RawMessage(config))
	require.NoError(t, err)
	ctx := jsplugin.WithFetcher(t.Context(), service.RequestPluginFetcher(plugin, validated))
	result, err := plugin.CallReply(ctx, jsplugin.TransformContext{
		Format:   "openai",
		Path:     "/v1/chat/completions",
		Model:    "gpt-test",
		Group:    "default",
		Instance: jsplugin.TransformInstance{ID: "rp_test0001", Name: "test"},
		Config:   validated,
	}, stream, []jsplugin.ReplyOutput{{Index: 0, Text: text, Final: final}})
	var transformErr *jsplugin.TransformError
	if errors.As(err, &transformErr) {
		require.NoError(t, err, transformErr.Thrown)
	}
	require.NoError(t, err)
	return result
}

// masked applies the masks of a result to text as the host does.
func masked(text string, result jsplugin.ReplyResult) string {
	units := []rune(text)
	var out strings.Builder
	position := 0
	masks := slices.SortedFunc(slices.Values(result.Masks), func(a, b jsplugin.ReplyMask) int { return a.Start - b.Start })
	for _, mask := range masks {
		// The texts here are plain ASCII and CJK: runes are UTF-16 units.
		out.WriteString(string(units[position:mask.Start]))
		out.WriteString("***")
		position = mask.End
	}
	out.WriteString(string(units[position:]))
	return out.String()
}

func TestRequestRedactReply(t *testing.T) {
	const text = "Mail jane.doe@example.com or call +14155550123, key Bearer abcdefghijklmnop0123456789 now."
	// Replies pass unless the instance asks for them, or when it has nothing
	// to mask.
	result := runReplyHook(t, "request-redact", `{}`, true, false, text)
	assert.Equal(t, jsplugin.ReplyResult{Action: "pass"}, result)
	result = runReplyHook(t, "request-redact", `{"replies": true, "categories": []}`, true, false, text)
	assert.Equal(t, jsplugin.ReplyResult{Action: "pass"}, result)

	result = runReplyHook(t, "request-redact", `{"replies": true}`, false, true, text)
	assert.Equal(t, 0, result.Hold)
	assert.Equal(t, "Mail *** or call ***, key Bearer *** now.", masked(text, result))
	var categories []string
	for _, mask := range result.Masks {
		categories = append(categories, mask.Category)
	}
	assert.ElementsMatch(t, []string{"email", "phone", "api_key"}, categories)

	// A stream holds back enough text for a match split across chunks.
	result = runReplyHook(t, "request-redact", `{"replies": true, "categories": ["email"], "rules": [{"pattern": "EMP-\\d{6}"}]}`, true, false, "id EMP-123456, call +14155550123")
	assert.Equal(t, 128, result.Hold)
	assert.Equal(t, "id ***, call +14155550123", masked("id EMP-123456, call +14155550123", result))
	assert.Equal(t, "custom", result.Masks[0].Category)
}

func TestRequestFilterReply(t *testing.T) {
	const keywords = `{"rules": [{"id": "falcon", "pattern": "Project Falcon"}, {"pattern": "codename"}], "message": "Not here", "replies": true}`
	assert.Equal(t, jsplugin.ReplyResult{Action: "pass"}, runReplyHook(t, "request-filter", `{"rules": [{"pattern": "falcon"}]}`, true, false, "project falcon"))
	assert.Equal(t, jsplugin.ReplyResult{Action: "pass"}, runReplyHook(t, "request-filter", `{"rules": [], "replies": true}`, true, false, "project falcon"))

	result := runReplyHook(t, "request-filter", keywords, true, false, "The plan is PROJECT FALCON.")
	assert.Equal(t, jsplugin.ReplyResult{Action: "stop", Code: "request_filtered", Message: "Not here", Findings: []jsplugin.TransformFinding{{Rule: "falcon", Count: 1}}}, result)

	// The hold covers the longest keyword; a regular expression gets a fixed
	// hold.
	result = runReplyHook(t, "request-filter", keywords, true, false, "nothing to see")
	assert.Equal(t, jsplugin.ReplyResult{Action: "continue", Hold: len("Project Falcon") - 1}, result)
	result = runReplyHook(t, "request-filter", `{"rules": [{"type": "regex", "pattern": "a+b"}], "replies": true}`, true, false, "nothing")
	assert.Equal(t, 256, result.Hold)
	result = runReplyHook(t, "request-filter", `{"rules": [{"id": "r", "type": "regex", "pattern": "a+b"}], "replies": true}`, false, true, "xaaab")
	assert.Equal(t, "stop", result.Action)
	assert.Empty(t, result.Message)
}

func TestContentModerationReply(t *testing.T) {
	var inputs []any
	flagged := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		inputs = append(inputs, gjson.GetBytes(raw, "input").Value())
		w.Header().Set("Content-Type", "application/json")
		if flagged {
			_, _ = w.Write([]byte(moderationResult(map[string]bool{"violence": true})))
			return
		}
		_, _ = w.Write([]byte(moderationResult(map[string]bool{"violence": false})))
	}))
	t.Cleanup(server.Close)
	config := `{"url": "` + server.URL + `/v1/moderations", "replies": true}`

	assert.Equal(t, jsplugin.ReplyResult{Action: "pass"}, runReplyHook(t, "content-moderation", `{"url": "`+server.URL+`/v1/moderations"}`, true, false, "text"))
	assert.Empty(t, inputs)

	// A stream holds its text until about 1000 characters gathered.
	result := runReplyHook(t, "content-moderation", config, true, false, "short text")
	assert.Equal(t, jsplugin.ReplyResult{Action: "continue", Hold: 8192}, result)
	assert.Empty(t, inputs)
	long := strings.Repeat("calm words ", 100)
	result = runReplyHook(t, "content-moderation", config, true, false, long)
	assert.Equal(t, jsplugin.ReplyResult{Action: "continue"}, result)
	assert.Equal(t, []any{[]any{long}}, inputs)

	// A non-stream reply is checked once; a flagged one stops.
	flagged = true
	result = runReplyHook(t, "content-moderation", config, false, true, "bad text")
	assert.Equal(t, "stop", result.Action)
	assert.Equal(t, "moderation.flagged", result.Code)
	assert.Equal(t, "The reply was flagged by content moderation", result.Message)
	assert.Equal(t, []jsplugin.TransformFinding{{Rule: "violence", Category: "violence", Count: 1}}, result.Findings)
	assert.Len(t, inputs, 2)
}

// A built-in whose reply option is off lets the reply pass in a dry run: the
// step shows continue and the text comes back unchanged.
func TestReplyOptionOffDryRun(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(moderationResult(map[string]bool{"violence": false})))
	}))
	t.Cleanup(server.Close)
	reply := "Mail jane.doe@example.com now."
	for key, raw := range map[string]string{
		"request-redact":     `{}`,
		"request-filter":     `{"rules": [{"pattern": "jane"}]}`,
		"content-moderation": `{"url": "` + server.URL + `/v1/moderations"}`,
	} {
		t.Run(key, func(t *testing.T) {
			plugin, found := jsplugin.DefaultRegistry.Generation().Get(key)
			require.True(t, found)
			config, err := plugin.ValidateConfig(json.RawMessage(raw))
			require.NoError(t, err)
			result := requestplugin.DryRun(t.Context(), requestplugin.DryRunInput{Format: "openai", Model: "gpt", Group: "default",
				Body: []byte(`{"model":"gpt","messages":[{"role":"user","content":"hello"}]}`), Reply: &reply,
				Instance: &request_plugin_setting.Instance{ID: "try", Name: "Try", Plugin: key, Config: config}})
			require.Nil(t, result.Failed)
			assert.JSONEq(t, `{"text":"`+reply+`","stopped":null}`, string(result.Reply))
			index := slices.IndexFunc(result.Steps, func(step requestplugin.Step) bool { return step.Stage == requestplugin.StageReply })
			require.GreaterOrEqual(t, index, 0)
			assert.Equal(t, "continue", result.Steps[index].Action)
			assert.Zero(t, result.Steps[index].Effects)
			assert.False(t, slices.ContainsFunc(result.Record, func(entry relaycommon.RequestPluginRecord) bool { return entry.Stage == requestplugin.StageReply }))
		})
	}
}

func TestAutoReasoningDefaultRules(t *testing.T) {
	plugin, found := jsplugin.DefaultRegistry.Generation().Get("auto-reasoning")
	require.True(t, found)
	config, err := plugin.ValidateConfig(nil)
	require.NoError(t, err)
	assert.JSONEq(t, `[{"minTools":1,"effort":"high"},{"minTotalChars":4000,"effort":"high"}]`, gjson.GetBytes(config, "rules").Raw)
	assert.Equal(t, "", gjson.GetBytes(config, "defaultEffort").Str)
	for _, tc := range []struct {
		summary jsplugin.TransformSummary
		effort  string
	}{
		{jsplugin.TransformSummary{MessageCount: 4, ToolCount: 1}, "high"},
		{jsplugin.TransformSummary{MessageCount: 1, TotalTextLength: 4000}, "high"},
		{jsplugin.TransformSummary{MessageCount: 1, TotalTextLength: 3999}, ""},
	} {
		summary := tc.summary
		result := runRequestPlugin(t, "auto-reasoning", "request", `{}`, jsplugin.TransformRequest{Body: json.RawMessage(`{}`), Summary: &summary})
		if tc.effort == "" {
			assert.Nil(t, result.Effects)
			continue
		}
		effects, err := requestpatch.DecodeTransformEffects(result.Effects, requestpatch.EffectReasoningSet)
		require.NoError(t, err)
		assert.Equal(t, tc.effort, effects[0].Effort)
	}
}

func TestBuiltInRequestPluginSamples(t *testing.T) {
	for _, key := range []string{"auto-reasoning", "content-moderation", "image-compress", "param-override", "request-filter", "request-redact"} {
		t.Run(key, func(t *testing.T) {
			plugin, found := jsplugin.DefaultRegistry.Generation().Get(key)
			require.True(t, found)
			samples := plugin.Meta.Samples
			langs := map[string]int{}
			for _, sample := range samples {
				langs[sample.Lang]++
				assert.NotEmpty(t, sample.Name["en"])
				assert.NotEmpty(t, sample.Name["zh"])
				assert.Equal(t, "openai", sample.Format)
			}
			// One to three samples in each of English and Chinese.
			assert.Len(t, langs, 2)
			assert.GreaterOrEqual(t, langs["en"], 1)
			assert.LessOrEqual(t, langs["en"], 3)
			assert.Equal(t, langs["en"], langs["zh"])
		})
	}
	sample := func(key, lang string) jsplugin.Sample {
		plugin, _ := jsplugin.DefaultRegistry.Generation().Get(key)
		for _, sample := range plugin.Meta.Samples {
			if sample.Lang == lang {
				return sample
			}
		}
		t.Fatalf("%s has no %s sample", key, lang)
		return jsplugin.Sample{}
	}

	// The redaction samples carry an email and a phone number in the
	// request and in the reply.
	for _, lang := range []string{"en", "zh"} {
		redact := sample("request-redact", lang)
		result := runRequestPlugin(t, "request-redact", "ingress", `{}`, jsplugin.TransformRequest{Body: redact.Body})
		body, _ := applyEffects(t, string(redact.Body), result)
		assert.Equal(t, 2, strings.Count(gjson.Get(body, "messages.0.content").Str, "[REDACTED]"), lang)
		reply := runReplyHook(t, "request-redact", `{"replies": true}`, false, true, redact.Reply)
		assert.Len(t, reply.Masks, 2, lang)
	}
	// The filter samples hit the rule its schema shows as an example.
	for _, lang := range []string{"en", "zh"} {
		filter := sample("request-filter", lang)
		pattern := map[string]string{"en": "internal use only", "zh": "仅限内部使用"}[lang]
		result := runRequestPlugin(t, "request-filter", "ingress", `{"rules": [{"pattern": "`+pattern+`"}]}`, jsplugin.TransformRequest{Body: filter.Body})
		assert.Equal(t, "reject", result.Action, lang)
	}
	// The reasoning samples have a tool, so the default rules apply.
	assert.True(t, gjson.GetBytes(sample("auto-reasoning", "en").Body, "tools.0").Exists())
	assert.Equal(t, "[sample-image]", gjson.GetBytes(sample("image-compress", "zh").Body, "messages.0.content.1").Str)
	encoded, err := common.Marshal(sample("param-override", "en"))
	require.NoError(t, err)
	assert.False(t, gjson.GetBytes(encoded, "reply").Exists())
}

func TestRequestPluginsReadTaskSubmissions(t *testing.T) {
	// The built-ins read the prompts of task submissions where each vendor
	// puts them, negative prompts included, and leave a string content (a
	// Midjourney member) alone.
	body := `{
		"model": "veo",
		"prompt": "a@example.com walks",
		"negative_prompt": "b@example.com",
		"lyrics": "c@example.com",
		"input": {"prompt": "d@example.com", "negative_prompt": "e@example.com", "messages": [{"role": "user", "content": [{"type": "text", "text": "f@example.com"}]}]},
		"parameters": {"negative_prompt": "g@example.com"},
		"instances": [{"prompt": "h@example.com", "image": {"bytesBase64Encoded": "[media:0]"}}],
		"content": [{"type": "text", "text": "i@example.com --ratio 16:9"}, {"type": "image_url", "image_url": {"url": "[media:1]"}}],
		"customId": "j@example.com"
	}`
	result := runRequestPlugin(t, "request-redact", "ingress", `{"categories": ["email"]}`, jsplugin.TransformRequest{Body: json.RawMessage(body)})
	assert.Equal(t, []jsplugin.TransformFinding{{Rule: "email", Category: "email", Count: 9}}, result.Findings)
	patched, _ := applyEffects(t, body, result)
	assert.JSONEq(t, `{
		"model": "veo",
		"prompt": "[REDACTED] walks",
		"negative_prompt": "[REDACTED]",
		"lyrics": "[REDACTED]",
		"input": {"prompt": "[REDACTED]", "negative_prompt": "[REDACTED]", "messages": [{"role": "user", "content": [{"type": "text", "text": "[REDACTED]"}]}]},
		"parameters": {"negative_prompt": "[REDACTED]"},
		"instances": [{"prompt": "[REDACTED]", "image": {"bytesBase64Encoded": "[media:0]"}}],
		"content": [{"type": "text", "text": "[REDACTED] --ratio 16:9"}, {"type": "image_url", "image_url": {"url": "[media:1]"}}],
		"customId": "j@example.com"
	}`, patched)
	mj := `{"prompt": "a cat", "content": "k@example.com"}`
	result = runRequestPlugin(t, "request-redact", "ingress", `{"categories": ["email"]}`, jsplugin.TransformRequest{Body: json.RawMessage(mj)})
	assert.Empty(t, result.Findings)

	filter := `{"rules": [{"id": "falcon", "pattern": "Project Falcon"}]}`
	for _, body := range []string{
		`{"negative_prompt": "project falcon"}`,
		`{"instances": [{"prompt": "Project Falcon at dawn"}]}`,
		`{"gpt_description_prompt": "a song about Project Falcon"}`,
		`{"input": {"messages": [{"role": "user", "content": "Project Falcon"}]}}`,
	} {
		result = runRequestPlugin(t, "request-filter", "ingress", filter, jsplugin.TransformRequest{Body: json.RawMessage(body)})
		assert.Equal(t, "falcon", result.RuleID, body)
	}
	result = runRequestPlugin(t, "request-filter", "ingress", filter, jsplugin.TransformRequest{Body: json.RawMessage(`{"prompt": "a cat", "content": "Project Falcon"}`)})
	assert.Equal(t, "continue", result.Action)

	// On a form body the redactions are replace operations with string
	// values, the only change a form takes.
	form := `{"model": "sora-2", "prompt": "mail a@example.com", "seconds": "8", "tag": ["b@example.com", "x"]}`
	result = runRequestPlugin(t, "request-redact", "ingress", `{"categories": ["email"]}`, jsplugin.TransformRequest{Body: json.RawMessage(form), Form: true})
	effects, err := requestpatch.DecodeTransformEffects(result.Effects, requestpatch.EffectJSONPatch)
	require.NoError(t, err)
	for _, effect := range effects {
		for _, op := range effect.Ops {
			assert.Equal(t, "replace", op.Op)
			assert.Equal(t, gjson.String, gjson.ParseBytes(op.Value).Type)
		}
	}
	patched, _ = applyEffects(t, form, result)
	assert.JSONEq(t, `{"model": "sora-2", "prompt": "mail [REDACTED]", "seconds": "8", "tag": ["b@example.com", "x"]}`, patched)
}

func TestContentModerationTaskSubmissions(t *testing.T) {
	clean := moderationResult(map[string]bool{"violence": false})
	defaults := map[string]any{"apiKey": "sk-test"}
	cases := []struct {
		name, format, body, input string
	}{
		{"song prompts, negative prompt left out", "task", `{"model": "suno", "prompt": "a cat", "negative_prompt": "blood", "lyrics": "la la", "gpt_description_prompt": "calm"}`, "a cat\nla la\ncalm"},
		{"input prompt and user messages", "task", `{"input": {"prompt": "a dog", "negative_prompt": "gore", "messages": [{"role": "system", "content": "be nice"}, {"role": "user", "content": "run"}]}}`, "a dog\nrun"},
		{"instances and content parts", "task", `{"instances": [{"prompt": "a fox"}], "content": [{"type": "text", "text": "a horse"}, {"type": "image_url", "image_url": {"url": "[media:0]"}}]}`, "a fox\na horse"},
		{"Midjourney prompt", "mj_proxy", `{"prompt": "a lighthouse --ar 16:9", "base64Array": []}`, "a lighthouse --ar 16:9"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result, calls, err := runModeration(t, defaults, tc.format, "/v1/videos", tc.body, http.StatusOK, clean)
			require.NoError(t, err)
			assert.Equal(t, "continue", result.Action)
			require.Len(t, calls, 1)
			assert.Equal(t, tc.input, calls[0].Body["input"])
		})
	}
}

// dryRunBuiltIn runs one instance of a built-in plugin through the host's
// dry run, attachments included.
func dryRunBuiltIn(t *testing.T, key string, config map[string]any, body string) requestplugin.DryRunResult {
	t.Helper()
	plugin, found := jsplugin.DefaultRegistry.Generation().Get(key)
	require.True(t, found, key)
	raw, err := common.Marshal(config)
	require.NoError(t, err)
	validated, err := plugin.ValidateConfig(raw)
	require.NoError(t, err)
	result := requestplugin.DryRun(t.Context(), requestplugin.DryRunInput{Format: "openai", Path: "/v1/chat/completions", Model: "gpt", Group: "default",
		Body: []byte(body), Instance: &request_plugin_setting.Instance{ID: "try", Name: "Try", Plugin: key, Config: validated}})
	require.Nil(t, result.Failed)
	return result
}

func userContent(parts ...string) string {
	return `{"model":"gpt","messages":[{"role":"user","content":[{"type":"text","text":"Please read."},` + strings.Join(parts, ",") + `]}]}`
}

func fileAttachment(filename, mime string, data []byte) string {
	return `{"type":"file","file":{"filename":"` + filename + `","file_data":"data:` + mime + `;base64,` + base64.StdEncoding.EncodeToString(data) + `"}}`
}

const tinyImage = `{"type":"image_url","image_url":{"url":"data:image/png;base64,iVBORw0KGgo="}}`

// onePagePDF is a PDF whose one page shows text in Helvetica.
func onePagePDF(text string) []byte {
	content := "BT /F1 12 Tf 72 712 Td (" + text + ") Tj ET"
	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	}
	var pdf strings.Builder
	pdf.WriteString("%PDF-1.4\n")
	offsets := make([]int, len(objects))
	for index, object := range objects {
		offsets[index] = pdf.Len()
		fmt.Fprintf(&pdf, "%d 0 obj\n%s\nendobj\n", index+1, object)
	}
	xref := pdf.Len()
	fmt.Fprintf(&pdf, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for _, offset := range offsets {
		fmt.Fprintf(&pdf, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&pdf, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, xref)
	return []byte(pdf.String())
}

// The keyword list matches in any letter case unless told otherwise, in the
// request text and in the text of its documents; images and files named by
// id are left alone.
func TestRequestFilterKeywords(t *testing.T) {
	config := map[string]any{"keywords": "Forbidden\n秘密"}
	result := dryRunBuiltIn(t, "request-filter", config, `{"model":"gpt","messages":[{"role":"user","content":"this is FORBIDDEN"}]}`)
	require.NotNil(t, result.Rejected)
	assert.Equal(t, "request_filtered", result.Rejected.Code)
	assert.Equal(t, "keywords", result.Steps[0].RuleID)
	assert.NotContains(t, result.Rejected.Message, "Forbidden")
	result = dryRunBuiltIn(t, "request-filter", map[string]any{"keywords": "Forbidden", "keywordsCaseSensitive": true}, `{"model":"gpt","messages":[{"role":"user","content":"this is FORBIDDEN"}]}`)
	assert.Nil(t, result.Rejected)

	for name, tc := range map[string]struct {
		part string
		mime string
	}{
		"text file":     {fileAttachment("a.txt", "text/plain", []byte("内部秘密")), "text/plain"},
		"PDF":           {fileAttachment("a.pdf", "application/pdf", onePagePDF("Forbidden plan")), "application/pdf"},
		"Claude text":   {`{"type":"document","source":{"type":"text","media_type":"text/plain","data":"top 秘密"}}`, ""},
		"after a match": {fileAttachment("a.txt", "text/plain", []byte("fine")), ""},
	} {
		t.Run(name, func(t *testing.T) {
			body := userContent(tc.part)
			if name == "after a match" {
				// The text matched first, so no attachment was read.
				body = strings.Replace(body, "Please read.", "Forbidden", 1)
			}
			result := dryRunBuiltIn(t, "request-filter", config, body)
			require.NotNil(t, result.Rejected)
			if tc.mime == "" {
				assert.Empty(t, result.Record[0].Attachments)
				return
			}
			assert.Equal(t, []relaycommon.RequestPluginAttachment{{Kind: "document", Mime: tc.mime, Status: "checked"}}, result.Record[0].Attachments)
		})
	}

	result = dryRunBuiltIn(t, "request-filter", config, userContent(fileAttachment("a.txt", "text/plain", []byte("fine")), tinyImage, `{"type":"file","file":{"file_id":"file-1"}}`))
	assert.Nil(t, result.Rejected)
	assert.Equal(t, []relaycommon.RequestPluginAttachment{
		{Kind: "document", Mime: "text/plain", Status: "checked"},
		{Kind: "image", Mime: "image/png", Status: "unchecked"},
		{Kind: "document", Status: "unchecked", Reason: "reference"},
	}, result.Record[0].Attachments)

	// Replies too, holding back the longest keyword.
	replies := `{"keywords": "Forbidden\nab", "replies": true}`
	assert.Equal(t, jsplugin.ReplyResult{Action: "stop", Code: "request_filtered", Findings: []jsplugin.TransformFinding{{Rule: "keywords", Count: 1}}},
		runReplyHook(t, "request-filter", replies, true, false, "this is forbidden"))
	assert.Equal(t, jsplugin.ReplyResult{Action: "continue", Hold: len("Forbidden") - 1}, runReplyHook(t, "request-filter", replies, true, false, "fine"))
}

// A text file read whole takes the redacted text. A PDF that holds a match
// cannot be rewritten: with the check before sending on it rejects the
// request, off it goes as it is and the record says so.
func TestRequestRedactAttachments(t *testing.T) {
	text := fileAttachment("notes.txt", "text/plain", []byte("mail jane.doe@example.com"))
	pdf := fileAttachment("cv.pdf", "application/pdf", onePagePDF("mail jane.doe@example.com"))
	clean := fileAttachment("clean.pdf", "application/pdf", onePagePDF("nothing here"))

	result := dryRunBuiltIn(t, "request-redact", map[string]any{}, userContent(text, clean, tinyImage))
	require.Nil(t, result.Rejected)
	assert.Equal(t, "data:text/plain;base64,"+base64.StdEncoding.EncodeToString([]byte("mail [REDACTED]")), gjson.GetBytes(result.Body, "messages.0.content.1.file.file_data").Str)
	assert.Equal(t, gjson.Get(userContent(clean), "messages.0.content.1.file.file_data").Str, gjson.GetBytes(result.Body, "messages.0.content.2.file.file_data").Str)
	assert.Equal(t, []relaycommon.RequestPluginAttachment{
		{Kind: "document", Mime: "text/plain", Status: "checked", Rewritten: true},
		{Kind: "document", Mime: "application/pdf", Status: "checked"},
		{Kind: "image", Mime: "image/png", Status: "unchecked"},
	}, result.Record[0].Attachments)
	assert.Equal(t, []relaycommon.RequestPluginCount{{Category: "email", Count: 1}}, result.Record[0].Findings)

	result = dryRunBuiltIn(t, "request-redact", map[string]any{}, userContent(pdf))
	require.NotNil(t, result.Rejected)
	assert.Equal(t, "sensitive_content", result.Rejected.Code)
	assert.Equal(t, "email", result.Steps[0].RuleID)

	body := userContent(pdf)
	result = dryRunBuiltIn(t, "request-redact", map[string]any{"finalCheck": "off"}, body)
	require.Nil(t, result.Rejected)
	assert.JSONEq(t, body, string(result.Body))
	assert.Equal(t, []relaycommon.RequestPluginAttachment{{Kind: "document", Mime: "application/pdf", Status: "unchecked", Reason: "not_rewritable"}}, result.Record[0].Attachments)
}

// Images in the user message go to the moderation API one per request, an
// inline one as its data and a remote one by URL; documents go as text.
func TestContentModerationImagesAndDocuments(t *testing.T) {
	var inputs []string
	flagImages := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		input := gjson.GetBytes(raw, "input")
		inputs = append(inputs, input.Raw)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(moderationResult(map[string]bool{"violence": flagImages && input.Get("0.type").Str == "image_url"})))
	}))
	t.Cleanup(server.Close)
	url := server.URL + "/v1/moderations"
	remote := `{"type":"image_url","image_url":{"url":"https://example.com/cat.png"}}`
	body := `{"model":"gpt","messages":[{"role":"user","content":"earlier"},{"role":"assistant","content":"ok"},{"role":"user","content":[{"type":"text","text":"Please read."},` +
		tinyImage + `,` + remote + `,` + fileAttachment("a.pdf", "application/pdf", onePagePDF("The plan")) + `]}]}`

	result := dryRunBuiltIn(t, "content-moderation", map[string]any{"url": url}, body)
	require.Nil(t, result.Rejected)
	assert.Equal(t, []string{`["Please read.","The plan"]`,
		`[{"type":"image_url","image_url":{"url":"data:image/png;base64,iVBORw0KGgo="}}]`,
		`[{"type":"image_url","image_url":{"url":"https://example.com/cat.png"}}]`}, inputs)
	assert.Equal(t, []relaycommon.RequestPluginAttachment{
		{Kind: "image", Mime: "image/png", Status: "checked"},
		{Kind: "image", Status: "checked"},
		{Kind: "document", Mime: "application/pdf", Status: "checked"},
	}, result.Record[0].Attachments)

	inputs = nil
	result = dryRunBuiltIn(t, "content-moderation", map[string]any{"url": url, "images": false}, body)
	require.Nil(t, result.Rejected)
	assert.Equal(t, []string{`["Please read.","The plan"]`}, inputs)

	// A message with only an image is checked; a flagged image rejects.
	inputs, flagImages = nil, true
	result = dryRunBuiltIn(t, "content-moderation", map[string]any{"url": url}, `{"model":"gpt","messages":[{"role":"user","content":[`+tinyImage+`]}]}`)
	require.NotNil(t, result.Rejected)
	assert.Equal(t, "moderation.flagged", result.Rejected.Code)
	assert.Equal(t, []string{`[{"type":"image_url","image_url":{"url":"data:image/png;base64,iVBORw0KGgo="}}]`}, inputs)
}
