package oaichat

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	// content delta only; no usage yet.
	terminalChunkText = `{"id":"c1","object":"chat.completion.chunk","model":"m","choices":[{"index":0,"delta":{"role":"assistant","content":"hi"}}]}`
	// finish_reason without usage: the converter defers the terminal events.
	terminalChunkFinishNoUsage = `{"id":"c1","object":"chat.completion.chunk","model":"m","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`
	// trailing chunk with non-empty choices, no finish_reason and no usage —
	// seen on DashScope-style gateways after the finish_reason chunk.
	terminalChunkTrailingSilent = `{"id":"c1","object":"chat.completion.chunk","model":"m","choices":[{"index":0,"delta":{}}]}`
	// healthy upstream: a final usage-only frame carries real usage.
	terminalChunkUsageOnlyReal = `{"id":"c1","object":"chat.completion.chunk","model":"m","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":34,"total_tokens":46}}`
)

func countEventType(types []string, typ string) int {
	n := 0
	for _, t := range types {
		if t == typ {
			n++
		}
	}
	return n
}

// convertChunks mirrors the relay loop: every chunk funnels through
// StreamResponseOpenAI2Claude with one shared info per stream.
func convertChunks(t *testing.T, chunks []string) (*convmeta.Values, []string) {
	t.Helper()
	info := &convmeta.Values{}
	types := make([]string, 0, len(chunks))
	for i, raw := range chunks {
		var resp dto.ChatCompletionsStreamResponse
		require.NoError(t, json.Unmarshal([]byte(raw), &resp), "chunk %d", i)
		info.IncrSendResponseCount()
		for _, r := range StreamResponseOpenAI2Claude(&resp, info) {
			types = append(types, r.Type)
		}
	}
	return info, types
}

func TestStreamTerminalEmittedWhenUsageFrameCarriesUsage(t *testing.T) {
	_, types := convertChunks(t, []string{terminalChunkText, terminalChunkFinishNoUsage, terminalChunkUsageOnlyReal})

	assert.Equal(t, 1, countEventType(types, "message_delta"))
	assert.Equal(t, 1, countEventType(types, "message_stop"))
}

func TestStreamStaysOpenWhenFinishChunkIsLastWithoutUsage(t *testing.T) {
	// finish_reason arrives without usage and the stream ends: the converter
	// defers the terminal events expecting a usage frame that never comes.
	info, types := convertChunks(t, []string{terminalChunkText, terminalChunkFinishNoUsage})

	assert.Zero(t, countEventType(types, "message_delta"))
	assert.Zero(t, countEventType(types, "message_stop"))
	assert.False(t, info.EnsureClaudeConvertInfo().Done, "stream must not mark itself done without terminal events")
}

func TestStreamStaysOpenWhenTrailingChunkHasChoicesWithoutFinishReason(t *testing.T) {
	// DashScope-style gateways send a trailing chunk with non-empty choices,
	// no finish_reason and no usable usage after the finish_reason chunk. Both
	// terminal paths are skipped and the state stays open (Done=false).
	info, types := convertChunks(t, []string{terminalChunkText, terminalChunkFinishNoUsage, terminalChunkTrailingSilent})

	assert.Zero(t, countEventType(types, "message_delta"))
	assert.Zero(t, countEventType(types, "message_stop"))
	assert.False(t, info.EnsureClaudeConvertInfo().Done, "stream must not mark itself done without terminal events")
}

func TestFinalizeClosesStreamAfterDeferredTerminal(t *testing.T) {
	info, _ := convertChunks(t, []string{terminalChunkText, terminalChunkFinishNoUsage, terminalChunkTrailingSilent})
	require.False(t, info.EnsureClaudeConvertInfo().Done)

	types := make([]string, 0)
	for _, r := range FinalizeStreamResponseOpenAI2Claude(info) {
		types = append(types, r.Type)
	}

	assert.Equal(t, 1, countEventType(types, "message_delta"))
	assert.Equal(t, 1, countEventType(types, "message_stop"))
}
