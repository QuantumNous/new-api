package service

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

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

func TestBuildDingTalkChannelAlertContentMasksChannelMetadata(t *testing.T) {
	content := BuildDingTalkChannelAlertContent(DingTalkChannelAlert{
		ChannelID:       12,
		ChannelName:     "bedrock AKIAIOSFODNN7EXAMPLE",
		ChannelTypeName: "gemini AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70",
		Error:           types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, 401),
		Now:             time.Date(2026, 6, 2, 13, 14, 15, 0, time.Local),
	})

	require.Contains(t, content, "Channel Name:")
	require.Contains(t, content, "Channel Type:")
	require.NotContains(t, content, "AKIAIOSFODNN7EXAMPLE")
	require.NotContains(t, content, "AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70")
}

func TestSanitizeDingTalkAlertTextMasksBearerAndOAuthCredentials(t *testing.T) {
	content := sanitizeDingTalkAlertText(`Authorization: Bearer ya29.secret-token {"access_token":"oauth-access","refresh_token":"oauth-refresh","id_token":"oauth-id"}`)

	require.NotContains(t, content, "ya29.secret-token")
	require.NotContains(t, content, "oauth-access")
	require.NotContains(t, content, "oauth-refresh")
	require.NotContains(t, content, "oauth-id")
	require.Contains(t, content, "Authorization: ***")
}

func TestSanitizeDingTalkAlertTextMasksUnlabeledCloudCredentials(t *testing.T) {
	content := sanitizeDingTalkAlertText("aws AKIAIOSFODNN7EXAMPLE google AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70")

	require.NotContains(t, content, "AKIAIOSFODNN7EXAMPLE")
	require.NotContains(t, content, "AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70")
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

func TestSendDingTalkTextSanitizesWebhookURLInNetworkError(t *testing.T) {
	allowDingTalkTestServer(t)
	originalHTTPClient := httpClient
	t.Cleanup(func() {
		httpClient = originalHTTPClient
	})

	httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return nil, fmt.Errorf("Post %q: connection refused", req.URL.String())
		}),
	}

	err := SendDingTalkText("https://oapi.dingtalk.com/robot/send?access_token=leaky-token", "sign-secret", "New API test")

	require.Error(t, err)
	require.NotContains(t, err.Error(), "leaky-token")
	require.NotContains(t, err.Error(), "sign-secret")
	require.Contains(t, err.Error(), "dingtalk request failed")
}

func TestSendDingTalkTextSanitizesWebhookURLInBuildError(t *testing.T) {
	err := SendDingTalkText("https://oapi.dingtalk.com/robot/send?access_token=leaky-token%zz", "sign-secret", "New API test")

	require.Error(t, err)
	require.NotContains(t, err.Error(), "leaky-token")
	require.NotContains(t, err.Error(), "sign-secret")
}

func TestSendDingTalkTextSetsRequestDeadline(t *testing.T) {
	allowDingTalkTestServer(t)
	originalHTTPClient := httpClient
	t.Cleanup(func() {
		httpClient = originalHTTPClient
	})

	httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if _, ok := req.Context().Deadline(); !ok {
				return nil, errors.New("missing request deadline")
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(`{"errcode":0,"errmsg":"ok"}`)),
				Request:    req,
			}, nil
		}),
	}

	err := SendDingTalkText("https://oapi.dingtalk.com/robot/send?access_token=secret-token", "sign-secret", "New API test")

	require.NoError(t, err)
}

func TestNotifyDingTalkFailureDoesNotConsumeCooldownOnSendFailure(t *testing.T) {
	allowDingTalkTestServer(t)
	originalSetting := *operation_setting.GetMonitorSetting()
	originalCooldown := dingTalkAlertCooldown
	originalHTTPClient := httpClient
	originalDB := model.DB
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
		dingTalkAlertCooldown = originalCooldown
		httpClient = originalHTTPClient
		model.DB = originalDB
	})
	model.DB = nil

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

func TestNotifyDingTalkFailuresSendsOneBatchForMultipleChannels(t *testing.T) {
	allowDingTalkTestServer(t)
	originalSetting := *operation_setting.GetMonitorSetting()
	originalCooldown := dingTalkAlertCooldown
	originalHTTPClient := httpClient
	originalDB := model.DB
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
		dingTalkAlertCooldown = originalCooldown
		httpClient = originalHTTPClient
		model.DB = originalDB
	})
	model.DB = nil

	var requests int32
	contents := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
		var payload struct {
			Text struct {
				Content string `json:"content"`
			} `json:"text"`
		}
		require.NoError(t, json.NewDecoder(r.Body).Decode(&payload))
		contents <- payload.Text.Content
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

	alerts := []DingTalkChannelAlert{
		{
			ChannelID:       99,
			ChannelName:     "codex-prod",
			ChannelTypeName: "Codex",
			Error:           types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, http.StatusUnauthorized),
			Now:             time.Date(2026, 6, 2, 13, 0, 0, 0, time.UTC),
		},
		{
			ChannelID:       100,
			ChannelName:     "gemini-backup",
			ChannelTypeName: "Gemini",
			Error:           types.NewErrorWithStatusCode(errors.New("429"), types.ErrorCodeBadResponse, http.StatusTooManyRequests),
			Now:             time.Date(2026, 6, 2, 13, 0, 5, 0, time.UTC),
		},
	}

	require.NoError(t, NotifyDingTalkChannelTestFailures(alerts))

	require.Equal(t, int32(1), atomic.LoadInt32(&requests))
	content := <-contents
	require.Contains(t, content, "New API channel test failures")
	require.Contains(t, content, "Total Failures: 2")
	require.Contains(t, content, "Channel ID: 99")
	require.Contains(t, content, "Channel ID: 100")
}

func TestNotifyDingTalkFailuresSplitsLargeBatches(t *testing.T) {
	allowDingTalkTestServer(t)
	originalSetting := *operation_setting.GetMonitorSetting()
	originalCooldown := dingTalkAlertCooldown
	originalHTTPClient := httpClient
	originalDB := model.DB
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
		dingTalkAlertCooldown = originalCooldown
		httpClient = originalHTTPClient
		model.DB = originalDB
	})
	model.DB = nil

	var requests int32
	contents := make(chan string, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
		var payload struct {
			Text struct {
				Content string `json:"content"`
			} `json:"text"`
		}
		require.NoError(t, json.NewDecoder(r.Body).Decode(&payload))
		contents <- payload.Text.Content
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

	alerts := make([]DingTalkChannelAlert, maxDingTalkChannelAlertBatchSize+1)
	for index := range alerts {
		alerts[index] = DingTalkChannelAlert{
			ChannelID:       200 + index,
			ChannelName:     fmt.Sprintf("channel-%d", index),
			ChannelTypeName: "Codex",
			Error:           types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, http.StatusUnauthorized),
			Now:             time.Date(2026, 6, 2, 13, 0, index, 0, time.UTC),
		}
	}

	require.NoError(t, NotifyDingTalkChannelTestFailures(alerts))

	require.Equal(t, int32(2), atomic.LoadInt32(&requests))
	firstContent := <-contents
	secondContent := <-contents
	require.Contains(t, firstContent, fmt.Sprintf("Total Failures: %d", maxDingTalkChannelAlertBatchSize))
	require.Contains(t, secondContent, "Channel ID: 205")
	require.NotContains(t, firstContent, "Channel ID: 205")
}

func TestNotifyDingTalkFailureSharesCooldownThroughDatabase(t *testing.T) {
	allowDingTalkTestServer(t)
	originalSetting := *operation_setting.GetMonitorSetting()
	originalCooldown := dingTalkAlertCooldown
	originalHTTPClient := httpClient
	originalDB := model.DB
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
		dingTalkAlertCooldown = originalCooldown
		httpClient = originalHTTPClient
		model.DB = originalDB
	})

	db, err := gorm.Open(sqlite.Open("file:dingtalk-alert-cooldown?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.DingTalkAlertCooldownRecord{}))
	model.DB = db

	var requests int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
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
		ChannelID:       32,
		ChannelName:     "codex-prod",
		ChannelTypeName: "Codex",
		Error:           types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, http.StatusUnauthorized),
		Now:             time.Date(2026, 6, 2, 13, 0, 0, 0, time.UTC),
	}

	require.NoError(t, NotifyDingTalkChannelTestFailure(alert))
	dingTalkAlertCooldown = NewDingTalkAlertCooldown()
	alert.Now = alert.Now.Add(5 * time.Second)
	require.NoError(t, NotifyDingTalkChannelTestFailure(alert))

	require.Equal(t, int32(1), atomic.LoadInt32(&requests))
}

func TestReserveDingTalkAlertCooldownDBPendingReservationExpiresWithoutConsumingCooldown(t *testing.T) {
	originalDB := model.DB
	t.Cleanup(func() {
		model.DB = originalDB
	})

	db, err := gorm.Open(sqlite.Open("file:dingtalk-alert-pending-expiry?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.DingTalkAlertCooldownRecord{}))
	model.DB = db

	now := time.Date(2026, 6, 2, 13, 0, 0, 0, time.UTC)
	firstReservation, allowed, err := reserveDingTalkAlertCooldownDB(32, now, time.Hour)
	require.NoError(t, err)
	require.True(t, allowed)
	require.NotNil(t, firstReservation)

	secondReservation, allowed, err := reserveDingTalkAlertCooldownDB(32, now.Add(dingTalkRequestTimeout), time.Hour)
	require.NoError(t, err)
	require.False(t, allowed)
	require.Nil(t, secondReservation)

	retryReservation, allowed, err := reserveDingTalkAlertCooldownDB(32, now.Add(2*dingTalkRequestTimeout+time.Second), time.Hour)
	require.NoError(t, err)
	require.True(t, allowed)
	require.NotNil(t, retryReservation)
}

func TestReserveDingTalkAlertCooldownFailsClosedWhenDatabaseReservationErrors(t *testing.T) {
	originalDB := model.DB
	originalCooldown := dingTalkAlertCooldown
	t.Cleanup(func() {
		model.DB = originalDB
		dingTalkAlertCooldown = originalCooldown
	})

	db, err := gorm.Open(sqlite.Open("file:dingtalk-alert-closed-db?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())
	model.DB = db
	dingTalkAlertCooldown = NewDingTalkAlertCooldown()

	reservation, allowed := reserveDingTalkAlertCooldown(32, time.Date(2026, 6, 2, 13, 0, 0, 0, time.UTC), time.Hour)

	require.False(t, allowed)
	require.Nil(t, reservation)
	require.True(t, dingTalkAlertCooldown.Allow(32, time.Date(2026, 6, 2, 13, 0, 0, 0, time.UTC), time.Hour))
}

func TestReserveDingTalkAlertCooldownAfterCreateConflictUsesExistingRecord(t *testing.T) {
	originalDB := model.DB
	t.Cleanup(func() {
		model.DB = originalDB
	})

	db, err := gorm.Open(sqlite.Open("file:dingtalk-alert-create-conflict?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.DingTalkAlertCooldownRecord{}))
	model.DB = db

	now := time.Date(2026, 6, 2, 13, 0, 0, 0, time.UTC)
	require.NoError(t, db.Create(&model.DingTalkAlertCooldownRecord{
		ChannelID: 32,
		LastAt:    now.UnixMilli(),
	}).Error)

	var reservation *dingTalkAlertCooldownReservation
	allowed := true
	err = db.Transaction(func(tx *gorm.DB) error {
		return reserveDingTalkAlertCooldownAfterCreateConflict(tx, 32, now.Add(5*time.Second), time.Hour, &reservation, &allowed)
	})

	require.NoError(t, err)
	require.False(t, allowed)
	require.Nil(t, reservation)
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
