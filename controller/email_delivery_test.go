package controller

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type emailHTTPTransport func(*http.Request) (*http.Response, error)

func (transport emailHTTPTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

func configureEmailDelivery(t *testing.T, options map[string]string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	original := common.OptionMap
	common.OptionMap = options
	common.OptionMapRWMutex.Unlock()
	originalTransport := http.DefaultTransport
	originalFrom, originalAccount, originalServer := common.SMTPFrom, common.SMTPAccount, common.SMTPServer
	common.SMTPFrom, common.SMTPAccount, common.SMTPServer = "", "", ""
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = original
		common.OptionMapRWMutex.Unlock()
		http.DefaultTransport = originalTransport
		common.SMTPFrom, common.SMTPAccount, common.SMTPServer = originalFrom, originalAccount, originalServer
	})
}

func TestResendDeliversThroughSelectedProvider(t *testing.T) {
	configureEmailDelivery(t, map[string]string{"EmailProvider": "resend", "ResendApiKey": "test-key", "ResendFrom": "New API <sender@example.com>"})
	calls := 0
	http.DefaultTransport = emailHTTPTransport(func(request *http.Request) (*http.Response, error) {
		calls++
		assert.Equal(t, "https://api.resend.com/emails", request.URL.String())
		assert.Equal(t, http.MethodPost, request.Method)
		assert.Equal(t, "Bearer test-key", request.Header.Get("Authorization"))
		assert.Equal(t, "application/json", request.Header.Get("Content-Type"))
		_, hasDeadline := request.Context().Deadline()
		assert.True(t, hasDeadline, "email delivery must have a bounded wait")
		var body struct {
			From    string   `json:"from"`
			To      []string `json:"to"`
			Subject string   `json:"subject"`
			HTML    string   `json:"html"`
		}
		require.NoError(t, common.DecodeJson(request.Body, &body))
		assert.Equal(t, `"New API" <sender@example.com>`, body.From)
		assert.Equal(t, []string{"one@example.com", "two@example.com"}, body.To)
		assert.Equal(t, "验证码", body.Subject)
		assert.Equal(t, "<p>123456</p>", body.HTML)
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"id":"email-test-id"}`)), Header: make(http.Header)}, nil
	})
	require.NoError(t, common.SendEmail("验证码", "one@example.com; two@example.com", "<p>123456</p>"))
	assert.Equal(t, 1, calls, "no SMTP configuration is needed and no duplicate request is made")
}

func TestResendFailuresDoNotRetryFallbackOrExposeSensitiveContent(t *testing.T) {
	for _, status := range []int{302, 400, 401, 403, 429, 500} {
		t.Run(strconv.Itoa(status), func(t *testing.T) {
			configureEmailDelivery(t, map[string]string{"EmailProvider": "resend", "ResendApiKey": "test-key", "ResendFrom": "sender@example.com"})
			calls := 0
			http.DefaultTransport = emailHTTPTransport(func(request *http.Request) (*http.Response, error) {
				calls++
				return &http.Response{StatusCode: status, Header: http.Header{"Location": []string{"https://untrusted.example/emails"}}, Body: io.NopCloser(strings.NewReader(`{"message":"test-key 123456 reset-token"}`))}, nil
			})
			err := common.SendEmail("verification", "one@example.com", "123456 reset-token")
			require.EqualError(t, err, "Resend email delivery failed (HTTP "+strconv.Itoa(status)+")")
			assert.Equal(t, 1, calls, "do not retry or follow redirects")
		})
	}
}

func TestResendRejectsIncompleteOrInvalidConfigurationBeforeSending(t *testing.T) {
	tests := []struct{ name, key, from, receiver string }{
		{"missing key", "", "sender@example.com", "one@example.com"},
		{"header injection", "key\r\nInjected: value", "sender@example.com", "one@example.com"},
		{"missing sender", "test-key", "", "one@example.com"},
		{"invalid sender", "test-key", "bad-address", "one@example.com"},
		{"invalid recipient", "test-key", "sender@example.com", "bad-address"},
		{"empty recipient", "test-key", "sender@example.com", ""},
		{"too many recipients", "test-key", "sender@example.com", strings.Repeat("one@example.com;", 50) + "two@example.com"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			configureEmailDelivery(t, map[string]string{"EmailProvider": "resend", "ResendApiKey": test.key, "ResendFrom": test.from})
			http.DefaultTransport = emailHTTPTransport(func(*http.Request) (*http.Response, error) {
				t.Fatal("invalid settings must not make a request")
				return nil, errors.New("unexpected request")
			})
			err := common.SendEmail("verification", test.receiver, "123456")
			require.Error(t, err)
			assert.NotContains(t, err.Error(), "123456")
			assert.NotContains(t, err.Error(), "test-key")
		})
	}
}

func TestResendRejectsMalformedSuccessAndSanitizesTransportErrors(t *testing.T) {
	for _, body := range []string{`{}`, `not json`, `{"id":false}`, `{"id":""}`} {
		t.Run(body, func(t *testing.T) {
			configureEmailDelivery(t, map[string]string{"EmailProvider": "resend", "ResendApiKey": "test-key", "ResendFrom": "sender@example.com"})
			http.DefaultTransport = emailHTTPTransport(func(*http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
			})
			require.EqualError(t, common.SendEmail("verification", "one@example.com", "123456"), "Invalid Resend delivery response")
		})
	}
	configureEmailDelivery(t, map[string]string{"EmailProvider": "resend", "ResendApiKey": "test-key", "ResendFrom": "sender@example.com"})
	http.DefaultTransport = emailHTTPTransport(func(*http.Request) (*http.Response, error) { return nil, errors.New("test-key 123456 reset-token") })
	require.EqualError(t, common.SendEmail("verification", "one@example.com", "123456"), "Resend request failed")
}

func TestSMTPAndLegacyConfigurationNeverUseResend(t *testing.T) {
	for _, provider := range []string{"", "smtp", "invalid"} {
		t.Run("provider="+provider, func(t *testing.T) {
			configureEmailDelivery(t, map[string]string{"EmailProvider": provider, "ResendApiKey": "test-key", "ResendFrom": "sender@example.com"})
			http.DefaultTransport = emailHTTPTransport(func(*http.Request) (*http.Response, error) {
				t.Fatal("SMTP and unknown providers must not invoke Resend")
				return nil, errors.New("unexpected request")
			})
			require.Error(t, common.SendEmail("verification", "one@example.com", "123456"))
		})
	}
}

func TestEmailOptionsNeverReturnResendCredentials(t *testing.T) {
	configureEmailDelivery(t, map[string]string{"EmailProvider": "resend", "ResendApiKey": "private-email-credential", "ResendFrom": "sender@example.com"})
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)
	GetOptions(context)
	require.Equal(t, http.StatusOK, response.Code)
	assert.NotContains(t, response.Body.String(), "private-email-credential")
	assert.NotContains(t, response.Body.String(), "ResendApiKey")
	assert.Contains(t, response.Body.String(), "ResendFrom")
	assert.Contains(t, response.Body.String(), `"key":"ResendKeyConfigured","value":"true"`)
}

func TestEmailProviderOptionRejectsInvalidValues(t *testing.T) {
	for _, provider := range []string{"", "both", "SMTP", "smtp,resend"} {
		t.Run(provider, func(t *testing.T) {
			configureEmailDelivery(t, map[string]string{"EmailProvider": "smtp"})
			body, err := common.Marshal(OptionUpdateRequest{Key: "EmailProvider", Value: provider})
			require.NoError(t, err)
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(string(body)))
			UpdateOption(context)
			assert.Contains(t, response.Body.String(), `"success":false`)
			assert.Contains(t, response.Body.String(), `"message_key":"Email sending method must be SMTP or Resend"`)
			assert.Equal(t, "smtp", common.OptionMap["EmailProvider"])
		})
	}
}

func TestEmailProviderCannotActivateIncompleteResend(t *testing.T) {
	for name, settings := range map[string]map[string]string{
		"missing key":    {"ResendFrom": "sender@example.com"},
		"missing sender": {"ResendApiKey": "test-key"},
		"invalid sender": {"ResendApiKey": "test-key", "ResendFrom": "invalid"},
		"invalid key":    {"ResendApiKey": "key\r\nInjected: value", "ResendFrom": "sender@example.com"},
	} {
		t.Run(name, func(t *testing.T) {
			settings["EmailProvider"] = "smtp"
			configureEmailDelivery(t, settings)
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(`{"key":"EmailProvider","value":"resend"}`))
			require.NotPanics(t, func() { UpdateOption(context) }, "invalid activation must fail before accessing storage")
			assert.Contains(t, response.Body.String(), `"success":false`)
			assert.Contains(t, response.Body.String(), `"message_key":"Resend `)
			assert.Equal(t, "smtp", common.OptionMap["EmailProvider"])
			assert.NotContains(t, response.Body.String(), "test-key")
		})
	}
}

func TestResendSettingsChangesKeepActiveDeliveryWorking(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	previousDB, previousRedis := model.DB, common.RedisEnabled
	model.DB, common.RedisEnabled = db, false
	t.Cleanup(func() { model.DB, common.RedisEnabled = previousDB, previousRedis })

	tests := []struct {
		name, provider, key, value string
		saved                      bool
	}{
		{"active sender the parser rejects", "resend", "ResendFrom", "notify..team@example.com", false},
		{"active key cleared", "resend", "ResendApiKey", " ", false},
		{"active sender renamed", "resend", "ResendFrom", `"New API" <notify@example.com>`, true},
		{"inactive sender saved before its key", "smtp", "ResendFrom", "notify@example.com", true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			settings := map[string]string{"EmailProvider": test.provider, "ResendApiKey": "test-key", "ResendFrom": "sender@example.com"}
			if test.provider == "smtp" {
				settings["ResendApiKey"] = ""
			}
			configureEmailDelivery(t, settings)
			before := settings[test.key]
			body, err := common.Marshal(OptionUpdateRequest{Key: test.key, Value: test.value})
			require.NoError(t, err)
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(string(body)))
			UpdateOption(context)
			if test.saved {
				assert.Contains(t, response.Body.String(), `"success":true`)
				assert.Equal(t, test.value, common.OptionMap[test.key])
				return
			}
			assert.Contains(t, response.Body.String(), `"message_key":"Resend `)
			assert.Equal(t, before, common.OptionMap[test.key])
		})
	}
}

func TestEmailKeyStatusIsDerivedAndReadOnly(t *testing.T) {
	configureEmailDelivery(t, map[string]string{"EmailProvider": "smtp", "ResendKeyConfigured": "true"})
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/option/", nil)
	GetOptions(context)
	assert.Contains(t, response.Body.String(), `"key":"ResendKeyConfigured","value":"false"`)
	assert.NotContains(t, response.Body.String(), `"value":"true"`)

	response = httptest.NewRecorder()
	context, _ = gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(`{"key":"ResendKeyConfigured","value":true}`))
	UpdateOption(context)
	assert.Contains(t, response.Body.String(), `"success":false`)
	assert.Contains(t, response.Body.String(), "read-only")
}

func TestPasswordResetUsesStoredEmailAndSingleUseToken(t *testing.T) {
	require.NoError(t, i18n.Init())
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}))
	previousDB, previousRedis, previousServerAddress, previousValidMinutes := model.DB, common.RedisEnabled, system_setting.ServerAddress, common.VerificationValidMinutes
	model.DB, common.RedisEnabled, system_setting.ServerAddress = db, false, "https://gateway.example"
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
		system_setting.ServerAddress = previousServerAddress
		common.VerificationValidMinutes = previousValidMinutes
		common.DeleteKey("victim+tag@example.com", common.PasswordResetPurpose)
		common.DeleteKey("victim+tag@exámple.com", common.PasswordResetPurpose)
	})

	originalHash, err := common.HashAccountPassword("OriginalPass123!")
	require.NoError(t, err)
	victim := model.User{
		Username:    "victim",
		Password:    originalHash,
		Email:       "Victim+Tag@Example.com",
		AffCode:     "vic1",
		Status:      common.UserStatusEnabled,
		AuthVersion: 1,
	}
	require.NoError(t, db.Create(&victim).Error)
	// Also ensure a look-alike email stored alongside does not confuse lookup.
	require.NoError(t, db.Create(&model.User{
		Username: "other",
		Password: originalHash,
		Email:    "victim+tag@exàmple.com",
		AffCode:  "oth1",
		Status:   common.UserStatusEnabled,
	}).Error)

	type deliveredEmail struct {
		To   []string
		HTML string
	}
	var delivered []deliveredEmail
	failDelivery := false
	var replacementCode string
	configureEmailDelivery(t, map[string]string{
		"EmailProvider": "resend",
		"ResendApiKey":  "test-key",
		"ResendFrom":    "sender@example.com",
	})
	http.DefaultTransport = emailHTTPTransport(func(request *http.Request) (*http.Response, error) {
		var body struct {
			To   []string `json:"to"`
			HTML string   `json:"html"`
		}
		require.NoError(t, common.DecodeJson(request.Body, &body))
		delivered = append(delivered, deliveredEmail{To: body.To, HTML: body.HTML})
		if failDelivery {
			if replacementCode != "" {
				common.RegisterVerificationCodeWithKey(model.NormalizeEmail(victim.Email), replacementCode, common.PasswordResetPurpose)
			}
			return &http.Response{StatusCode: http.StatusInternalServerError, Body: io.NopCloser(strings.NewReader(`{"message":"smtp down"}`)), Header: make(http.Header)}, nil
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"email-1"}`)), Header: make(http.Header)}, nil
	})

	tokenRe := regexp.MustCompile(`https://gateway\.example/user/reset\?email=([^&'"<\s]+)&token=([0-9a-f]+)`)

	// 1. Accent look-alike address does not match victim and sends no mail.
	resp := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(resp)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/reset_password?email="+url.QueryEscape("victim+tag@exámple.com"), nil)
	SendPasswordResetEmail(ctx)
	require.Equal(t, http.StatusOK, resp.Code)
	assert.Contains(t, resp.Body.String(), `"success":true`)
	assert.Empty(t, delivered)

	// 2. Preserve the mailbox on file for delivery, but use the normalized key in the URL.
	resp = httptest.NewRecorder()
	ctx, _ = gin.CreateTestContext(resp)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/reset_password?email="+url.QueryEscape("VICTIM+TAG@EXAMPLE.COM"), nil)
	SendPasswordResetEmail(ctx)
	require.Equal(t, http.StatusOK, resp.Code)
	require.Len(t, delivered, 1)
	assert.Equal(t, []string{victim.Email}, delivered[0].To)
	matches := tokenRe.FindStringSubmatch(delivered[0].HTML)
	require.Len(t, matches, 3)
	assert.Equal(t, url.QueryEscape("victim+tag@example.com"), matches[1])
	token := matches[2]

	// 3. Redeeming with look-alike email fails even with the real token.
	resp = httptest.NewRecorder()
	ctx, _ = gin.CreateTestContext(resp)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/reset", strings.NewReader(`{"email":"victim+tag@exámple.com","token":"`+token+`"}`))
	ResetPassword(ctx)
	assert.Contains(t, resp.Body.String(), `"success":false`)

	// 4. Redeeming once with the real email resets the password and rotates auth version.
	resp = httptest.NewRecorder()
	ctx, _ = gin.CreateTestContext(resp)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/reset", strings.NewReader(`{"email":"Victim+Tag@Example.com","token":"`+token+`"}`))
	ResetPassword(ctx)
	require.Equal(t, http.StatusOK, resp.Code)
	var resetResp struct {
		Success bool   `json:"success"`
		Data    string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(resp.Body.Bytes(), &resetResp))
	require.True(t, resetResp.Success)
	require.NotEmpty(t, resetResp.Data)

	var updated model.User
	require.NoError(t, db.First(&updated, victim.Id).Error)
	assert.True(t, common.ValidatePasswordAndHash(resetResp.Data, updated.Password))
	assert.False(t, common.ValidatePasswordAndHash("OriginalPass123!", updated.Password))
	assert.Equal(t, int64(2), updated.AuthVersion)

	// 5. Replaying the same token is rejected.
	resp = httptest.NewRecorder()
	ctx, _ = gin.CreateTestContext(resp)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/reset", strings.NewReader(`{"email":"victim+tag@example.com","token":"`+token+`"}`))
	ResetPassword(ctx)
	assert.Contains(t, resp.Body.String(), `"success":false`)

	// 6. Failed delivery revokes the generated token so no undelivered code remains active.
	failDelivery = true
	resp = httptest.NewRecorder()
	ctx, _ = gin.CreateTestContext(resp)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/reset_password?email="+url.QueryEscape("victim+tag@example.com"), nil)
	SendPasswordResetEmail(ctx)
	require.Len(t, delivered, 2)
	failedMatches := tokenRe.FindStringSubmatch(delivered[1].HTML)
	require.Len(t, failedMatches, 3)
	assert.False(t, common.VerifyCodeWithKey("victim+tag@example.com", failedMatches[2], common.PasswordResetPurpose))

	// A late delivery failure must not revoke the code issued by a newer request.
	replacementCode = common.GenerateVerificationCode(0)
	ctx, _ = gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/reset_password?email="+url.QueryEscape(victim.Email), nil)
	SendPasswordResetEmail(ctx)
	require.Len(t, delivered, 3)
	assert.True(t, common.ConsumeCodeWithKey(model.NormalizeEmail(victim.Email), replacementCode, common.PasswordResetPurpose))

	// 7. Expired token is rejected and cleared.
	failDelivery = false
	common.VerificationValidMinutes = 0
	common.RegisterVerificationCodeWithKey("victim+tag@example.com", "expired-token-value", common.PasswordResetPurpose)
	resp = httptest.NewRecorder()
	ctx, _ = gin.CreateTestContext(resp)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/reset", strings.NewReader(`{"email":"victim+tag@example.com","token":"expired-token-value"}`))
	ResetPassword(ctx)
	assert.Contains(t, resp.Body.String(), `"success":false`)
}
