package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// TestMessageReasoningContentPreservesEmptyString verifies that an explicitly
// set empty reasoning_content string survives the JSON round-trip.
//
// This is critical for the request-forwarding path (non-passThrough mode):
// the gateway unmarshals the client request into GeneralOpenAIRequest, then
// re-marshals it before sending upstream. If Message.ReasoningContent were
// `string` + `omitempty` (the old type), the empty string would be silently
// dropped, causing the upstream to never receive the field.
//
// With the fix (`*string` + `omitempty`), nil = absent, &"" = explicit empty.
func TestMessageReasoningContentPreservesEmptyString(t *testing.T) {
	raw := []byte(`{
		"role": "assistant",
		"content": "Hello",
		"reasoning_content": "",
		"reasoning": ""
	}`)

	var msg Message
	err := common.Unmarshal(raw, &msg)
	require.NoError(t, err)

	// Pointers must be non-nil: the field was explicitly set to ""
	require.NotNil(t, msg.ReasoningContent, "reasoning_content should be non-nil when explicitly set to empty string")
	require.NotNil(t, msg.Reasoning, "reasoning should be non-nil when explicitly set to empty string")
	require.Equal(t, "", *msg.ReasoningContent)
	require.Equal(t, "", *msg.Reasoning)

	// Re-marshal — the fields must still be present in the output JSON
	encoded, err := common.Marshal(msg)
	require.NoError(t, err)

	require.True(t, gjson.GetBytes(encoded, "reasoning_content").Exists(),
		"reasoning_content should exist in re-marshaled JSON when explicitly set to empty string")
	require.True(t, gjson.GetBytes(encoded, "reasoning").Exists(),
		"reasoning should exist in re-marshaled JSON when explicitly set to empty string")
	require.Equal(t, "", gjson.GetBytes(encoded, "reasoning_content").String())
	require.Equal(t, "", gjson.GetBytes(encoded, "reasoning").String())
}

// TestMessageReasoningContentOmitsAbsentField verifies that when
// reasoning_content / reasoning are absent from the input JSON, they remain
// absent after a round-trip (nil pointer → omitted by omitempty).
func TestMessageReasoningContentOmitsAbsentField(t *testing.T) {
	raw := []byte(`{
		"role": "assistant",
		"content": "Hello"
	}`)

	var msg Message
	err := common.Unmarshal(raw, &msg)
	require.NoError(t, err)

	// Pointers must be nil: the fields were not present in the input
	require.Nil(t, msg.ReasoningContent)
	require.Nil(t, msg.Reasoning)

	// Re-marshal — the fields must NOT appear in the output JSON
	encoded, err := common.Marshal(msg)
	require.NoError(t, err)

	require.False(t, gjson.GetBytes(encoded, "reasoning_content").Exists(),
		"reasoning_content should not exist in re-marshaled JSON when absent from input")
	require.False(t, gjson.GetBytes(encoded, "reasoning").Exists(),
		"reasoning should not exist in re-marshaled JSON when absent from input")
}

// TestMessageGetReasoningContent verifies the GetReasoningContent helper
// method that is used in token-counting code paths.
func TestMessageGetReasoningContent(t *testing.T) {
	t.Run("both nil returns empty", func(t *testing.T) {
		msg := Message{Role: "assistant"}
		require.Equal(t, "", msg.GetReasoningContent())
	})

	t.Run("ReasoningContent takes priority", func(t *testing.T) {
		rc := "thinking..."
		r := "should be ignored"
		msg := Message{ReasoningContent: &rc, Reasoning: &r}
		require.Equal(t, "thinking...", msg.GetReasoningContent())
	})

	t.Run("falls back to Reasoning when ReasoningContent is nil", func(t *testing.T) {
		r := "fallback reasoning"
		msg := Message{Reasoning: &r}
		require.Equal(t, "fallback reasoning", msg.GetReasoningContent())
	})

	t.Run("empty string values returned correctly", func(t *testing.T) {
		empty := ""
		msg := Message{ReasoningContent: &empty}
		require.Equal(t, "", msg.GetReasoningContent())
	})
}
