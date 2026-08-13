package model

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestRecordUpstreamCostFromLogIsIdempotentAndAggregated(t *testing.T) {
	previousDB := DB
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	db, err := gorm.Open(sqlite.Open("file:upstream_cost_ledger?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	initCol()
	t.Cleanup(func() {
		DB = previousDB
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		initCol()
	})
	require.NoError(t, db.AutoMigrate(&UpstreamCostRecord{}))

	log := &Log{
		RequestId:         "req-cost-1",
		UpstreamRequestId: "upstream-1",
		CreatedAt:         100,
		UserId:            9,
		Username:          "admin",
		TokenName:         "Nexa",
		Group:             "codex",
		ChannelId:         36,
		ModelName:         "gpt-5.6-sol",
	}
	snapshot := &dto.UpstreamCostSnapshot{
		Status:                dto.UpstreamCostStatusSettled,
		Mode:                  dto.UpstreamCostModeBillingUnits,
		Source:                dto.UpstreamCostSourceBillingUnits,
		NativeUnit:            "CREDIT",
		NativeAmount:          0.011682,
		NativeAmountDecimal:   "0.011682",
		RateCNYPerUnit:        0.495,
		RateCNYPerUnitDecimal: "0.495",
		AmountCNYMicros:       5783,
		Estimated:             true,
		PriceVersion:          "yunwu-2026-07",
		SettlementCurrency:    "CNY",
	}
	other := map[string]interface{}{
		"admin_info": map[string]interface{}{"upstream_cost": snapshot},
	}

	require.NoError(t, RecordUpstreamCostFromLog(log, other))
	require.NoError(t, RecordUpstreamCostFromLog(log, other))

	unpricedLog := *log
	unpricedLog.RequestId = "req-cost-2"
	unpricedSnapshot := &dto.UpstreamCostSnapshot{
		Status:             dto.UpstreamCostStatusUnpriced,
		Mode:               dto.UpstreamCostModeBillingUnits,
		Reason:             "missing_channel_cost_profile",
		NativeUnit:         "UNIT",
		PriceVersion:       "manual",
		SettlementCurrency: "CNY",
	}
	require.NoError(t, RecordUpstreamCostFromLog(&unpricedLog, map[string]interface{}{
		"admin_info": map[string]interface{}{"upstream_cost": unpricedSnapshot},
	}))

	var recordCount int64
	require.NoError(t, db.Model(&UpstreamCostRecord{}).Count(&recordCount).Error)
	assert.Equal(t, int64(2), recordCount)
	var settledRecord UpstreamCostRecord
	require.NoError(t, db.Where("request_id = ?", "req-cost-1").First(&settledRecord).Error)
	assert.Equal(t, int64(5783), settledRecord.AmountCNYMicros)
	assert.Equal(t, "0.011682", settledRecord.NativeAmount)
	assert.Equal(t, "0.495", settledRecord.RateCNYPerUnit)

	stat, err := GetUpstreamCostStat(
		0,
		0,
		"gpt-5.6-sol",
		"admin",
		"Nexa",
		"codex",
		"",
		"upstream-1",
		36,
	)
	require.NoError(t, err)
	assert.Equal(t, int64(1), stat.SettledRequests)
	assert.Equal(t, int64(1), stat.UnpricedRequests)
	assert.Equal(t, int64(1), stat.EstimatedRequests)
	assert.Equal(t, int64(5783), stat.AmountCNYMicros)
}

func TestRecordConsumeLogKeepsCostLedgerWhenUsageLogsAreDisabled(t *testing.T) {
	previousDB := DB
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousLogConsumeEnabled := common.LogConsumeEnabled
	db, err := gorm.Open(sqlite.Open("file:upstream_cost_without_usage_log?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.LogConsumeEnabled = false
	initCol()
	t.Cleanup(func() {
		DB = previousDB
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		common.LogConsumeEnabled = previousLogConsumeEnabled
		initCol()
	})
	require.NoError(t, db.AutoMigrate(&UpstreamCostRecord{}))

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("username", "admin")
	snapshot := &dto.UpstreamCostSnapshot{
		Status:             dto.UpstreamCostStatusUnpriced,
		Mode:               dto.UpstreamCostModeBillingUnits,
		Reason:             "missing_channel_cost_profile",
		NativeUnit:         "UNIT",
		PriceVersion:       "manual",
		SettlementCurrency: "CNY",
	}
	RecordConsumeLog(ctx, 9, RecordConsumeLogParams{
		ChannelId: 36,
		ModelName: "gpt-5.6-sol",
		TokenName: "Nexa",
		Group:     "codex",
		Other: map[string]interface{}{
			"admin_info": map[string]interface{}{"upstream_cost": snapshot},
		},
	})

	var record UpstreamCostRecord
	require.NoError(t, db.First(&record).Error)
	assert.Equal(t, dto.UpstreamCostStatusUnpriced, record.Status)
	assert.Equal(t, "admin", record.Username)
}
