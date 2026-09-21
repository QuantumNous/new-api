package relayconvert

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	sharedclaude "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/claude"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeDefaultMaxTokensPresence(t *testing.T) {
	converters := []struct {
		name    string
		convert func(t *testing.T, meta convmeta.Meta, clientMaxTokens *uint) (*dto.ClaudeRequest, error)
	}{
		{
			name: "chat completions",
			convert: func(t *testing.T, meta convmeta.Meta, clientMaxTokens *uint) (*dto.ClaudeRequest, error) {
				t.Helper()
				return OpenAIChatRequestToClaudeMessages(context.Background(), meta, dto.GeneralOpenAIRequest{
					Model:     "claude-test",
					MaxTokens: clientMaxTokens,
					Messages: []dto.Message{
						{Role: "user", Content: "hello"},
					},
				})
			},
		},
		{
			name: "responses",
			convert: func(t *testing.T, meta convmeta.Meta, clientMaxTokens *uint) (*dto.ClaudeRequest, error) {
				t.Helper()
				return OpenAIResponsesRequestToClaudeMessages(context.Background(), meta, &dto.OpenAIResponsesRequest{
					Model:           "claude-test",
					Input:           []byte(`"hello"`),
					MaxOutputTokens: clientMaxTokens,
				})
			},
		},
	}

	for _, converter := range converters {
		t.Run(converter.name, func(t *testing.T) {
			t.Run("callback absent fails conversion", func(t *testing.T) {
				got, err := converter.convert(t, &convmeta.Values{}, nil)
				require.ErrorIs(t, err, sharedclaude.ErrMissingMaxTokens)
				assert.Nil(t, got)
			})

			t.Run("callback absent, client value wins", func(t *testing.T) {
				clientMaxTokens := uint(99)
				got, err := converter.convert(t, &convmeta.Values{}, &clientMaxTokens)
				require.NoError(t, err)
				require.NotNil(t, got.MaxTokens)
				assert.Equal(t, clientMaxTokens, *got.MaxTokens)
			})

			t.Run("configured zero", func(t *testing.T) {
				got, err := converter.convert(t, claudeDefaultsMeta(func(string) int { return 0 }), nil)
				require.NoError(t, err)
				require.NotNil(t, got.MaxTokens)
				assert.Zero(t, *got.MaxTokens)
			})

			t.Run("configured positive", func(t *testing.T) {
				got, err := converter.convert(t, claudeDefaultsMeta(func(string) int { return 512 }), nil)
				require.NoError(t, err)
				require.NotNil(t, got.MaxTokens)
				assert.Equal(t, uint(512), *got.MaxTokens)
			})

			t.Run("client nonzero wins", func(t *testing.T) {
				clientMaxTokens := uint(99)
				got, err := converter.convert(t, claudeDefaultsMeta(func(string) int { return 512 }), &clientMaxTokens)
				require.NoError(t, err)
				require.NotNil(t, got.MaxTokens)
				assert.Equal(t, clientMaxTokens, *got.MaxTokens)
			})
		})
	}
}

// The thinking adapter's max_tokens floor is an injection path of its own: a
// "-thinking" request without max_tokens must keep converting even when no
// DefaultMaxTokens hook is configured.
func TestClaudeThinkingAdapterSatisfiesMaxTokensWithoutCallback(t *testing.T) {
	meta := &convmeta.Values{Options: &convmeta.Options{
		Claude: convmeta.ClaudeOptions{
			ThinkingAdapterEnabled:                true,
			ThinkingAdapterBudgetTokensPercentage: 0.8,
		},
	}}
	got, err := OpenAIChatRequestToClaudeMessages(context.Background(), meta, dto.GeneralOpenAIRequest{
		Model: "claude-test-thinking",
		Messages: []dto.Message{
			{Role: "user", Content: "hello"},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, got.MaxTokens)
	assert.Equal(t, uint(1280), *got.MaxTokens)
}

func TestOpenAIChatRequestToClaudeMessagesOmitsEmptyTools(t *testing.T) {
	maxTokens := uint(16)
	tests := []struct {
		name      string
		request   dto.GeneralOpenAIRequest
		wantTools bool
	}{
		{
			name: "omitted tools",
			request: dto.GeneralOpenAIRequest{
				Model:     "claude-test",
				MaxTokens: &maxTokens,
				Messages:  []dto.Message{{Role: "user", Content: "hi"}},
			},
		},
		{
			name: "explicit empty tools",
			request: dto.GeneralOpenAIRequest{
				Model:     "claude-test",
				MaxTokens: &maxTokens,
				Messages:  []dto.Message{{Role: "user", Content: "hi"}},
				Tools:     []dto.ToolCallRequest{},
			},
		},
		{
			name: "function tool",
			request: dto.GeneralOpenAIRequest{
				Model:     "claude-test",
				MaxTokens: &maxTokens,
				Messages:  []dto.Message{{Role: "user", Content: "hi"}},
				Tools: []dto.ToolCallRequest{{
					Type: "function",
					Function: dto.FunctionRequest{
						Name:        "get_weather",
						Description: "Get weather by city",
						Parameters: map[string]any{
							"type":       "object",
							"properties": map[string]any{"city": map[string]any{"type": "string"}},
							"required":   []any{"city"},
						},
					},
				}},
			},
			wantTools: true,
		},
		{
			name: "web search only",
			request: dto.GeneralOpenAIRequest{
				Model:            "claude-test",
				MaxTokens:        &maxTokens,
				Messages:         []dto.Message{{Role: "user", Content: "hi"}},
				WebSearchOptions: &dto.WebSearchOptions{SearchContextSize: "low"},
			},
			wantTools: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := OpenAIChatRequestToClaudeMessages(context.Background(), &convmeta.Values{}, test.request)
			require.NoError(t, err)

			body, err := kitutil.Marshal(got)
			require.NoError(t, err)

			if test.wantTools {
				assert.NotNil(t, got.Tools)
				assert.Contains(t, string(body), `"tools":`)
				return
			}
			assert.Nil(t, got.Tools)
			assert.NotContains(t, string(body), `"tools":`)
		})
	}
}

func claudeDefaultsMeta(defaultMaxTokens func(string) int) convmeta.Meta {
	return &convmeta.Values{Options: &convmeta.Options{
		Claude: convmeta.ClaudeOptions{DefaultMaxTokens: defaultMaxTokens},
	}}
}
