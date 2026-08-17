package origin

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRewriteResponsesModelPreservesUnknownFieldsToolsAndExplicitZeroValues(t *testing.T) {
	original := []byte(`{
		"model":"origin-codex",
		"input":[{"role":"user","content":[{"type":"input_text","text":"hello"}]}],
		"tools":[{"type":"function","name":"lookup","parameters":{"type":"object","x-origin-unknown":true}}],
		"parallel_tool_calls":false,
		"temperature":0,
		"x-future-field":{"nested":[1,2,3]}
	}`)

	rewritten, err := RewriteResponsesModel(original, "beenex-codex-1")
	require.NoError(t, err)

	var document map[string]any
	require.NoError(t, common.Unmarshal(rewritten, &document))
	assert.Equal(t, "beenex-codex-1", document["model"])
	assert.Equal(t, false, document["parallel_tool_calls"])
	assert.Equal(t, float64(0), document["temperature"])
	assert.Contains(t, document, "x-future-field")
	assert.Contains(t, string(rewritten), "x-origin-unknown")
	assert.NotContains(t, string(rewritten), "origin-codex")
}

func TestRewriteResponsesModelRejectsInvalidOrMissingModel(t *testing.T) {
	_, err := RewriteResponsesModel([]byte(`{"input":"hello"}`), "beenex-codex-1")
	assert.Error(t, err)
	_, err = RewriteResponsesModel([]byte(`{"model":42}`), "beenex-codex-1")
	assert.Error(t, err)
	_, err = RewriteResponsesModel([]byte(`not-json`), "beenex-codex-1")
	assert.Error(t, err)
}

func TestRewriteResponsesModelRejectsDuplicateModelFields(t *testing.T) {
	_, err := RewriteResponsesModel([]byte(`{"model":"origin-codex","input":"hello","model":"smuggled-model"}`), "beenex-codex-1")

	require.Error(t, err)
}

func TestRewriteMessagesResponseModelRestoresPlatformModelForJSONAndSSEEvent(t *testing.T) {
	nonStream, err := RewriteMessagesResponseModel(
		[]byte(`{"id":"msg_1","type":"message","model":"beenex-claude-1","content":[]}`),
		"origin-agent",
	)
	require.NoError(t, err)
	assert.Contains(t, string(nonStream), `"model":"origin-agent"`)
	assert.NotContains(t, string(nonStream), "beenex-claude-1")

	messageStart, err := RewriteMessagesResponseModel(
		[]byte(`{"type":"message_start","message":{"id":"msg_1","model":"beenex-claude-1","content":[]}}`),
		"origin-agent",
	)
	require.NoError(t, err)
	assert.Contains(t, string(messageStart), `"model":"origin-agent"`)
	assert.NotContains(t, string(messageStart), "beenex-claude-1")
}
