package service

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/savings_setting"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSavingsLifetimeServiceTest(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	previousType := common.MainDatabaseType()
	previousQuotaPerUnit := common.QuotaPerUnit
	previousRate := operation_setting.USDExchangeRate
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.SavingsLifetimeEvent{},
		&model.SavingsLifetimeDaily{},
		&model.SavingsLifetimeTotal{},
		&model.SystemTask{},
	))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.QuotaPerUnit = 500_000
	operation_setting.USDExchangeRate = 7.25
	require.NoError(t, savings_setting.UpdateSettingByJSONString(`{"enabled":true,"lifetime_enabled":true,"lifetime_show_on_dashboard":false,"lifetime_show_on_wallet":true}`))
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.QuotaPerUnit = previousQuotaPerUnit
		operation_setting.USDExchangeRate = previousRate
		require.NoError(t, savings_setting.UpdateSettingByJSONString(""))
	})
}

func TestAttachSavingsLifetimeSnapshotFreezesCurrencyInputs(t *testing.T) {
	setupSavingsLifetimeServiceTest(t)
	estimate := &SavingsEstimate{SavingsQuota: 1_000_000}

	attachSavingsLifetimeSnapshot(estimate, "savg_test")

	assert.Equal(t, "savg_test", estimate.AggregationKey)
	assert.Equal(t, int64(500_000), estimate.QuotaPerUnit)
	assert.Equal(t, int64(7_250_000), estimate.USDCNYRateMicros)
	assert.Equal(t, "14500000", estimate.SavingsCNYMicros)
}

func TestRecordSavingsLifetimeLogCreatesEstimatedAndSkippedEvents(t *testing.T) {
	setupSavingsLifetimeServiceTest(t)
	estimate := SavingsEstimate{
		SchemaVersion:     savingsEstimateSchemaVersion,
		OfficialQuota:     500,
		ActualQuota:       100,
		SavingsQuota:      400,
		Estimated:         true,
		AggregationKey:    "savg_estimated",
		QuotaPerUnit:      500_000,
		USDCNYRateMicros:  7_250_000,
		SavingsCNYMicros:  "5800",
		PriceSnapshotAt:   1_700_000_000,
		PriceFingerprint:  "price-v1",
		OfficialConfirmed: true,
	}
	require.NoError(t, RecordSavingsLifetimeLog(&model.Log{
		Id:        11,
		UserId:    7,
		CreatedAt: 1_785_081_610,
		Other: common.MapToJsonStr(map[string]any{
			"savings_aggregation_key": "savg_estimated",
			"savings_estimate":        estimate,
		}),
	}))
	require.NoError(t, RecordSavingsLifetimeLog(&model.Log{
		Id:        12,
		UserId:    7,
		CreatedAt: 1_785_081_620,
		Other: common.MapToJsonStr(map[string]any{
			"savings_aggregation_key": "savg_skipped",
			"admin_info": map[string]any{
				"savings_skip_reason": SavingsSkipMissingOfficialPrice,
			},
		}),
	}))
	require.NoError(t, RecordSavingsLifetimeLog(&model.Log{
		Id:        11,
		UserId:    7,
		CreatedAt: 1_785_081_610,
		Other: common.MapToJsonStr(map[string]any{
			"savings_aggregation_key": "savg_estimated",
			"savings_estimate":        estimate,
		}),
	}))

	var events []model.SavingsLifetimeEvent
	require.NoError(t, model.DB.Order("log_id asc").Find(&events).Error)
	require.Len(t, events, 2)
	assert.Equal(t, model.SavingsLifetimeCoverageEstimated, events[0].CoverageState)
	assert.Equal(t, int64(5_800), events[0].SavingsCNYMicros)
	assert.Equal(t, model.SavingsLifetimeCoverageSkipped, events[1].CoverageState)
	assert.Equal(t, SavingsSkipMissingOfficialPrice, events[1].SkipReason)
}

func TestGetUserSavingsLifetimeSummarySeparatesFeatureAndPlacementFlags(t *testing.T) {
	setupSavingsLifetimeServiceTest(t)
	require.NoError(t, model.DB.Create(&model.SavingsLifetimeTotal{
		UserID:                7,
		SavingsCNYMicros:      12_345_678,
		RequestCount:          4,
		EstimatedRequestCount: 3,
		StatisticsStartedAt:   1_700_000_000,
		LastAggregatedAt:      1_700_000_100,
	}).Error)

	summary, err := GetUserSavingsLifetimeSummary(7)

	require.NoError(t, err)
	assert.True(t, summary.Enabled)
	assert.False(t, summary.ShowOnDashboard)
	assert.True(t, summary.ShowOnWallet)
	assert.Equal(t, "12345678", summary.SavingsCNYMicros)
	assert.Equal(t, 0.75, summary.CoverageRatio)
}

func TestValidateSavingsLifetimeBackfillPayloadRejectsChangedSnapshot(t *testing.T) {
	prices := map[string]savings_setting.OfficialPrice{
		"gpt-4o-mini": {OfficialConfirmed: true},
	}
	data, err := common.Marshal(prices)
	require.NoError(t, err)
	hash := sha256.Sum256(data)
	payload := SavingsLifetimeBackfillPayload{
		Setting:             savings_setting.Setting{OfficialPrices: prices},
		PricingSnapshotHash: hex.EncodeToString(hash[:]),
		QuotaPerUnit:        500_000,
		USDCNYRateMicros:    7_250_000,
	}

	require.NoError(t, validateSavingsLifetimeBackfillPayload(payload))
	payload.Setting.OfficialPrices["gpt-4o-mini"] = savings_setting.OfficialPrice{Source: "changed"}
	require.ErrorContains(t, validateSavingsLifetimeBackfillPayload(payload), "hash mismatch")
	payload.QuotaPerUnit = 0
	require.ErrorContains(t, validateSavingsLifetimeBackfillPayload(payload), "currency snapshot")
}

func TestSavingsLifetimeCompensationRecoversMissingEventIdempotently(t *testing.T) {
	setupSavingsLifetimeServiceTest(t)
	previousLogDB := model.LOG_DB
	previousLogType := common.LogDatabaseType()
	previousCursor := savingsLifetimeCompensationCursor
	logDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, logDB.AutoMigrate(&model.Log{}))
	model.LOG_DB = logDB
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	savingsLifetimeCompensationCursor = model.SavingsLifetimeLogCursor{}
	t.Cleanup(func() {
		model.LOG_DB = previousLogDB
		common.SetLogDatabaseType(previousLogType)
		savingsLifetimeCompensationCursor = previousCursor
	})

	estimate := SavingsEstimate{
		SchemaVersion:     savingsEstimateSchemaVersion,
		OfficialQuota:     500,
		ActualQuota:       100,
		SavingsQuota:      400,
		Estimated:         true,
		AggregationKey:    "savg_compensation",
		QuotaPerUnit:      500_000,
		USDCNYRateMicros:  7_250_000,
		SavingsCNYMicros:  "5800",
		OfficialConfirmed: true,
	}
	require.NoError(t, logDB.Create(&model.Log{
		Id:        100,
		UserId:    7,
		Type:      model.LogTypeConsume,
		CreatedAt: common.GetTimestamp(),
		RequestId: "req-compensation",
		Other: common.MapToJsonStr(map[string]any{
			"savings_aggregation_key": "savg_compensation",
			"savings_estimate":        estimate,
		}),
	}).Error)

	require.NoError(t, compensateSavingsLifetimeEvents())
	require.NoError(t, compensateSavingsLifetimeEvents())
	var count int64
	require.NoError(t, model.DB.Model(&model.SavingsLifetimeEvent{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}
