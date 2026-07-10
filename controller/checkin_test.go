package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

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
	common.SeedCaptchaWithCreatedAtForTest("checkin-captcha-id", "246810", time.Now().Add(-4*time.Second).UnixMilli())
	q := url.Values{}
	q.Set("captcha_id", "checkin-captcha-id")
	q.Set("captcha_answer", "wrong-answer")
	w, c := newCheckinTestContext("/api/user/checkin?" + q.Encode())

	DoCheckin(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)
	require.Contains(t, w.Body.String(), "图形验证码错误或已过期，请刷新重试")
}

func TestDoCheckinRejectsTooFastDuration(t *testing.T) {
	setupCheckinCaptchaTest(t)
	common.SeedCaptchaWithCreatedAtForTest("checkin-captcha-id", "246810", time.Now().Add(-2*time.Second).UnixMilli())
	q := url.Values{}
	q.Set("captcha_id", "checkin-captcha-id")
	q.Set("captcha_answer", "246810")
	// 客户端伪造足够长的 first_seen 也不应绕过服务端图片下发时间
	q.Set("captcha_first_seen_at", strconv.FormatInt(time.Now().Add(-10*time.Second).UnixMilli(), 10))

	w, c := newCheckinTestContext("/api/user/checkin?" + q.Encode())
	DoCheckin(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)
	require.Contains(t, w.Body.String(), "操作过快")
	// 过快失败不消费验证码
	require.True(t, common.VerifyCaptcha("checkin-captcha-id", "246810"))
}

func TestDoCheckinRejectsLegacyCaptchaWithoutCreatedAt(t *testing.T) {
	setupCheckinCaptchaTest(t)
	common.SeedCaptchaWithCreatedAtForTest("legacy-captcha-id", "111111", 0)
	q := url.Values{}
	q.Set("captcha_id", "legacy-captcha-id")
	q.Set("captcha_answer", "111111")
	w, c := newCheckinTestContext("/api/user/checkin?" + q.Encode())

	DoCheckin(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":false`)
	require.Contains(t, w.Body.String(), "验证码已失效，请刷新页面重新签到")
}

func TestParseCheckinCaptchaKeyInputs(t *testing.T) {
	inputs := sanitizeCheckinCaptchaKeyInputs(parseCheckinCaptchaKeyInputs(`[{"digit":"1","position":1,"display_count":1,"timestamp":1000,"elapsed_ms":120,"interval_ms":0},{"digit":"x"},{"digit":"2","order":2,"position":2,"display_count":1,"timestamp":1300,"elapsed_ms":420,"interval_ms":300}]`))

	require.Len(t, inputs, 2)
	require.Equal(t, "1", inputs[0].Digit)
	require.Equal(t, 1, inputs[0].Order)
	require.Equal(t, int64(120), inputs[0].ElapsedMs)
	require.Equal(t, "2", inputs[1].Digit)
	require.Equal(t, 2, inputs[1].Order)
}
