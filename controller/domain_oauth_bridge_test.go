package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDomainOAuthHandoffBridgeAllowsPromotionAndPeerMainTargetsOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
	})

	owner := model.User{Username: "handoff-bridge-owner", AffCode: "handoff-bridge-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro,https://future.example,https://*.yeschoy.com",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)

	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/oauth/handoff", DomainOAuthHandoffBridge)

	request := httptest.NewRequest(http.MethodGet, "https://alpha.yeschoy.io/oauth/handoff", nil)
	request.Host = "alpha.yeschoy.io"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Header().Get("Content-Security-Policy"), "default-src 'none'")
	assert.Contains(t, response.Header().Get("Content-Security-Policy"), "connect-src 'self'")
	assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))
	assert.Equal(t, "no-referrer", response.Header().Get("Referrer-Policy"))
	assert.Contains(t, response.Body.String(), "location.hash")
	assert.Contains(t, response.Body.String(), "/api/oauth/domain-handoff")
	assert.Contains(t, response.Body.String(), "/api/oauth/domain-handoff-fallback")
	assert.Contains(t, response.Body.String(), "domain_login_fallback")
	assert.Contains(t, response.Body.String(), "oauth:binding:handoff")
	assert.Contains(t, response.Body.String(), "oauth:binding:return")
	assert.Contains(t, response.Body.String(), "searchParams.get('mode')")
	assert.NotContains(t, response.Body.String(), "<script src=")
	assert.NotContains(t, response.Body.String(), "analytics")

	for _, host := range []string{"yeschoy.pro", "future.example", "api.yeschoy.com"} {
		request = httptest.NewRequest(http.MethodGet, "https://"+host+"/oauth/handoff", nil)
		request.Host = host
		response = httptest.NewRecorder()
		router.ServeHTTP(response, request)
		assert.Equal(t, http.StatusOK, response.Code)
	}

	request = httptest.NewRequest(http.MethodGet, "https://yeschoy.com/oauth/handoff", nil)
	request.Host = "yeschoy.com"
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusNotFound, response.Code)

	request = httptest.NewRequest(http.MethodGet, "https://yeschoy.com/oauth/handoff?mode=fallback", nil)
	request.Host = "yeschoy.com"
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusOK, response.Code)

	request = httptest.NewRequest(http.MethodGet, "https://yeschoy.pro/oauth/handoff?mode=fallback", nil)
	request.Host = "yeschoy.pro"
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusNotFound, response.Code)
}
