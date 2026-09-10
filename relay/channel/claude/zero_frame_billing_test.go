package claude

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newClaudeFinalResponseTestContext() *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	return c
}

func newClaudeFinalResponseTestInfo(receivedResponseCount, estimatePromptTokens int) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		ReceivedResponseCount: receivedResponseCount,
		RelayFormat:           types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-test",
		},
	}
	info.SetEstimatePromptTokens(estimatePromptTokens)
	return info
}

func TestHandleStreamFinalResponse_ZeroFramesWithoutUsageEvidenceKeepsZeroUsage(t *testing.T) {
	c := newClaudeFinalResponseTestContext()
	info := newClaudeFinalResponseTestInfo(0, 1234)
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, nil)
	claudeInfo := &ClaudeResponseInfo{
		ResponseText: strings.Builder{},
		Usage:        &dto.Usage{},
	}
	claudeInfo.ResponseText.WriteString("partial response text")

	HandleStreamFinalResponse(c, info, claudeInfo)

	require.Zero(t, claudeInfo.Usage.PromptTokens)
	require.Zero(t, claudeInfo.Usage.CompletionTokens)
	require.Zero(t, claudeInfo.Usage.TotalTokens)
	require.Nil(t, claudeInfo.Usage.BillingUsage)
	require.False(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
}

func TestHandleStreamFinalResponse_ZeroCountWithMessageStartUsagePreservesUpstreamEvidence(t *testing.T) {
	c := newClaudeFinalResponseTestContext()
	info := newClaudeFinalResponseTestInfo(0, 1234)
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, nil)
	claudeInfo := &ClaudeResponseInfo{Usage: &dto.Usage{}}

	require.True(t, FormatClaudeResponseInfo(&dto.ClaudeResponse{
		Type: "message_start",
		Message: &dto.ClaudeMediaMessage{
			Usage: &dto.ClaudeUsage{
				InputTokens:              100,
				CacheReadInputTokens:     30,
				CacheCreationInputTokens: 50,
			},
		},
	}, nil, claudeInfo))

	HandleStreamFinalResponse(c, info, claudeInfo)

	require.Equal(t, 100, claudeInfo.Usage.PromptTokens)
	require.Equal(t, 30, claudeInfo.Usage.PromptTokensDetails.CachedTokens)
	require.Equal(t, 50, claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens)
	require.NotNil(t, claudeInfo.Usage.BillingUsage)
}

func TestHandleStreamFinalResponse_ZeroFramesWithCacheOnlyUsagePreservesUpstreamEvidence(t *testing.T) {
	c := newClaudeFinalResponseTestContext()
	info := newClaudeFinalResponseTestInfo(0, 1234)
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, nil)
	claudeInfo := &ClaudeResponseInfo{
		Usage: &dto.Usage{
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens: 30,
			},
		},
	}

	HandleStreamFinalResponse(c, info, claudeInfo)

	require.Equal(t, 30, claudeInfo.Usage.PromptTokensDetails.CachedTokens)
	require.NotNil(t, claudeInfo.Usage.BillingUsage)
}

func TestHandleStreamFinalResponse_ZeroCountWithoutAbnormalStatusKeepsLocalFallback(t *testing.T) {
	tests := []struct {
		name      string
		endReason *relaycommon.StreamEndReason
	}{
		{name: "AWS stream status absent"},
		{name: "normal EOF", endReason: commonPointer(relaycommon.StreamEndReasonEOF)},
		{name: "normal done", endReason: commonPointer(relaycommon.StreamEndReasonDone)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newClaudeFinalResponseTestContext()
			info := newClaudeFinalResponseTestInfo(0, 1234)
			if tt.endReason != nil {
				info.StreamStatus = relaycommon.NewStreamStatus()
				info.StreamStatus.SetEndReason(*tt.endReason, nil)
			}
			claudeInfo := &ClaudeResponseInfo{
				ResponseText: strings.Builder{},
				Usage:        &dto.Usage{},
			}
			claudeInfo.ResponseText.WriteString("response text")

			HandleStreamFinalResponse(c, info, claudeInfo)

			require.Equal(t, 1234, claudeInfo.Usage.PromptTokens)
			require.Positive(t, claudeInfo.Usage.CompletionTokens)
			require.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
		})
	}
}

func TestHandleStreamFinalResponse_ReceivedFramesWithoutUsageKeepsLocalFallback(t *testing.T) {
	c := newClaudeFinalResponseTestContext()
	info := newClaudeFinalResponseTestInfo(1, 1234)
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, nil)
	claudeInfo := &ClaudeResponseInfo{
		ResponseText: strings.Builder{},
		Usage:        &dto.Usage{},
	}
	claudeInfo.ResponseText.WriteString("response text")

	HandleStreamFinalResponse(c, info, claudeInfo)

	require.Equal(t, 1234, claudeInfo.Usage.PromptTokens)
	require.Positive(t, claudeInfo.Usage.CompletionTokens)
	require.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
}

func TestHandleStreamFinalResponse_CompleteUpstreamUsageRemainsUnchanged(t *testing.T) {
	c := newClaudeFinalResponseTestContext()
	info := newClaudeFinalResponseTestInfo(3, 1234)
	billingUsage := dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{
		InputTokens:  100,
		OutputTokens: 20,
	})
	claudeInfo := &ClaudeResponseInfo{
		Done: true,
		Usage: &dto.Usage{
			PromptTokens:     100,
			CompletionTokens: 20,
			TotalTokens:      120,
			BillingUsage:     billingUsage,
		},
	}

	HandleStreamFinalResponse(c, info, claudeInfo)

	require.Equal(t, 100, claudeInfo.Usage.PromptTokens)
	require.Equal(t, 20, claudeInfo.Usage.CompletionTokens)
	require.Equal(t, 120, claudeInfo.Usage.TotalTokens)
	require.Same(t, billingUsage, claudeInfo.Usage.BillingUsage)
	require.False(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
}
