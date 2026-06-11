package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedAttributionLogs(t *testing.T) {
	t.Helper()
	dayA := int64(86400*100 + 3600)
	dayB := int64(86400*101 + 7200)
	logs := []*Log{
		{UserId: 1, Username: "alice", TokenId: 10, TokenName: "key-a", ModelName: "gpt", Type: LogTypeConsume, Quota: 100, PromptTokens: 50, CompletionTokens: 10, CreatedAt: dayA},
		{UserId: 1, Username: "alice", TokenId: 10, TokenName: "key-a", ModelName: "mini", Type: LogTypeConsume, Quota: 20, PromptTokens: 5, CompletionTokens: 2, CreatedAt: dayA},
		{UserId: 2, Username: "bob", TokenId: 20, TokenName: "key-b", ModelName: "gpt", Type: LogTypeConsume, Quota: 60, PromptTokens: 30, CompletionTokens: 5, CreatedAt: dayB},
		// non-consume log must be excluded from cost aggregation
		{UserId: 1, Username: "alice", TokenId: 10, TokenName: "key-a", ModelName: "gpt", Type: LogTypeError, Quota: 0, CreatedAt: dayB},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)
}

func findRow(rows []AttributionRow, key string) (AttributionRow, bool) {
	for _, r := range rows {
		if r.Key == key {
			return r, true
		}
	}
	return AttributionRow{}, false
}

func TestGetLogAttribution_ByUser(t *testing.T) {
	truncateTables(t)
	seedAttributionLogs(t)

	// Start: 1 opts into full history (seed uses fixed epoch-era timestamps);
	// without it the default time window would exclude the seeded rows.
	total, rows, err := GetLogAttribution(AttributionFilter{Dimension: "user", Start: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 180, total.Quota)
	assert.EqualValues(t, 3, total.Count) // error log excluded
	require.Len(t, rows, 2)
	// ordered by quota desc
	assert.Equal(t, "1", rows[0].Key)
	assert.EqualValues(t, 120, rows[0].Quota)
	assert.Equal(t, "alice", rows[0].Label)
	assert.Equal(t, "2", rows[1].Key)
	assert.EqualValues(t, 60, rows[1].Quota)
}

func TestGetLogAttribution_ByModel(t *testing.T) {
	truncateTables(t)
	seedAttributionLogs(t)

	_, rows, err := GetLogAttribution(AttributionFilter{Dimension: "model", Start: 1})
	require.NoError(t, err)
	gpt, ok := findRow(rows, "gpt")
	require.True(t, ok)
	assert.EqualValues(t, 160, gpt.Quota)
	mini, ok := findRow(rows, "mini")
	require.True(t, ok)
	assert.EqualValues(t, 20, mini.Quota)
}

func TestGetLogAttribution_TokenDrillToModel(t *testing.T) {
	truncateTables(t)
	seedAttributionLogs(t)

	total, rows, err := GetLogAttribution(AttributionFilter{
		Dimension: "token",
		Sub:       "model",
		ParentId:  "10",
		Start:     1,
	})
	require.NoError(t, err)
	assert.EqualValues(t, 120, total.Quota) // only token 10
	require.Len(t, rows, 2)
	gpt, ok := findRow(rows, "gpt")
	require.True(t, ok)
	assert.EqualValues(t, 100, gpt.Quota)
	mini, ok := findRow(rows, "mini")
	require.True(t, ok)
	assert.EqualValues(t, 20, mini.Quota)
}

func TestGetLogAttributionTrend_ByModel(t *testing.T) {
	truncateTables(t)
	seedAttributionLogs(t)

	trend, err := GetLogAttributionTrend(AttributionFilter{Dimension: "model", Top: 5, Start: 1})
	require.NoError(t, err)
	require.Len(t, trend.Buckets, 2) // dayA, dayB
	assert.Equal(t, int64(86400*100), trend.Buckets[0])
	assert.Equal(t, int64(86400*101), trend.Buckets[1])

	var gptSeries *AttributionSeries
	for i := range trend.Series {
		if trend.Series[i].Key == "gpt" {
			gptSeries = &trend.Series[i]
		}
	}
	require.NotNil(t, gptSeries)
	require.Len(t, gptSeries.Points, 2)
	assert.EqualValues(t, 100, gptSeries.Points[0]) // dayA gpt
	assert.EqualValues(t, 60, gptSeries.Points[1])  // dayB gpt
}

func TestGetLogAttribution_FilterByUsername(t *testing.T) {
	truncateTables(t)
	seedAttributionLogs(t)

	total, rows, err := GetLogAttribution(AttributionFilter{Dimension: "model", Username: "bob", Start: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 60, total.Quota)
	require.Len(t, rows, 1)
	assert.Equal(t, "gpt", rows[0].Key)
}

func TestNormalizeAttributionFilter_CapsTop(t *testing.T) {
	// Oversized Top is hard-capped.
	got := normalizeAttributionFilter(AttributionFilter{Top: 99999})
	assert.EqualValues(t, attributionMaxTop, got.Top)

	// Under-cap Top is preserved as-is. The time-window bound is enforced in
	// attributionBase (see TestGetLogAttribution_DefaultWindowExcludesOldLogs).
	got = normalizeAttributionFilter(AttributionFilter{Top: 10})
	assert.EqualValues(t, 10, got.Top)
}

func TestGetLogAttribution_DefaultWindowExcludesOldLogs(t *testing.T) {
	truncateTables(t)
	seedAttributionLogs(t) // fixed epoch-era timestamps, far outside the default window

	// No Start provided => default time window excludes the ancient seeded rows.
	total, rows, err := GetLogAttribution(AttributionFilter{Dimension: "user"})
	require.NoError(t, err)
	assert.EqualValues(t, 0, total.Quota)
	assert.Len(t, rows, 0)
}
