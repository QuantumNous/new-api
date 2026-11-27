package claudemessages

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMessageStartZeroOutputSidecarRemainsRefreshable(t *testing.T) {
	t.Parallel()

	info := &ClaudeResponseInfo{Usage: &dto.Usage{}}
	ok := FormatClaudeResponseInfo(&dto.ClaudeResponse{
		Type: "message_start",
		Message: &dto.ClaudeMediaMessage{
			Id:    "msg_1",
			Model: "claude-test",
			Usage: &dto.ClaudeUsage{
				InputTokens:  10,
				OutputTokens: 0,
				BillingUsage: dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{
					InputTokens:  10,
					OutputTokens: 0,
				}),
			},
		},
	}, nil, info)
	require.True(t, ok)

	ok = FormatClaudeResponseInfo(&dto.ClaudeResponse{
		Type: "message_delta",
		Usage: &dto.ClaudeUsage{
			OutputTokens: 42,
		},
	}, nil, info)
	require.True(t, ok)
	require.NotNil(t, info.Usage.BillingUsage)
	require.NotNil(t, info.Usage.BillingUsage.ClaudeUsage)
	assert.Equal(t, 42, info.Usage.BillingUsage.ClaudeUsage.OutputTokens)
}

func TestTerminalSidecarRemainsAuthoritativeAgainstFinalize(t *testing.T) {
	t.Parallel()

	info := &ClaudeResponseInfo{Usage: &dto.Usage{}}
	ok := FormatClaudeResponseInfo(&dto.ClaudeResponse{
		Type: "message_delta",
		Usage: &dto.ClaudeUsage{
			InputTokens:  10,
			OutputTokens: 7,
			BillingUsage: dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{
				InputTokens:  10,
				OutputTokens: 7,
			}),
		},
	}, nil, info)
	require.True(t, ok)
	require.NotNil(t, info.Usage.BillingUsage)
	require.NotNil(t, info.Usage.BillingUsage.ClaudeUsage)

	info.Usage.CompletionTokens = 99
	FinalizeClaudeStreamBillingUsage(info)
	assert.Equal(t, 7, info.Usage.BillingUsage.ClaudeUsage.OutputTokens)
}

// Stream usage frames are cumulative but partial. The reported thinking count
// is kept as reported and the shown value follows the cumulative output total:
// a frame without a total is not an authoritative total of 0.
func TestStreamThinkingFollowsCumulativeTotal(t *testing.T) {
	t.Parallel()

	snapshot60x43 := &dto.BillingUsage{Source: dto.BillingUsageSourceOAIChat, Semantic: dto.BillingUsageSemanticOpenAI,
		OpenAIUsage: &dto.Usage{CompletionTokens: 60, CompletionTokenDetails: dto.OutputTokenDetails{ReasoningTokens: 43}}}
	start := func(usage *dto.ClaudeUsage) *dto.ClaudeResponse {
		return &dto.ClaudeResponse{Type: "message_start", Message: &dto.ClaudeMediaMessage{Id: "m", Model: "m", Usage: usage}}
	}
	delta := func(usage *dto.ClaudeUsage) *dto.ClaudeResponse {
		return &dto.ClaudeResponse{Type: "message_delta", Usage: usage}
	}
	details := func(raw string) *dto.ClaudeOutputTokensDetails {
		var out dto.ClaudeOutputTokensDetails
		require.NoError(t, kitutil.UnmarshalJsonStr(raw, &out))
		return &out
	}
	for _, tc := range []struct {
		name       string
		events     []*dto.ClaudeResponse
		wantOutput int
		want       int
		present    bool
	}{
		{"start snapshot before total", []*dto.ClaudeResponse{
			start(&dto.ClaudeUsage{InputTokens: 100, BillingUsage: snapshot60x43}),
			delta(&dto.ClaudeUsage{OutputTokens: 60}),
		}, 60, 43, true},
		{"thinking-only frame keeps known total", []*dto.ClaudeResponse{
			start(&dto.ClaudeUsage{OutputTokens: 60}),
			delta(&dto.ClaudeUsage{OutputTokensDetails: details(`{"thinking_tokens":43}`)}),
		}, 60, 43, true},
		{"thinking before total", []*dto.ClaudeResponse{
			start(&dto.ClaudeUsage{OutputTokensDetails: details(`{"thinking_tokens":43}`)}),
			delta(&dto.ClaudeUsage{OutputTokens: 60}),
		}, 60, 43, true},
		{"explicit zero replaces", []*dto.ClaudeResponse{
			start(&dto.ClaudeUsage{OutputTokens: 60, OutputTokensDetails: details(`{"thinking_tokens":43}`)}),
			delta(&dto.ClaudeUsage{OutputTokens: 60, OutputTokensDetails: details(`{"thinking_tokens":0}`)}),
		}, 60, 0, true},
		{"missing keeps", []*dto.ClaudeResponse{
			start(&dto.ClaudeUsage{OutputTokens: 60, OutputTokensDetails: details(`{"thinking_tokens":43}`)}),
			delta(&dto.ClaudeUsage{OutputTokens: 60}),
		}, 60, 43, true},
		{"empty object keeps", []*dto.ClaudeResponse{
			start(&dto.ClaudeUsage{OutputTokens: 60, OutputTokensDetails: details(`{"thinking_tokens":43}`)}),
			delta(&dto.ClaudeUsage{OutputTokens: 60, OutputTokensDetails: details(`{}`)}),
		}, 60, 43, true},
		{"null keeps", []*dto.ClaudeResponse{
			start(&dto.ClaudeUsage{OutputTokens: 60, OutputTokensDetails: details(`{"thinking_tokens":43}`)}),
			delta(&dto.ClaudeUsage{OutputTokens: 60, OutputTokensDetails: details(`{"thinking_tokens":null}`)}),
		}, 60, 43, true},
		{"never reported", []*dto.ClaudeResponse{
			start(&dto.ClaudeUsage{OutputTokens: 0, OutputTokensDetails: details(`{}`)}),
			delta(&dto.ClaudeUsage{OutputTokens: 60}),
		}, 60, 0, false},
		{"updates replace, not summed", []*dto.ClaudeResponse{
			start(&dto.ClaudeUsage{OutputTokens: 60, OutputTokensDetails: details(`{"thinking_tokens":30}`)}),
			delta(&dto.ClaudeUsage{OutputTokens: 60, OutputTokensDetails: details(`{"thinking_tokens":43}`)}),
		}, 60, 43, true},
		{"lowered total bounds the shown value", []*dto.ClaudeResponse{
			start(&dto.ClaudeUsage{OutputTokens: 60, OutputTokensDetails: details(`{"thinking_tokens":43}`)}),
			delta(&dto.ClaudeUsage{OutputTokens: 40}),
		}, 40, 40, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &ClaudeResponseInfo{Usage: &dto.Usage{}}
			for _, event := range tc.events {
				require.True(t, FormatClaudeResponseInfo(event, nil, info))
			}
			assert.Equal(t, tc.wantOutput, info.Usage.CompletionTokens)
			assert.Equal(t, tc.want, info.Usage.CompletionTokenDetails.ReasoningTokens)
			assert.Equal(t, tc.present, info.Usage.CompletionTokenDetails.HasReasoningTokens())
		})
	}

	// A start frame without a total does not mark the count as a reported 0.
	info := &ClaudeResponseInfo{Usage: &dto.Usage{}}
	require.True(t, FormatClaudeResponseInfo(start(&dto.ClaudeUsage{InputTokens: 100, BillingUsage: snapshot60x43}), nil, info))
	assert.False(t, info.Usage.CompletionTokenDetails.HasReasoningTokens())
	assert.Equal(t, 43, snapshot60x43.OpenAIUsage.CompletionTokenDetails.ReasoningTokens, "snapshot unchanged")
}
