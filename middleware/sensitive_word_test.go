package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSensitiveWordDistributorTest(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(
		&model.User{}, &model.Token{}, &model.Log{}, &model.Option{},
		&model.SensitiveWordRule{}, &model.SensitiveWordRuleWord{}, &model.SensitiveWordRuleGroup{},
		&model.SensitiveWordPolicy{}, &model.SensitiveWordAuditEvent{},
	))
	model.DB, model.LOG_DB = database, database
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		require.NoError(t, sqlDB.Close())
	})
	return database
}

func TestDistributeChecksSensitiveWordsBeforeMissingChannel(t *testing.T) {
	database := setupSensitiveWordDistributorTest(t)
	require.NoError(t, model.MigrateSensitiveWordData())
	policy := model.GetSensitiveWordPolicy()
	policy.Enabled = true
	policy.CheckPrompt = true
	require.NoError(t, model.SaveSensitiveWordPolicy(policy, 1))

	markers := []string{
		"distributor-chat-sensitive-marker",
		"distributor-responses-sensitive-marker",
		"distributor-claude-sensitive-marker",
		"distributor-gemini-sensitive-marker",
		"distributor-image-sensitive-marker",
	}
	_, err := model.UpsertSensitiveWordRuleWithMode(
		0, "distributor boundary", markers, model.SensitiveWordScopeGlobal, nil, 1, model.SensitiveWordModeBlock,
	)
	require.NoError(t, err)
	user := &model.User{
		Username: "distributor-sensitive-user", Password: "password", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", Quota: 4_000_000,
		AuthVersion: 1, AffCode: "distributor-sensitive-aff",
	}
	require.NoError(t, database.Create(user).Error)
	token := &model.Token{
		UserId: user.Id, Key: "distributor-sensitive-token", Name: "distributor sensitive token",
		Status: common.TokenStatusEnabled, RemainQuota: 3_000_000, Group: "default",
	}
	require.NoError(t, database.Create(token).Error)

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	handlerCalled := false
	engine.POST("/*path", RequestId(), func(c *gin.Context) {
		c.Set("id", user.Id)
		c.Set("username", user.Username)
		c.Set("token_id", token.Id)
		c.Set("token_name", token.Name)
		common.SetContextKey(c, constant.ContextKeyUserId, user.Id)
		common.SetContextKey(c, constant.ContextKeyUserName, user.Username)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
		common.SetContextKey(c, constant.ContextKeyTokenId, token.Id)
	}, Distribute(), func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusNoContent)
	})

	for _, testCase := range []struct {
		name       string
		path       string
		body       string
		claudeBody bool
	}{
		{
			name: "chat completions", path: "/v1/chat/completions",
			body: `{"model":"no-channel-chat","messages":[{"role":"user","content":"distributor-chat-sensitive-marker"}]}`,
		},
		{
			name: "responses function call output", path: "/v1/responses",
			body: `{"model":"no-channel-responses","input":[{"type":"function_call_output","call_id":"call_1","output":"distributor-responses-sensitive-marker"}]}`,
		},
		{
			name: "claude messages", path: "/v1/messages", claudeBody: true,
			body: `{"model":"no-channel-claude","max_tokens":1,"messages":[{"role":"user","content":"distributor-claude-sensitive-marker"}]}`,
		},
		{
			name: "gemini", path: "/v1beta/models/no-channel-gemini:generateContent",
			body: `{"contents":[{"role":"user","parts":[{"text":"distributor-gemini-sensitive-marker"}]}]}`,
		},
		{
			name: "image generation", path: "/v1/images/generations",
			body: `{"model":"no-channel-image","prompt":"distributor-image-sensitive-marker"}`,
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			handlerCalled = false
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, testCase.path, strings.NewReader(testCase.body))
			request.Header.Set("Content-Type", "application/json")
			engine.ServeHTTP(recorder, request)

			require.Equal(t, http.StatusUnprocessableEntity, recorder.Code)
			assert.False(t, handlerCalled, "the relay handler and channel selection must not run")
			assert.NotContains(t, recorder.Body.String(), "model_not_found")
			assert.NotContains(t, recorder.Body.String(), "request id:")
			if testCase.claudeBody {
				var response struct {
					Type  string `json:"type"`
					Error struct {
						Type string `json:"type"`
					} `json:"error"`
				}
				require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
				assert.Equal(t, "error", response.Type)
				assert.Equal(t, "sensitive_words_detected", response.Error.Type)
				return
			}
			var response struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
			assert.Equal(t, "sensitive_words_detected", response.Error.Code)
		})
	}

	var storedUser model.User
	require.NoError(t, database.First(&storedUser, user.Id).Error)
	assert.Equal(t, len(markers), storedUser.SensitiveWordViolationCount)
}
