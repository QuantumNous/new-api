package controller_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/router"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenPeriodicQuotaE2EWithMockUpstream(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var upstreamCalls int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&upstreamCalls, 1)
		assert.Equal(t, "/v1/chat/completions", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"id":"chatcmpl-periodic-e2e",
			"object":"chat.completion",
			"created":1782532500,
			"model":"gpt-4o-mini",
			"choices":[{"index":0,"message":{"role":"assistant","content":"periodic quota e2e demo"},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}
		}`))
	}))
	defer upstream.Close()

	originalSQLitePath := common.SQLitePath
	originalPreConsumedQuota := common.PreConsumedQuota
	originalRedisEnabled := common.RedisEnabled
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalBatchUpdateEnabled := common.BatchUpdateEnabled
	originalLogConsumeEnabled := common.LogConsumeEnabled
	originalIsMasterNode := common.IsMasterNode
	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	originalSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")
	t.Cleanup(func() {
		common.SQLitePath = originalSQLitePath
		common.PreConsumedQuota = originalPreConsumedQuota
		common.RedisEnabled = originalRedisEnabled
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.BatchUpdateEnabled = originalBatchUpdateEnabled
		common.LogConsumeEnabled = originalLogConsumeEnabled
		common.IsMasterNode = originalIsMasterNode
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(originalModelPrice))
		if hadSQLDSN {
			require.NoError(t, os.Setenv("SQL_DSN", originalSQLDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
		if model.DB != nil {
			if sqlDB, err := model.DB.DB(); err == nil {
				_ = sqlDB.Close()
			}
		}
	})

	common.SQLitePath = filepath.Join(t.TempDir(), "periodic-e2e.db")
	common.PreConsumedQuota = 20
	common.RedisEnabled = false
	common.MemoryCacheEnabled = true
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true
	common.IsMasterNode = true
	require.NoError(t, os.Setenv("SQL_DSN", "local"))
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"gpt-4o-mini":0.00003}`))
	require.NoError(t, model.InitDB())
	model.LOG_DB = model.DB
	service.InitHttpClient()

	const userID = 9001
	const tokenID = 9101
	const channelID = 9201
	rawTokenKey := "periodice2ekey"
	baseURL := upstream.URL
	priority := int64(0)

	require.NoError(t, model.DB.Create(&model.User{
		Id:       userID,
		Username: "periodic-e2e",
		Password: "password-for-test",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Quota:    1000,
		Group:    "default",
	}).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		Id:                 tokenID,
		UserId:             userID,
		Key:                rawTokenKey,
		Status:             common.TokenStatusEnabled,
		Name:               "periodic-e2e-token",
		CreatedTime:        1,
		AccessedTime:       1,
		ExpiredTime:        -1,
		RemainQuota:        1000,
		UnlimitedQuota:     false,
		QuotaPolicyEnabled: true,
		Group:              "default",
	}).Error)
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:          channelID,
		Type:        constant.ChannelTypeOpenAI,
		Key:         "sk-upstream-demo",
		Status:      common.ChannelStatusEnabled,
		Name:        "periodic-e2e-openai",
		BaseURL:     &baseURL,
		Models:      "gpt-4o-mini",
		Group:       "default",
		CreatedTime: 1,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-4o-mini",
		ChannelId: channelID,
		Enabled:   true,
		Priority:  &priority,
		Weight:    1,
	}).Error)

	anchor := common.GetTimestamp()
	window, err := model.CalculateTokenQuotaPolicyWindow(model.TokenQuotaPeriodCustom, 10, anchor, anchor)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.TokenQuotaPolicy{
		TokenId:         tokenID,
		UserId:          userID,
		Enabled:         true,
		PeriodMode:      model.TokenQuotaPeriodCustom,
		CustomMinutes:   10,
		Quota:           20,
		AnchorTime:      anchor,
		PeriodStart:     window.Start,
		PeriodEnd:       window.End,
		NextResetAt:     window.NextResetAt,
		ExhaustedAction: model.TokenQuotaExhaustRejectOnly,
		BoundaryMode:    model.TokenQuotaBoundaryStrict,
		AutoResume:      true,
	}).Error)
	model.InitChannelCache()

	engine := gin.New()
	router.SetRelayRouter(engine)

	first := performPeriodicQuotaE2EChat(engine, rawTokenKey)
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	assert.Equal(t, int32(1), atomic.LoadInt32(&upstreamCalls))
	policy := getE2ETokenQuotaPolicy(t, tokenID)
	assert.Greater(t, policy.UsedQuota, 0)
	assert.LessOrEqual(t, policy.UsedQuota, policy.Quota)

	second := performPeriodicQuotaE2EChat(engine, rawTokenKey)
	require.Equal(t, http.StatusTooManyRequests, second.Code, second.Body.String())
	var secondBody map[string]map[string]any
	require.NoError(t, common.Unmarshal(second.Body.Bytes(), &secondBody))
	assert.Equal(t, "token_quota_policy_exhausted", secondBody["error"]["code"])
	assert.Equal(t, int32(1), atomic.LoadInt32(&upstreamCalls), "periodic quota rejection must not call upstream")
	policy = getE2ETokenQuotaPolicy(t, tokenID)
	assert.Greater(t, policy.UsedQuota, 0)
	assert.LessOrEqual(t, policy.UsedQuota, policy.Quota)
	assert.Zero(t, policy.ExhaustedAt)
	var token model.Token
	require.NoError(t, model.DB.Where("id = ?", tokenID).First(&token).Error)
	assert.Equal(t, common.TokenStatusEnabled, token.Status)

	require.NoError(t, model.DB.Model(&model.TokenQuotaPolicy{}).
		Where("token_id = ?", tokenID).
		Updates(map[string]any{
			"next_reset_at": common.GetTimestamp() - 1,
			"period_end":    common.GetTimestamp() - 1,
		}).Error)

	third := performPeriodicQuotaE2EChat(engine, rawTokenKey)
	require.Equal(t, http.StatusOK, third.Code, third.Body.String())
	assert.Equal(t, int32(2), atomic.LoadInt32(&upstreamCalls))
	policy = getE2ETokenQuotaPolicy(t, tokenID)
	assert.Greater(t, policy.UsedQuota, 0)
	assert.LessOrEqual(t, policy.UsedQuota, policy.Quota)
	assert.Greater(t, policy.NextResetAt, common.GetTimestamp())
}

func performPeriodicQuotaE2EChat(engine http.Handler, rawTokenKey string) *httptest.ResponseRecorder {
	body := []byte(`{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}]}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer sk-"+rawTokenKey)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, req)
	return recorder
}

func getE2ETokenQuotaPolicy(t *testing.T, tokenID int) *model.TokenQuotaPolicy {
	t.Helper()
	var policy model.TokenQuotaPolicy
	require.NoError(t, model.DB.Where("token_id = ?", tokenID).First(&policy).Error)
	return &policy
}
