package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
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

func performRegisterRequest(t *testing.T, body []byte) *httptest.ResponseRecorder {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("register-session-test"))))
	router.POST("/api/user/register", Register)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/user/register", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	return recorder
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
