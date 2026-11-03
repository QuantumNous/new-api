package openai

import (
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// chunk builds one SSE data line from a raw JSON body.
func chunk(body string) string { return "data: " + body + "\n\n" }

// slowPathObservations reproduces what the slow path accumulates for a stream, so
// the fast path can be asserted against it rather than against hand-written
// expectations that could drift from the real billing inputs.
func slowPathObservations(t *testing.T, relayMode int, payloads []string) (text string, toolCount int, names []string, finished bool) {
	t.Helper()
	var sb strings.Builder
	seen := make(map[string]struct{})
	for _, p := range payloads {
		collectStreamFunctionCallNames(p, seen, &names)
		done, err := processTokenData(relayMode, p, &sb, &toolCount)
		require.NoError(t, err)
		if done {
			finished = true
		}
	}
	return sb.String(), toolCount, names, finished
}

// TestStreamObserverMatchesSlowPathBillingInputs is the #395 equivalence contract:
// the passthrough observer must derive the same billing inputs the slow path
// derives by unmarshalling every chunk. Divergence here is a billing bug, so the
// expectations are computed from the slow path itself.
func TestStreamObserverMatchesSlowPathBillingInputs(t *testing.T) {
	cases := []struct {
		name      string
		relayMode int
		payloads  []string
	}{
		{
			name:      "content only",
			relayMode: relayconstant.RelayModeChatCompletions,
			payloads: []string{
				`{"choices":[{"index":0,"delta":{"role":"assistant","content":"Hel"}}]}`,
				`{"choices":[{"index":0,"delta":{"content":"lo wor"}}]}`,
				`{"choices":[{"index":0,"delta":{"content":"ld"}}]}`,
				`{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
			},
		},
		{
			name:      "reasoning content counts as billable text",
			relayMode: relayconstant.RelayModeChatCompletions,
			payloads: []string{
				`{"choices":[{"index":0,"delta":{"reasoning_content":"thinking hard"}}]}`,
				`{"choices":[{"index":0,"delta":{"content":"answer"}}]}`,
				`{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
			},
		},
		{
			name:      "reasoning field variant",
			relayMode: relayconstant.RelayModeChatCompletions,
			payloads: []string{
				`{"choices":[{"index":0,"delta":{"reasoning":"alt field"}}]}`,
				`{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
			},
		},
		{
			// An explicit null must fall through to `reasoning`; the slow path
			// unmarshals null to a nil pointer and does exactly that.
			name:      "null reasoning_content falls back to reasoning",
			relayMode: relayconstant.RelayModeChatCompletions,
			payloads: []string{
				`{"choices":[{"index":0,"delta":{"reasoning_content":null,"reasoning":"fallback text"}}]}`,
				`{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
			},
		},
		{
			// Null content must contribute nothing, not the literal "null".
			name:      "null content contributes no text",
			relayMode: relayconstant.RelayModeChatCompletions,
			payloads: []string{
				`{"choices":[{"index":0,"delta":{"content":null,"reasoning_content":"only reasoning"}}]}`,
				`{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
			},
		},
		{
			name:      "tool calls deduped by index",
			relayMode: relayconstant.RelayModeChatCompletions,
			payloads: []string{
				`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}`,
				`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":"}}]}}]}`,
				`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]}}]}`,
				`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"c2","type":"function","function":{"name":"get_time","arguments":"{}"}}]}}]}`,
				`{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
			},
		},
		{
			name:      "multiple parallel tool calls in one chunk",
			relayMode: relayconstant.RelayModeChatCompletions,
			payloads: []string{
				`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"a","function":{"name":"f1","arguments":"{}"}},{"index":1,"id":"b","function":{"name":"f2","arguments":"{}"}}]}}]}`,
				`{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
			},
		},
		{
			name:      "no finish reason",
			relayMode: relayconstant.RelayModeChatCompletions,
			payloads: []string{
				`{"choices":[{"index":0,"delta":{"content":"truncated"}}]}`,
			},
		},
		{
			name:      "legacy completions mode",
			relayMode: relayconstant.RelayModeCompletions,
			payloads: []string{
				`{"choices":[{"text":"foo","finish_reason":""}]}`,
				`{"choices":[{"text":"bar","finish_reason":"stop"}]}`,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			wantText, wantToolCount, wantNames, wantFinished := slowPathObservations(t, tc.relayMode, tc.payloads)

			o := newStreamObserver(tc.relayMode)
			for _, p := range tc.payloads {
				o.observe(p)
			}

			assert.Equal(t, wantText, o.responseText.String(), "billable text must match the slow path")
			assert.Equal(t, wantToolCount, o.toolCount, "tool count drives completion token surcharge")
			assert.Equal(t, wantNames, o.toolNames, "tool names drive per-call billing")
			assert.Equal(t, wantFinished, o.sawFinishReason, "terminal detection must match the slow path")
		})
	}
}

// TestStreamObserverReadsUpstreamUsage pins the billing-critical case: when
// upstream reports usage, it must be preferred over local estimation.
func TestStreamObserverReadsUpstreamUsage(t *testing.T) {
	o := newStreamObserver(relayconstant.RelayModeChatCompletions)
	o.observe(`{"choices":[{"index":0,"delta":{"content":"hi"}}]}`)
	require.Nil(t, o.usage, "no usage reported yet")

	o.observe(`{"choices":[],"usage":{"prompt_tokens":11,"completion_tokens":7,"total_tokens":18,"prompt_tokens_details":{"cached_tokens":5}}}`)

	require.NotNil(t, o.usage)
	assert.True(t, o.containStreamUsage)
	assert.Equal(t, 11, o.usage.PromptTokens)
	assert.Equal(t, 7, o.usage.CompletionTokens)
	assert.Equal(t, 18, o.usage.TotalTokens)
	assert.Equal(t, 5, o.usage.PromptTokensDetails.CachedTokens,
		"nested detail fields must survive, they feed cache pricing")
}

// TestStreamObserverIgnoresZeroUsage matches relaycommon.ValidUsage: an all-zero
// usage block is not usable and must not suppress local token estimation.
func TestStreamObserverIgnoresZeroUsage(t *testing.T) {
	o := newStreamObserver(relayconstant.RelayModeChatCompletions)
	o.observe(`{"choices":[],"usage":{"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}}`)

	assert.Nil(t, o.usage)
	assert.False(t, o.containStreamUsage)
}

// TestStreamObserverSurvivesMalformedChunk: a non-JSON payload must not panic or
// corrupt accumulated state, since upstreams do emit junk lines.
func TestStreamObserverSurvivesMalformedChunk(t *testing.T) {
	o := newStreamObserver(relayconstant.RelayModeChatCompletions)
	o.observe(`{"choices":[{"index":0,"delta":{"content":"ok"}}]}`)
	o.observe(`not json at all`)
	o.observe(`[]`)
	o.observe(``)
	o.observe(`{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`)

	assert.Equal(t, "ok", o.responseText.String())
	assert.True(t, o.sawFinishReason)
}

// TestCanCopyAndObserveAdmission pins fast-path admission. Anything that rewrites
// the forwarded bytes, or needs observations the observer does not track, must
// stay on the slow path.
func TestCanCopyAndObserveAdmission(t *testing.T) {
	newInfo := func(mutate func(*relaycommon.RelayInfo)) *relaycommon.RelayInfo {
		info := &relaycommon.RelayInfo{
			RelayFormat: types.RelayFormatOpenAI,
			RelayMode:   relayconstant.RelayModeChatCompletions,
			ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		}
		if mutate != nil {
			mutate(info)
		}
		return info
	}

	cases := []struct {
		name   string
		info   *relaycommon.RelayInfo
		expect bool
	}{
		{"plain openai chat", newInfo(nil), true},
		{"legacy completions", newInfo(func(i *relaycommon.RelayInfo) {
			i.RelayMode = relayconstant.RelayModeCompletions
		}), true},
		{"force format rewrites bytes", newInfo(func(i *relaycommon.RelayInfo) {
			i.ChannelSetting.ForceFormat = true
		}), false},
		{"thinking to content rewrites bytes", newInfo(func(i *relaycommon.RelayInfo) {
			i.ChannelSetting.ThinkingToContent = true
		}), false},
		{"claude format needs conversion", newInfo(func(i *relaycommon.RelayInfo) {
			i.RelayFormat = types.RelayFormatClaude
		}), false},
		{"gemini format needs conversion", newInfo(func(i *relaycommon.RelayInfo) {
			i.RelayFormat = types.RelayFormatGemini
		}), false},
		{"audio model usage comes from second-last chunk", newInfo(func(i *relaycommon.RelayInfo) {
			i.UpstreamModelName = "gpt-4o-audio-preview"
		}), false},
		{"responses mode", newInfo(func(i *relaycommon.RelayInfo) {
			i.RelayMode = relayconstant.RelayModeResponses
		}), false},
		{"nil info", nil, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expect, canCopyAndObserve(tc.info))
		})
	}
}

// TestOaiStreamHandlerFastPathForwardsUpstreamBytesVerbatim is the passthrough
// contract: the client must see exactly the upstream chunk bodies, in order, and
// the terminal [DONE]. Re-serialization would reorder or reshape JSON keys.
func TestOaiStreamHandlerFastPathForwardsUpstreamBytesVerbatim(t *testing.T) {
	// Key order here is deliberately not the DTO's field order, and includes a
	// field new-api's DTO does not model, so any round-trip would be visible.
	bodies := []string{
		`{"choices":[{"delta":{"content":"Hel"},"index":0}],"model":"gpt-test","id":"c1","object":"chat.completion.chunk","created":1710000000,"vendor_extra":{"keep":true}}`,
		`{"choices":[{"delta":{"content":"lo"},"index":0}],"model":"gpt-test","id":"c1","object":"chat.completion.chunk","created":1710000000}`,
		`{"choices":[{"delta":{},"finish_reason":"stop","index":0}],"model":"gpt-test","id":"c1","object":"chat.completion.chunk","created":1710000000}`,
	}
	var upstream strings.Builder
	for _, b := range bodies {
		upstream.WriteString(chunk(b))
	}
	upstream.WriteString("data: [DONE]\n\n")

	c, recorder, resp, info := newStreamTestContext(t, upstream.String())
	require.True(t, canCopyAndObserve(info), "fixture must qualify for the fast path")

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	var want strings.Builder
	for _, b := range bodies {
		want.WriteString(chunk(b))
	}
	want.WriteString("data: [DONE]\n\n")
	assert.Equal(t, want.String(), recorder.Body.String(),
		"fast path must forward upstream bytes verbatim, including unknown fields and key order")
}

// TestOaiStreamHandlerFastPathAndSlowPathBillSameUsage checks the end-to-end
// billing result rather than just the observer: both paths must report the same
// usage for the same upstream stream, including the local-estimation case.
func TestOaiStreamHandlerFastPathAndSlowPathBillSameUsage(t *testing.T) {
	streams := map[string]string{
		"upstream reports usage": chunk(`{"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"content":"hello there"}}]}`) +
			chunk(`{"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":13,"completion_tokens":5,"total_tokens":18}}`) +
			"data: [DONE]\n\n",
		"no upstream usage falls back to local count": chunk(`{"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"content":"hello there"}}]}`) +
			chunk(`{"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`) +
			"data: [DONE]\n\n",
		"tool call surcharge": chunk(`{"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"t1","type":"function","function":{"name":"get_weather","arguments":"{}"}}]}}]}`) +
			chunk(`{"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`) +
			"data: [DONE]\n\n",
	}

	for name, upstream := range streams {
		t.Run(name, func(t *testing.T) {
			cFast, _, respFast, infoFast := newStreamTestContext(t, upstream)
			require.True(t, canCopyAndObserve(infoFast))
			fastUsage, fastErr := OaiStreamHandler(cFast, infoFast, respFast)
			require.Nil(t, fastErr)

			// ForceFormat only re-serializes the forwarded payload; it does not
			// change what is counted, so it is the cleanest way to force the slow
			// path for the same stream.
			cSlow, _, respSlow, infoSlow := newStreamTestContext(t, upstream)
			infoSlow.ChannelSetting.ForceFormat = true
			require.False(t, canCopyAndObserve(infoSlow))
			slowUsage, slowErr := OaiStreamHandler(cSlow, infoSlow, respSlow)
			require.Nil(t, slowErr)

			require.NotNil(t, fastUsage)
			require.NotNil(t, slowUsage)
			assert.Equal(t, slowUsage.PromptTokens, fastUsage.PromptTokens)
			assert.Equal(t, slowUsage.CompletionTokens, fastUsage.CompletionTokens)
			assert.Equal(t, slowUsage.TotalTokens, fastUsage.TotalTokens)
		})
	}
}

// TestOaiStreamHandlerFastPathDetectsTruncation confirms the fast path inherits
// #394's terminal semantics instead of silently accepting a dead stream.
func TestOaiStreamHandlerFastPathDetectsTruncation(t *testing.T) {
	upstream := chunk(`{"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"content":"half"}}]}`)

	c, recorder, resp, info := newStreamTestContext(t, upstream)
	require.True(t, canCopyAndObserve(info))

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr, "delivered partial output must be settled")
	require.NotNil(t, usage)
	assert.Equal(t, "upstream", info.StreamCutOverride)
	assert.NotContains(t, recorder.Body.String(), "data: [DONE]")
	assert.Contains(t, recorder.Body.String(), `data: {"error":`)
}
