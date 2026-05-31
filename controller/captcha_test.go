package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func doGetCaptcha(t *testing.T) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/captcha", nil)
	GetCaptcha(c)
	return w
}

func TestGetCaptchaDisabled(t *testing.T) {
	prev := common.RegisterCaptchaEnabled
	t.Cleanup(func() { common.RegisterCaptchaEnabled = prev })
	common.RegisterCaptchaEnabled = false

	w := doGetCaptcha(t)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)
	require.Contains(t, w.Body.String(), "图形验证码未启用")
}

func TestGetCaptchaEnabledReturnsImage(t *testing.T) {
	prevCaptcha := common.RegisterCaptchaEnabled
	prevRedis := common.RedisEnabled
	t.Cleanup(func() {
		common.RegisterCaptchaEnabled = prevCaptcha
		common.RedisEnabled = prevRedis
	})
	common.RegisterCaptchaEnabled = true
	common.RedisEnabled = false

	w := doGetCaptcha(t)
	require.Equal(t, http.StatusOK, w.Code)
	body := w.Body.String()
	require.Contains(t, body, `"success":true`)
	require.Contains(t, body, "captcha_id")
	require.True(t, strings.Contains(body, "data:image/png;base64"))
}
