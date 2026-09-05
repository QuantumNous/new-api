package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegisterOnCustomDomainUsesDomainOwnerOnlyWhenAffIsEmpty(t *testing.T) {
	db := setupRegistrationTest(t)

	owner := model.User{Username: "registration-domain-owner", AffCode: "registration-owner-aff", Status: common.UserStatusEnabled}
	explicit := model.User{Username: "registration-explicit-owner", AffCode: "registration-explicit-aff", Status: common.UserStatusDisabled}
	require.NoError(t, db.Create(&owner).Error)
	require.NoError(t, db.Create(&explicit).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro",
		"5",
		"",
	)
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
			request.Header.Set("Origin", "https://alpha.yeschoy.io")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			require.Equal(t, http.StatusOK, response.Code)

			var stored model.User
			require.NoError(t, db.Where("username = ?", test.username).First(&stored).Error)
			assert.Equal(t, test.expectedInviter, stored.InviterId)
			var result struct {
				Success bool `json:"success"`
				Data    struct {
					service.AuthBundle
					User model.User `json:"user"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			require.True(t, result.Success)
			require.NotEmpty(t, result.Data.AccessToken)
			assert.Equal(t, stored.Id, result.Data.User.Id)
			assert.Equal(t, test.expectedInviter, result.Data.User.InviterId)
			cookies := response.Result().Cookies()
			require.Len(t, cookies, 1)
			assert.Equal(t, service.RefreshCookieName, cookies[0].Name)
			assert.Empty(t, cookies[0].Domain)
			assert.Empty(t, response.Header().Get("Location"))
		})
	}

	request := httptest.NewRequest(http.MethodPost, "https://yeschoy.pro/api/user/register", strings.NewReader("{\"username\":\"peer-main-user\",\"password\":\"password123\"}"))
	request.Host = "yeschoy.pro"
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://yeschoy.pro")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusOK, response.Code)
	var peerMainUser model.User
	require.NoError(t, db.Where("username = ?", "peer-main-user").First(&peerMainUser).Error)
	assert.Zero(t, peerMainUser.InviterId)
}
