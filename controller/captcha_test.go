package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

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
	prevCheckin := operation_setting.GetCheckinSetting().Enabled
	t.Cleanup(func() {
		common.RegisterCaptchaEnabled = prev
		operation_setting.GetCheckinSetting().Enabled = prevCheckin
	})
	common.RegisterCaptchaEnabled = false
	operation_setting.GetCheckinSetting().Enabled = false

	w := doGetCaptcha(t)
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)
	require.Contains(t, w.Body.String(), "图形验证码未启用")
}

func TestGetCaptchaEnabledReturnsImage(t *testing.T) {
	prevCaptcha := common.RegisterCaptchaEnabled
	prevRedis := common.RedisEnabled
	prevCheckin := operation_setting.GetCheckinSetting().Enabled
	t.Cleanup(func() {
		common.RegisterCaptchaEnabled = prevCaptcha
		common.RedisEnabled = prevRedis
		operation_setting.GetCheckinSetting().Enabled = prevCheckin
	})
	common.RegisterCaptchaEnabled = true
	common.RedisEnabled = false
	operation_setting.GetCheckinSetting().Enabled = false

	w := doGetCaptcha(t)
	require.Equal(t, http.StatusOK, w.Code)
	body := w.Body.String()
	require.Contains(t, body, `"success":true`)
	require.Contains(t, body, "captcha_id")
	require.True(t, strings.Contains(body, "data:image/png;base64"))
}

func TestGetCaptchaCheckinEnabledReturnsImage(t *testing.T) {
	prevCaptcha := common.RegisterCaptchaEnabled
	prevRedis := common.RedisEnabled
	prevCheckin := operation_setting.GetCheckinSetting().Enabled
	t.Cleanup(func() {
		common.RegisterCaptchaEnabled = prevCaptcha
		common.RedisEnabled = prevRedis
		operation_setting.GetCheckinSetting().Enabled = prevCheckin
	})
	common.RegisterCaptchaEnabled = false
	common.RedisEnabled = false
	operation_setting.GetCheckinSetting().Enabled = true

	w := doGetCaptcha(t)
	require.Equal(t, http.StatusOK, w.Code)
	body := w.Body.String()
	require.Contains(t, body, `"success":true`)
	require.Contains(t, body, "captcha_id")
	require.True(t, strings.Contains(body, "data:image/png;base64"))
}
