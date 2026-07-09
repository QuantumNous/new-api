package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildChannelDataAuditDetectsMissingCacheWrite(t *testing.T) {
	items, summary, groups := buildChannelDataAudit("claude-opus-4-6", []ModelDataItem{
		{
			ChannelID:                4,
			ChannelName:              "packyapi-claude-sale",
			PricingSource:            "pricing",
			ActualPrice:              floatPtr(1.4737),
			ActualOutputPrice:        floatPtr(7.3685),
			ActualCachePrice:         floatPtr(0.14737),
			ActualCacheCreationPrice: nil,
		},
	})

	require.Len(t, items, 1)
	require.Equal(t, "pricing", items[0].FinalSource)
	require.Equal(t, "partial", items[0].Completeness)
	require.True(t, items[0].IsAnomaly)
	require.Equal(t, []string{"cache_write"}, items[0].MissingFields)
	require.Equal(t, 1, summary.PartialCount)
	require.Equal(t, 1, summary.AnomalyCount)
	require.Len(t, groups["pricing_missing_cache_write"], 1)
}

func TestBuildChannelDataAuditTreatsManualMediaMissingFieldsAsAnomaly(t *testing.T) {
	items, summary, groups := buildChannelDataAudit("sora-2", []ModelDataItem{
		{
			ChannelID:     88,
			ChannelName:   "video-channel",
			PricingSource: "manual",
			ActualPrice:   floatPtr(0.12),
		},
	})

	require.Len(t, items, 1)
	require.Equal(t, "manual", items[0].FinalSource)
	require.Equal(t, "partial", items[0].Completeness)
	require.True(t, items[0].IsAnomaly)
	require.Equal(t, []string{"output", "cache_read", "cache_write"}, items[0].MissingFields)
	require.Equal(t, 1, summary.ManualSources)
	require.Equal(t, 1, summary.PartialCount)
	require.Equal(t, 1, summary.AnomalyCount)
	require.Len(t, groups["manual_missing_output"], 1)
	require.Len(t, groups["manual_missing_cache_read"], 1)
	require.Len(t, groups["manual_missing_cache_write"], 1)
}

func TestBuildChannelDataAuditTreatsGlobalFallbackAsAnomaly(t *testing.T) {
	items, summary, groups := buildChannelDataAudit("gpt-4.1", []ModelDataItem{
		{
			ChannelID:                10,
			ChannelName:              "global-only",
			PricingSource:            "global",
			ActualPrice:              floatPtr(2),
			ActualOutputPrice:        floatPtr(8),
			ActualCachePrice:         floatPtr(0.5),
			ActualCacheCreationPrice: floatPtr(2.5),
		},
		{
			ChannelID:     11,
			ChannelName:   "no-price",
			PricingSource: "",
		},
	})

	require.Len(t, items, 2)
	require.Equal(t, "global", items[0].FinalSource)
	require.Equal(t, "complete", items[0].Completeness)
	require.True(t, items[0].IsAnomaly)
	require.Contains(t, items[0].Note, "global")
	require.Equal(t, "none", items[1].FinalSource)
	require.Equal(t, "missing", items[1].Completeness)
	require.Equal(t, 1, summary.GlobalSources)
	require.Equal(t, 1, summary.NoneSources)
	require.Equal(t, 1, summary.CompleteCount)
	require.Equal(t, 1, summary.MissingCount)
	require.Equal(t, 2, summary.AnomalyCount)
	require.Len(t, groups["global_fallback"], 1)
	require.Len(t, groups["missing_procurement_price"], 1)
}

func floatPtr(v float64) *float64 {
	return &v
}
