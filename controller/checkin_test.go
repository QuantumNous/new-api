package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newCheckinTestContext(rawURL string) (*httptest.ResponseRecorder, *gin.Context) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, rawURL, nil)
	c.Set("id", 1)
	return w, c
}

func setupCheckinCaptchaTest(t *testing.T) {
	t.Helper()
	prevEnabled := operation_setting.GetCheckinSetting().Enabled
	prevRedis := common.RedisEnabled
	t.Cleanup(func() {
		operation_setting.GetCheckinSetting().Enabled = prevEnabled
		common.RedisEnabled = prevRedis
	})
	operation_setting.GetCheckinSetting().Enabled = true
	common.RedisEnabled = false
}

func TestDoCheckinRequiresCaptcha(t *testing.T) {
	setupCheckinCaptchaTest(t)
	w, c := newCheckinTestContext("/api/user/checkin")

	DoCheckin(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)
	require.Contains(t, w.Body.String(), "请输入图形验证码")
}

func TestDoCheckinRejectsWrongCaptcha(t *testing.T) {
	setupCheckinCaptchaTest(t)
	common.SeedCaptchaForTest("checkin-captcha-id", "246810")
	q := url.Values{}
	q.Set("captcha_id", "checkin-captcha-id")
	q.Set("captcha_answer", "wrong-answer")
	w, c := newCheckinTestContext("/api/user/checkin?" + q.Encode())

	DoCheckin(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)
	require.Contains(t, w.Body.String(), "图形验证码错误或已过期，请刷新重试")
}
