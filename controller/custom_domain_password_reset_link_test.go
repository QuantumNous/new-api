package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPasswordResetEmailLinkUsesMainDispatcherForACustomDomain(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousSecret := common.SessionSecret
	previousSuffix := common.CustomDomainSuffix
	previousMainOrigin := common.CustomDomainMainOrigin
	previousServerAddress := system_setting.ServerAddress
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.SessionSecret = "reset-email-link-test-secret"
	common.CustomDomainSuffix = "yeschoy.io"
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	system_setting.ServerAddress = "https://yeschoy.com"
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.SessionSecret = previousSecret
		common.CustomDomainSuffix = previousSuffix
		common.CustomDomainMainOrigin = previousMainOrigin
		system_setting.ServerAddress = previousServerAddress
	})

	owner := model.User{Username: "reset-link-owner", AffCode: "reset-link-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)

	var generatedLink string
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/link", func(c *gin.Context) {
		generatedLink = passwordResetEmailLink(c, "user@example.com", "reset-token")
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "https://alpha.yeschoy.io/link", nil)
	request.Host = "alpha.yeschoy.io:443"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusNoContent, response.Code)

	parsed, err := url.Parse(generatedLink)
	require.NoError(t, err)
	assert.Equal(t, "yeschoy.com", parsed.Host)
	assert.Equal(t, "/api/reset_password/return", parsed.Path)
	query := parsed.Query()
	targetHost, active, err := service.ResolvePasswordResetReturnContext(query.Get("context"), query.Get("email"), query.Get("token"), time.Now())
	require.NoError(t, err)
	assert.True(t, active)
	assert.Equal(t, "alpha.yeschoy.io", targetHost)

	mainContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	mainLink := passwordResetEmailLink(mainContext, "user@example.com", "reset-token")
	assert.Equal(t, "https://yeschoy.com/user/reset?email=user%40example.com&token=reset-token", mainLink)
}
