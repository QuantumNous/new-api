package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	backendi18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDistributorAllowlistContractTest(t *testing.T) {
	t.Helper()
	require.NoError(t, backendi18n.Init())

	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	common.MemoryCacheEnabled = false
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id: 93001, Type: constant.ChannelTypeOpenAI, Key: "contract-test-key",
		Status: common.ChannelStatusEnabled, Models: "gpt-5.5,gpt-4-gizmo-*,gemini-2.5-pro-thinking-*",
		Group: "default", Priority: &priority, Weight: &weight,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "gpt-5.5", ChannelId: 93001, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "default", Model: "gpt-4-gizmo-*", ChannelId: 93001, Enabled: true, Priority: &priority, Weight: weight},
		{Group: "default", Model: "gemini-2.5-pro-thinking-*", ChannelId: 93001, Enabled: true, Priority: &priority, Weight: weight},
	}).Error)

	t.Cleanup(func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})

}

func TestDistributorEnforcesCanonicalTokenAllowlistOnRealRequestPath(t *testing.T) {
	setupDistributorAllowlistContractTest(t)
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name       string
		model      string
		allowlist  map[string]bool
		wantStatus int
	}{
		{name: "exact", model: "gpt-5.5", allowlist: map[string]bool{"gpt-5.5": true}, wantStatus: http.StatusNoContent},
		{name: "gizmo wildcard", model: "gpt-4-gizmo-customer-model", allowlist: map[string]bool{"gpt-4-gizmo-*": true}, wantStatus: http.StatusNoContent},
		{name: "thinking budget wildcard", model: "gemini-2.5-pro-thinking-8192", allowlist: map[string]bool{"gemini-2.5-pro-thinking-*": true}, wantStatus: http.StatusNoContent},
		{name: "mismatch", model: "gpt-5.5", allowlist: map[string]bool{"claude-sonnet-4-6": true}, wantStatus: http.StatusForbidden},
		{name: "whitespace does not match", model: " gpt-5.5 ", allowlist: map[string]bool{"gpt-5.5": true}, wantStatus: http.StatusForbidden},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			router := gin.New()
			router.POST("/v1/chat/completions", func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
				common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
				common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
				common.SetContextKey(c, constant.ContextKeyTokenModelLimit, test.allowlist)
			}, Distribute(), func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(fmt.Sprintf(`{"model":%q}`, test.model)))
			request.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, request)

			require.Equal(t, test.wantStatus, recorder.Code, recorder.Body.String())
		})
	}
}

func TestDistributorRejectsBlacklistedOriginModelOnTaskFetch(t *testing.T) {
	setupDistributorAllowlistContractTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Task{}))
	require.NoError(t, model.DB.Create(&model.Task{
		TaskID:     "task-blacklisted-model",
		UserId:     77,
		Status:     model.TaskStatusSubmitted,
		Properties: model.Properties{OriginModelName: "gpt-5.5"},
	}).Error)

	router := gin.New()
	router.GET("/v1/generation/tasks/:task_id", func(c *gin.Context) {
		c.Set("id", 77)
		common.SetContextKey(c, constant.ContextKeyTokenModelBlacklistEnabled, true)
		common.SetContextKey(c, constant.ContextKeyTokenModelBlacklist, map[string]bool{"gpt-5.5": true})
	}, Distribute(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "/v1/generation/tasks/task-blacklisted-model", nil)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusForbidden, recorder.Code, recorder.Body.String())
}
