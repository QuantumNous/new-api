package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// Tests for the per-key spend ranking behind /api/data/token-usage and
// /api/data/self/token-usage.

func seedTokenUsageData(t *testing.T, now int64) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&QuotaDataDimension{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM quota_data_dimensions") })

	// Alive key, soft-deleted key (status stays 1, deleted_at set), another
	// user's key, and one key that was hard-deleted (only the dimension table
	// still remembers its name).
	require.NoError(t, DB.Create(&Token{Id: 11, UserId: 1, Key: "sk-active", Name: "active-key", Status: 1}).Error)
	require.NoError(t, DB.Create(&Token{Id: 12, UserId: 1, Key: "sk-gone-soft", Name: "soft-deleted-key", Status: 1}).Error)
	require.NoError(t, DB.Create(&Token{Id: 13, UserId: 2, Key: "sk-other", Name: "other-user-key", Status: 1}).Error)
	require.NoError(t, DB.Delete(&Token{Id: 12}).Error)
	require.NoError(t, DB.Create(&QuotaDataDimension{
		UserID: 1, TokenName: "hard-deleted-key", TokenNameID: 99, ModelName: "gpt-a", LastSeenAt: now,
	}).Error)

	rows := []QuotaData{
		// User 1, alive key: two rows in range that must sum up. One row
		// predates the RawQuota column (RawQuota left at its zero value),
		// mirroring real historical data mixed with new rows.
		{UserID: 1, Username: "alice", TokenID: 11, UseGroup: "default", ModelName: "gpt-a", ChannelID: 1, CreatedAt: now - 100, Count: 2, Quota: 300, RawQuota: 600, TokenUsed: 400, CacheReadTokens: 100, InputTokensTotal: 200},
		{UserID: 1, Username: "alice", TokenID: 11, UseGroup: "default", ModelName: "gpt-a", ChannelID: 1, CreatedAt: now - 50, Count: 1, Quota: 100, TokenUsed: 100, CacheReadTokens: 50, InputTokensTotal: 80},
		// User 1, soft-deleted key: spend stays visible, name still resolves.
		{UserID: 1, Username: "alice", TokenID: 12, UseGroup: "default", ModelName: "gpt-a", ChannelID: 1, CreatedAt: now - 40, Count: 1, Quota: 500, TokenUsed: 500, CacheReadTokens: 0, InputTokensTotal: 0},
		// User 1, hard-deleted key: name can only come from the dims table.
		{UserID: 1, Username: "alice", TokenID: 99, UseGroup: "default", ModelName: "gpt-a", ChannelID: 1, CreatedAt: now - 30, Count: 1, Quota: 200, TokenUsed: 200, CacheReadTokens: 0, InputTokensTotal: 0},
		// Another user's key must stay out of user 1's scoped ranking.
		{UserID: 2, Username: "bob", TokenID: 13, UseGroup: "default", ModelName: "gpt-a", ChannelID: 1, CreatedAt: now - 20, Count: 9, Quota: 9000, TokenUsed: 900, CacheReadTokens: 0, InputTokensTotal: 0},
		// Rows without a token id cannot be attributed to a key.
		{UserID: 1, Username: "alice", TokenID: 0, UseGroup: "default", ModelName: "gpt-a", ChannelID: 1, CreatedAt: now - 10, Count: 1, Quota: 700, TokenUsed: 700, CacheReadTokens: 0, InputTokensTotal: 0},
		// Out of range entirely.
		{UserID: 1, Username: "alice", TokenID: 11, UseGroup: "default", ModelName: "gpt-a", ChannelID: 1, CreatedAt: now - 100000, Count: 1, Quota: 9999, TokenUsed: 999, CacheReadTokens: 0, InputTokensTotal: 0},
	}
	for i := range rows {
		require.NoError(t, DB.Create(&rows[i]).Error)
	}
}

func TestTokenUsageRankingOrdersSumsAndScopes(t *testing.T) {
	now := time.Now().Unix()
	seedTokenUsageData(t, now)

	rows, err := GetTokenUsageRanking(now-1000, now, 0, "", "", "", 0)
	require.NoError(t, err)

	// Sorted by spend: other user's key first, then the soft-deleted one.
	require.Len(t, rows, 4)
	require.Equal(t, 13, rows[0].TokenID)
	require.Equal(t, "other-user-key", rows[0].TokenName)
	require.Equal(t, int64(9000), rows[0].Quota)
	require.Equal(t, "bob", rows[0].Username)

	// The soft-deleted key keeps its spend visible and its name resolves
	// from the tokens table.
	require.Equal(t, 12, rows[1].TokenID)
	require.Equal(t, "soft-deleted-key", rows[1].TokenName)
	require.Equal(t, int64(500), rows[1].Quota)

	// The alive key's in-range rows sum up; the out-of-range row is excluded.
	require.Equal(t, 11, rows[2].TokenID)
	require.Equal(t, "active-key", rows[2].TokenName)
	require.Equal(t, int64(400), rows[2].Quota)
	// RawQuota sums what is known (600) and silently treats the pre-column
	// row's zero as "unknown" rather than "free" — it is not forced to equal
	// Quota's full 400 since the second row never recorded a group ratio.
	require.Equal(t, int64(600), rows[2].RawQuota)
	require.Equal(t, int64(3), rows[2].Count)
	require.Equal(t, int64(500), rows[2].TokenUsed)
	require.Equal(t, int64(150), rows[2].CacheReadTokens)
	require.Equal(t, int64(280), rows[2].InputTokensTotal)
	require.Equal(t, now-50, rows[2].LastUsed)

	// The hard-deleted key's name survives through the dimension table.
	require.Equal(t, 99, rows[3].TokenID)
	require.Equal(t, "hard-deleted-key", rows[3].TokenName)

	// Self scope: only the session account's keys.
	mine, err := GetTokenUsageRanking(now-1000, now, 1, "", "", "", 0)
	require.NoError(t, err)
	require.Len(t, mine, 3)
	for _, row := range mine {
		require.Equal(t, 1, row.UserID)
	}

	// The username filter matches the same way /api/data does.
	byUser, err := GetTokenUsageRanking(now-1000, now, 0, "bob", "", "", 0)
	require.NoError(t, err)
	require.Len(t, byUser, 1)
	require.Equal(t, 13, byUser[0].TokenID)
}

func TestTokenUsageRankingFiltersByNameAndModel(t *testing.T) {
	now := time.Now().Unix()
	seedTokenUsageData(t, now)

	// Key-name filter agrees with the pickers: a soft-deleted key's name is
	// not offered, so filtering by it matches nothing.
	byName, err := GetTokenUsageRanking(now-1000, now, 0, "", "active-key", "", 0)
	require.NoError(t, err)
	require.Len(t, byName, 1)
	require.Equal(t, 11, byName[0].TokenID)

	deleted, err := GetTokenUsageRanking(now-1000, now, 0, "", "soft-deleted-key", "", 0)
	require.NoError(t, err)
	require.Empty(t, deleted)

	byModel, err := GetTokenUsageRanking(now-1000, now, 0, "", "", "gpt-a", 0)
	require.NoError(t, err)
	require.Len(t, byModel, 4)

	none, err := GetTokenUsageRanking(now-1000, now, 0, "", "", "claude-x", 0)
	require.NoError(t, err)
	require.Empty(t, none)
}
