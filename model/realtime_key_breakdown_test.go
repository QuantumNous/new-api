package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// Tests for the per-key realtime breakdown behind /api/usage/realtime/keys.
// They reuse the synthetic clock and registry helpers from
// realtime_metrics_test.go / realtime_dimensions_test.go.

func seedKeyBreakdownTokens(t *testing.T) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.Create(&Token{Id: 10, UserId: 1, Key: "sk-alpha", Name: "alpha"}).Error)
	require.NoError(t, DB.Create(&Token{Id: 20, UserId: 1, Key: "sk-beta", Name: "beta"}).Error)
}

func TestRealtimeKeyBreakdownSplitsByToken(t *testing.T) {
	setupDimensionTest(t)
	seedKeyBreakdownTokens(t)

	RecordRealtimeRequest(1, 10, "gpt-4o", 300, 240, 250, true, 5)
	RecordRealtimeRequest(1, 10, "claude-sonnet-4", 100, 0, 0, false, 3)
	RecordRealtimeRequest(1, 20, "gpt-4o", 50, 0, 0, false, 2)
	RecordRealtimeRequest(2, 99, "gpt-4o", 900, 0, 0, false, 1)

	breakdown := GetRealtimeKeyBreakdowns(1)
	require.False(t, breakdown.Truncated)
	require.Len(t, breakdown.Keys, 2)

	// Busiest key first (longest window), with its name resolved and its
	// windows equal to the account snapshot's math scoped to the key.
	first := breakdown.Keys[0]
	require.Equal(t, 10, first.TokenID)
	require.Equal(t, "alpha", first.TokenName)
	byWindow := map[int]RealtimeWindow{}
	for _, w := range first.Windows {
		byWindow[w.WindowSeconds] = w
	}
	require.Equal(t, 2, byWindow[60].Requests)
	require.InDelta(t, 2.0, byWindow[60].RPM, 1e-9)
	require.Equal(t, 400, byWindow[60].Tokens)
	require.InDelta(t, 400.0, byWindow[60].TPM, 1e-9)
	// Cache hit rate only counts requests that reported cache metadata.
	require.NotNil(t, byWindow[60].CacheHitRate)
	require.InDelta(t, 240.0/250.0, *byWindow[60].CacheHitRate, 1e-9)
	// Little's Law estimate: (5s + 3s busy) over the 60s window.
	require.InDelta(t, 8.0/60.0, byWindow[60].AvgConcurrency, 1e-9)

	second := breakdown.Keys[1]
	require.Equal(t, 20, second.TokenID)
	require.Equal(t, "beta", second.TokenName)

	// Another account's key never appears, and an id without a token row
	// keeps an empty name instead of a stale label.
	other := GetRealtimeKeyBreakdowns(2)
	require.Len(t, other.Keys, 1)
	require.Equal(t, 99, other.Keys[0].TokenID)
	require.Empty(t, other.Keys[0].TokenName)
}

func TestRealtimeKeyBreakdownOmitsIdleAccountsAndKeys(t *testing.T) {
	current := setupDimensionTest(t)
	seedKeyBreakdownTokens(t)

	RecordRealtimeRequest(1, 10, "gpt-4o", 100, 0, 0, false, 1)

	// An account with no traffic gets an empty (non-nil) list rather than
	// zeroed rows.
	require.Empty(t, GetRealtimeKeyBreakdowns(3).Keys)

	// An account whose only traffic rolled out of the retention window stays
	// absent too — the ring survives but every window is zero, and a zeroed
	// key row only invites misreading.
	RecordRealtimeRequest(2, 30, "gpt-4o", 100, 0, 0, false, 1)
	*current = realtimeTestNow + 3600*7
	idle := GetRealtimeKeyBreakdowns(2)
	require.Empty(t, idle.Keys)
}
