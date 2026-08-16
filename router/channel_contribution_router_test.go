package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelContributionRouterTest(t *testing.T) string {
	t.Helper()
	previousDB := model.DB
	previousType := common.MainDatabaseType()
	previousRedis := common.RedisEnabled
	previousTurnstile := common.TurnstileCheckEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.ChannelContribution{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	token := "channel-contribution-router-token"
	user := &model.User{
		Username:    "contribution-router-user",
		Password:    "password-placeholder",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AccessToken: &token,
		AuthVersion: 1,
		AffCode:     "contribution-router-aff-code",
	}
	require.NoError(t, db.Create(user).Error)
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.RedisEnabled = previousRedis
		common.TurnstileCheckEnabled = previousTurnstile
	})
	return token
}

func performChannelContributionRouteRequest(router http.Handler, token string, method string, path string, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestChannelContributionSubmitAloneRequiresTurnstile(t *testing.T) {
	token := setupChannelContributionRouterTest(t)
	common.TurnstileCheckEnabled = true
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	registerChannelContributionRoutes(engine.Group("/api"))

	submit := performChannelContributionRouteRequest(engine, token, http.MethodPost, "/api/channel-contributions/1/submit", `{}`)
	assert.Contains(t, submit.Body.String(), "Turnstile token")

	for _, path := range []string{
		"/api/channel-contributions/1/fetch-models",
		"/api/channel-contributions/1/test-runs",
	} {
		response := performChannelContributionRouteRequest(engine, token, http.MethodPost, path, "")
		assert.NotContains(t, response.Body.String(), "Turnstile", path)
		assert.Contains(t, response.Body.String(), "record not found", path)
	}
}

func TestChannelContributionSubmitSkipsTurnstileWhenDisabled(t *testing.T) {
	token := setupChannelContributionRouterTest(t)
	common.TurnstileCheckEnabled = false
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	registerChannelContributionRoutes(engine.Group("/api"))

	response := performChannelContributionRouteRequest(engine, token, http.MethodPost, "/api/channel-contributions/1/submit", `{}`)
	assert.NotContains(t, response.Body.String(), "Turnstile")
	assert.Contains(t, response.Body.String(), "agreement must be accepted")
}
