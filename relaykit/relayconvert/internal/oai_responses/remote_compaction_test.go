package oairesponses

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestResponsesToChatRejectsCompactionTrigger(t *testing.T) {
	_, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-5",
		Input: []byte(`[{"type":"compaction_trigger"}]`),
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "compaction_trigger")
	require.Contains(t, err.Error(), "native Responses")
}

func TestResponsesToChatRejectsCompactionItem(t *testing.T) {
	_, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-5",
		Input: []byte(`[{"type":"compaction","encrypted_content":"ciphertext"}]`),
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "compaction item")
	require.Contains(t, err.Error(), "native Responses")
}
