package claude

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
	"github.com/tidwall/gjson"
)

func withNormalize(t *testing.T, enabled bool) {
	t.Helper()
	settings := model_setting.GetClaudeSettings()
	orig := settings.ResponseNormalizeEnabled
	settings.ResponseNormalizeEnabled = enabled
	t.Cleanup(func() { settings.ResponseNormalizeEnabled = orig })
}

func TestPatchClaudeMessageStartIdentity_NormalizesModelAndID(t *testing.T) {
	withNormalize(t, true)

	upstreamID := "gen-1781245943-9Q4Nyw8yXglc3sttYIim"
	data := `{"type":"message_start","message":{"id":"` + upstreamID +
		`","model":"anthropic/claude-4.6-opus-20260205","role":"assistant","usage":{"input_tokens":0,"output_tokens":1}}}`
	info := &relaycommon.RelayInfo{OriginModelName: "claude-opus-4-6"}

	out := patchClaudeMessageStartIdentity(data, info)

	assert.Equal(t, "claude-opus-4-6", gjson.Get(out, "message.model").String())
	gotID := gjson.Get(out, "message.id").String()
	assert.True(t, strings.HasPrefix(gotID, "msg_01"), "id should be normalized to msg_ form, got %q", gotID)
	assert.Equal(t, common.EncodeAnthropicMessageID(upstreamID), gotID, "id must be deterministic re-encoding")
	// unrelated fields preserved
	assert.EqualValues(t, 1, gjson.Get(out, "message.usage.output_tokens").Int())
	assert.Equal(t, "assistant", gjson.Get(out, "message.role").String())
	// input_tokens NOT calibrated on the passthrough path
	assert.EqualValues(t, 0, gjson.Get(out, "message.usage.input_tokens").Int())
}

func TestPatchClaudeMessageStartIdentity_NormalizeDisabledPassthrough(t *testing.T) {
	withNormalize(t, false)

	data := `{"type":"message_start","message":{"id":"gen-abc","model":"anthropic/claude-4.6-opus-20260205"}}`
	info := &relaycommon.RelayInfo{OriginModelName: "claude-opus-4-6"}

	out := patchClaudeMessageStartIdentity(data, info)
	assert.Equal(t, data, out, "disabled flag must leave bytes unchanged")
}

func TestPatchClaudeMessageStartIdentity_NilAndEmpty(t *testing.T) {
	withNormalize(t, true)
	assert.Equal(t, "", patchClaudeMessageStartIdentity("", &relaycommon.RelayInfo{}))
	data := `{"type":"message_start","message":{"id":"gen-x","model":"slug"}}`
	assert.Equal(t, data, patchClaudeMessageStartIdentity(data, nil))
}

func TestPatchClaudeTopLevelIdentity_NormalizesModelAndID(t *testing.T) {
	withNormalize(t, true)

	upstreamID := "gen-1781245943-abc"
	data := []byte(`{"id":"` + upstreamID + `","type":"message","model":"anthropic/claude-4.6-opus-20260205","role":"assistant","content":[]}`)
	info := &relaycommon.RelayInfo{OriginModelName: "claude-opus-4-6"}

	out := string(patchClaudeTopLevelIdentity(data, info))

	assert.Equal(t, "claude-opus-4-6", gjson.Get(out, "model").String())
	gotID := gjson.Get(out, "id").String()
	assert.True(t, strings.HasPrefix(gotID, "msg_01"))
	assert.Equal(t, common.EncodeAnthropicMessageID(upstreamID), gotID)
	assert.Equal(t, "message", gjson.Get(out, "type").String())
}

func TestPatchClaudeTopLevelIdentity_NormalizeDisabled(t *testing.T) {
	withNormalize(t, false)
	data := []byte(`{"id":"gen-x","model":"slug"}`)
	out := patchClaudeTopLevelIdentity(data, &relaycommon.RelayInfo{OriginModelName: "claude-opus-4-6"})
	assert.Equal(t, string(data), string(out))
}
