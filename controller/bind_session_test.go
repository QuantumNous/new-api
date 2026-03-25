package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

func newBindSessionTestRouter(t *testing.T) *gin.Engine {
	t.Helper()

	router := gin.New()
	store := cookie.NewStore([]byte("bind-session-test-secret"))
	router.Use(sessions.Sessions("session", store))
	router.GET("/api/oauth/email/bind", EmailBind)
	router.GET("/api/oauth/wechat/bind", WeChatBind)
	router.GET("/api/oauth/telegram/bind", TelegramBind)
	return router
}

func performBindSessionTestRequest(t *testing.T, serverURL string, path string) oauthJWTAPIResponse {
	t.Helper()

	response, err := http.Get(serverURL + path)
	if err != nil {
		t.Fatalf("failed to perform request: %v", err)
	}
	defer response.Body.Close()

	var payload oauthJWTAPIResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return payload
}

func TestEmailBindRequiresLoggedInSession(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	router := newBindSessionTestRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	email := "bind-email@example.com"
	code := "123456"
	common.RegisterVerificationCodeWithKey(email, code, common.EmailVerificationPurpose)
	t.Cleanup(func() {
		common.DeleteKey(email, common.EmailVerificationPurpose)
	})

	response := performBindSessionTestRequest(
		t,
		server.URL,
		"/api/oauth/email/bind?email="+url.QueryEscape(email)+"&code="+url.QueryEscape(code),
	)

	if response.Success {
		t.Fatalf("expected email bind without session to fail")
	}
	if response.Message != "未登录" {
		t.Fatalf("unexpected error message: %s", response.Message)
	}
}

func TestWeChatBindRequiresLoggedInSession(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	router := newBindSessionTestRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	oldEnabled := common.WeChatAuthEnabled
	oldAddress := common.WeChatServerAddress
	oldToken := common.WeChatServerToken
	defer func() {
		common.WeChatAuthEnabled = oldEnabled
		common.WeChatServerAddress = oldAddress
		common.WeChatServerToken = oldToken
	}()

	wechatServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"success":true,"message":"","data":"wechat-user-1"}`))
	}))
	defer wechatServer.Close()

	common.WeChatAuthEnabled = true
	common.WeChatServerAddress = wechatServer.URL
	common.WeChatServerToken = "test-wechat-token"

	response := performBindSessionTestRequest(
		t,
		server.URL,
		"/api/oauth/wechat/bind?code=wechat-code",
	)

	if response.Success {
		t.Fatalf("expected wechat bind without session to fail")
	}
	if response.Message != "未登录" {
		t.Fatalf("unexpected error message: %s", response.Message)
	}
}

func TestTelegramBindRequiresLoggedInSession(t *testing.T) {
	setupCustomOAuthJWTControllerTestDB(t)
	router := newBindSessionTestRouter(t)
	server := httptest.NewServer(router)
	defer server.Close()

	oldEnabled := common.TelegramOAuthEnabled
	oldToken := common.TelegramBotToken
	defer func() {
		common.TelegramOAuthEnabled = oldEnabled
		common.TelegramBotToken = oldToken
	}()

	common.TelegramOAuthEnabled = true
	common.TelegramBotToken = "test-telegram-bot-token"

	params := buildTelegramAuthParams(common.TelegramBotToken, "123456789")
	response := performBindSessionTestRequest(
		t,
		server.URL,
		"/api/oauth/telegram/bind?"+params.Encode(),
	)

	if response.Success {
		t.Fatalf("expected telegram bind without session to fail")
	}
	if response.Message != "未登录" {
		t.Fatalf("unexpected error message: %s", response.Message)
	}
}

func buildTelegramAuthParams(botToken string, telegramID string) url.Values {
	params := url.Values{}
	params.Set("id", telegramID)
	params.Set("first_name", "Bind")
	params.Set("auth_date", strconv.FormatInt(time.Now().Unix(), 10))
	params.Set("hash", telegramAuthHash(params, botToken))
	return params
}

func telegramAuthHash(params url.Values, token string) string {
	items := make([]string, 0, len(params))
	for key, values := range params {
		if key == "hash" || len(values) == 0 {
			continue
		}
		items = append(items, key+"="+values[0])
	}
	sort.Strings(items)

	payload := ""
	for index, item := range items {
		if index > 0 {
			payload += "\n"
		}
		payload += item
	}

	sha256hash := sha256.New()
	_, _ = sha256hash.Write([]byte(token))
	hmacHash := hmac.New(sha256.New, sha256hash.Sum(nil))
	_, _ = hmacHash.Write([]byte(payload))
	return hex.EncodeToString(hmacHash.Sum(nil))
}
