package middleware

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// newCaptchaTestRouter 构建一个挂载 session + CaptchaCheck 的测试路由，
// 命中放行时返回 200 {"passed":true}。
func newCaptchaTestRouter(setSession bool) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	store := cookie.NewStore([]byte("captcha-test-secret"))
	r.Use(sessions.Sessions("session", store))
	if setSession {
		r.Use(func(c *gin.Context) {
			s := sessions.Default(c)
			s.Set("id", 1)
			_ = s.Save()
			c.Next()
		})
	}
	r.GET("/guard", CaptchaCheck(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"passed": true})
	})
	return r
}

func doCaptchaReq(r *gin.Engine, query string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/guard?"+query, nil)
	r.ServeHTTP(w, req)
	return w
}

func setupCaptchaMiddlewareEnv(t *testing.T, captchaEnabled, turnstileEnabled bool) {
	t.Helper()
	prevCaptcha := common.RegisterCaptchaEnabled
	prevTurnstile := common.TurnstileCheckEnabled
	prevRedis := common.RedisEnabled
	t.Cleanup(func() {
		common.RegisterCaptchaEnabled = prevCaptcha
		common.TurnstileCheckEnabled = prevTurnstile
		common.RedisEnabled = prevRedis
	})
	common.RegisterCaptchaEnabled = captchaEnabled
	common.TurnstileCheckEnabled = turnstileEnabled
	common.RedisEnabled = false
}

func TestCaptchaCheckDisabledPasses(t *testing.T) {
	setupCaptchaMiddlewareEnv(t, false, false)
	w := doCaptchaReq(newCaptchaTestRouter(false), "")
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), "passed")
}

func TestCaptchaCheckTurnstilePriorityPasses(t *testing.T) {
	// Turnstile 启用时图形验证码让位，直接放行
	setupCaptchaMiddlewareEnv(t, true, true)
	w := doCaptchaReq(newCaptchaTestRouter(false), "")
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), "passed")
}

func TestCaptchaCheckLoggedInUserPasses(t *testing.T) {
	// 已登录用户（session 中存在 id）直接放行，不校验图形验证码
	setupCaptchaMiddlewareEnv(t, true, false)
	w := doCaptchaReq(newCaptchaTestRouter(true), "")
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), "passed")
}

func TestCaptchaCheckMissingInputAborts(t *testing.T) {
	setupCaptchaMiddlewareEnv(t, true, false)
	w := doCaptchaReq(newCaptchaTestRouter(false), "")
	require.Equal(t, http.StatusOK, w.Code)
	require.NotContains(t, w.Body.String(), "passed")
	require.Contains(t, w.Body.String(), "请输入图形验证码")
}

func TestCaptchaCheckWrongAnswerAborts(t *testing.T) {
	setupCaptchaMiddlewareEnv(t, true, false)
	id, _, err := common.GenerateCaptcha()
	require.NoError(t, err)

	q := url.Values{}
	q.Set("captcha_id", id)
	q.Set("captcha_answer", "wrong-answer")
	w := doCaptchaReq(newCaptchaTestRouter(false), q.Encode())
	require.Equal(t, http.StatusOK, w.Code)
	require.NotContains(t, w.Body.String(), "passed")
}

func TestCaptchaCheckCorrectAnswerPasses(t *testing.T) {
	setupCaptchaMiddlewareEnv(t, true, false)
	answer := common.SeedCaptchaForTest("captcha-mw-id", "246810")

	q := url.Values{}
	q.Set("captcha_id", "captcha-mw-id")
	q.Set("captcha_answer", answer)
	w := doCaptchaReq(newCaptchaTestRouter(false), q.Encode())
	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), "passed")
}
