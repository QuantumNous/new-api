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
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPasswordResetReturnDispatcherUsesSignedCustomDomainOrMainFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousSecret := common.SessionSecret
	previousSuffix := common.CustomDomainSuffix
	previousMainOrigin := common.CustomDomainMainOrigin
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.SessionSecret = "reset-dispatcher-test-secret"
	common.CustomDomainSuffix = "yeschoy.io"
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.SessionSecret = previousSecret
		common.CustomDomainSuffix = previousSuffix
		common.CustomDomainMainOrigin = previousMainOrigin
	})

	owner := model.User{Username: "reset-dispatcher-owner", AffCode: "reset-dispatcher-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/api/reset_password/return", PasswordResetReturnDispatcher)

	email, token := "user@example.com", "reset-token"
	returnContext, err := service.CreatePasswordResetReturnContext(domain.Id, "alpha.yeschoy.io", email, token, time.Now().Add(time.Minute))
	require.NoError(t, err)

	requestDispatcher := func(returnContext string) *httptest.ResponseRecorder {
		query := url.Values{"email": {email}, "token": {token}, "context": {returnContext}}
		request := httptest.NewRequest(http.MethodGet, "https://yeschoy.com/api/reset_password/return?"+query.Encode(), nil)
		request.Host = "yeschoy.com"
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}

	response := requestDispatcher(returnContext)
	require.Equal(t, http.StatusFound, response.Code)
	assert.Equal(t, "https://alpha.yeschoy.io/user/reset?email=user%40example.com&token=reset-token", response.Header().Get("Location"))

	_, err = model.DisableCustomDomain(domain.Label)
	require.NoError(t, err)
	response = requestDispatcher(returnContext)
	require.Equal(t, http.StatusFound, response.Code)
	assert.Equal(t, "https://yeschoy.com/user/reset?email=user%40example.com&token=reset-token", response.Header().Get("Location"))

	response = requestDispatcher("forged")
	assert.Equal(t, http.StatusBadRequest, response.Code)
}
