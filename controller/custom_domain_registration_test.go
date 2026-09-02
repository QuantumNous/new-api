package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRegisterOnCustomDomainUsesDomainOwnerOnlyWhenAffIsEmpty(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousRegisterEnabled := common.RegisterEnabled
	previousPasswordRegisterEnabled := common.PasswordRegisterEnabled
	previousEmailVerificationEnabled := common.EmailVerificationEnabled
	previousRedisEnabled := common.RedisEnabled
	previousGenerateDefaultToken := constant.GenerateDefaultToken
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	common.RedisEnabled = false
	constant.GenerateDefaultToken = false
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.RegisterEnabled = previousRegisterEnabled
		common.PasswordRegisterEnabled = previousPasswordRegisterEnabled
		common.EmailVerificationEnabled = previousEmailVerificationEnabled
		common.RedisEnabled = previousRedisEnabled
		constant.GenerateDefaultToken = previousGenerateDefaultToken
	})

	owner := model.User{Username: "registration-domain-owner", AffCode: "registration-owner-aff", Status: common.UserStatusEnabled}
	explicit := model.User{Username: "registration-explicit-owner", AffCode: "registration-explicit-aff", Status: common.UserStatusDisabled}
	require.NoError(t, db.Create(&owner).Error)
	require.NoError(t, db.Create(&explicit).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.POST("/api/user/register", Register)

	for _, test := range []struct {
		username        string
		affCode         string
		expectedInviter int
	}{
		{username: "domain-default-user", expectedInviter: owner.Id},
		{username: "domain-invalid-aff", affCode: "missing-aff", expectedInviter: 0},
		{username: "domain-explicit-aff", affCode: explicit.AffCode, expectedInviter: explicit.Id},
	} {
		t.Run(test.username, func(t *testing.T) {
			body := fmt.Sprintf(`{"username":%q,"password":"password123","aff_code":%q}`, test.username, test.affCode)
			request := httptest.NewRequest(http.MethodPost, "https://alpha.yeschoy.io/api/user/register", strings.NewReader(body))
			request.Host = "alpha.yeschoy.io"
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			require.Equal(t, http.StatusOK, response.Code)

			var stored model.User
			require.NoError(t, db.Where("username = ?", test.username).First(&stored).Error)
			assert.Equal(t, test.expectedInviter, stored.InviterId)
		})
	}
}
