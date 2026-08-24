package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

const registrationEmailVerificationTestSessionSecret = "registration-email-verification-test"

type registrationEmailVerificationResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Verified  bool `json:"verified"`
		ExpiresIn int  `json:"expires_in"`
	} `json:"data"`
}

func registrationEmailVerificationTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte(registrationEmailVerificationTestSessionSecret))))
	router.POST("/exchange", ExchangeRegistrationEmailVerification)
	router.POST("/status", GetRegistrationEmailVerificationStatus)
	return router
}

func performRegistrationEmailVerificationRequest(t *testing.T, router *gin.Engine, path string, body map[string]any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := common.Marshal(body)
	require.NoError(t, err)
	request := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(payload))
	request.Header.Set("Content-Type", "application/json")
	for _, item := range cookies {
		request.AddCookie(item)
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder
}

func TestExchangeRegistrationEmailVerificationCreatesBrowserGrant(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	token, err := common.RegisterRegistrationEmailLink(" user@example.com ")
	require.NoError(t, err)

	router := registrationEmailVerificationTestRouter()
	recorder := performRegistrationEmailVerificationRequest(t, router, "/exchange", map[string]any{"token": token})

	var payload registrationEmailVerificationResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.True(t, payload.Data.Verified)
	require.Equal(t, common.VerificationValidMinutes*60, payload.Data.ExpiresIn)
	require.NotEmpty(t, recorder.Result().Cookies())
}

func TestExchangeRegistrationEmailVerificationRejectsInvalidTokenWithLocalizedMessage(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	router := registrationEmailVerificationTestRouter()
	payloadBytes, err := common.Marshal(map[string]any{"token": "invalid-token"})
	require.NoError(t, err)
	request := httptest.NewRequest(http.MethodPost, "/exchange", bytes.NewReader(payloadBytes))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept-Language", "zh-CN")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, request)

	var payload registrationEmailVerificationResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.False(t, payload.Success)
	require.Equal(t, backendI18n.Translate(backendI18n.LangZhCN, backendI18n.MsgEmailVerifyLinkInvalid), payload.Message)
}

func TestRegistrationEmailStatusMatchesOnlyExactTrimmedEmail(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	token, err := common.RegisterRegistrationEmailLink("user@example.com")
	require.NoError(t, err)
	router := registrationEmailVerificationTestRouter()
	exchange := performRegistrationEmailVerificationRequest(t, router, "/exchange", map[string]any{"token": token})
	require.NotEmpty(t, exchange.Result().Cookies())

	matching := performRegistrationEmailVerificationRequest(t, router, "/status", map[string]any{"email": " user@example.com "}, exchange.Result().Cookies()...)
	var matchingPayload registrationEmailVerificationResponse
	require.NoError(t, common.Unmarshal(matching.Body.Bytes(), &matchingPayload))
	require.True(t, matchingPayload.Success)
	require.True(t, matchingPayload.Data.Verified)

	different := performRegistrationEmailVerificationRequest(t, router, "/status", map[string]any{"email": "other@example.com"}, exchange.Result().Cookies()...)
	var differentPayload registrationEmailVerificationResponse
	require.NoError(t, common.Unmarshal(different.Body.Bytes(), &differentPayload))
	require.True(t, differentPayload.Success)
	require.False(t, differentPayload.Data.Verified)
}
