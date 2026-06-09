package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupQueryKeyReportModelTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	previousDB := DB
	previousLogDB := LOG_DB
	previousUsingSQLite := common.UsingSQLite
	previousUsingMySQL := common.UsingMySQL
	previousUsingPostgreSQL := common.UsingPostgreSQL
	previousRedisEnabled := common.RedisEnabled

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	initCol()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	LOG_DB = db
	require.NoError(t, db.AutoMigrate(&Channel{}, &ChannelPreparation{}))

	t.Cleanup(func() {
		DB = previousDB
		LOG_DB = previousLogDB
		common.UsingSQLite = previousUsingSQLite
		common.UsingMySQL = previousUsingMySQL
		common.UsingPostgreSQL = previousUsingPostgreSQL
		common.RedisEnabled = previousRedisEnabled
		initCol()

		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func quotaUnits(units int64) int64 {
	return int64(common.QuotaPerUnit) * units
}

func reportItemByKey(t *testing.T, report *QueryKeyReport, key string) QueryKeyReportItem {
	t.Helper()
	for _, item := range report.Items {
		if item.Key == key {
			return item
		}
	}
	t.Fatalf("missing report item for key %q", key)
	return QueryKeyReportItem{}
}

func TestBuildChannelQueryKeyReportAggregatesDuplicateRowsAndSharedMultiKeyBalance(t *testing.T) {
	setupQueryKeyReportModelTestDB(t)

	channels := []Channel{
		{Id: 1, Type: 1, Key: "sk-repeat", Name: "repeat low balance", Status: common.ChannelStatusEnabled, Group: "default", Models: "gpt-4o", UsedQuota: quotaUnits(4), Balance: 5},
		{Id: 2, Type: 1, Key: "sk-repeat", Name: "repeat high balance", Status: common.ChannelStatusEnabled, Group: "default", Models: "gpt-4o", UsedQuota: quotaUnits(3), Balance: 6},
		{Id: 3, Type: 2, Key: "sk-shared-a\nsk-shared-b", Name: "shared multi", Status: common.ChannelStatusEnabled, Group: "default", Models: "gpt-4o-mini", UsedQuota: quotaUnits(6), Balance: 10},
	}
	require.NoError(t, DB.Create(&channels).Error)

	report, err := BuildChannelQueryKeyReport([]string{" sk-repeat ", "sk-missing", "sk-shared-a", "sk-shared-b", "sk-repeat", ""})
	require.NoError(t, err)

	require.Equal(t, 5, report.TotalInput)
	require.Equal(t, 4, report.UniqueKeys)
	require.Equal(t, 1, report.DuplicateCount)
	require.Equal(t, 3, report.FoundCount)
	require.Equal(t, 1, report.NotFoundCount)
	require.Equal(t, 3, report.OverBrushedCount)
	require.Equal(t, quotaUnits(19), report.TotalUsedQuota)
	require.InDelta(t, 19, report.TotalUsedAmount, 0.000001)
	require.InDelta(t, 16, report.TotalOriginalAmount, 0.000001)
	require.InDelta(t, -3, report.TotalCurrentAmount, 0.000001)
	require.InDelta(t, 3, report.TotalOverBrushAmount, 0.000001)

	repeat := reportItemByKey(t, report, "sk-repeat")
	require.True(t, repeat.Found)
	require.Equal(t, QueryKeyReportStatusOverBrushed, repeat.Status)
	require.Equal(t, 2, repeat.ChannelCount)
	require.Equal(t, quotaUnits(7), repeat.UsedQuota)
	require.InDelta(t, 7, repeat.UsedAmount, 0.000001)
	require.InDelta(t, 6, repeat.OriginalAmount, 0.000001)
	require.InDelta(t, -1, repeat.CurrentAmount, 0.000001)
	require.InDelta(t, 1, repeat.OverBrushAmount, 0.000001)
	require.False(t, repeat.OriginalAmountShared)

	missing := reportItemByKey(t, report, "sk-missing")
	require.False(t, missing.Found)
	require.Equal(t, QueryKeyReportStatusNotFound, missing.Status)
	require.Equal(t, 0, missing.ChannelCount)

	sharedA := reportItemByKey(t, report, "sk-shared-a")
	require.True(t, sharedA.Found)
	require.Equal(t, QueryKeyReportStatusOverBrushed, sharedA.Status)
	require.True(t, sharedA.OriginalAmountShared)
	require.InDelta(t, 10, sharedA.OriginalAmount, 0.000001)
	require.InDelta(t, -2, sharedA.CurrentAmount, 0.000001)
	require.InDelta(t, 2, sharedA.OverBrushAmount, 0.000001)
	require.Len(t, sharedA.Channels, 1)
	require.Equal(t, 2, sharedA.Channels[0].MatchedKeyCount)
	require.Equal(t, quotaUnits(12), sharedA.Channels[0].MatchedUsedQuota)
	require.InDelta(t, 12, sharedA.Channels[0].MatchedUsedAmount, 0.000001)
	require.InDelta(t, 10, sharedA.Channels[0].OriginalAmount, 0.000001)
	require.InDelta(t, -2, sharedA.Channels[0].CurrentAmount, 0.000001)
	require.InDelta(t, 2, sharedA.Channels[0].OverBrushAmount, 0.000001)

	sharedB := reportItemByKey(t, report, "sk-shared-b")
	require.True(t, sharedB.OriginalAmountShared)
	require.InDelta(t, 10, sharedB.OriginalAmount, 0.000001)
}

func TestBuildChannelQueryKeyReportIncludesChannelPreparations(t *testing.T) {
	setupQueryKeyReportModelTestDB(t)

	preparations := []ChannelPreparation{
		{Id: 20, Type: 2, Key: "sk-prep", Name: "prep single", Status: ChannelPreparationStatusPending, Group: "svip", Models: "claude-3", Balance: 20, UpdatedTime: 1717488000},
		{Id: 21, Type: 2, Key: "sk-prep-a\nsk-prep-b", Name: "prep multi", Status: ChannelPreparationStatusPending, Group: "default", Models: "claude-3", Balance: 9, UpdatedTime: 1717489000},
	}
	require.NoError(t, DB.Create(&preparations).Error)

	report, err := BuildChannelQueryKeyReport([]string{"sk-prep", "sk-prep-a", "sk-prep-b", "sk-missing"})
	require.NoError(t, err)

	require.Equal(t, 3, report.FoundCount)
	require.Equal(t, 1, report.NotFoundCount)
	require.Equal(t, int64(0), report.TotalUsedQuota)
	require.InDelta(t, 0, report.TotalUsedAmount, 0.000001)
	require.InDelta(t, 29, report.TotalOriginalAmount, 0.000001)
	require.InDelta(t, 29, report.TotalCurrentAmount, 0.000001)
	require.InDelta(t, 0, report.TotalOverBrushAmount, 0.000001)

	prep := reportItemByKey(t, report, "sk-prep")
	require.True(t, prep.Found)
	require.Equal(t, QueryKeyReportStatusFound, prep.Status)
	require.Equal(t, 1, prep.ChannelCount)
	require.Equal(t, int64(0), prep.UsedQuota)
	require.InDelta(t, 20, prep.OriginalAmount, 0.000001)
	require.InDelta(t, 20, prep.CurrentAmount, 0.000001)
	require.Equal(t, QueryKeyReportSourcePreparation, prep.Channels[0].Source)
	require.Equal(t, ChannelPreparationStatusPending, prep.Channels[0].Status)
	require.Equal(t, int64(1717488000), prep.Channels[0].BalanceUpdatedTime)

	multi := reportItemByKey(t, report, "sk-prep-a")
	require.True(t, multi.Found)
	require.True(t, multi.OriginalAmountShared)
	require.Len(t, multi.Channels, 1)
	require.Equal(t, QueryKeyReportSourcePreparation, multi.Channels[0].Source)
	require.Equal(t, 2, multi.Channels[0].MatchedKeyCount)
	require.InDelta(t, 9, multi.Channels[0].OriginalAmount, 0.000001)
	require.InDelta(t, 9, multi.Channels[0].CurrentAmount, 0.000001)
}

func TestBuildChannelQueryKeyReportMatchesMultiKeyFormatsAndSanitizesDetails(t *testing.T) {
	setupQueryKeyReportModelTestDB(t)

	channels := []Channel{
		{Id: 10, Type: 1, Key: "sk-newline\nsk-dup\nsk-dup", Name: "newline multi", Status: common.ChannelStatusEnabled, Group: "default", Models: "gpt-4o", UsedQuota: quotaUnits(1), Balance: 3},
		{Id: 11, Type: 2, Key: `[
			"sk-json-string",
			{"b":2,"a":"x"}
		]`, Name: "json multi", Status: common.ChannelStatusEnabled, Group: "default", Models: "claude-3", UsedQuota: quotaUnits(2), Balance: 10},
	}
	require.NoError(t, DB.Create(&channels).Error)

	report, err := BuildChannelQueryKeyReport([]string{"sk-newline", "sk-dup", "sk-json-string", `{ "a": "x", "b": 2 }`})
	require.NoError(t, err)

	require.Equal(t, 4, report.FoundCount)
	require.Equal(t, 0, report.NotFoundCount)

	newline := reportItemByKey(t, report, "sk-newline")
	require.Len(t, newline.Channels, 1)
	require.True(t, newline.Channels[0].IsMultiKey)
	require.Equal(t, 2, newline.Channels[0].MatchedKeyCount)
	require.True(t, newline.OriginalAmountShared)

	dup := reportItemByKey(t, report, "sk-dup")
	require.Len(t, dup.Channels, 1)
	require.Equal(t, 1, dup.ChannelCount)

	jsonString := reportItemByKey(t, report, "sk-json-string")
	require.True(t, jsonString.OriginalAmountShared)
	require.Len(t, jsonString.Channels, 1)
	require.Equal(t, 2, jsonString.Channels[0].MatchedKeyCount)

	object := reportItemByKey(t, report, `{ "a": "x", "b": 2 }`)
	require.True(t, object.Found)
	require.True(t, object.OriginalAmountShared)

	detailBytes, err := common.Marshal(jsonString.Channels[0])
	require.NoError(t, err)
	detailJSON := string(detailBytes)
	require.NotContains(t, detailJSON, "sk-json-string")
	require.NotContains(t, detailJSON, "sk-dup")
	require.NotContains(t, detailJSON, "\"key\"")
}

func TestBuildChannelQueryKeyReportRejectsEmptyAndTooManyUniqueKeys(t *testing.T) {
	setupQueryKeyReportModelTestDB(t)

	_, err := BuildChannelQueryKeyReport([]string{"", "   "})
	require.Error(t, err)
	require.Contains(t, err.Error(), "keys")

	keys := make([]string, MaxQueryKeyReportKeys+1)
	for i := range keys {
		keys[i] = fmt.Sprintf("sk-%05d", i)
	}
	_, err = BuildChannelQueryKeyReport(keys)
	require.Error(t, err)
	require.Contains(t, err.Error(), "10000")
}
