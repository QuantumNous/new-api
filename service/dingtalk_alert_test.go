package service

import (
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestBuildDingTalkChannelAlertContentMasksSensitiveFields(t *testing.T) {
	err := types.NewErrorWithStatusCode(
		errors.New("invalid access_token sk-secret refresh_token abc"),
		types.ErrorCodeBadResponse,
		401,
	)

	content := BuildDingTalkChannelAlertContent(DingTalkChannelAlert{
		ChannelID:       12,
		ChannelName:     "codex-prod",
		ChannelTypeName: "Codex",
		Error:           err,
		AutoDisabled:    true,
		Now:             time.Date(2026, 6, 2, 13, 14, 15, 0, time.Local),
	})

	require.Contains(t, content, "New API channel test failed")
	require.Contains(t, content, "Channel ID: 12")
	require.Contains(t, content, "Channel Name: codex-prod")
	require.Contains(t, content, "Channel Type: Codex")
	require.Contains(t, content, "Status Code: 401")
	require.Contains(t, content, "Error Code: bad_response")
	require.Contains(t, content, "Auto Disabled: yes")
	require.NotContains(t, content, "sk-secret")
	require.NotContains(t, content, "refresh_token abc")
}

func TestBuildDingTalkWebhookURLAddsSignature(t *testing.T) {
	now := time.UnixMilli(1780380000123)

	signedURL, err := BuildDingTalkWebhookURL(
		"https://oapi.dingtalk.com/robot/send?access_token=abc",
		"ding-secret",
		now,
	)

	require.NoError(t, err)
	parsed, err := url.Parse(signedURL)
	require.NoError(t, err)
	require.Equal(t, "1780380000123", parsed.Query().Get("timestamp"))
	require.NotEmpty(t, parsed.Query().Get("sign"))
	require.Contains(t, signedURL, "access_token=abc")

	decodedSign, err := base64.StdEncoding.DecodeString(parsed.Query().Get("sign"))
	require.NoError(t, err)
	require.NotEmpty(t, decodedSign)
}

func TestDingTalkAlertCooldownSuppressesSameChannel(t *testing.T) {
	cooldown := NewDingTalkAlertCooldown()
	now := time.Date(2026, 6, 2, 13, 0, 0, 0, time.UTC)

	require.True(t, cooldown.Allow(7, now, time.Hour))
	require.False(t, cooldown.Allow(7, now.Add(10*time.Minute), time.Hour))
	require.True(t, cooldown.Allow(7, now.Add(time.Hour+time.Second), time.Hour))
}

func TestDingTalkAlertCooldownAllowsDifferentChannels(t *testing.T) {
	cooldown := NewDingTalkAlertCooldown()
	now := time.Date(2026, 6, 2, 13, 0, 0, 0, time.UTC)

	require.True(t, cooldown.Allow(7, now, time.Hour))
	require.True(t, cooldown.Allow(8, now.Add(time.Minute), time.Hour))
}

func TestSendDingTalkTextReturnsErrorForDingTalkErrorCode(t *testing.T) {
	allowDingTalkTestServer(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":310000,"errmsg":"keywords not in content"}`))
	}))
	defer server.Close()

	err := SendDingTalkText(server.URL, "", "New API test")

	require.Error(t, err)
	require.Contains(t, err.Error(), "310000")
	require.Contains(t, err.Error(), "keywords not in content")
}

func TestSendDingTalkTextReturnsErrorForEmptyDingTalkResponse(t *testing.T) {
	allowDingTalkTestServer(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	err := SendDingTalkText(server.URL, "", "New API test")

	require.Error(t, err)
	require.Contains(t, err.Error(), "empty response")
}

func TestSendDingTalkTextReturnsErrorForMissingDingTalkErrCode(t *testing.T) {
	allowDingTalkTestServer(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()

	err := SendDingTalkText(server.URL, "", "New API test")

	require.Error(t, err)
	require.Contains(t, err.Error(), "missing errcode")
}

func TestNotifyDingTalkFailureDoesNotConsumeCooldownOnSendFailure(t *testing.T) {
	allowDingTalkTestServer(t)
	originalSetting := *operation_setting.GetMonitorSetting()
	originalCooldown := dingTalkAlertCooldown
	originalHTTPClient := httpClient
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
		dingTalkAlertCooldown = originalCooldown
		httpClient = originalHTTPClient
	})

	var requests int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&requests, 1)
		if count == 1 {
			http.Error(w, "temporary failure", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
	dingTalkAlertCooldown = NewDingTalkAlertCooldown()
	setting := operation_setting.GetMonitorSetting()
	setting.DingTalkAlertEnabled = true
	setting.DingTalkAlertWebhookURL = server.URL
	setting.DingTalkAlertSecret = ""
	setting.DingTalkAlertCooldownMinutes = 60

	alert := DingTalkChannelAlert{
		ChannelID:       99,
		ChannelName:     "codex-prod",
		ChannelTypeName: "Codex",
		Error:           types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, http.StatusUnauthorized),
		Now:             time.Date(2026, 6, 2, 13, 0, 0, 0, time.UTC),
	}

	require.Error(t, NotifyDingTalkChannelTestFailure(alert))
	require.NoError(t, NotifyDingTalkChannelTestFailure(alert))
	require.Equal(t, int32(2), atomic.LoadInt32(&requests))
}

func allowDingTalkTestServer(t *testing.T) {
	t.Helper()

	original := *system_setting.GetFetchSetting()
	t.Cleanup(func() {
		*system_setting.GetFetchSetting() = original
	})

	fetchSetting := system_setting.GetFetchSetting()
	fetchSetting.EnableSSRFProtection = false
}
