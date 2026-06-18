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

func setupChannelPreparationModelTestDB(t *testing.T) *gorm.DB {
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
	require.NoError(t, db.AutoMigrate(&ChannelPreparation{}))

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

func TestChannelPreparationUpdateResponseTimeOnlyTouchesTestFields(t *testing.T) {
	setupChannelPreparationModelTestDB(t)

	preparation := ChannelPreparation{
		Type:         1,
		Key:          "sk-test",
		Name:         "candidate",
		Status:       ChannelPreparationStatusPending,
		Group:        "default",
		UpdatedTime:  12345,
		TestTime:     111,
		ResponseTime: 222,
	}
	require.NoError(t, DB.Create(&preparation).Error)

	before := common.GetTimestamp()
	preparation.UpdateResponseTime(3456)

	var got ChannelPreparation
	require.NoError(t, DB.First(&got, "id = ?", preparation.Id).Error)
	require.Equal(t, 3456, got.ResponseTime)
	require.Equal(t, ChannelPreparationTestStatusSuccess, got.TestStatus)
	require.Empty(t, got.TestMessage)
	require.GreaterOrEqual(t, got.TestTime, before)
	require.LessOrEqual(t, got.TestTime, common.GetTimestamp())
	require.Equal(t, ChannelPreparationStatusPending, got.Status)
	require.Equal(t, "sk-test", got.Key)
	require.Equal(t, int64(12345), got.UpdatedTime)
}

func TestChannelPreparationUpdateTestResultStoresFailure(t *testing.T) {
	setupChannelPreparationModelTestDB(t)

	preparation := ChannelPreparation{
		Type:   1,
		Key:    "sk-test",
		Name:   "candidate",
		Status: ChannelPreparationStatusPending,
		Group:  "default",
	}
	require.NoError(t, DB.Create(&preparation).Error)

	before := common.GetTimestamp()
	preparation.UpdateTestResult(789, ChannelPreparationTestStatusFailed, "upstream timeout")

	var got ChannelPreparation
	require.NoError(t, DB.First(&got, "id = ?", preparation.Id).Error)
	require.Equal(t, 789, got.ResponseTime)
	require.Equal(t, ChannelPreparationTestStatusFailed, got.TestStatus)
	require.Equal(t, "upstream timeout", got.TestMessage)
	require.GreaterOrEqual(t, got.TestTime, before)
	require.LessOrEqual(t, got.TestTime, common.GetTimestamp())
}

func TestChannelPreparationNormalizePreservesAndResetsTestFields(t *testing.T) {
	existing := &ChannelPreparation{
		Id:           7,
		Status:       ChannelPreparationStatusPending,
		CreatedTime:  100,
		UpdatedTime:  200,
		Key:          "existing-key",
		Group:        "vip",
		TestTime:     300,
		ResponseTime: 456,
		TestStatus:   ChannelPreparationTestStatusFailed,
		TestMessage:  "previous failure",
	}
	input := ChannelPreparation{Key: "", Group: ""}
	input.NormalizeForUpdate(existing)
	require.Equal(t, existing.Id, input.Id)
	require.Equal(t, existing.Key, input.Key)
	require.Equal(t, int64(300), input.TestTime)
	require.Equal(t, 456, input.ResponseTime)
	require.Equal(t, ChannelPreparationTestStatusFailed, input.TestStatus)
	require.Equal(t, "previous failure", input.TestMessage)

	createInput := ChannelPreparation{
		TestTime:     300,
		ResponseTime: 456,
		TestStatus:   ChannelPreparationTestStatusFailed,
		TestMessage:  "previous failure",
	}
	createInput.NormalizeForCreate()
	require.Zero(t, createInput.TestTime)
	require.Zero(t, createInput.ResponseTime)
	require.Equal(t, ChannelPreparationTestStatusUntested, createInput.TestStatus)
	require.Empty(t, createInput.TestMessage)
}

func TestChannelPreparationResponseAndToChannelIncludeTestFields(t *testing.T) {
	preparation := ChannelPreparation{
		Type:         1,
		Key:          "sk-test",
		Name:         "candidate",
		Group:        "default",
		TestTime:     300,
		ResponseTime: 456,
		TestStatus:   ChannelPreparationTestStatusFailed,
		TestMessage:  "failed",
	}

	response := preparation.ToResponse()
	require.Equal(t, int64(300), response.TestTime)
	require.Equal(t, 456, response.ResponseTime)
	require.Equal(t, ChannelPreparationTestStatusFailed, response.TestStatus)
	require.Equal(t, "failed", response.TestMessage)

	channel := preparation.ToChannel()
	require.Equal(t, int64(300), channel.TestTime)
	require.Equal(t, 456, channel.ResponseTime)
}

func TestGetChannelPreparationsFiltersGroupByExactToken(t *testing.T) {
	setupChannelPreparationModelTestDB(t)

	preparations := []ChannelPreparation{
		{Id: 1, Type: 1, Key: "sk-vip", Name: "vip only", Status: ChannelPreparationStatusPending, Group: "vip", Balance: 10},
		{Id: 2, Type: 1, Key: "sk-svip", Name: "svip only", Status: ChannelPreparationStatusPending, Group: "svip", Balance: 20},
		{Id: 3, Type: 1, Key: "sk-default-vip", Name: "default vip", Status: ChannelPreparationStatusPending, Group: "default,vip", Balance: 30},
		{Id: 4, Type: 1, Key: "sk-vip2", Name: "vip2 only", Status: ChannelPreparationStatusPending, Group: "vip2", Balance: 40},
	}
	require.NoError(t, DB.Create(&preparations).Error)

	items, total, stats, statusCounts, _, err := GetChannelPreparations(ChannelPreparationListOptions{Group: "vip", Page: 1, PageSize: 20})
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.InDelta(t, 40, stats.BalanceTotal, 0.000001)
	require.Len(t, statusCounts, 1)
	require.Equal(t, int64(2), statusCounts[0].Count)

	names := make(map[string]bool, len(items))
	for _, item := range items {
		names[item.Name] = true
	}
	require.True(t, names["vip only"])
	require.True(t, names["default vip"])
	require.False(t, names["svip only"])
	require.False(t, names["vip2 only"])

	items, total, stats, _, _, err = GetChannelPreparations(ChannelPreparationListOptions{Group: "svip", Page: 1, PageSize: 20})
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.InDelta(t, 20, stats.BalanceTotal, 0.000001)
	require.Len(t, items, 1)
	require.Equal(t, "svip only", items[0].Name)
}
