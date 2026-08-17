package relay

import (
	"encoding/json"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestResponsesCompactUpstreamRequestUsesOfficialFieldsOnly(t *testing.T) {
	req := &dto.OpenAIResponsesCompactionRequest{
		Model:                "gpt-5",
		Input:                json.RawMessage(`[{"role":"user","content":"secret-input"}]`),
		Instructions:         json.RawMessage(`"secret-instructions"`),
		PreviousResponseID:   "resp_secret",
		Tools:                json.RawMessage(`[{"type":"function"}]`),
		ParallelToolCalls:    json.RawMessage(`true`),
		Reasoning:            &dto.Reasoning{Effort: "high"},
		ServiceTier:          "default",
		PromptCacheKey:       json.RawMessage(`"cache-secret"`),
		PromptCacheOptions:   json.RawMessage(`{"retention":"24h"}`),
		PromptCacheRetention: json.RawMessage(`"24h"`),
		Text:                 json.RawMessage(`{"format":{"type":"text"}}`),
	}

	jsonData, err := json.Marshal(responsesCompactUpstreamRequest(req))
	require.NoError(t, err)
	var payload map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(jsonData, &payload))
	require.ElementsMatch(t, responsesCompactAllowedFields, mapKeys(payload))
	require.NotContains(t, payload, "parallel_tool_calls")
	require.NotContains(t, payload, "tools")
	require.NotContains(t, payload, "reasoning")
	require.NotContains(t, payload, "text")
}

func TestFilterResponsesCompactRequestFieldsRemovesOverrideExtras(t *testing.T) {
	filtered, err := filterResponsesCompactRequestFields([]byte(`{
		"model":"gpt-5",
		"input":"hello",
		"parallel_tool_calls":true,
		"tools":[{"type":"function"}],
		"metadata":{"secret":"value"}
	}`))
	require.NoError(t, err)

	var payload map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(filtered, &payload))
	require.ElementsMatch(t, []string{"model", "input"}, mapKeys(payload))
}

func TestCompactRequestDebugSummaryContainsNoBodyValues(t *testing.T) {
	jsonData := []byte(`{
		"model":"gpt-5-openai-compact",
		"input":"secret-input",
		"instructions":"secret-instructions",
		"prompt_cache_key":"secret-cache-key"
	}`)
	info := &relaycommon.RelayInfo{
		LogicalBillingModel:  "gpt-5-openai-compact",
		UpstreamAttemptModel: "gpt-5-openai-compact",
		CompactAttemptStage:  relaycommon.CompactAttemptExact,
	}

	summary := compactRequestDebugSummary(info, jsonData)
	require.Contains(t, summary, "body_bytes=")
	require.Contains(t, summary, "fields=model,input,instructions,prompt_cache_key")
	require.Contains(t, summary, `logical_model="gpt-5-openai-compact"`)
	require.NotContains(t, summary, "secret-input")
	require.NotContains(t, summary, "secret-instructions")
	require.NotContains(t, summary, "secret-cache-key")
}

func mapKeys(values map[string]json.RawMessage) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	return keys
}
