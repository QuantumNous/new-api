package claude

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyModelThinkingMapsEffortSuffixForAnyClaudeModel(t *testing.T) {
	req := &dto.ClaudeRequest{Model: "claude-sonnet-4-5-xhigh"}
	got := ApplyModelThinking(req, req.Model, false, false)
	assert.Equal(t, "claude-sonnet-4-5", got)
	assert.Equal(t, "claude-sonnet-4-5", req.Model)
	require.NotNil(t, req.Thinking)
	assert.Equal(t, "adaptive", req.Thinking.Type)
	assert.JSONEq(t, `{"effort":"max"}`, string(req.OutputConfig))
}

func TestApplyModelThinkingThinkingSuffixRequiresAdapter(t *testing.T) {
	req := &dto.ClaudeRequest{Model: "claude-sonnet-4-5-thinking"}
	got := ApplyModelThinking(req, req.Model, false, false)
	assert.Equal(t, "claude-sonnet-4-5-thinking", got)
	assert.Nil(t, req.Thinking)

	got = ApplyModelThinking(req, req.Model, true, false)
	assert.Equal(t, "claude-sonnet-4-5", got)
	require.NotNil(t, req.Thinking)
	assert.Equal(t, "adaptive", req.Thinking.Type)
	assert.JSONEq(t, `{"effort":"high"}`, string(req.OutputConfig))
	assert.Equal(t, reasoning.LevelHigh, ThinkingLevelFromClaudeRequest(req))
}

func TestApplyModelThinkingPreservesThinkingSuffixWhenRequested(t *testing.T) {
	req := &dto.ClaudeRequest{Model: "claude-sonnet-4-5-thinking"}
	got := ApplyModelThinking(req, req.Model, true, true)
	assert.Equal(t, "claude-sonnet-4-5-thinking", got)
	assert.Equal(t, "claude-sonnet-4-5-thinking", req.Model)
	require.NotNil(t, req.Thinking)
	assert.Equal(t, "adaptive", req.Thinking.Type)
}

func TestApplyModelThinkingSummarizesOpus47(t *testing.T) {
	req := &dto.ClaudeRequest{Model: "claude-opus-4-7-high"}
	ApplyModelThinking(req, req.Model, true, false)
	require.NotNil(t, req.Thinking)
	assert.Equal(t, "summarized", req.Thinking.Display)
	assert.Nil(t, req.Temperature)
}
