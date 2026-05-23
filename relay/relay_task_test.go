package relay

import (
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRelayTaskTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalMemoryCacheEnabled := common.MemoryCacheEnabled

	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.MemoryCacheEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Task{}))

	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.RedisEnabled = originalRedisEnabled
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})
}

func TestResolveOriginTaskSetsLockedMultiKeyContext(t *testing.T) {
	setupRelayTaskTestDB(t)
	gin.SetMode(gin.TestMode)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/tasks", nil)
	ctx.Set("channel_id", 1)
	common.SetContextKey(ctx, constant.ContextKeyChannelMultiKeyIndex, 5)

	baseURL := "https://example.com"
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:      2,
		Type:    constant.ChannelTypeOpenAI,
		Key:     "key-0\nkey-1",
		Status:  common.ChannelStatusEnabled,
		Name:    "origin-channel",
		BaseURL: &baseURL,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				0: common.ChannelStatusEnabled,
				1: common.ChannelStatusEnabled,
			},
			MultiKeyPollingIndex: 1,
			MultiKeyMode:         constant.MultiKeyModePolling,
		},
	}).Error)
	require.NoError(t, model.DB.Create(&model.Task{
		TaskID:    "origin-task",
		UserId:    7,
		ChannelId: 2,
		Properties: model.Properties{
			OriginModelName: "sora_video",
		},
	}).Error)

	info := &relaycommon.RelayInfo{
		UserId:          7,
		OriginModelName: "sora_video",
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			OriginTaskID: "origin-task",
		},
	}

	taskErr := ResolveOriginTask(ctx, info)

	require.Nil(t, taskErr)
	lockedChannel, ok := info.LockedChannel.(*model.Channel)
	require.True(t, ok)
	require.Equal(t, 2, lockedChannel.Id)
	require.Equal(t, 2, common.GetContextKeyInt(ctx, constant.ContextKeyChannelId))
	require.True(t, common.GetContextKeyBool(ctx, constant.ContextKeyChannelIsMultiKey))
	require.Equal(t, 1, common.GetContextKeyInt(ctx, constant.ContextKeyChannelMultiKeyIndex))
	require.Equal(t, "key-1", common.GetContextKeyString(ctx, constant.ContextKeyChannelKey))
	require.Equal(t, 1, info.ChannelMultiKeyIndex)
	require.Equal(t, "key-1", info.ApiKey)
}
