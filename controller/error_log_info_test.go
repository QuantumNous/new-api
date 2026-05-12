package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupErrorLogInfoTestDB(t *testing.T) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	oldDB := model.DB
	oldLogDB := model.LOG_DB
	oldRedisEnabled := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "error_log_info.db")), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}))

	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
		model.DB = oldDB
		model.LOG_DB = oldLogDB
		common.RedisEnabled = oldRedisEnabled
	})
}

func newErrorLogInfoTestContext() *gin.Context {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions?ignored=true", nil)
	ctx.Set("id", 101)
	ctx.Set("username", "error_user")
	ctx.Set("token_name", "test_token")
	ctx.Set("token_id", 202)
	ctx.Set("group", "default")
	ctx.Set("channel_id", 303)
	ctx.Set("channel_name", "test_channel")
	ctx.Set("channel_type", 1)
	ctx.Set(common.RequestIdKey, "req_error_log")
	ctx.Set("use_channel", []string{"303", "404"})
	common.SetContextKey(ctx, constant.ContextKeyOriginalModel, "gpt-original")
	common.SetContextKey(ctx, constant.ContextKeyRequestStartTime, time.Now().Add(-1500*time.Millisecond))
	common.SetContextKey(ctx, constant.ContextKeyChannelIsMultiKey, true)
	common.SetContextKey(ctx, constant.ContextKeyChannelMultiKeyIndex, 2)
	common.SetContextKey(ctx, constant.ContextKeyIsStream, true)
	return ctx
}

func TestBuildErrorLogOtherIncludesDiagnosticFields(t *testing.T) {
	ctx := newErrorLogInfoTestContext()
	err := types.WithOpenAIError(types.OpenAIError{
		Message: "upstream failed Authorization: Bearer sk-secret123456789",
		Type:    "invalid_request_error",
		Code:    "bad_request",
	}, http.StatusBadRequest)
	info := &relaycommon.RelayInfo{
		RelayMode:               relayconstant.RelayModeChatCompletions,
		RelayFormat:             types.RelayFormatOpenAI,
		FinalRequestRelayFormat: types.RelayFormatClaude,
		OriginModelName:         "gpt-original",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-final",
			IsModelMapped:     true,
		},
		IsStream:               true,
		RetryIndex:             1,
		RequestConversionChain: []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude},
	}

	other := buildErrorLogOther(ctx, info, *types.NewChannelError(303, 1, "test_channel", true, "secret-key", true), err, 1)

	require.Equal(t, "/v1/chat/completions", other["request_path"])
	require.Equal(t, http.MethodPost, other["request_method"])
	require.Equal(t, "chat_completions", other["relay_mode"])
	require.Equal(t, "openai", other["relay_format"])
	require.Equal(t, "claude", other["final_relay_format"])
	require.Equal(t, true, other["is_stream"])
	require.Equal(t, 1, other["retry_count"])
	require.Equal(t, 1, other["use_time_seconds"])
	require.GreaterOrEqual(t, other["elapsed_ms"], int64(1000))
	require.Equal(t, "gpt-original", other["original_model_name"])
	require.Equal(t, "claude-final", other["final_model_name"])
	require.Equal(t, true, other["is_model_mapped"])
	require.Equal(t, "upstream", other["error_source"])
	require.Equal(t, http.StatusBadRequest, other["upstream_status_code"])

	upstreamError, ok := other["upstream_error"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "bad_request", upstreamError["code"])
	require.NotContains(t, upstreamError["message"], "sk-secret123456789")
	require.Contains(t, upstreamError["message"], "Authorization:***")
	content := errorLogContent(err)
	require.NotContains(t, content, "sk-secret123456789")
	require.Contains(t, content, "Authorization:***")

	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, []string{"303", "404"}, adminInfo["use_channel"])
	require.Equal(t, 2, adminInfo["multi_key_index"])
}

func TestProcessChannelErrorWritesDetailedLogWhenEnabled(t *testing.T) {
	setupErrorLogInfoTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{Id: 101, Username: "error_user"}).Error)

	oldEnabled := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = true
	t.Cleanup(func() {
		constant.ErrorLogEnabled = oldEnabled
	})

	ctx := newErrorLogInfoTestContext()
	err := types.WithOpenAIError(types.OpenAIError{
		Message: "upstream failed api_key:abc123",
		Type:    "upstream_error",
		Code:    "bad_request",
	}, http.StatusBadRequest)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "gpt-original",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-original"},
		IsStream:        true,
	}

	processChannelError(ctx, info, *types.NewChannelError(303, 1, "test_channel", true, "secret-key", false), err)

	var log model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeError).First(&log).Error)
	require.Equal(t, "req_error_log", log.RequestId)
	require.NotContains(t, strings.ToLower(log.Content), "abc123")
	require.Contains(t, log.Other, `"request_method":"POST"`)
	require.Contains(t, log.Other, `"upstream_error"`)
	require.NotContains(t, strings.ToLower(log.Other), "abc123")
	require.NotContains(t, strings.ToLower(log.Other), "secret-key")
}

func TestProcessChannelErrorSkipsLogWhenDisabled(t *testing.T) {
	setupErrorLogInfoTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{Id: 101, Username: "error_user"}).Error)

	oldEnabled := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = false
	t.Cleanup(func() {
		constant.ErrorLogEnabled = oldEnabled
	})

	ctx := newErrorLogInfoTestContext()
	err := types.NewErrorWithStatusCode(errors.New("upstream failed"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)

	processChannelError(ctx, nil, *types.NewChannelError(303, 1, "test_channel", false, "secret-key", false), err)

	var count int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("type = ?", model.LogTypeError).Count(&count).Error)
	require.Equal(t, int64(0), count)
}
