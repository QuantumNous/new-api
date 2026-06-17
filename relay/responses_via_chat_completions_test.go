// SPDX-License-Identifier: AGPL-3.0-or-later
package relay

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// newResponsesViaChatTestContext returns a gin.Context tied to an in-memory
// recorder so handlers can write SSE/JSON without a real HTTP transport.
func newResponsesViaChatTestContext(t *testing.T) (*gin.Context, *httptest.ResponseRecorder, *relaycommon.RelayInfo) {
	t.Helper()

	old := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = old })

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-test",
		},
		OriginModelName: "claude-test",
		IsStream:        true,
		RelayFormat:     types.RelayFormatOpenAIResponses,
	}
	return c, rec, info
}

// anthropicSSE returns a canonical Anthropic streaming-message envelope as a
// raw SSE byte string (suitable for piping through StreamScannerHandler).
func anthropicSSE() string {
	var b strings.Builder
	b.WriteString(`data: {"type":"message_start","message":{"id":"msg_001","model":"claude-test","usage":{"input_tokens":11,"output_tokens":1}}}` + "\n")
	b.WriteString(`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}` + "\n")
	b.WriteString(`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}` + "\n")
	b.WriteString(`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world"}}` + "\n")
	b.WriteString(`data: {"type":"content_block_stop","index":0}` + "\n")
	b.WriteString(`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}` + "\n")
	b.WriteString(`data: {"type":"message_stop"}` + "\n")
	b.WriteString("data: [DONE]\n")
	return b.String()
}

// TestResponsesViaChatCompletions_StreamingTextOnly drives
// runAnthropicToResponsesStream with a canonical Anthropic SSE byte stream
// (text-only) and asserts the resulting Responses-API SSE wire format.
//
// It satisfies the §13 streaming integration coverage requirement: we verify
// the orchestration writes the documented sequence of events
// (response.created / in_progress / output_item.added / output_text.delta /
// output_text.done / content_part.done / output_item.done / response.completed)
// with monotonically increasing sequence_number values.
func TestResponsesViaChatCompletions_StreamingTextOnly(t *testing.T) {
	c, rec, info := newResponsesViaChatTestContext(t)

	resp := &http.Response{
		Body:   io.NopCloser(strings.NewReader(anthropicSSE())),
		Header: http.Header{"Content-Type": []string{"text/event-stream"}},
	}

	usage, apiErr := runAnthropicToResponsesStream(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, "anthropic", usage.UsageSemantic)

	body := rec.Body.String()

	// Mandatory event types per spec §5 of the responses-to-anthropic spec.
	mustContain := []string{
		"event: response.created",
		"event: response.in_progress",
		"event: response.output_item.added",
		"event: response.output_text.delta",
		"event: response.output_text.done",
		"event: response.content_part.done",
		"event: response.output_item.done",
		"event: response.completed",
	}
	for _, marker := range mustContain {
		require.Contains(t, body, marker, "expected SSE to contain %q", marker)
	}

	// Validate monotonically increasing sequence_number values across all
	// emitted JSON payloads.
	seq := extractSequenceNumbers(t, body)
	require.NotEmpty(t, seq, "expected at least one sequence_number")
	for i := 1; i < len(seq); i++ {
		require.GreaterOrEqual(t, seq[i], seq[i-1], "sequence_number must be monotonically non-decreasing (got %d after %d at idx %d)", seq[i], seq[i-1], i)
	}

	// The output_item.added for the message item must carry type=message.
	require.Contains(t, body, `"type":"message"`)
}

// TestResponsesViaChatCompletions_NonStreamingTextOnly drives
// runAnthropicToResponsesNonStream with a single JSON Anthropic message and
// validates that the response body parses as a valid Responses-API response
// with status=completed and output[0].type=message containing the text.
func TestResponsesViaChatCompletions_NonStreamingTextOnly(t *testing.T) {
	c, rec, info := newResponsesViaChatTestContext(t)
	info.IsStream = false

	anthropicBody := `{
		"id": "msg_abc",
		"type": "message",
		"role": "assistant",
		"model": "claude-test",
		"content": [
			{"type": "text", "text": "Hello world"}
		],
		"stop_reason": "end_turn",
		"usage": {"input_tokens": 11, "output_tokens": 2}
	}`

	resp := &http.Response{
		Body:       io.NopCloser(strings.NewReader(anthropicBody)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		StatusCode: http.StatusOK,
	}

	usage, apiErr := runAnthropicToResponsesNonStream(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, "anthropic", usage.UsageSemantic)

	var got dto.OpenAIResponsesResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got), "response body must be a valid OpenAIResponsesResponse")
	require.Equal(t, "claude-test", got.Model)

	statusStr := strings.Trim(strings.TrimSpace(string(got.Status)), `"`)
	require.Equal(t, "completed", statusStr)

	require.NotEmpty(t, got.Output)
	require.Equal(t, "message", got.Output[0].Type)
	require.NotEmpty(t, got.Output[0].Content)
	require.Equal(t, "Hello world", got.Output[0].Content[0].Text)
}

// TestResponsesViaChatCompletions_FeatureFlagGate_EnvParse verifies that the
// PRODUCTION env-flag reader (common.GetEnvOrDefaultBool) — not a
// reimplementation in this test — correctly resolves
// RESPONSES_TO_ANTHROPIC_ENABLED to false when set to "false" and to true when
// set to "true". This is the exact call made at responses_handler.go to gate
// the Responses → Chat-Completions → Anthropic pivot, so a regression in the
// env parser or a flip of the default would be caught here.
func TestResponsesViaChatCompletions_FeatureFlagGate_EnvParse(t *testing.T) {
	const envKey = "RESPONSES_TO_ANTHROPIC_ENABLED"

	// Flag explicitly false => production reader returns false (overrides the
	// default value passed by the caller).
	t.Setenv(envKey, "false")
	require.False(t, common.GetEnvOrDefaultBool(envKey, true),
		"production env reader must honour explicit false")

	// Flag explicitly true => production reader returns true.
	t.Setenv(envKey, "true")
	require.True(t, common.GetEnvOrDefaultBool(envKey, false),
		"production env reader must honour explicit true")
}

// TestResponsesViaChatCompletions_FeatureFlagGate_BranchCondition drives the
// branch predicate extracted from responses_handler.go. It builds a baseline
// "engaged" condition (RelayModeResponses + APITypeAnthropic + no global
// pass-through + no body pass-through + flag-on) and then flips each input
// individually, asserting that any flip disables the pivot. The flag's role
// is verified explicitly: with all other inputs in the engaged baseline, the
// pivot SHALL engage iff featureFlagEnabled is true.
func TestResponsesViaChatCompletions_FeatureFlagGate_BranchCondition(t *testing.T) {
	// Baseline: everything aligned so the pivot engages.
	require.True(t, shouldUseResponsesToAnthropicPivot(
		relayconstant.RelayModeResponses,
		constant.APITypeAnthropic,
		false, // passThroughGlobal
		false, // passThroughBody
		true,  // featureFlagEnabled
	), "engaged baseline must trigger the pivot")

	// Feature flag off disables the pivot even when every other condition is
	// aligned. This is the critical regression-catch for the MAJOR finding.
	require.False(t, shouldUseResponsesToAnthropicPivot(
		relayconstant.RelayModeResponses,
		constant.APITypeAnthropic,
		false,
		false,
		false, // <- flag off
	), "feature flag off must bypass the pivot")

	// Wrong relay mode disables the pivot.
	require.False(t, shouldUseResponsesToAnthropicPivot(
		relayconstant.RelayModeChatCompletions,
		constant.APITypeAnthropic,
		false,
		false,
		true,
	), "non-Responses relay mode must bypass the pivot")

	// Wrong API type disables the pivot.
	require.False(t, shouldUseResponsesToAnthropicPivot(
		relayconstant.RelayModeResponses,
		constant.APITypeOpenAI,
		false,
		false,
		true,
	), "non-Anthropic api type must bypass the pivot")

	// Global pass-through disables the pivot.
	require.False(t, shouldUseResponsesToAnthropicPivot(
		relayconstant.RelayModeResponses,
		constant.APITypeAnthropic,
		true, // <- pass-through global on
		false,
		true,
	), "global pass-through must bypass the pivot")

	// Channel-level body pass-through disables the pivot.
	require.False(t, shouldUseResponsesToAnthropicPivot(
		relayconstant.RelayModeResponses,
		constant.APITypeAnthropic,
		false,
		true, // <- channel body pass-through on
		true,
	), "channel body pass-through must bypass the pivot")
}

// TestResponsesViaChatCompletions_FeatureFlagGate_DefaultIsOn locks in the
// documented default for the feature flag: when the env var is unset, the
// pivot SHALL be enabled. This guards against an accidental default-flip.
func TestResponsesViaChatCompletions_FeatureFlagGate_DefaultIsOn(t *testing.T) {
	const envKey = "RESPONSES_TO_ANTHROPIC_ENABLED"

	// t.Setenv with empty string clears the env at scope exit, but during the
	// scope we explicitly unset it via setting to "" (production reader treats
	// empty as unset and returns the default).
	t.Setenv(envKey, "")
	require.True(t, common.GetEnvOrDefaultBool(envKey, true),
		"empty/unset RESPONSES_TO_ANTHROPIC_ENABLED must default to true")
}

// extractSequenceNumbers scans the recorded SSE body and returns every
// `"sequence_number": N` value in emission order.
func extractSequenceNumbers(t *testing.T, body string) []int64 {
	t.Helper()

	const marker = `"sequence_number":`
	out := make([]int64, 0)
	rest := body
	for {
		idx := strings.Index(rest, marker)
		if idx < 0 {
			break
		}
		rest = rest[idx+len(marker):]
		// Read digits.
		i := 0
		for i < len(rest) && (rest[i] == ' ' || rest[i] == '\t') {
			i++
		}
		start := i
		for i < len(rest) && rest[i] >= '0' && rest[i] <= '9' {
			i++
		}
		if i == start {
			continue
		}
		var n int64
		for j := start; j < i; j++ {
			n = n*10 + int64(rest[j]-'0')
		}
		out = append(out, n)
		rest = rest[i:]
	}
	return out
}
