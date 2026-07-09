package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type registerResponse struct {
	Success bool `json:"success"`
	Data    struct {
		ID        int    `json:"id"`
		Username  string `json:"username"`
		IsNewUser bool   `json:"is_new_user"`
	} `json:"data"`
}

func performRegisterRequest(t *testing.T, body []byte, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("register-session-test"))))
	router.POST("/api/user/register", Register)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/user/register", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}
	router.ServeHTTP(recorder, request)

	return recorder
}

func performWeChatAuthRequest(t *testing.T, code string) *httptest.ResponseRecorder {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("wechat-session-test"))))
	router.GET("/api/oauth/wechat", WeChatAuth)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/oauth/wechat?code="+code, nil)
	router.ServeHTTP(recorder, request)

	return recorder
}

func TestRegisterPersistsSharedCookieLanguage(t *testing.T) {
	db := setupModelListControllerTestDB(t)

	originalRegisterEnabled := common.RegisterEnabled
	originalPasswordRegisterEnabled := common.PasswordRegisterEnabled
	originalEmailVerificationEnabled := common.EmailVerificationEnabled
	originalGenerateDefaultToken := constant.GenerateDefaultToken
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
		common.PasswordRegisterEnabled = originalPasswordRegisterEnabled
		common.EmailVerificationEnabled = originalEmailVerificationEnabled
		constant.GenerateDefaultToken = originalGenerateDefaultToken
	})
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	constant.GenerateDefaultToken = false

	body, err := common.Marshal(map[string]any{
		"username": "cookie-language-user",
		"password": "password123",
		"email":    "cookie-language@example.com",
	})
	require.NoError(t, err)

	recorder := performRegisterRequest(t, body, &http.Cookie{
		Name:  backendI18n.LanguagePreferenceCookieName,
		Value: "ja",
	})

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload registerResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)

	var user model.User
	require.NoError(t, db.First(&user, "username = ?", "cookie-language-user").Error)
	require.Equal(t, "ja", user.GetSetting().Language)
}

func TestRegisterWithEmailVerificationAutoLogsInNewUser(t *testing.T) {
	setupModelListControllerTestDB(t)

	originalRegisterEnabled := common.RegisterEnabled
	originalPasswordRegisterEnabled := common.PasswordRegisterEnabled
	originalEmailVerificationEnabled := common.EmailVerificationEnabled
	originalGenerateDefaultToken := constant.GenerateDefaultToken
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
		common.PasswordRegisterEnabled = originalPasswordRegisterEnabled
		common.EmailVerificationEnabled = originalEmailVerificationEnabled
		constant.GenerateDefaultToken = originalGenerateDefaultToken
	})
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = true
	constant.GenerateDefaultToken = false

	common.RegisterVerificationCodeWithKey("verified@example.com", "123456", common.EmailVerificationPurpose)
	body, err := common.Marshal(map[string]any{
		"username":          "verified-user",
		"password":          "password123",
		"email":             "verified@example.com",
		"verification_code": "123456",
	})
	require.NoError(t, err)

	recorder := performRegisterRequest(t, body)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.NotEmpty(t, recorder.Result().Cookies(), "registration should establish a login session")
	var payload registerResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.NotZero(t, payload.Data.ID)
	require.Equal(t, "verified-user", payload.Data.Username)
	require.True(t, payload.Data.IsNewUser)
}

func TestRegisterRejectsEmailOutsideDomainWhitelist(t *testing.T) {
	db := setupModelListControllerTestDB(t)

	originalRegisterEnabled := common.RegisterEnabled
	originalPasswordRegisterEnabled := common.PasswordRegisterEnabled
	originalEmailVerificationEnabled := common.EmailVerificationEnabled
	originalEmailDomainRestrictionEnabled := common.EmailDomainRestrictionEnabled
	originalEmailDomainWhitelist := append([]string(nil), common.EmailDomainWhitelist...)
	originalGenerateDefaultToken := constant.GenerateDefaultToken
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
		common.PasswordRegisterEnabled = originalPasswordRegisterEnabled
		common.EmailVerificationEnabled = originalEmailVerificationEnabled
		common.EmailDomainRestrictionEnabled = originalEmailDomainRestrictionEnabled
		common.EmailDomainWhitelist = originalEmailDomainWhitelist
		constant.GenerateDefaultToken = originalGenerateDefaultToken
	})
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	common.EmailDomainRestrictionEnabled = true
	common.EmailDomainWhitelist = []string{"allowed.example"}
	constant.GenerateDefaultToken = false

	body, err := common.Marshal(map[string]any{
		"username": "blocked-domain-user",
		"password": "password123",
		"email":    "blocked@outside.example",
	})
	require.NoError(t, err)

	recorder := performRegisterRequest(t, body)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.False(t, payload.Success)
	require.NotEmpty(t, payload.Message)

	var users int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", "blocked-domain-user").Count(&users).Error)
	require.Zero(t, users)
}

func TestRegisterDefaultTokenLimitDoesNotBlockRegistration(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Token{}))

	originalRegisterEnabled := common.RegisterEnabled
	originalPasswordRegisterEnabled := common.PasswordRegisterEnabled
	originalEmailVerificationEnabled := common.EmailVerificationEnabled
	originalGenerateDefaultToken := constant.GenerateDefaultToken
	tokenSetting := operation_setting.GetTokenSetting()
	originalMaxUserTokens := tokenSetting.MaxUserTokens
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
		common.PasswordRegisterEnabled = originalPasswordRegisterEnabled
		common.EmailVerificationEnabled = originalEmailVerificationEnabled
		constant.GenerateDefaultToken = originalGenerateDefaultToken
		tokenSetting.MaxUserTokens = originalMaxUserTokens
	})
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	constant.GenerateDefaultToken = true
	tokenSetting.MaxUserTokens = 0

	body, err := common.Marshal(map[string]any{
		"username": "token-limit-user",
		"password": "password123",
		"email":    "token-limit@example.com",
	})
	require.NoError(t, err)

	recorder := performRegisterRequest(t, body)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.NotEmpty(t, recorder.Result().Cookies(), "registration should establish a login session")
	var payload registerResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.NotZero(t, payload.Data.ID)
	require.True(t, payload.Data.IsNewUser)

	var tokenCount int64
	require.NoError(t, db.Model(&model.Token{}).Count(&tokenCount).Error)
	require.Zero(t, tokenCount)
}

func TestRegisterDefaultTokenForPlgUserIgnoresAutoGroupDefault(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Token{}))

	originalRegisterEnabled := common.RegisterEnabled
	originalPasswordRegisterEnabled := common.PasswordRegisterEnabled
	originalEmailVerificationEnabled := common.EmailVerificationEnabled
	originalGenerateDefaultToken := constant.GenerateDefaultToken
	originalDefaultUseAutoGroup := setting.DefaultUseAutoGroup
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
		common.PasswordRegisterEnabled = originalPasswordRegisterEnabled
		common.EmailVerificationEnabled = originalEmailVerificationEnabled
		constant.GenerateDefaultToken = originalGenerateDefaultToken
		setting.DefaultUseAutoGroup = originalDefaultUseAutoGroup
	})
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	constant.GenerateDefaultToken = true
	setting.DefaultUseAutoGroup = true

	body, err := common.Marshal(map[string]any{
		"username": "plg-token-user",
		"password": "password123",
		"email":    "plg-default-token@example.com",
	})
	require.NoError(t, err)

	recorder := performRegisterRequest(t, body)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload registerResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)

	var token model.Token
	require.NoError(t, db.First(&token, "user_id = ?", payload.Data.ID).Error)
	require.Equal(t, plgGroup, token.Group)
	require.False(t, token.CrossGroupRetry)
}

func TestWeChatAuthNewUserMarksIsNewUser(t *testing.T) {
	setupModelListControllerTestDB(t)

	wechatServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/wechat/user", r.URL.Path)
		require.Equal(t, "valid-wechat-code", r.URL.Query().Get("code"))
		body, err := common.Marshal(map[string]any{
			"success": true,
			"message": "",
			"data":    "wechat-open-id-new-user",
		})
		require.NoError(t, err)
		w.Header().Set("Content-Type", "application/json")
		_, err = w.Write(body)
		require.NoError(t, err)
	}))
	defer wechatServer.Close()

	originalWeChatAuthEnabled := common.WeChatAuthEnabled
	originalRegisterEnabled := common.RegisterEnabled
	originalWeChatServerAddress := common.WeChatServerAddress
	originalWeChatServerToken := common.WeChatServerToken
	t.Cleanup(func() {
		common.WeChatAuthEnabled = originalWeChatAuthEnabled
		common.RegisterEnabled = originalRegisterEnabled
		common.WeChatServerAddress = originalWeChatServerAddress
		common.WeChatServerToken = originalWeChatServerToken
	})
	common.WeChatAuthEnabled = true
	common.RegisterEnabled = true
	common.WeChatServerAddress = wechatServer.URL
	common.WeChatServerToken = "test-token"

	recorder := performWeChatAuthRequest(t, "valid-wechat-code")

	require.Equal(t, http.StatusOK, recorder.Code)
	require.NotEmpty(t, recorder.Result().Cookies(), "WeChat registration should establish a login session")
	var payload registerResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.NotZero(t, payload.Data.ID)
	require.True(t, payload.Data.IsNewUser)
}
