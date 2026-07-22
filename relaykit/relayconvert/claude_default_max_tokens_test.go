package relayconvert

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeDefaultMaxTokensPresence(t *testing.T) {
	converters := []struct {
		name    string
		convert func(t *testing.T, meta convmeta.Meta, clientMaxTokens *uint) *dto.ClaudeRequest
	}{
		{
			name: "chat completions",
			convert: func(t *testing.T, meta convmeta.Meta, clientMaxTokens *uint) *dto.ClaudeRequest {
				t.Helper()
				got, err := OpenAIChatRequestToClaudeMessages(context.Background(), meta, dto.GeneralOpenAIRequest{
					Model:     "claude-test",
					MaxTokens: clientMaxTokens,
					Messages: []dto.Message{
						{Role: "user", Content: "hello"},
					},
				})
				require.NoError(t, err)
				return got
			},
		},
		{
			name: "responses",
			convert: func(t *testing.T, meta convmeta.Meta, clientMaxTokens *uint) *dto.ClaudeRequest {
				t.Helper()
				got, err := OpenAIResponsesRequestToClaudeMessages(context.Background(), meta, &dto.OpenAIResponsesRequest{
					Model:           "claude-test",
					Input:           []byte(`"hello"`),
					MaxOutputTokens: clientMaxTokens,
				})
				require.NoError(t, err)
				return got
			},
		},
	}

	for _, converter := range converters {
		t.Run(converter.name, func(t *testing.T) {
			t.Run("callback absent", func(t *testing.T) {
				got := converter.convert(t, &convmeta.Values{}, nil)
				assert.Nil(t, got.MaxTokens)
			})

			t.Run("configured zero", func(t *testing.T) {
				got := converter.convert(t, claudeDefaultsMeta(func(string) int { return 0 }), nil)
				require.NotNil(t, got.MaxTokens)
				assert.Zero(t, *got.MaxTokens)
			})

			t.Run("configured positive", func(t *testing.T) {
				got := converter.convert(t, claudeDefaultsMeta(func(string) int { return 512 }), nil)
				require.NotNil(t, got.MaxTokens)
				assert.Equal(t, uint(512), *got.MaxTokens)
			})

			t.Run("client nonzero wins", func(t *testing.T) {
				clientMaxTokens := uint(99)
				got := converter.convert(t, claudeDefaultsMeta(func(string) int { return 512 }), &clientMaxTokens)
				require.NotNil(t, got.MaxTokens)
				assert.Equal(t, clientMaxTokens, *got.MaxTokens)
			})
		})
	}
}

func claudeDefaultsMeta(defaultMaxTokens func(string) int) convmeta.Meta {
	return &convmeta.Values{Options: &convmeta.Options{
		Claude: convmeta.ClaudeOptions{DefaultMaxTokens: defaultMaxTokens},
	}}
}
