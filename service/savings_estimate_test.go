package service

import (
	"encoding/base64"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/savings_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/stretchr/testify/require"
)

func TestBuildTextSavingsEstimateSkipsWhenDisabled(t *testing.T) {
	require.NoError(t, savings_setting.UpdateSettingByJSONString(""))
	t.Cleanup(func() { require.NoError(t, savings_setting.UpdateSettingByJSONString("")) })

	result := buildTextSavingsEstimate(nil, savingsRelayInfo("gpt-4o-mini"), savingsSummary(100))

	require.Nil(t, result.Estimate)
	require.Equal(t, SavingsSkipDisabled, result.SkipReason)
}

func TestBuildTextSavingsEstimateUsesConfirmedOfficialPrice(t *testing.T) {
	configureSavingsSetting(t, map[string]savings_setting.OfficialPrice{
		"gpt-4o-mini": {
			ModelRatio:        float64Ptr(2),
			CompletionRatio:   float64Ptr(3),
			Source:            "OpenAI",
			SourceURL:         "https://openai.com/api/pricing",
			SourceUpdatedAt:   1_700_000_000,
			OfficialConfirmed: true,
		},
	})

	result := buildTextSavingsEstimate(nil, savingsRelayInfo("gpt-4o-mini"), savingsSummary(100))

	require.Empty(t, result.SkipReason)
	require.NotNil(t, result.Estimate)
	require.Equal(t, 260, result.Estimate.OfficialQuota)
	require.Equal(t, 100, result.Estimate.ActualQuota)
	require.Equal(t, 160, result.Estimate.SavingsQuota)
	require.Equal(t, "OpenAI", result.Estimate.Source)
	require.Equal(t, "https://openai.com/api/pricing", result.Estimate.SourceURL)
	require.Equal(t, "gpt-4o-mini", result.Estimate.MatchedModel)
	require.True(t, result.Estimate.OfficialConfirmed)
	require.Equal(t, savingsCalculationSnapshot, result.Estimate.CalculationMode)
	require.NotEmpty(t, result.Estimate.PriceFingerprint)
}

func TestBuildTextSavingsEstimateSkipsUnconfirmedOfficialPrice(t *testing.T) {
	configureSavingsSetting(t, map[string]savings_setting.OfficialPrice{
		"gpt-4o-mini": {
			ModelRatio:      float64Ptr(1),
			CompletionRatio: float64Ptr(1),
			SourceUpdatedAt: 1_700_000_000,
		},
	})

	result := buildTextSavingsEstimate(nil, savingsRelayInfo("gpt-4o-mini"), savingsSummary(100))

	require.Nil(t, result.Estimate)
	require.Equal(t, SavingsSkipUnconfirmedOfficialPrice, result.SkipReason)
}

func TestBuildTextSavingsEstimateSkipsUnsupportedBillingModes(t *testing.T) {
	configureSavingsSetting(t, map[string]savings_setting.OfficialPrice{
		"gpt-4o-mini": {
			ModelRatio:        float64Ptr(1),
			CompletionRatio:   float64Ptr(1),
			SourceUpdatedAt:   1_700_000_000,
			OfficialConfirmed: true,
		},
	})

	t.Run("fixed price billing", func(t *testing.T) {
		relayInfo := savingsRelayInfo("gpt-4o-mini")
		relayInfo.PriceData.UsePrice = true

		result := buildTextSavingsEstimate(nil, relayInfo, savingsSummary(100))

		require.Nil(t, result.Estimate)
		require.Equal(t, SavingsSkipUnsupportedBillingMode, result.SkipReason)
	})

	t.Run("other ratios", func(t *testing.T) {
		relayInfo := savingsRelayInfo("gpt-4o-mini")
		relayInfo.PriceData.AddOtherRatio("n", 2)

		result := buildTextSavingsEstimate(nil, relayInfo, savingsSummary(100))

		require.Nil(t, result.Estimate)
		require.Equal(t, SavingsSkipUnknownExtraRatio, result.SkipReason)
	})

	t.Run("tool surcharges", func(t *testing.T) {
		summary := savingsSummary(100)
		summary.ToolSurchargeItems = []ToolSurchargeItem{{
			Name:  "web_search",
			Count: 1,
			Price: 10,
		}}

		result := buildTextSavingsEstimate(nil, savingsRelayInfo("gpt-4o-mini"), summary)

		require.Nil(t, result.Estimate)
		require.Equal(t, SavingsSkipUnknownExtraRatio, result.SkipReason)
	})
}

func TestBuildTextSavingsEstimateSupportsTieredActualAndOfficialPricing(t *testing.T) {
	configureSavingsSetting(t, map[string]savings_setting.OfficialPrice{
		"gpt-4o-mini": {
			BillingMode:       "tiered_expr",
			BillingExpr:       `tier("base", p * 2 + c * 4)`,
			Source:            "OpenAI",
			OfficialConfirmed: true,
		},
	})
	relayInfo := savingsRelayInfo("gpt-4o-mini")
	relayInfo.TieredBillingSnapshot = &billingexpr.BillingSnapshot{BillingMode: "tiered_expr"}

	result := buildTextSavingsEstimate(nil, relayInfo, savingsSummary(40))

	require.Empty(t, result.SkipReason)
	require.NotNil(t, result.Estimate)
	require.Equal(t, 120, result.Estimate.OfficialQuota)
	require.Equal(t, 40, result.Estimate.ActualQuota)
	require.Equal(t, 80, result.Estimate.SavingsQuota)
	require.Equal(t, "tiered_expr", result.Estimate.PricingMode)
}

func TestBuildTextSavingsEstimateRejectsRequestDependentOfficialExpression(t *testing.T) {
	configureSavingsSetting(t, map[string]savings_setting.OfficialPrice{
		"gpt-4o-mini": {
			BillingMode:       "tiered_expr",
			BillingExpr:       `tier("base", p * 2 + c * 4) * (header("x-fast") == "1" ? 2 : 1)`,
			Source:            "OpenAI",
			OfficialConfirmed: true,
		},
	})

	result := buildTextSavingsEstimate(nil, savingsRelayInfo("gpt-4o-mini"), savingsSummary(40))

	require.Nil(t, result.Estimate)
	require.Equal(t, SavingsSkipUnsupportedBillingMode, result.SkipReason)
}

func TestBuildTextSavingsEstimateNeverReturnsNegativeSavings(t *testing.T) {
	configureSavingsSetting(t, map[string]savings_setting.OfficialPrice{
		"gpt-4o-mini": {
			ModelRatio:        float64Ptr(1),
			CompletionRatio:   float64Ptr(1),
			SourceUpdatedAt:   1_700_000_000,
			OfficialConfirmed: true,
		},
	})

	result := buildTextSavingsEstimate(nil, savingsRelayInfo("gpt-4o-mini"), savingsSummary(500))

	require.NotNil(t, result.Estimate)
	require.Equal(t, 110, result.Estimate.OfficialQuota)
	require.Equal(t, 500, result.Estimate.ActualQuota)
	require.Equal(t, 0, result.Estimate.SavingsQuota)
}

func TestSavingsEstimateFromOtherRejectsInvalidPayloads(t *testing.T) {
	require.Nil(t, savingsEstimateFromOther(""))
	require.Nil(t, savingsEstimateFromOther("{bad json"))
	require.Nil(t, savingsEstimateFromOther(common.MapToJsonStr(map[string]any{
		"savings_estimate": SavingsEstimate{SchemaVersion: 999},
	})))
	require.Nil(t, savingsEstimateFromOther(common.MapToJsonStr(map[string]any{
		"savings_estimate": SavingsEstimate{
			SchemaVersion: savingsEstimateSchemaVersion,
			OfficialQuota: -1,
		},
	})))
	require.Nil(t, savingsEstimateFromOther(common.MapToJsonStr(map[string]any{
		"savings_estimate": SavingsEstimate{
			SchemaVersion: savingsEstimateSchemaVersion,
			OfficialQuota: 200,
			ActualQuota:   80,
			SavingsQuota:  121,
		},
	})))

	other := common.MapToJsonStr(map[string]any{
		"savings_estimate": SavingsEstimate{
			SchemaVersion: savingsEstimateSchemaVersion,
			OfficialQuota: 200,
			ActualQuota:   80,
			SavingsQuota:  120,
		},
	})

	estimate := savingsEstimateFromOther(other)
	require.NotNil(t, estimate)
	require.Equal(t, 120, estimate.SavingsQuota)
}

func TestMatchSavingsOfficialPriceUsesLocalPricingFallback(t *testing.T) {
	setting := savings_setting.Setting{
		LocalPricingOfficialConfirmed: true,
		RequireOfficialConfirmation:   true,
		OfficialPrices:                map[string]savings_setting.OfficialPrice{},
	}
	localPrices := map[string]savings_setting.OfficialPrice{
		"gpt-4o-mini": {
			ModelRatio:        float64Ptr(1),
			CompletionRatio:   float64Ptr(2),
			Source:            savingsSourceLocalPricing,
			PriceSnapshotAt:   1_700_000_000,
			OfficialConfirmed: true,
		},
	}

	price, matchedModel, skipReason := matchSavingsOfficialPriceCandidates(
		setting,
		[]string{"gpt-4o-mini"},
		localPrices,
		1_700_000_000,
	)

	require.Empty(t, skipReason)
	require.Equal(t, "gpt-4o-mini", matchedModel)
	require.Equal(t, savingsSourceLocalPricing, price.Source)
	require.NotEmpty(t, price.PriceFingerprint)
}

func TestSavingsPriceFingerprintTracksPricingFields(t *testing.T) {
	first := savings_setting.OfficialPrice{
		ModelRatio:      float64Ptr(1),
		CompletionRatio: float64Ptr(2),
	}
	second := first
	require.True(t, finalizeSavingsOfficialPrice(&first, "gpt-4o-mini"))
	require.True(t, finalizeSavingsOfficialPrice(&second, "gpt-4o-mini"))
	require.Equal(t, first.PriceFingerprint, second.PriceFingerprint)

	second.CompletionRatio = float64Ptr(3)
	require.True(t, finalizeSavingsOfficialPrice(&second, "gpt-4o-mini"))
	require.NotEqual(t, first.PriceFingerprint, second.PriceFingerprint)
}

func TestRebuildHistoricalSavingsEstimateRequiresActualQuotaMatch(t *testing.T) {
	setting := savings_setting.Setting{
		RequireOfficialConfirmation: true,
		OfficialPrices: map[string]savings_setting.OfficialPrice{
			"gpt-4o-mini": {
				ModelRatio:        float64Ptr(2),
				CompletionRatio:   float64Ptr(3),
				Source:            "OpenAI",
				OfficialConfirmed: true,
			},
		},
	}
	row := model.SavingsLogRow{
		ModelName:        "gpt-4o-mini",
		PromptTokens:     100,
		CompletionTokens: 11,
		Quota:            56,
		Other: common.MapToJsonStr(map[string]any{
			"model_ratio":      0.5,
			"group_ratio":      1.0,
			"completion_ratio": 1.0,
			"model_price":      -1.0,
			"cache_tokens":     0,
			"cache_ratio":      0.5,
		}),
	}

	result := rebuildHistoricalSavingsEstimate(setting, nil, row, 1_700_000_000)

	require.Empty(t, result.SkipReason)
	require.NotNil(t, result.Estimate)
	require.Equal(t, 266, result.Estimate.OfficialQuota)
	require.Equal(t, 56, result.Estimate.ActualQuota)
	require.Equal(t, 210, result.Estimate.SavingsQuota)
	require.Equal(t, savingsCalculationHistorical, result.Estimate.CalculationMode)

	row.Quota = 57
	result = rebuildHistoricalSavingsEstimate(setting, nil, row, 1_700_000_000)
	require.Nil(t, result.Estimate)
	require.Equal(t, SavingsSkipLegacyActualQuotaMismatch, result.SkipReason)
}

func TestRebuildHistoricalSavingsEstimateValidatesTieredLogSnapshot(t *testing.T) {
	setting := savings_setting.Setting{
		RequireOfficialConfirmation: true,
		OfficialPrices: map[string]savings_setting.OfficialPrice{
			"gpt-4o-mini": {
				BillingMode:       "tiered_expr",
				BillingExpr:       `tier("base", p * 2 + c * 4 + cr * 0.2)`,
				Source:            "OpenAI",
				OfficialConfirmed: true,
			},
		},
	}
	actualExpr := `tier("base", p * 1 + c * 2 + cr * 0.1)`
	row := model.SavingsLogRow{
		ModelName:        "gpt-4o-mini",
		PromptTokens:     100,
		CompletionTokens: 10,
		Quota:            26,
		Other: common.MapToJsonStr(map[string]any{
			"billing_mode": "tiered_expr",
			"expr_b64":     base64.StdEncoding.EncodeToString([]byte(actualExpr)),
			"group_ratio":  0.5,
			"cache_tokens": 20,
		}),
	}

	result := rebuildHistoricalSavingsEstimate(setting, nil, row, 1_700_000_000)

	require.Empty(t, result.SkipReason)
	require.NotNil(t, result.Estimate)
	require.Equal(t, 102, result.Estimate.OfficialQuota)
	require.Equal(t, 26, result.Estimate.ActualQuota)
	require.Equal(t, 76, result.Estimate.SavingsQuota)
	require.Equal(t, "tiered_expr", result.Estimate.PricingMode)

	row.Quota = 27
	result = rebuildHistoricalSavingsEstimate(setting, nil, row, 1_700_000_000)
	require.Nil(t, result.Estimate)
	require.Equal(t, SavingsSkipLegacyActualQuotaMismatch, result.SkipReason)
}

func TestRebuildHistoricalSavingsEstimateRejectsMissingBaseFields(t *testing.T) {
	result := rebuildHistoricalSavingsEstimate(
		savings_setting.Setting{},
		nil,
		model.SavingsLogRow{
			ModelName:        "gpt-4o-mini",
			PromptTokens:     100,
			CompletionTokens: 10,
			Quota:            55,
			Other:            `{}`,
		},
		1_700_000_000,
	)

	require.Nil(t, result.Estimate)
	require.Equal(t, SavingsSkipLegacyMissingBaseFields, result.SkipReason)
}

func TestNormalizeSavingsSummaryWindowClampsSmallClockSkew(t *testing.T) {
	now := time.Now().Unix()
	effectiveEnd, err := NormalizeSavingsSummaryWindow(now-3600, now+60)

	require.NoError(t, err)
	require.InDelta(t, time.Now().Unix(), effectiveEnd, 1)

	_, err = NormalizeSavingsSummaryWindow(now-3600, now+5*60+10)
	require.EqualError(t, err, "结束时间不能晚于当前时间")
}

func TestBuildSavingsTrendBucketsAlignsToLocalCalendar(t *testing.T) {
	const (
		localOffsetMinutes = 8 * 60
		localMidnightUTC   = int64(1_785_081_600)
	)
	start := localMidnightUTC + 30*60
	end := localMidnightUTC + 2*24*3600 + 30*60

	buckets, bucketSize, err := buildSavingsTrendBuckets(
		start,
		end,
		SavingsTrendGranularityDay,
		localOffsetMinutes,
	)

	require.NoError(t, err)
	require.Equal(t, int64(24*3600), bucketSize)
	require.Len(t, buckets, 3)
	require.Equal(t, localMidnightUTC, buckets[0].StartTimestamp)
	require.Equal(t, localMidnightUTC+3*24*3600, buckets[2].EndTimestamp)
}

func TestBuildSavingsTrendBucketsRejectsInvalidBoundaries(t *testing.T) {
	_, _, err := buildSavingsTrendBuckets(1_000, 2_000, "minute", 0)
	require.EqualError(t, err, "趋势粒度无效")

	_, _, err = buildSavingsTrendBuckets(1_000, 2_000, SavingsTrendGranularityHour, 841)
	require.EqualError(t, err, "时区偏移无效")

	_, _, err = buildSavingsTrendBuckets(1_000, 1_000+49*3600, SavingsTrendGranularityHour, 0)
	require.EqualError(t, err, "小时粒度最多查询 48 小时")
}

func TestSavingsTrendAggregationPreservesPerRequestNonNegativeSavings(t *testing.T) {
	summary := &SavingsSummary{RequestCount: 2, Source: "official_snapshot"}
	accumulator := newSavingsSummaryAccumulator(summary, 1_700_000_000, 90)
	bucket := SavingsTrendBucket{RequestCount: 2}
	results := []savingsLogEstimate{
		{
			Estimate: &SavingsEstimate{
				OfficialQuota:     100,
				ActualQuota:       40,
				SavingsQuota:      60,
				Source:            savingsSourceLocalPricing,
				OfficialConfirmed: true,
			},
			CalculationMode: savingsCalculationSnapshot,
		},
		{
			Estimate: &SavingsEstimate{
				OfficialQuota:     50,
				ActualQuota:       80,
				SavingsQuota:      0,
				Source:            savingsSourceOfficialOverride,
				OfficialConfirmed: true,
			},
			CalculationMode: savingsCalculationHistorical,
		},
	}

	for _, result := range results {
		require.NoError(t, accumulator.add(result))
		require.NoError(t, addSavingsTrendBucket(&bucket, result))
	}
	accumulator.finish()
	bucket.CoverageRatio = float64(bucket.EstimatedRequestCount) / float64(bucket.RequestCount)

	require.Equal(t, int64(150), summary.OfficialQuota)
	require.Equal(t, int64(120), summary.ActualQuota)
	require.Equal(t, int64(60), summary.SavingsQuota)
	require.NotEqual(t, summary.OfficialQuota-summary.ActualQuota, summary.SavingsQuota)
	require.Equal(t, int64(1), summary.SnapshotRequestCount)
	require.Equal(t, int64(1), summary.ReconstructedRequestCount)
	require.Equal(t, savingsSourceMixed, summary.Source)
	require.Equal(t, float64(1), summary.CoverageRatio)
	require.Equal(t, summary.OfficialQuota, bucket.OfficialQuota)
	require.Equal(t, summary.ActualQuota, bucket.ActualQuota)
	require.Equal(t, summary.SavingsQuota, bucket.SavingsQuota)
	require.Equal(t, float64(1), bucket.CoverageRatio)
}

func TestNormalizeSavingsTrendWindowValidatesGranularityAndClockSkew(t *testing.T) {
	now := time.Now().Unix()
	effectiveEnd, err := NormalizeSavingsTrendWindow(
		now-24*3600,
		now+60,
		SavingsTrendGranularityHour,
		8*60,
	)

	require.NoError(t, err)
	require.InDelta(t, time.Now().Unix(), effectiveEnd, 1)

	_, err = NormalizeSavingsTrendWindow(now-3600, now, "minute", 8*60)
	require.EqualError(t, err, "趋势粒度无效")
}

func configureSavingsSetting(t *testing.T, prices map[string]savings_setting.OfficialPrice) {
	t.Helper()
	require.NoError(t, savings_setting.UpdateSettingByJSONString(""))
	t.Cleanup(func() { require.NoError(t, savings_setting.UpdateSettingByJSONString("")) })

	value := savings_setting.Setting{
		Enabled:                       true,
		ShowOnDashboard:               true,
		ShowOnUsageLogs:               true,
		LocalPricingOfficialConfirmed: false,
		RebuildLegacyLogs:             true,
		RequireOfficialConfirmation:   true,
		OfficialPriceStaleDays:        90,
		MaxSummaryDays:                31,
		MaxSummaryLogRows:             50000,
		OfficialPrices:                prices,
	}
	jsonBytes, err := common.Marshal(value)
	require.NoError(t, err)
	require.NoError(t, savings_setting.UpdateSettingByJSONString(string(jsonBytes)))
}

func savingsRelayInfo(model string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: model,
		PriceData: types.PriceData{
			ModelRatio:      0.5,
			CompletionRatio: 1,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
		StartTime: time.Now(),
	}
}

func savingsSummary(actualQuota int) textQuotaSummary {
	return textQuotaSummary{
		PromptTokens:     100,
		CompletionTokens: 10,
		TotalTokens:      110,
		Quota:            actualQuota,
		ModelName:        "gpt-4o-mini",
	}
}

func float64Ptr(value float64) *float64 {
	return &value
}
