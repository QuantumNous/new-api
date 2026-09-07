package attemptlog

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
)

// TestComputePrefixHashes_OpenAI verifies gjson extraction paths for OpenAI
// chat format: system lives inside messages (role=system), tools is top-level.
func TestComputePrefixHashes_OpenAI(t *testing.T) {
	body := []byte(`{"model":"glm-5.2","messages":[{"role":"system","content":"You are helpful."},{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi there"},{"role":"user","content":"Translate this"}],"tools":[{"type":"function","function":{"name":"get_weather","description":"Get weather"}}]}`)

	h := ComputePrefixHashes(body, types.RelayFormatOpenAI)
	assert.NotEmpty(t, h.System, "system hash should be extracted from messages.#(role=system).content")
	assert.NotEmpty(t, h.Tools, "tools hash should be extracted")
	assert.NotEmpty(t, h.Prefix, "prefix chain should be non-empty")
}

func TestComputePrefixHashes_Claude(t *testing.T) {
	body := []byte(`{"model":"claude-sonnet-5","system":"You are helpful.","messages":[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi"},{"role":"user","content":"Translate"}],"tools":[{"name":"get_weather","description":"Get weather","input_schema":{}}]}`)

	h := ComputePrefixHashes(body, types.RelayFormatClaude)
	assert.NotEmpty(t, h.System, "system hash from top-level system field")
	assert.NotEmpty(t, h.Tools)
	assert.NotEmpty(t, h.Prefix)
}

func TestComputePrefixHashes_Gemini(t *testing.T) {
	body := []byte(`{"contents":[{"role":"user","parts":[{"text":"Hello"}]},{"role":"model","parts":[{"text":"Hi"}]},{"role":"user","parts":[{"text":"Translate"}]}],"systemInstruction":{"parts":[{"text":"You are helpful."}]},"tools":{}}`)

	h := ComputePrefixHashes(body, types.RelayFormatGemini)
	assert.NotEmpty(t, h.System, "system hash from systemInstruction")
	assert.NotEmpty(t, h.Prefix)
}

func TestComputePrefixHashes_Responses(t *testing.T) {
	body := []byte(`{"model":"glm-5.2","instructions":"You are helpful.","input":[{"role":"user","content":[{"type":"input_text","text":"Hello"}]},{"role":"assistant","content":[{"type":"output_text","text":"Hi"}]},{"role":"user","content":[{"type":"input_text","text":"Translate"}]}],"tools":[]}`)

	h := ComputePrefixHashes(body, types.RelayFormatOpenAIResponses)
	assert.NotEmpty(t, h.System, "system hash from instructions")
	assert.NotEmpty(t, h.Prefix)
}

func TestComputePrefixHashes_NoSystem(t *testing.T) {
	body := []byte(`{"model":"glm-5.2","messages":[{"role":"user","content":"Hello"}],"tools":[]}`)
	h := ComputePrefixHashes(body, types.RelayFormatOpenAI)
	assert.Empty(t, h.System, "no system message → empty system hash")
	assert.Empty(t, h.Tools, "empty tools array → empty tools hash")
	assert.NotEmpty(t, h.Prefix, "prefix chain should still cover messages")
}

func TestComputePrefixHashes_DeveloperRole(t *testing.T) {
	body := []byte(`{"model":"o1","messages":[{"role":"developer","content":"You are helpful."},{"role":"user","content":"Hello"}]}`)
	h := ComputePrefixHashes(body, types.RelayFormatOpenAI)
	assert.NotEmpty(t, h.System, "developer role should be picked up as system")
}

// TestComputePrefixHashes_ByteExact guards the hard requirement: different
// whitespace in the system prompt must produce a different hash.
func TestComputePrefixHashes_ByteExact(t *testing.T) {
	a := []byte(`{"messages":[{"role":"system","content":"hello world"}]}`)
	b := []byte(`{"messages":[{"role":"system","content":"hello  world"}]}`) // double space
	ha := ComputePrefixHashes(a, types.RelayFormatOpenAI)
	hb := ComputePrefixHashes(b, types.RelayFormatOpenAI)
	assert.NotEqual(t, ha.System, hb.System, "different whitespace must change system hash")
	assert.NotEqual(t, ha.Prefix, hb.Prefix, "different whitespace must change prefix chain")
}

// TestComputePrefixHashes_Stable confirms identical bodies produce identical
// hashes across calls.
func TestComputePrefixHashes_Stable(t *testing.T) {
	body := []byte(`{"messages":[{"role":"system","content":"hello"}],"tools":[{"type":"function","function":{"name":"f"}}]}`)
	h1 := ComputePrefixHashes(body, types.RelayFormatOpenAI)
	h2 := ComputePrefixHashes(body, types.RelayFormatOpenAI)
	assert.Equal(t, h1, h2)
}

// TestLastUserText_OpenAI verifies the last user message text is extracted,
// not the first or an assistant message.
func TestLastUserText_OpenAI(t *testing.T) {
	body := []byte(`{"messages":[{"role":"system","content":"sys"},{"role":"user","content":"first user"},{"role":"assistant","content":"reply"},{"role":"user","content":"translate this"}]}`)
	assert.Equal(t, "translate this", LastUserText(body, types.RelayFormatOpenAI))
}

func TestLastUserText_OpenAI_ArrayContent(t *testing.T) {
	body := []byte(`{"messages":[{"role":"user","content":[{"type":"text","text":"hello "},{"type":"text","text":"world"}]}]}`)
	assert.Equal(t, "hello world", LastUserText(body, types.RelayFormatOpenAI))
}

func TestLastUserText_Claude(t *testing.T) {
	body := []byte(`{"system":"sys","messages":[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi"},{"role":"user","content":"Translate this"}]}`)
	assert.Equal(t, "Translate this", LastUserText(body, types.RelayFormatClaude))
}

func TestLastUserText_Gemini(t *testing.T) {
	body := []byte(`{"contents":[{"role":"user","parts":[{"text":"Hello"}]},{"role":"model","parts":[{"text":"Hi"}]},{"role":"user","parts":[{"text":"Translate this"}]}]}`)
	assert.Equal(t, "Translate this", LastUserText(body, types.RelayFormatGemini))
}

func TestLastUserText_Responses_String(t *testing.T) {
	body := []byte(`{"input":"simple string input"}`)
	assert.Equal(t, "simple string input", LastUserText(body, types.RelayFormatOpenAIResponses))
}

func TestLastUserText_Responses_Array(t *testing.T) {
	body := []byte(`{"input":[{"role":"user","content":[{"type":"input_text","text":"Hello"}]},{"role":"assistant","content":[{"type":"output_text","text":"Hi"}]},{"role":"user","content":[{"type":"input_text","text":"Translate this"}]}]}`)
	assert.Equal(t, "Translate this", LastUserText(body, types.RelayFormatOpenAIResponses))
}

func TestLastUserText_NoUser(t *testing.T) {
	body := []byte(`{"messages":[{"role":"system","content":"sys"},{"role":"assistant","content":"reply"}]}`)
	assert.Equal(t, "", LastUserText(body, types.RelayFormatOpenAI))
}

func TestLastUserText_EmptyBody(t *testing.T) {
	assert.Equal(t, "", LastUserText(nil, types.RelayFormatOpenAI))
	assert.Equal(t, "", LastUserText([]byte{}, types.RelayFormatOpenAI))
}
