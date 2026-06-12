package claude

import (
	"encoding/json"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
	"github.com/tidwall/gjson"
)

func withRecalcChannels(t *testing.T, ids ...int) {
	t.Helper()
	settings := model_setting.GetClaudeSettings()
	orig := settings.RecalcInputTokensChannels
	settings.RecalcInputTokensChannels = append([]int(nil), ids...)
	t.Cleanup(func() { settings.RecalcInputTokensChannels = orig })
}

func TestNormalizeClaudeUsageFields_MessageStartTranslatesAliases(t *testing.T) {
	withNormalize(t, true)

	data := `{"type":"message_start","message":{"id":"x","model":"m","usage":{` +
		`"input_tokens":1026,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,` +
		`"claude_cache_creation_5_m_tokens":12,"claude_cache_creation_1_h_tokens":7,"output_tokens":1}}}`

	out := normalizeClaudeUsageFields(data, "message.usage", true)

	// flat aliases removed
	assert.False(t, gjson.Get(out, "message.usage.claude_cache_creation_5_m_tokens").Exists())
	assert.False(t, gjson.Get(out, "message.usage.claude_cache_creation_1_h_tokens").Exists())
	// nested cache_creation present with translated values
	assert.EqualValues(t, 12, gjson.Get(out, "message.usage.cache_creation.ephemeral_5m_input_tokens").Int())
	assert.EqualValues(t, 7, gjson.Get(out, "message.usage.cache_creation.ephemeral_1h_input_tokens").Int())
	// untouched fields preserved
	assert.EqualValues(t, 1026, gjson.Get(out, "message.usage.input_tokens").Int())
	assert.EqualValues(t, 1, gjson.Get(out, "message.usage.output_tokens").Int())
	// still valid JSON
	var sink map[string]any
	assert.NoError(t, json.Unmarshal([]byte(out), &sink))
}

func TestNormalizeClaudeUsageFields_MessageStartZeroStillAddsCacheCreation(t *testing.T) {
	withNormalize(t, true)

	data := `{"type":"message_start","message":{"usage":{"input_tokens":5,` +
		`"claude_cache_creation_5_m_tokens":0,"claude_cache_creation_1_h_tokens":0,"output_tokens":1}}}`

	out := normalizeClaudeUsageFields(data, "message.usage", true)

	assert.False(t, gjson.Get(out, "message.usage.claude_cache_creation_5_m_tokens").Exists())
	// official message_start carries cache_creation{} even at 0
	assert.True(t, gjson.Get(out, "message.usage.cache_creation").Exists())
	assert.EqualValues(t, 0, gjson.Get(out, "message.usage.cache_creation.ephemeral_5m_input_tokens").Int())
	assert.EqualValues(t, 0, gjson.Get(out, "message.usage.cache_creation.ephemeral_1h_input_tokens").Int())
}

func TestNormalizeClaudeUsageFields_MessageDeltaStripsOnly(t *testing.T) {
	withNormalize(t, true)

	data := `{"type":"message_delta","usage":{"input_tokens":862,"output_tokens":42,` +
		`"claude_cache_creation_5_m_tokens":12,"claude_cache_creation_1_h_tokens":7}}`

	out := normalizeClaudeUsageFields(data, "usage", false)

	// flat aliases removed
	assert.False(t, gjson.Get(out, "usage.claude_cache_creation_5_m_tokens").Exists())
	assert.False(t, gjson.Get(out, "usage.claude_cache_creation_1_h_tokens").Exists())
	// message_delta must NOT gain a nested cache_creation
	assert.False(t, gjson.Get(out, "usage.cache_creation").Exists())
	// real upstream input_tokens left untouched
	assert.EqualValues(t, 862, gjson.Get(out, "usage.input_tokens").Int())
	assert.EqualValues(t, 42, gjson.Get(out, "usage.output_tokens").Int())
}

func TestNormalizeClaudeUsageFields_DisabledLeavesBytes(t *testing.T) {
	withNormalize(t, false)
	data := `{"type":"message_start","message":{"usage":{"claude_cache_creation_5_m_tokens":1}}}`
	assert.Equal(t, data, normalizeClaudeUsageFields(data, "message.usage", true))
}

func TestMaybeRecalcClaudeMessageStartInputTokens_AllowlistHit(t *testing.T) {
	withNormalize(t, true)
	withRecalcChannels(t, 7)

	data := `{"type":"message_start","message":{"usage":{"input_tokens":1026,"output_tokens":1}}}`
	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-4-6",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 7},
	}
	info.SetEstimatePromptTokens(1026)

	out := maybeRecalcClaudeMessageStartInputTokens(data, "message.usage", info)

	want := service.CalibrateAnthropicInputTokens(1026, "claude-opus-4-6")
	assert.EqualValues(t, want, gjson.Get(out, "message.usage.input_tokens").Int())
	// sanity: opus-4-6 calibrates down (×0.84)
	assert.Less(t, want, 1026)
}

func TestMaybeRecalcClaudeMessageStartInputTokens_AllowlistMiss(t *testing.T) {
	withNormalize(t, true)
	withRecalcChannels(t, 99) // not the channel under test

	data := `{"type":"message_start","message":{"usage":{"input_tokens":1026}}}`
	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-4-6",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 7},
	}
	info.SetEstimatePromptTokens(1026)

	out := maybeRecalcClaudeMessageStartInputTokens(data, "message.usage", info)
	assert.EqualValues(t, 1026, gjson.Get(out, "message.usage.input_tokens").Int(), "miss must leave upstream value")
}

func TestMaybeRecalcClaudeMessageStartInputTokens_DisabledFlag(t *testing.T) {
	withNormalize(t, false)
	withRecalcChannels(t, 7)

	data := `{"type":"message_start","message":{"usage":{"input_tokens":1026}}}`
	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-4-6",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 7},
	}
	info.SetEstimatePromptTokens(1026)

	out := maybeRecalcClaudeMessageStartInputTokens(data, "message.usage", info)
	assert.EqualValues(t, 1026, gjson.Get(out, "message.usage.input_tokens").Int())
}
