package controller

import (
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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRegistrationTest(t *testing.T) *gorm.DB {
	t.Helper()
	db := setupManageUserTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Token{}, &model.CustomDomain{}))
	previousRegister, previousPasswordRegister := common.RegisterEnabled, common.PasswordRegisterEnabled
	previousPasswordLogin, previousEmailVerification := common.PasswordLoginEnabled, common.EmailVerificationEnabled
	previousDefaultToken, previousSecret := constant.GenerateDefaultToken, common.SessionSecret
	previousSecure, previousActiveLimit := common.SessionCookieSecure, common.UserSessionActiveLimit
	common.RegisterEnabled, common.PasswordRegisterEnabled = true, true
	common.PasswordLoginEnabled, common.EmailVerificationEnabled = true, false
	constant.GenerateDefaultToken = false
	common.SessionSecret = "registration-test-session-secret"
	common.SessionCookieSecure = true
	common.UserSessionActiveLimit = 10
	t.Cleanup(func() {
		common.RegisterEnabled, common.PasswordRegisterEnabled = previousRegister, previousPasswordRegister
		common.PasswordLoginEnabled, common.EmailVerificationEnabled = previousPasswordLogin, previousEmailVerification
		constant.GenerateDefaultToken, common.SessionSecret = previousDefaultToken, previousSecret
		common.SessionCookieSecure, common.UserSessionActiveLimit = previousSecure, previousActiveLimit
	})
	gin.SetMode(gin.TestMode)
	return db
}

func performRegistrationRequest(t *testing.T, router http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "https://main.example/api/user/register", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://main.example")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestRegisterCreatesUsableLoginSession(t *testing.T) {
	for _, verifyEmail := range []bool{false, true} {
		name := "password"
		if verifyEmail {
			name = "verified email"
		}
		t.Run(name, func(t *testing.T) {
			db := setupRegistrationTest(t)
			common.EmailVerificationEnabled = verifyEmail
			constant.GenerateDefaultToken = true
			if verifyEmail {
				common.RegisterVerificationCodeWithKey("new@example.com", "123456", common.EmailVerificationPurpose)
			}
			router := gin.New()
			router.POST("/api/user/register", Register)
			router.POST("/api/user/auth/refresh", RefreshAuth)
			router.GET("/api/user/self", middleware.UserAuth(), GetSelf)
			response := performRegistrationRequest(t, router, `{"username":"new-user","password":"password123","email":"new@example.com","verification_code":"123456","role":100}`)
			require.Equal(t, http.StatusOK, response.Code)
			type registrationResponse struct {
				Success bool `json:"success"`
				Data    struct {
					service.AuthBundle
					User map[string]interface{} `json:"user"`
				} `json:"data"`
			}
			var result registrationResponse
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			require.True(t, result.Success)
			require.NotEmpty(t, result.Data.AccessToken, "registration must return a login bundle")
			assert.Equal(t, "Bearer", result.Data.TokenType)
			assert.Equal(t, "password", result.Data.Session.LoginMethod)
			assert.True(t, result.Data.Session.Current)
			assert.Equal(t, float64(common.RoleCommonUser), result.Data.User["role"])
			assert.NotContains(t, result.Data.User, "password")
			assert.NotContains(t, result.Data.User, "access_token")
			assert.NotContains(t, response.Body.String(), "refresh_token")
			var stored model.User
			require.NoError(t, db.Where("username = ?", "new-user").First(&stored).Error)
			assert.Equal(t, float64(stored.Id), result.Data.User["id"])
			assert.Positive(t, stored.LastLoginAt)
			var token model.Token
			require.NoError(t, db.Where("user_id = ?", stored.Id).First(&token).Error)
			var audit model.Log
			require.NoError(t, db.Where("user_id = ? AND type = ?", stored.Id, model.LogTypeLogin).First(&audit).Error)
			var auditOther map[string]interface{}
			require.NoError(t, common.UnmarshalJsonStr(audit.Other, &auditOther))
			assert.Equal(t, "password", auditOther["login_method"])

			cookies := response.Result().Cookies()
			require.Len(t, cookies, 1)
			cookie := cookies[0]
			assert.Equal(t, service.RefreshCookieName, cookie.Name)
			assert.Empty(t, cookie.Domain)
			assert.True(t, cookie.HttpOnly)
			assert.True(t, cookie.Secure)
			assert.Equal(t, http.SameSiteStrictMode, cookie.SameSite)
			assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))

			selfRequest := httptest.NewRequest(http.MethodGet, "https://main.example/api/user/self", nil)
			selfRequest.Header.Set("Authorization", "Bearer "+result.Data.AccessToken)
			selfResponse := httptest.NewRecorder()
			router.ServeHTTP(selfResponse, selfRequest)
			require.Equal(t, http.StatusOK, selfResponse.Code)
			var self struct {
				Success bool       `json:"success"`
				Data    model.User `json:"data"`
			}
			require.NoError(t, common.Unmarshal(selfResponse.Body.Bytes(), &self))
			assert.True(t, self.Success)
			assert.Equal(t, stored.Id, self.Data.Id)

			refreshRequest := httptest.NewRequest(http.MethodPost, "https://main.example/api/user/auth/refresh", nil)
			refreshRequest.AddCookie(cookie)
			refreshResponse := httptest.NewRecorder()
			router.ServeHTTP(refreshResponse, refreshRequest)
			require.Equal(t, http.StatusOK, refreshResponse.Code)
			var refreshed registrationResponse
			require.NoError(t, common.Unmarshal(refreshResponse.Body.Bytes(), &refreshed))
			require.True(t, refreshed.Success)
			require.NotEmpty(t, refreshed.Data.AccessToken, "refresh must return its own login bundle")
			assert.Equal(t, "Bearer", refreshed.Data.TokenType)
			assert.Equal(t, result.Data.Session.SID, refreshed.Data.Session.SID)
			assert.Equal(t, float64(stored.Id), refreshed.Data.User["id"])
			identity, err := service.ParseAccessToken(refreshed.Data.AccessToken)
			require.NoError(t, err)
			_, refreshedUser, err := service.ValidateLoginSession(identity)
			require.NoError(t, err)
			assert.Equal(t, stored.Id, refreshedUser.Id)
			assert.Equal(t, result.Data.Session.SID, identity.SessionID)
		})
	}
}

func TestRegisterWithoutAutomaticLoginKeepsCreatedAccount(t *testing.T) {
	for _, reason := range []string{"password login disabled", "session creation rejected"} {
		t.Run(reason, func(t *testing.T) {
			db := setupRegistrationTest(t)
			if reason == "password login disabled" {
				common.PasswordLoginEnabled = false
			} else {
				common.UserSessionActiveLimit = 0
			}
			router := gin.New()
			router.POST("/api/user/register", Register)
			response := performRegistrationRequest(t, router, `{"username":"new-user","password":"password123"}`)
			require.Equal(t, http.StatusOK, response.Code)
			var result struct {
				Success bool                `json:"success"`
				Data    *service.AuthBundle `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.True(t, result.Success, "account creation must not be reported as failed")
			assert.Nil(t, result.Data)
			assert.Empty(t, response.Result().Cookies())
			var stored model.User
			require.NoError(t, db.Where("username = ?", "new-user").First(&stored).Error)
			assert.Zero(t, stored.LastLoginAt)
			var count int64
			require.NoError(t, db.Model(&model.UserSession{}).Count(&count).Error)
			assert.Zero(t, count)
			require.NoError(t, db.Model(&model.Log{}).Where("type = ?", model.LogTypeLogin).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestRegisterRejectedRequestDoesNotCreateSession(t *testing.T) {
	for _, reason := range []string{"registration disabled", "password registration disabled", "invalid verification", "duplicate username"} {
		t.Run(reason, func(t *testing.T) {
			db := setupRegistrationTest(t)
			switch reason {
			case "registration disabled":
				common.RegisterEnabled = false
			case "password registration disabled":
				common.PasswordRegisterEnabled = false
			case "invalid verification":
				common.EmailVerificationEnabled = true
			case "duplicate username":
				require.NoError(t, db.Create(&model.User{Username: "new-user", Password: "unused"}).Error)
			}
			router := gin.New()
			router.POST("/api/user/register", Register)
			response := performRegistrationRequest(t, router, `{"username":"new-user","password":"password123","email":"invalid@example.com","verification_code":"wrong"}`)
			var result struct {
				Success bool `json:"success"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.False(t, result.Success)
			assert.Empty(t, response.Result().Cookies())
			var count int64
			require.NoError(t, db.Model(&model.UserSession{}).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestRegisterDoesNotSetSessionCookieForUntrustedBrowserOrigin(t *testing.T) {
	for _, origin := range []string{"https://foreign.example", "null", ""} {
		t.Run("origin="+origin, func(t *testing.T) {
			db := setupRegistrationTest(t)
			previousTrusted := common.SessionCookieTrustedURLs
			common.SessionCookieTrustedURLs = nil
			t.Cleanup(func() { common.SessionCookieTrustedURLs = previousTrusted })
			router := gin.New()
			router.POST("/api/user/register", Register)
			// A top-level text/plain form can carry valid JSON with the '='
			// separator inside an ignored field. It does not need a CORS preflight.
			request := httptest.NewRequest(http.MethodPost, "https://main.example/api/user/register",
				strings.NewReader("{\"username\":\"origin-user\",\"password\":\"password123\",\"padding\":\"=\"}\r\n"))
			request.Header.Set("Content-Type", "text/plain")
			request.Header.Set("Sec-Fetch-Site", "cross-site")
			request.Header.Set("Sec-Fetch-Mode", "navigate")
			if origin != "" {
				request.Header.Set("Origin", origin)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			require.Equal(t, http.StatusOK, response.Code)
			var result struct {
				Success bool                `json:"success"`
				Data    *service.AuthBundle `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			require.True(t, result.Success, "registration-only clients remain compatible")
			assert.Empty(t, response.Result().Cookies(), "untrusted registration must not replace a browser's login")
			assert.Nil(t, result.Data)
			var count int64
			require.NoError(t, db.Model(&model.UserSession{}).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}
