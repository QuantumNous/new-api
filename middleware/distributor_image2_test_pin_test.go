package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func image2TestPinNow() time.Time {
	return time.Date(2026, time.August, 10, 1, 0, 0, 0, time.FixedZone("CST", 8*60*60))
}

func setImage2TestPinEnv(t *testing.T, enabled, tokenID string, until time.Time) {
	t.Helper()
	t.Setenv(image2TestPinEnabledEnv, enabled)
	t.Setenv(image2TestPinTokenIDEnv, tokenID)
	if until.IsZero() {
		t.Setenv(image2TestPinUntilEnv, "")
	} else {
		t.Setenv(image2TestPinUntilEnv, until.Format(time.RFC3339))
	}
}

func newImage2TestPinContext(t *testing.T, requestURL, remoteAddr, body string) *gin.Context {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, requestURL, strings.NewReader(body))
	ctx.Request.RemoteAddr = remoteAddr
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", image2TestPinUserID)
	ctx.Set("token_id", 730001)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, image2TestPinGroup)
	return ctx
}

func resolveAndTryImage2TestPin(t *testing.T, ctx *gin.Context, now time.Time) bool {
	t.Helper()
	modelRequest, _, err := getModelRequest(ctx)
	require.NoError(t, err)
	return maybeSetImage2TestPin(ctx, modelRequest, now)
}

func TestImage2TestPinFailureFirstAndLoopbackPositive(t *testing.T) {
	now := image2TestPinNow()
	until := now.Add(time.Hour)
	setImage2TestPinEnv(t, "true", "730001", until)

	tests := []struct {
		name          string
		requestURL    string
		remoteAddr    string
		body          string
		tokenID       int
		group         string
		preexistingID any
		enabled       string
		deadline      time.Time
		wantPin       bool
		wantChannelID any
	}{
		{
			name:       "non-allowlisted-token-does-not-pin",
			remoteAddr: "127.0.0.1:3001",
			body:       `{"model":"gpt-image-2"}`,
			tokenID:    730002,
			group:      image2TestPinGroup,
		},
		{
			name:          "all-server-conditions-loopback-pin-32",
			remoteAddr:    "127.0.0.1:3001",
			body:          `{"model":"gpt-image-2"}`,
			tokenID:       730001,
			group:         image2TestPinGroup,
			wantPin:       true,
			wantChannelID: image2TestPinChannelID,
		},
		{
			name:       "public-remote-and-spoofed-forwarded-for-do-not-pin",
			remoteAddr: "203.0.113.10:3001",
			body:       `{"model":"gpt-image-2"}`,
			tokenID:    730001,
			group:      image2TestPinGroup,
		},
		{
			name:       "malformed-tcp-remote-does-not-pin",
			remoteAddr: "127.0.0.1:not-a-port",
			body:       `{"model":"gpt-image-2"}`,
			tokenID:    730001,
			group:      image2TestPinGroup,
		},
		{
			name:       "body-header-query-channel-spoof-does-not-pin",
			requestURL: "/v1/images/generations?model=gpt-image-2&channel_id=32",
			remoteAddr: "127.0.0.1:3001",
			body:       `{"model":"gpt-image-1","group":"gpt-image-2-4k","channel_id":32}`,
			tokenID:    730001,
			group:      image2TestPinGroup,
		},
		{
			name:       "expired-hard-deadline-does-not-pin",
			remoteAddr: "127.0.0.1:3001",
			body:       `{"model":"gpt-image-2"}`,
			tokenID:    730001,
			group:      image2TestPinGroup,
			deadline:   now.Add(-time.Second),
		},
		{
			name:       "switch-off-does-not-pin",
			remoteAddr: "127.0.0.1:3001",
			body:       `{"model":"gpt-image-2"}`,
			tokenID:    730001,
			group:      image2TestPinGroup,
			enabled:    "false",
		},
		{
			name:       "model-mismatch-does-not-pin",
			remoteAddr: "127.0.0.1:3001",
			body:       `{"model":"gpt-image-1"}`,
			tokenID:    730001,
			group:      image2TestPinGroup,
		},
		{
			name:       "resolved-group-mismatch-does-not-pin",
			remoteAddr: "127.0.0.1:3001",
			body:       `{"model":"gpt-image-2"}`,
			tokenID:    730001,
			group:      "default",
		},
		{
			name:          "admin-existing-specific-channel-wins",
			remoteAddr:    "127.0.0.1:3001",
			body:          `{"model":"gpt-image-2"}`,
			tokenID:       730001,
			group:         image2TestPinGroup,
			preexistingID: "47",
			wantChannelID: "47",
		},
		{
			name:       "ordinary-business-path-does-not-pin",
			requestURL: "/v1/chat/completions",
			remoteAddr: "127.0.0.1:3001",
			body:       `{"model":"gpt-image-2"}`,
			tokenID:    730001,
			group:      image2TestPinGroup,
		},
		{
			name:       "playground-image-path-does-not-pin",
			requestURL: "/pg/images/generations",
			remoteAddr: "127.0.0.1:3001",
			body:       `{"model":"gpt-image-2"}`,
			tokenID:    730001,
			group:      image2TestPinGroup,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			deadline := test.deadline
			if deadline.IsZero() {
				deadline = until
			}
			enabled := test.enabled
			if enabled == "" {
				enabled = "true"
			}
			setImage2TestPinEnv(t, enabled, "730001", deadline)

			requestURL := test.requestURL
			if requestURL == "" {
				requestURL = "/v1/images/generations"
			}
			ctx := newImage2TestPinContext(t, requestURL, test.remoteAddr, test.body)
			ctx.Set("token_id", test.tokenID)
			common.SetContextKey(ctx, constant.ContextKeyUsingGroup, test.group)
			if test.preexistingID != nil {
				common.SetContextKey(ctx, constant.ContextKeyTokenSpecificChannelId, test.preexistingID)
			}
			ctx.Request.Header.Set("X-Channel-ID", "32")
			ctx.Request.Header.Set("X-Forwarded-For", "127.0.0.1")

			pinned := resolveAndTryImage2TestPin(t, ctx, now)
			require.Equal(t, test.wantPin, pinned)
			gotChannelID, exists := common.GetContextKey(ctx, constant.ContextKeyTokenSpecificChannelId)
			if test.wantChannelID == nil {
				require.False(t, exists, "a rejected condition must not create a server-side channel pin")
			} else {
				require.True(t, exists)
				require.Equal(t, test.wantChannelID, gotChannelID)
			}
		})
	}
}

func TestImage2TestPinMasterNodeFailsClosed(t *testing.T) {
	now := image2TestPinNow()
	setImage2TestPinEnv(t, "true", "730001", now.Add(time.Hour))
	previousMasterNode := common.IsMasterNode
	common.IsMasterNode = true
	t.Cleanup(func() { common.IsMasterNode = previousMasterNode })

	ctx := newImage2TestPinContext(t, "/v1/images/generations", "127.0.0.1:3001", `{"model":"gpt-image-2"}`)
	require.False(t, resolveAndTryImage2TestPin(t, ctx, now))
	_, exists := common.GetContextKey(ctx, constant.ContextKeyTokenSpecificChannelId)
	require.False(t, exists, "master must never create a slave-only test pin")
}

func TestImage2TestPinConfigFailsClosedWithoutExactRuntimeInputs(t *testing.T) {
	now := image2TestPinNow()
	cases := []struct {
		name      string
		enabled   string
		tokenID   string
		until     string
		wantValid bool
	}{
		{name: "missing-enabled-switch", tokenID: "730001", until: now.Add(time.Hour).Format(time.RFC3339)},
		{name: "missing-token-id", enabled: "true", until: now.Add(time.Hour).Format(time.RFC3339)},
		{name: "multiple-token-ids", enabled: "true", tokenID: "730001,730002", until: now.Add(time.Hour).Format(time.RFC3339)},
		{name: "zero-token-id", enabled: "true", tokenID: "0", until: now.Add(time.Hour).Format(time.RFC3339)},
		{name: "malformed-deadline", enabled: "true", tokenID: "730001", until: "2026-08-10"},
		{name: "non-cst-deadline", enabled: "true", tokenID: "730001", until: now.UTC().Add(time.Hour).Format(time.RFC3339)},
		{name: "deadline-too-far", enabled: "true", tokenID: "730001", until: now.Add(2*time.Hour + time.Second).Format(time.RFC3339)},
		{name: "expired-deadline", enabled: "true", tokenID: "730001", until: now.Add(-time.Second).Format(time.RFC3339)},
		{name: "exact-runtime-config", enabled: "true", tokenID: "730001", until: now.Add(time.Hour).Format(time.RFC3339), wantValid: true},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv(image2TestPinEnabledEnv, test.enabled)
			t.Setenv(image2TestPinTokenIDEnv, test.tokenID)
			t.Setenv(image2TestPinUntilEnv, test.until)
			_, valid := image2TestPinConfigFromEnv(now)
			require.Equal(t, test.wantValid, valid)
		})
	}
}

func TestDistributeAppliesImage2TestPinAfterResolvedGroup(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	oldEntitlementFeatureEnabled := common.EntitlementFeatureEnabled
	common.EntitlementFeatureEnabled = false
	t.Cleanup(func() { common.EntitlementFeatureEnabled = oldEntitlementFeatureEnabled })
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))

	rawSetting := "{}"
	require.NoError(t, model.DB.Create(&model.Channel{
		Id: 32, Type: 1, Key: "pin-test-key", Status: common.ChannelStatusEnabled,
		Name: "pin-test-channel", Models: image2TestPinModel, Group: image2TestPinGroup,
		Setting: &rawSetting, OtherSettings: "{}",
	}).Error)

	now := time.Now().In(time.FixedZone("CST", 8*60*60))
	setImage2TestPinEnv(t, "true", "730001", now.Add(time.Hour))
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{"model":"gpt-image-2"}`))
	ctx.Request.RemoteAddr = "127.0.0.1:3001"
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", image2TestPinUserID)
	ctx.Set("token_id", 730001)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, image2TestPinGroup)

	Distribute()(ctx)

	specificID, exists := common.GetContextKey(ctx, constant.ContextKeyTokenSpecificChannelId)
	require.True(t, exists)
	require.Equal(t, image2TestPinChannelID, specificID)
	require.Equal(t, 32, common.GetContextKeyInt(ctx, constant.ContextKeyChannelId))
}

func TestImage2TestPinDisabledOrExpiredTokenIsRejectedByTokenAuth(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "false")
	require.NoError(t, model.DB.Create(&model.User{
		Id: 26, Username: "image2-pin-auth-user", Password: "password", Group: "default",
		AffCode: "image2-pin-auth-aff", Status: common.UserStatusEnabled,
	}).Error)

	cases := []struct {
		name        string
		tokenID     int
		status      int
		expiredTime int64
	}{
		{name: "disabled", tokenID: 730101, status: common.TokenStatusDisabled, expiredTime: -1},
		{name: "expired", tokenID: 730102, status: common.TokenStatusEnabled, expiredTime: time.Now().Add(-time.Minute).Unix()},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			key := fmt.Sprintf("image2-pin-auth-%d", test.tokenID)
			require.NoError(t, model.DB.Create(&model.Token{
				Id: test.tokenID, UserId: 26, Key: key, Status: test.status,
				UnlimitedQuota: true, ExpiredTime: test.expiredTime, Group: "default",
			}).Error)
			setImage2TestPinEnv(t, "true", fmt.Sprint(test.tokenID), time.Now().In(time.FixedZone("CST", 8*60*60)).Add(time.Hour))

			gin.SetMode(gin.TestMode)
			router := gin.New()
			continued := false
			router.Use(TokenAuth())
			router.POST("/v1/images/generations", func(c *gin.Context) {
				continued = true
				c.Status(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{"model":"gpt-image-2"}`))
			req.RemoteAddr = "127.0.0.1:3001"
			req.Header.Set("Authorization", "Bearer sk-"+key)
			req.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, req)

			require.Equal(t, http.StatusUnauthorized, recorder.Code)
			require.False(t, continued, "disabled/expired tokens must fail auth before a test pin can be considered")
		})
	}
}
