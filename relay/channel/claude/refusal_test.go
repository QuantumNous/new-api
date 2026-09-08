package claude

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func refusalTestContext(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	return ctx
}

func TestMaybeMarkClaudeRefusal(t *testing.T) {
	tests := []struct {
		name     string
		response dto.ClaudeResponse
		want     bool
	}{
		{
			name:     "non-stream refusal",
			response: dto.ClaudeResponse{Type: "message", StopReason: "refusal"},
			want:     true,
		},
		{
			name: "stream message_delta refusal",
			response: dto.ClaudeResponse{
				Type:  "message_delta",
				Delta: &dto.ClaudeMediaMessage{StopReason: commonPointer("refusal")},
			},
			want: true,
		},
		{
			name:     "end_turn is not a refusal",
			response: dto.ClaudeResponse{Type: "message", StopReason: "end_turn"},
			want:     false,
		},
		{
			name: "max_tokens delta is not a refusal",
			response: dto.ClaudeResponse{
				Type:  "message_delta",
				Delta: &dto.ClaudeMediaMessage{StopReason: commonPointer("max_tokens")},
			},
			want: false,
		},
		{
			name:     "content_block_delta carries no stop reason",
			response: dto.ClaudeResponse{Type: "content_block_delta"},
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := refusalTestContext(t)

			maybeMarkClaudeRefusal(ctx, &tt.response)

			assert.Equal(t, tt.want, common.GetContextKeyBool(ctx, constant.ContextKeyUpstreamRefusal))
			if tt.want {
				assert.Equal(t, "claude_stop_reason=refusal",
					common.GetContextKeyString(ctx, constant.ContextKeyAdminRejectReason))
			}
		})
	}
}

func TestNeedsLocalUsageFallback(t *testing.T) {
	tests := []struct {
		name             string
		done             bool
		promptTokens     int
		completionTokens int
		responseText     string
		want             bool
	}{
		{
			name:         "refusal with complete upstream usage keeps upstream counts",
			done:         true,
			promptTokens: 412,
			want:         false,
		},
		{
			name:             "normal response with output keeps upstream counts",
			done:             true,
			promptTokens:     412,
			completionTokens: 264,
			responseText:     "hello",
			want:             false,
		},
		{
			name:         "truncated stream still estimates locally",
			done:         false,
			promptTokens: 412,
			want:         true,
		},
		{
			name:         "text without an output count still estimates locally",
			done:         true,
			promptTokens: 412,
			responseText: "hello",
			want:         true,
		},
		{
			name:         "missing prompt tokens still estimates locally",
			done:         true,
			promptTokens: 0,
			want:         true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claudeInfo := &ClaudeResponseInfo{
				Done: tt.done,
				Usage: &dto.Usage{
					PromptTokens:     tt.promptTokens,
					CompletionTokens: tt.completionTokens,
				},
			}
			claudeInfo.ResponseText.WriteString(tt.responseText)

			assert.Equal(t, tt.want, needsLocalUsageFallback(claudeInfo))
		})
	}
}

// A fallback response must reach settlement with its per-attempt breakdown
// intact, otherwise the refused hop's output tokens are never charged.
func TestFormatClaudeResponseInfoPreservesFallbackIterations(t *testing.T) {
	claudeInfo := &ClaudeResponseInfo{Usage: &dto.Usage{}}
	iterations := []dto.ClaudeUsageIteration{
		{Type: "message", Model: "claude-opus-5", InputTokens: 535, OutputTokens: 0},
		{Type: "fallback_message", Model: "claude-opus-4-8", InputTokens: 412, OutputTokens: 264},
	}

	FormatClaudeResponseInfo(&dto.ClaudeResponse{
		Type: "message_delta",
		Usage: &dto.ClaudeUsage{
			InputTokens:  412,
			OutputTokens: 264,
			Iterations:   iterations,
		},
	}, nil, claudeInfo)

	require.NotNil(t, claudeInfo.Usage.BillingUsage)
	require.NotNil(t, claudeInfo.Usage.BillingUsage.ClaudeUsage)
	assert.Equal(t, iterations, claudeInfo.Usage.BillingUsage.ClaudeUsage.Iterations)

	billable := claudeInfo.Usage.BillingUsage.ClaudeUsage.BillableIterations()
	require.Len(t, billable, 1)
	assert.Equal(t, "claude-opus-4-8", billable[0].Model)
}
