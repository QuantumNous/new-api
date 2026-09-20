package dto

import (
	"testing"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatCompletionsStreamResponseChoicesNullOrEmptyObject(t *testing.T) {
	cases := []struct {
		name string
		raw  string
	}{
		{
			name: "null",
			raw:  `{"id":"cmpl-1","object":"chat.completion.chunk","created":1710000000,"model":"deepseek-v4-flash","choices":null,"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4}}`,
		},
		{
			name: "empty object",
			raw:  `{"id":"cmpl-1","object":"chat.completion.chunk","created":1710000000,"model":"deepseek-v4-flash","choices":{},"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4}}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var resp ChatCompletionsStreamResponse
			err := kitutil.Unmarshal([]byte(tc.raw), &resp)
			require.NoError(t, err)
			assert.Empty(t, resp.Choices)
			assert.False(t, resp.IsFinished())
			require.NotNil(t, resp.Usage)
			assert.Equal(t, 3, resp.Usage.PromptTokens)
			assert.Equal(t, 1, resp.Usage.CompletionTokens)
		})
	}
}

func TestChatCompletionsStreamResponseChoicesArrayStillUnmarshals(t *testing.T) {
	raw := `{"id":"cmpl-1","object":"chat.completion.chunk","created":1710000000,"model":"deepseek-v4-flash","choices":[{"index":0,"delta":{"content":"hi"},"finish_reason":null}]}`
	var resp ChatCompletionsStreamResponse
	require.NoError(t, kitutil.Unmarshal([]byte(raw), &resp))
	require.Len(t, resp.Choices, 1)
	assert.Equal(t, "hi", resp.Choices[0].Delta.GetContentString())
	assert.False(t, resp.IsFinished())
}
