package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOpenAIResponsesRequestRequiresNativeResponses(t *testing.T) {
	var input json.RawMessage = []byte(`[{"type":"input_text","text":"hello"},{"type":"compaction_trigger"}]`)
	req := OpenAIResponsesRequest{Model: "gpt-5", Input: input}
	require.True(t, req.HasCompactionTrigger())
	require.True(t, req.RequiresNativeResponses())

	req = OpenAIResponsesRequest{
		Model:             "gpt-5",
		Input:             []byte(`"hello"`),
		ContextManagement: []byte(`{"compact_threshold":1000}`),
	}
	require.False(t, req.HasCompactionTrigger())
	require.True(t, req.RequiresNativeResponses())

	req.ContextManagement = []byte(`null`)
	require.False(t, req.RequiresNativeResponses())

	req.Input = []byte(`[{"type":"compaction","encrypted_content":"ciphertext"}]`)
	require.True(t, req.HasCompactionItem())
	require.True(t, req.RequiresNativeResponses())
}

func TestOpenAIResponsesRequestCompactionTriggerIsCaseInsensitive(t *testing.T) {
	req := OpenAIResponsesRequest{Input: []byte(`[{"type":" COMPACTION_TRIGGER "}]`)}
	require.True(t, req.HasCompactionTrigger())
}
