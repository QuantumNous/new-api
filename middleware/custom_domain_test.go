package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCustomDomainContextAllowsOnlyMainAndEnabledCustomHosts(t *testing.T) {
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

	owner := model.User{Username: "middleware-domain-owner", AffCode: "middleware-domain-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	_, err = model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain("alpha")
	require.NoError(t, err)
	_, err = model.CreateCustomDomain("disabled", owner.Id)
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)

	router := gin.New()
	router.Use(CustomDomainContextWithResolver(resolver, true))
	router.GET("/context", func(c *gin.Context) {
		context, found := GetCustomDomainContext(c)
		if !found {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.JSON(http.StatusOK, gin.H{"kind": context.Kind, "owner_user_id": context.OwnerUserID})
	})
	router.POST("/api/user/passkey/login/begin", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	tests := []struct {
		name           string
		host           string
		forwardedHost  string
		expectedStatus int
		expectedKind   service.CustomDomainKind
	}{
		{name: "main", host: "yeschoy.com", expectedStatus: http.StatusOK, expectedKind: service.CustomDomainKindMain},
		{name: "active custom", host: "alpha.yeschoy.io", expectedStatus: http.StatusOK, expectedKind: service.CustomDomainKindCustom},
		{name: "apex", host: "yeschoy.io", expectedStatus: http.StatusNotFound},
		{name: "disabled", host: "disabled.yeschoy.io", expectedStatus: http.StatusNotFound},
		{name: "unknown", host: "missing.yeschoy.io", expectedStatus: http.StatusNotFound},
		{name: "nested", host: "nested.alpha.yeschoy.io", expectedStatus: http.StatusNotFound},
		{name: "forwarded host cannot upgrade main", host: "yeschoy.com", forwardedHost: "alpha.yeschoy.io", expectedStatus: http.StatusOK, expectedKind: service.CustomDomainKindMain},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "https://yeschoy.com/context", nil)
			request.Host = test.host
			if test.forwardedHost != "" {
				request.Header.Set("X-Forwarded-Host", test.forwardedHost)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			assert.Equal(t, test.expectedStatus, response.Code)
			if test.expectedKind != "" {
				assert.Contains(t, response.Body.String(), string(test.expectedKind))
			}
		})
	}

	request := httptest.NewRequest(http.MethodPost, "https://alpha.yeschoy.io/api/user/passkey/login/begin", nil)
	request.Host = "alpha.yeschoy.io"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusNotFound, response.Code)

	request = httptest.NewRequest(http.MethodPost, "https://yeschoy.com/api/user/passkey/login/begin", nil)
	request.Host = "yeschoy.com"
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusNoContent, response.Code)
}

func TestSessionCookieOriginGuardAcceptsOnlyTheValidatedCustomHostBehindTLSProxy(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousSecure := common.SessionCookieSecure
	previousTrustedURLs := common.SessionCookieTrustedURLs
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.SessionCookieSecure = true
	common.SessionCookieTrustedURLs = nil
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.SessionCookieSecure = previousSecure
		common.SessionCookieTrustedURLs = previousTrustedURLs
	})

	owner := model.User{Username: "origin-domain-owner", AffCode: "origin-domain-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)

	router := gin.New()
	router.Use(CustomDomainContextWithResolver(resolver, true))
	router.POST("/api/user/auth/refresh", SessionCookieOriginGuard(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	for _, test := range []struct {
		name           string
		origin         string
		expectedStatus int
	}{
		{name: "validated custom origin", origin: "https://alpha.yeschoy.io", expectedStatus: http.StatusNoContent},
		{name: "other custom origin", origin: "https://other.yeschoy.io", expectedStatus: http.StatusForbidden},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "http://alpha.yeschoy.io/api/user/auth/refresh", nil)
			request.Host = "alpha.yeschoy.io"
			request.Header.Set("Origin", test.origin)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			assert.Equal(t, test.expectedStatus, response.Code)
		})
	}
}
