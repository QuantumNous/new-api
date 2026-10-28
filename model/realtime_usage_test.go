package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRealtimeUsageParamsValidation(t *testing.T) {
	got, err := NormalizeRealtimeUsageParams(RealtimeUsageParams{})
	require.NoError(t, err)
	require.Equal(t, RealtimeUsageParams{WindowSeconds: 60, TrendMinutes: 60, Limit: 20}, got)
	for _, p := range []RealtimeUsageParams{{WindowSeconds: 29}, {TrendMinutes: 1441}, {Limit: 101}} {
		_, err := NormalizeRealtimeUsageParams(p)
		require.Error(t, err)
	}
}

func TestAggregateRealtimeUsageCacheTrendAndErrors(t *testing.T) {
	now := int64(1_700_000_000)
	logs := []*Log{
		{UserId: 1, Username: "alice", Type: LogTypeConsume, CreatedAt: now - 10, PromptTokens: 10, CompletionTokens: 5, Other: `{"cache_tokens":"3","cache_write_tokens":2}`},
		{UserId: 1, Username: "alice", Type: LogTypeConsume, CreatedAt: now - 70, PromptTokens: 2, CompletionTokens: 1, Other: `{"cache_creation_tokens_5m":4,"cache_creation_tokens_1h":5,"status":"error"}`},
		{UserId: 2, Username: "bob", Type: LogTypeConsume, CreatedAt: now - 400, PromptTokens: 99},
	}
	got, err := AggregateRealtimeUsage(logs, now, RealtimeUsageParams{WindowSeconds: 120, TrendMinutes: 5, Limit: 5})
	require.NoError(t, err)
	require.Equal(t, 2, got.Summary.Requests)
	require.Equal(t, 32, got.Summary.TotalTokens)
	require.Equal(t, 0.5, got.Summary.ErrorRate)
	require.Len(t, got.Users, 1)
	require.Equal(t, 32, got.Users[0].TotalTokens)
	require.Equal(t, 1, got.Users[0].Errors)
	require.Len(t, got.UserTrends[1], 6)
	userRequests := 0
	for _, point := range got.UserTrends[1] {
		userRequests += point.Requests
	}
	require.Equal(t, 2, userRequests)
	require.Len(t, got.Trend, 6)
}
