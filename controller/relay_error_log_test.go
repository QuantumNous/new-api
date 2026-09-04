package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupProcessChannelErrorLogDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousErrorLogEnabled := constant.ErrorLogEnabled

	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(&model.User{}, &model.Log{}))
	model.DB, model.LOG_DB = database, database
	common.RedisEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	constant.ErrorLogEnabled = true
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		constant.ErrorLogEnabled = previousErrorLogEnabled
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, database.Create(&model.User{Id: 7, Username: "log-owner", Group: "default"}).Error)
	return database
}

func newProcessChannelErrorContext() *gin.Context {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("id", 7)
	ctx.Set("username", "log-owner")
	ctx.Set("token_name", "test-token")
	ctx.Set("token_id", 11)
	ctx.Set("original_model", "gpt-test")
	ctx.Set("group", "default")
	ctx.Set("channel_id", 202)
	ctx.Set("channel_name", "mutable-context-channel")
	ctx.Set("channel_type", 9)
	ctx.Set("use_channel", []string{"101"})
	common.SetContextKey(ctx, constant.ContextKeyRequestStartTime, time.Now().Add(-time.Second))
	return ctx
}

func TestProcessChannelErrorUsesSnapshotWithoutLeakingChannelMetadata(t *testing.T) {
	database := setupProcessChannelErrorLogDB(t)
	ctx := newProcessChannelErrorContext()

	channelSnapshot := types.ChannelError{
		ChannelId:   101,
		ChannelType: 1,
		ChannelName: "snapshot-channel",
		AutoBan:     false,
	}
	apiErr := types.NewOpenAIError(errors.New("upstream failed"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)

	processChannelError(ctx, channelSnapshot, apiErr, nil)

	var stored model.Log
	require.NoError(t, database.First(&stored).Error)
	assert.Equal(t, channelSnapshot.ChannelId, stored.ChannelId)
	storedOther, err := common.StrToMap(stored.Other)
	require.NoError(t, err)
	assert.Equal(t, float64(http.StatusBadGateway), storedOther["status_code"])
	assert.Equal(t, "/v1/chat/completions", storedOther["request_path"])
	for _, key := range []string{"channel_id", "channel_name", "channel_type"} {
		assert.NotContains(t, storedOther, key)
	}
	adminInfo, ok := storedOther["admin_info"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, []interface{}{"101"}, adminInfo["use_channel"])

	logs, total, err := model.GetUserLogs(7, model.LogTypeError, 0, 0, "", "", 0, 10, "", "", "")
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, logs, 1)
	assert.Equal(t, channelSnapshot.ChannelId, logs[0].ChannelId)
	assert.Empty(t, logs[0].ChannelName)
	userOther, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.NotContains(t, userOther, "admin_info")
	assert.Equal(t, "/v1/chat/completions", userOther["request_path"])
	for _, key := range []string{"channel_id", "channel_name", "channel_type"} {
		assert.NotContains(t, userOther, key)
	}
}

func TestProcessChannelErrorRecordsModelMappingAndRequestDiagnostics(t *testing.T) {
	database := setupProcessChannelErrorLogDB(t)
	ctx := newProcessChannelErrorContext()
	ctx.Set(string(constant.ContextKeySystemPromptOverride), true)

	streamStatus := relaycommon.NewStreamStatus()
	streamStatus.SetEndReason(relaycommon.StreamEndReasonTimeout, errors.New(`Get "https://api.openai.com/v1/chat/completions": upstream timeout`))
	streamStatus.RecordError("chunk decode failed from 10.0.0.1")

	relayInfo := &relaycommon.RelayInfo{
		OriginModelName:         "gpt-test",
		ReasoningEffort:         "high",
		IsStream:                true,
		RequestConversionChain:  []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude},
		FinalRequestRelayFormat: types.RelayFormatClaude,
		ParamOverrideAudit:      []string{"set temperature=0.2"},
		StreamStatus:            streamStatus,
		ChannelMeta: &relaycommon.ChannelMeta{
			IsModelMapped:     true,
			UpstreamModelName: "claude-sonnet-4",
		},
	}
	channelSnapshot := types.ChannelError{
		ChannelId:   101,
		ChannelType: 1,
		ChannelName: "snapshot-channel",
		AutoBan:     false,
	}
	apiErr := types.NewOpenAIError(errors.New("upstream failed"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)

	processChannelError(ctx, channelSnapshot, apiErr, relayInfo)

	var stored model.Log
	require.NoError(t, database.First(&stored).Error)
	storedOther, err := common.StrToMap(stored.Other)
	require.NoError(t, err)
	assert.Equal(t, true, storedOther["is_model_mapped"])
	assert.Equal(t, "claude-sonnet-4", storedOther["upstream_model_name"])
	assert.Equal(t, true, storedOther["is_system_prompt_overwritten"])
	assert.Equal(t, "high", storedOther["reasoning_effort"])
	assert.Equal(t, []interface{}{"OpenAI Compatible", "Claude Messages"}, storedOther["request_conversion"])
	assert.Equal(t, true, storedOther["claude"])
	assert.Equal(t, []interface{}{"set temperature=0.2"}, storedOther["po"])
	assert.Equal(t, "/v1/chat/completions", storedOther["request_path"])
	streamInfo, ok := storedOther["stream_status"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "error", streamInfo["status"])
	assert.Equal(t, "timeout", streamInfo["end_reason"])
	assert.Equal(t, common.MaskSensitiveInfo(`Get "https://api.openai.com/v1/chat/completions": upstream timeout`), streamInfo["end_error"])
	assert.NotContains(t, streamInfo["end_error"], "api.openai.com")
	require.Equal(t, []interface{}{common.MaskSensitiveInfo("chunk decode failed from 10.0.0.1")}, streamInfo["errors"])

	logs, total, err := model.GetUserLogs(7, model.LogTypeError, 0, 0, "", "", 0, 10, "", "", "")
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	userOther, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.NotContains(t, userOther, "admin_info")
	assert.Equal(t, true, userOther["is_model_mapped"])
	assert.Equal(t, "claude-sonnet-4", userOther["upstream_model_name"])
	assert.Equal(t, []interface{}{"OpenAI Compatible", "Claude Messages"}, userOther["request_conversion"])
}
