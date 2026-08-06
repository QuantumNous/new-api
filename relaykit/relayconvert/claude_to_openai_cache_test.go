package relayconvert

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// claudeRequestWithCacheControl builds an Anthropic-format request whose user
// message carries a cache_control breakpoint, which is what Claude Code and
// similar clients send.
func claudeRequestWithCacheControl() dto.ClaudeRequest {
	return dto.ClaudeRequest{
		Model: "gpt-4o",
		Messages: []dto.ClaudeMessage{
			{
				Role: "user",
				Content: []map[string]any{
					{
						"type":          "text",
						"text":          "hello",
						"cache_control": map[string]string{"type": "ephemeral"},
					},
				},
			},
		},
	}
}

// cache_control is an Anthropic/OpenRouter-only field. Forwarding it to a plain
// OpenAI-compatible upstream destroys prompt caching: clients move the
// breakpoint as the conversation grows, so the marker lands on a different
// message each request and truncates the upstream longest-common-prefix match
// at exactly the point it moved.
func TestClaudeMessagesToOpenAIChat_StripsCacheControlForNonOpenRouterUpstream(t *testing.T) {
	meta := &convmeta.Values{
		UpstreamModelName: "gpt-4o",
		Options:           &convmeta.Options{OpenRouterDialect: false},
	}

	got, err := ClaudeMessagesRequestToOpenAIChat(claudeRequestWithCacheControl(), meta)
	require.NoError(t, err)
	require.Len(t, got.Messages, 1)

	contents := got.Messages[0].ParseContent()
	require.Len(t, contents, 1)
	assert.Empty(t, contents[0].CacheControl,
		"cache_control must not reach a non-OpenRouter upstream")
	assert.Equal(t, "hello", contents[0].Text,
		"stripping the marker must not drop the message text")
}

// OpenRouter proxying Anthropic models does understand cache_control, and
// forwarding it there is what lets those requests cache at all.
func TestClaudeMessagesToOpenAIChat_KeepsCacheControlForOpenRouterClaude(t *testing.T) {
	meta := &convmeta.Values{
		UpstreamModelName:   "anthropic/claude-sonnet-4",
		ChannelMetaAttached: true,
		Options:             &convmeta.Options{OpenRouterDialect: true},
	}

	got, err := ClaudeMessagesRequestToOpenAIChat(claudeRequestWithCacheControl(), meta)
	require.NoError(t, err)
	require.Len(t, got.Messages, 1)

	contents := got.Messages[0].ParseContent()
	require.Len(t, contents, 1)
	assert.NotEmpty(t, contents[0].CacheControl,
		"OpenRouter Anthropic upstreams rely on cache_control being forwarded")
}

// prompt_cache_key gives OpenAI a stable routing key for a conversation. It must
// come from the client's own identifier, and must stay unset when the client
// sends nothing usable: a key that varies per request is worse than no key,
// because it pins otherwise-cacheable requests to different cache nodes.
func TestClaudeMessagesToOpenAIChat_PromptCacheKeyFromMetadata(t *testing.T) {
	cases := []struct {
		name     string
		metadata string
		want     string
	}{
		{"forwards metadata.user_id", `{"user_id":"user-abc123"}`, "user-abc123"},
		{"trims whitespace", `{"user_id":"  user-abc123  "}`, "user-abc123"},
		{"absent metadata", ``, ""},
		{"metadata without user_id", `{"session":"x"}`, ""},
		{"empty user_id", `{"user_id":""}`, ""},
		{"non-string user_id is ignored, not fatal", `{"user_id":{"nested":true}}`, ""},
		{"malformed metadata is ignored, not fatal", `{"user_id":`, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			request := claudeRequestWithCacheControl()
			if tc.metadata != "" {
				request.Metadata = json.RawMessage(tc.metadata)
			}

			got, err := ClaudeMessagesRequestToOpenAIChat(request, &convmeta.Values{
				UpstreamModelName: "gpt-4o",
				Options:           &convmeta.Options{},
			})
			require.NoError(t, err)
			assert.Equal(t, tc.want, got.PromptCacheKey)
		})
	}
}

// omitempty must keep the field off the wire when unset, so its absence cannot
// itself become a byte-level difference between two requests.
func TestClaudeMessagesToOpenAIChat_OmitsEmptyPromptCacheKey(t *testing.T) {
	got, err := ClaudeMessagesRequestToOpenAIChat(claudeRequestWithCacheControl(), &convmeta.Values{
		UpstreamModelName: "gpt-4o",
		Options:           &convmeta.Options{},
	})
	require.NoError(t, err)
	require.Empty(t, got.PromptCacheKey)

	encoded, err := json.Marshal(got)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "prompt_cache_key")
}
