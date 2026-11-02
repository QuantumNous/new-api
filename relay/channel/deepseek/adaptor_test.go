package deepseek

import (
	"fmt"
	"strings"
	"testing"

	"github.com/MoeForge/moego/ojson"
	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The -none/-low/-max tails of deepseek-flash and deepseek-v4-* reach DeepSeek
// as its own thinking switch and effort in each upstream format, with the base
// name; a bare name keeps DeepSeek's default, and a blacklisted name is sent
// verbatim.
func TestThinkingSuffixUpstreamFields(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	original := append([]string(nil), settings.ThinkingModelBlacklist...)
	t.Cleanup(func() { settings.ThinkingModelBlacklist = original })
	settings.ThinkingModelBlacklist = append(original, "deepseek-v4-pro-max")

	tests := []struct {
		model, upstream, thinking, effort string
	}{
		{model: "deepseek-flash", upstream: "deepseek-flash"},
		{model: "deepseek-flash-none", upstream: "deepseek-flash", thinking: "disabled"},
		{model: "deepseek-flash-low", upstream: "deepseek-flash", thinking: "enabled", effort: "low"},
		{model: "deepseek-flash-max", upstream: "deepseek-flash", thinking: "enabled", effort: "max"},
		{model: "deepseek-v4-pro-none", upstream: "deepseek-v4-pro", thinking: "disabled"},
		{model: "deepseek-v4-pro-low", upstream: "deepseek-v4-pro", thinking: "enabled", effort: "low"},
		{model: "deepseek-v4-pro-max", upstream: "deepseek-v4-pro-max"},
	}
	newInfo := func(model string) *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{OriginModelName: model, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: model}}
	}
	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			chat := &dto.GeneralOpenAIRequest{Model: tt.model}
			converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, newInfo(tt.model), chat)
			require.NoError(t, err)
			chat = converted.(*dto.GeneralOpenAIRequest)
			assert.Equal(t, tt.upstream, chat.Model)
			assert.Equal(t, tt.effort, chat.ReasoningEffort)

			claude := &dto.ClaudeRequest{Model: tt.model}
			require.NoError(t, applyDeepSeekV4ClaudeThinkingSuffix(newInfo(tt.model), claude))
			assert.Equal(t, tt.upstream, claude.Model)

			converted, err = (&Adaptor{}).ConvertOpenAIResponsesRequest(nil, newInfo(tt.model), dto.OpenAIResponsesRequest{Model: tt.model})
			require.NoError(t, err)
			responses := converted.(dto.OpenAIResponsesRequest)
			assert.Equal(t, tt.upstream, responses.Model)

			if tt.thinking == "" {
				assert.Empty(t, chat.THINKING)
				assert.Nil(t, claude.Thinking)
				assert.Nil(t, claude.OutputConfig)
				assert.Nil(t, responses.Reasoning)
				return
			}
			assert.JSONEq(t, `{"type":"`+tt.thinking+`"}`, string(chat.THINKING))
			require.NotNil(t, claude.Thinking)
			assert.Equal(t, tt.thinking, claude.Thinking.Type)
			require.NotNil(t, responses.Reasoning)
			if tt.thinking == "disabled" {
				assert.Nil(t, claude.OutputConfig)
				assert.Equal(t, "none", responses.Reasoning.Effort)
				return
			}
			assert.JSONEq(t, `{"effort":"`+tt.effort+`"}`, string(claude.OutputConfig))
			assert.Equal(t, tt.effort, responses.Reasoning.Effort)
		})
	}
}

// DeepSeek runs Claude Code and Codex searches server-side and bills them as
// Search and Fetch API calls, whatever model name the client sent. On the
// Responses API the completed web_search_call items of the whole response
// replace the items counted while streaming: open_page is a Fetch call, a
// failed call is free, and an empty output keeps the streamed count.
func TestServerSideSearchBillingKeys(t *testing.T) {
	for _, tc := range []struct {
		format types.RelayFormat
		mode   int
	}{
		{types.RelayFormatClaude, constant.RelayModeUnknown},
		{types.RelayFormatOpenAI, constant.RelayModeChatCompletions},
		{types.RelayFormatOpenAIResponses, constant.RelayModeResponses},
	} {
		info := &relaycommon.RelayInfo{RelayFormat: tc.format, RelayMode: tc.mode, ChannelMeta: &relaycommon.ChannelMeta{}}
		(&Adaptor{}).Init(info)
		assert.Equal(t, SearchToolPriceKey, info.WebSearchBillingKey, tc.format)
		assert.Equal(t, FetchToolPriceKey, info.WebFetchBillingKey, tc.format)
		assert.Equal(t, tc.mode == constant.RelayModeResponses, info.VendorToolUsage != nil, tc.format)
	}

	const output = `[
		{"type":"web_search_call","status":"completed","action":{"type":"search","queries":["deepseek","ws_call_id=call_01"]}},
		{"type":"web_search_call","status":"completed","action":{"type":"open_page","url":"https://example.com/"}},
		{"type":"web_search_call","status":"failed","action":{"type":"open_page","url":"https://api-docs.deepseek.com/"}},
		{"type":"message","status":"completed"}]`
	for _, raw := range []string{
		`{"status":"completed","output":` + output + `}`,
		`{"type":"response.completed","response":{"status":"completed","output":` + output + `}}`,
	} {
		info := &relaycommon.RelayInfo{
			OriginModelName: "gpt-5.1-codex",
			RelayFormat:     types.RelayFormatOpenAIResponses,
			RelayMode:       constant.RelayModeResponses,
			ChannelMeta:     &relaycommon.ChannelMeta{},
		}
		(&Adaptor{}).Init(info)
		for range 3 {
			info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
		}
		assert.Equal(t, map[string]int{SearchToolPriceKey: 3}, toolCounts(info), "streamed items bill under the Search key")

		info.ApplyVendorToolUsage([]byte(`{"type":"response.failed","response":{"status":"failed","output":[]}}`))
		assert.Equal(t, map[string]int{SearchToolPriceKey: 3}, toolCounts(info), "an empty output keeps the streamed count")

		info.ApplyVendorToolUsage([]byte(raw))
		assert.Equal(t, map[string]int{SearchToolPriceKey: 1, FetchToolPriceKey: 1}, toolCounts(info), raw)
	}
}

func toolCounts(info *relaycommon.RelayInfo) map[string]int {
	counts := map[string]int{}
	for name, tool := range info.ResponsesUsageInfo.BuiltInTools {
		counts[name] = tool.CallCount
	}
	return counts
}

// Explicit @ modifiers reach DeepSeek as its own thinking switch and effort in
// every format and override the client's reasoning fields: no budget_tokens,
// adaptive thinking, max_tokens raise or sampling change. An @ effort wins
// over a -none/-low/-max tail, a budget maps to an effort, and a request
// without a modifier passes through unchanged. The usage log records the
// effort DeepSeek runs at.
func TestModelModifiersUpstreamFields(t *testing.T) {
	type client struct{ chat, claude, responses string }
	tests := []struct {
		name, model      string
		client           client
		thinking, effort string // thinking "" = untouched
		logEffort        string
	}{
		{name: "thinking on", model: "deepseek-flash@thinking:on", thinking: "enabled", logEffort: "high"},
		{name: "thinking off", model: "deepseek-flash@thinking:off", thinking: "disabled", logEffort: "none"},
		{name: "thinking zero budget", model: "deepseek-flash@thinking:0", thinking: "disabled", logEffort: "none"},
		{name: "effort none", model: "deepseek-flash@effort:none", thinking: "disabled", logEffort: "none"},
		{name: "effort low", model: "deepseek-flash@effort:low", thinking: "enabled", effort: "low", logEffort: "low"},
		{name: "effort medium", model: "deepseek-flash@effort:medium", thinking: "enabled", effort: "medium", logEffort: "high"},
		{name: "effort xhigh", model: "deepseek-flash@effort:xhigh", thinking: "enabled", effort: "xhigh", logEffort: "high"},
		{name: "effort max on pro", model: "deepseek-v4-pro@effort:max", thinking: "enabled", effort: "max", logEffort: "max"},
		{name: "budget maps to an effort", model: "deepseek-flash@thinking:8192", thinking: "enabled", effort: "medium", logEffort: "high"},
		{name: "adaptive", model: "deepseek-flash@thinking:adaptive", thinking: "enabled", logEffort: "high"},
		{name: "temperature with effort", model: "deepseek-flash@temperature:0.3@effort:low", thinking: "enabled", effort: "low", logEffort: "low"},
		{name: "effort overrides client thinking off", model: "deepseek-flash@effort:max", thinking: "enabled", effort: "max", logEffort: "max",
			client: client{chat: `"thinking":{"type":"disabled"}`, claude: `"thinking":{"type":"disabled"}`, responses: `"reasoning":{"effort":"none"}`}},
		{name: "thinking off overrides client thinking", model: "deepseek-flash@thinking:off", thinking: "disabled", logEffort: "none",
			client: client{chat: `"thinking":{"type":"enabled"},"reasoning_effort":"high"`,
				claude:    `"thinking":{"type":"enabled","budget_tokens":2048},"output_config":{"effort":"high","format":{"type":"json_schema"}}`,
				responses: `"reasoning":{"effort":"high"}`}},
		{name: "budget overrides client effort none", model: "deepseek-flash@thinking:8192", thinking: "enabled", effort: "medium", logEffort: "high",
			client: client{responses: `"reasoning":{"effort":"none"}`}},
		{name: "@ effort wins over a tail", model: "deepseek-flash-max@effort:low", thinking: "enabled", effort: "low", logEffort: "low"},
		{name: "no modifier", model: "deepseek-flash",
			client: client{chat: `"thinking":{"type":"disabled"},"reasoning_effort":"low"`, claude: `"thinking":{"type":"adaptive"},"output_config":{"effort":"low"}`, responses: `"reasoning":{"effort":"low"}`}},
	}
	extra := func(members string) string {
		if members == "" {
			return ""
		}
		return "," + members
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bodies := map[types.RelayFormat]string{
				types.RelayFormatOpenAI:          fmt.Sprintf(`{"model":%q,"messages":[{"role":"user","content":"hi"}]%s}`, tt.model, extra(tt.client.chat)),
				types.RelayFormatClaude:          fmt.Sprintf(`{"model":%q,"max_tokens":64,"temperature":0.7,"messages":[{"role":"user","content":"hi"}]%s}`, tt.model, extra(tt.client.claude)),
				types.RelayFormatOpenAIResponses: fmt.Sprintf(`{"model":%q,"input":"hi"%s}`, tt.model, extra(tt.client.responses)),
			}
			for format, body := range bodies {
				info := &relaycommon.RelayInfo{
					OriginModelName: tt.model,
					RelayFormat:     format,
					ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: tt.model},
				}
				var sent []byte
				switch format {
				case types.RelayFormatOpenAI:
					original, outbound := &dto.GeneralOpenAIRequest{}, &dto.GeneralOpenAIRequest{}
					require.NoError(t, common.UnmarshalJsonStr(body, original))
					require.NoError(t, common.UnmarshalJsonStr(body, outbound))
					info.Request = original
					require.NoError(t, helper.ApplyReasoningModelSuffix(nil, info, outbound))
					converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, outbound)
					require.NoError(t, err)
					sent, err = common.Marshal(converted)
					require.NoError(t, err)
				case types.RelayFormatClaude:
					original, outbound := &dto.ClaudeRequest{}, &dto.ClaudeRequest{}
					require.NoError(t, common.UnmarshalJsonStr(body, original))
					require.NoError(t, common.UnmarshalJsonStr(body, outbound))
					info.Request = original
					require.NoError(t, helper.ApplyReasoningModelSuffix(nil, info, outbound))
					converted, err := (&Adaptor{}).ConvertClaudeRequest(nil, info, outbound)
					require.NoError(t, err)
					sent, err = common.Marshal(converted)
					require.NoError(t, err)
				default:
					original, outbound := &dto.OpenAIResponsesRequest{}, &dto.OpenAIResponsesRequest{}
					require.NoError(t, common.UnmarshalJsonStr(body, original))
					require.NoError(t, common.UnmarshalJsonStr(body, outbound))
					info.Request = original
					require.NoError(t, helper.ApplyReasoningModelSuffix(nil, info, outbound))
					converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(nil, info, *outbound)
					require.NoError(t, err)
					sent, err = common.Marshal(converted)
					require.NoError(t, err)
				}
				wire := ojson.ParseBytes(sent)
				wantModel := "deepseek-flash"
				if strings.HasPrefix(tt.model, "deepseek-v4-pro") {
					wantModel = "deepseek-v4-pro"
				}
				assert.Equal(t, wantModel, wire.Get("model").String(), format)
				if tt.thinking == "" {
					// No modifier: the client's reasoning fields go out as sent.
					for _, member := range []string{"thinking", "reasoning_effort", "output_config", "reasoning"} {
						assert.Equal(t, ojson.Get(body, member).Raw, wire.Get(member).Raw, "%s %s", format, member)
					}
					continue
				}
				switch format {
				case types.RelayFormatOpenAI:
					assert.JSONEq(t, `{"type":"`+tt.thinking+`"}`, wire.Get("thinking").Raw, format)
					assert.Equal(t, tt.effort, wire.Get("reasoning_effort").String(), format)
					assert.False(t, wire.Get("reasoning").Exists(), format)
				case types.RelayFormatClaude:
					assert.JSONEq(t, `{"type":"`+tt.thinking+`"}`, wire.Get("thinking").Raw, format)
					assert.Equal(t, tt.effort, wire.Get("output_config.effort").String(), format)
					assert.Equal(t, ojson.Get(body, "output_config.format").Raw, wire.Get("output_config.format").Raw, format)
					assert.Equal(t, int64(64), wire.Get("max_tokens").Int(), format)
					wantTemperature := 0.7
					if strings.Contains(tt.model, "@temperature:0.3") {
						wantTemperature = 0.3
					}
					assert.Equal(t, wantTemperature, wire.Get("temperature").Float(), format)
				default:
					wantEffort := tt.effort
					if tt.thinking == "disabled" {
						wantEffort = "none"
					}
					assert.Equal(t, wantEffort, wire.Get("reasoning.effort").String(), format)
				}
				assert.Equal(t, tt.logEffort, info.ReasoningEffort, format)
			}
		})
	}
}

// Synthetic shapes reproduced against DeepSeek's native Responses endpoint on
// 2026-10-28; see also https://github.com/yetone/magpie/issues/1822.
// An empty string fails while a space before the assistant step succeeds.
func TestResponsesReasoningReplay(t *testing.T) {
	// Exercise the final wire-body hook without dropping unknown JSON fields.
	finalize := func(info *relaycommon.RelayInfo, req dto.OpenAIResponsesRequest) (any, error) {
		data, err := common.Marshal(req)
		if err != nil {
			return nil, err
		}
		data, err = (&Adaptor{}).FinalizeResponsesRequest(info, data)
		if err != nil {
			return nil, err
		}
		var out dto.OpenAIResponsesRequest
		err = common.Unmarshal(data, &out)
		return out, err
	}
	const r = `{"type":"reasoning","summary":[],"content":[{"type":"reasoning_text","text":" "}]}`
	const note = `{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Checking."}]}`
	const call = `{"type":"function_call","call_id":"c1","name":"probe","arguments":"{}"}`
	const output = `{"type":"function_call_output","call_id":"c1","output":"7"}`
	const call2 = `{"type":"function_call","call_id":"c2","name":"probe","arguments":"{}"}`
	const output2 = `{"type":"function_call_output","call_id":"c2","output":"8"}`
	const customCall = `{"type":"custom_tool_call","call_id":"custom1","name":"apply_patch","input":"synthetic"}`
	const customOutput = `{"type":"custom_tool_call_output","call_id":"custom1","output":"ok"}`
	const actual = `{"type":"reasoning","id":"r1","summary":[],"encrypted_content":"opaque","content":[{"type":"reasoning_text","text":"Existing reasoning"}],"extra":9007199254740993}`
	tests := []struct{ name, input, want string }{
		{"missing", "[" + note + "," + call + "," + output + "]", "[" + r + "," + note + "," + call + "," + output + "]"},
		{"empty", `[{"type":"reasoning","summary":[],"content":[{"type":"reasoning_text","text":""}]},` + call + "]", "[" + r + "," + call + "]"},
		{"null content", `[{"type":"reasoning","summary":[],"content":null},` + call + "]", "[" + r + "," + call + "]"},
		{"missing content", `[{"type":"reasoning","summary":[]},` + call + "]", "[" + r + "," + call + "]"},
		{"empty content", `[{"type":"reasoning","summary":[],"content":[]},` + call + "]", "[" + r + "," + call + "]"},
		{"move existing", "[" + note + "," + actual + "," + call + "," + output + "]", "[" + actual + "," + note + "," + call + "," + output + "]"},
		{"preserve", "[" + actual + "," + note + "," + call + "," + output + "]", "[" + actual + "," + note + "," + call + "," + output + "]"},
		{"interleaved", "[" + call + "," + output + "," + call2 + "," + output2 + "]", "[" + r + "," + call + "," + output + "," + r + "," + call2 + "," + output2 + "]"},
		{"after tool", "[" + call + "," + output + "," + note + "]", "[" + r + "," + call + "," + output + "," + r + "," + note + "]"},
		{"new user boundary", "[" + call + "," + output + `,{"role":"user","content":"Next"},` + note + "]", "[" + r + "," + call + "," + output + `,{"role":"user","content":"Next"},` + note + "]"},
		{"parallel", "[" + note + "," + call + "," + call2 + "," + output + "," + output2 + "]", "[" + r + "," + note + "," + call + "," + call2 + "," + output + "," + output2 + "]"},
		{"missing text", `[{"type":"reasoning","summary":[],"content":[{"type":"reasoning_text"}]},` + call + "]", "[" + r + "," + call + "]"},
		{"null text", `[{"type":"reasoning","summary":[],"content":[{"type":"reasoning_text","text":null}]},` + call + "]", "[" + r + "," + call + "]"},
		{"preserve whitespace", "[" + r + "," + call + "]", "[" + r + "," + call + "]"},
		{"unknown boundary", "[" + call + "," + output + `,{"type":"future_item"},` + note + "]", "[" + r + "," + call + "," + output + `,{"type":"future_item"},` + note + "]"},
		{"custom tool", "[" + note + "," + customCall + "," + customOutput + "," + note + "]", "[" + r + "," + note + "," + customCall + "," + customOutput + "," + r + "," + note + "]"},
		{"message only", "[" + note + "]", "[" + note + "]"},
		{"string input", `"hello"`, `"hello"`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req dto.OpenAIResponsesRequest
			require.NoError(t, common.Unmarshal([]byte(`{"model":"deepseek-flash","input":`+tt.input+`}`), &req))
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.deepseek.com"}}
			converted, err := finalize(info, req)
			require.NoError(t, err)
			out := converted.(dto.OpenAIResponsesRequest)
			assert.JSONEq(t, tt.want, string(out.Input))
			if strings.Contains(tt.input, `"extra":9007199254740993`) {
				assert.Contains(t, string(out.Input), `"extra":9007199254740993`)
			}
			assert.Equal(t, tt.input, string(req.Input), "input belongs to the caller")
			again, err := finalize(info, out)
			require.NoError(t, err)
			assert.Equal(t, string(out.Input), string(again.(dto.OpenAIResponsesRequest).Input))
		})
	}
	for _, endpoint := range []string{
		"", "https://api.deepseek.com/v1", "https://api.deepseek.com:443",
		"https://API.DEEPSEEK.COM", "https://Api.DeepSeek.Com:443/v1",
	} {
		t.Run("official "+endpoint, func(t *testing.T) {
			var req dto.OpenAIResponsesRequest
			require.NoError(t, common.Unmarshal([]byte(`{"model":"deepseek-flash","input":[`+call+`]}`), &req))
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: endpoint}}
			converted, err := finalize(info, req)
			require.NoError(t, err)
			assert.JSONEq(t, "["+r+","+call+"]", string(converted.(dto.OpenAIResponsesRequest).Input))
		})
	}
	for _, endpoint := range []string{
		"https://other.example", "https://api.deepseek.com.example", "http://api.deepseek.com",
		"https://API.DEEPSEEK.COM:8443", "https://api.deepseek.com:invalid",
	} {
		t.Run(endpoint, func(t *testing.T) {
			var req dto.OpenAIResponsesRequest
			require.NoError(t, common.Unmarshal([]byte(`{"model":"deepseek-flash","input":[`+call+`]}`), &req))
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: endpoint}}
			converted, err := finalize(info, req)
			require.NoError(t, err)
			assert.Equal(t, req.Input, converted.(dto.OpenAIResponsesRequest).Input)
		})
	}
	t.Run("thinking disabled", func(t *testing.T) {
		var req dto.OpenAIResponsesRequest
		require.NoError(t, common.Unmarshal([]byte(`{"model":"deepseek-flash","reasoning":{"effort":"none"},"input":[`+call+`]}`), &req))
		converted, err := finalize(nil, req)
		require.NoError(t, err)
		assert.Equal(t, req.Input, converted.(dto.OpenAIResponsesRequest).Input)
	})
}

// Long tool sessions are dominated by tool-result payloads, not item count.
// Keep their bodies opaque while measuring clean and repair paths.
func BenchmarkResponsesReasoningReplay(b *testing.B) {
	for _, rounds := range []int{4, 256} {
		for _, repair := range []bool{false, true} {
			b.Run(fmt.Sprintf("rounds=%d/repair=%t", rounds, repair), func(b *testing.B) {
				var input strings.Builder
				input.WriteByte('[')
				for i := range rounds {
					if i > 0 {
						input.WriteByte(',')
					}
					fmt.Fprintf(&input, `{"role":"user","content":"Inspect result %d"},`, i)
					if !repair || i != rounds-1 {
						input.WriteString(`{"type":"reasoning","summary":[],"content":[{"type":"reasoning_text","text":"Check the result."}]},`)
					}
					fmt.Fprintf(&input, `{"type":"function_call","name":"probe","call_id":"c%d","arguments":"{}"},{"type":"function_call_output","call_id":"c%d","output":"%s"}`, i, i, strings.Repeat("synthetic result ", 256))
				}
				input.WriteByte(']')
				data := []byte(input.String())
				b.ReportAllocs()
				b.SetBytes(int64(len(data)))
				b.ResetTimer()
				for b.Loop() {
					_, err := normalizeResponsesReasoningReplay(data)
					if err != nil {
						b.Fatal(err)
					}
				}
			})
		}
	}
}
