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

func TestBuildDingTalkPaymentProcessingAlertContentMasksSensitiveFields(t *testing.T) {
	content := BuildDingTalkPaymentProcessingAlertContent(DingTalkPaymentProcessingAlert{
		Provider:            "stripe",
		TradeNo:             "ref_payment_alert",
		EventType:           "checkout.session.completed",
		CustomerID:          "cus_alert",
		CustomerEmail:       "kurebarr.h@gmail.com",
		ExpectedCurrency:    "JPY",
		ExpectedAmountMinor: 3000,
		ActualCurrency:      "JPY",
		ActualAmountMinor:   2999,
		Error:               "amount mismatch access_token secret-token sk-sensitive",
		Now:                 time.Date(2026, 7, 2, 21, 40, 28, 0, time.Local),
	})

	require.Contains(t, content, "New API payment processing failed")
	require.Contains(t, content, "Provider: stripe")
	require.Contains(t, content, "Trade No: ref_payment_alert")
	require.Contains(t, content, "Event Type: checkout.session.completed")
	require.Contains(t, content, "Customer ID: cus_alert")
	require.Contains(t, content, "Customer Email: kurebarr.h@***.com")
	require.Contains(t, content, "Expected Amount: 3000 JPY")
	require.Contains(t, content, "Actual Amount: 2999 JPY")
	require.NotContains(t, content, "secret-token")
	require.NotContains(t, content, "sk-sensitive")
	require.NotContains(t, content, "kurebarr.h@gmail.com")
}

func TestNotifyDingTalkPaymentProcessingFailureUsesMonitorDingTalk(t *testing.T) {
	allowDingTalkTestServer(t)
	originalSetting := *operation_setting.GetMonitorSetting()
	originalHTTPClient := httpClient
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
		httpClient = originalHTTPClient
	})

	var requests int32
	var requestBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		requestBody = string(body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
	setting := operation_setting.GetMonitorSetting()
	setting.DingTalkAlertEnabled = true
	setting.DingTalkAlertWebhookURL = server.URL
	setting.DingTalkAlertSecret = ""

	err := NotifyDingTalkPaymentProcessingFailure(DingTalkPaymentProcessingAlert{
		Provider:            "stripe",
		TradeNo:             "ref_payment_alert",
		EventType:           "checkout.session.completed",
		ExpectedCurrency:    "JPY",
		ExpectedAmountMinor: 3000,
		ActualCurrency:      "JPY",
		ActualAmountMinor:   2999,
		Error:               "amount mismatch",
	})

	require.NoError(t, err)
	require.Equal(t, int32(1), atomic.LoadInt32(&requests))
	require.Contains(t, requestBody, "ref_payment_alert")
}

func TestBuildDingTalkCodexModelGovernanceAlertContentSanitizesError(t *testing.T) {
	record := &model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.3-codex",
		Status:             model.CodexModelGovernanceStatusUnsupportedPendingReview,
		Source:             model.CodexModelGovernanceSourceProbe,
		MatchedRule:        `The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`,
		LastError:          "access_token secret-token sk-sensitive",
		AffectedChannelIDs: "11,12",
		DisabledChannelIDs: "11,12",
		AbilitiesDisabled:  true,
		DetectedAt:         time.Date(2026, 6, 10, 12, 0, 0, 0, time.Local).Unix(),
	}

	content := BuildDingTalkCodexModelGovernanceAlertContent(record)

	require.Contains(t, content, "Codex model governance alert")
	require.Contains(t, content, "Model: gpt-5.3-codex")
	require.Contains(t, content, "Status: unsupported_pending_review")
	require.Contains(t, content, "Affected Channels: 2 (11,12)")
	require.Contains(t, content, "Disabled Channels: 2 (11,12)")
	require.Contains(t, content, "Auto Disabled: yes")
	require.NotContains(t, content, "secret-token")
	require.NotContains(t, content, "sk-sensitive")
}

func TestBuildDingTalkCodexModelGovernanceAlertContentHighlightsLinkedStillServingChannels(t *testing.T) {
	record := &model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.3-codex",
		Status:             model.CodexModelGovernanceStatusUnsupportedPendingReview,
		Source:             model.CodexModelGovernanceSourceProbe,
		MatchedRule:        "unsupported",
		LastError:          "probe rejected the model",
		AffectedChannelIDs: "11,12",
		DisabledChannelIDs: "11",
		AbilitiesDisabled:  true,
	}

	content := BuildDingTalkCodexModelGovernanceAlertContent(record)

	require.Contains(t, content, "Affected Channels: 2 (11,12)")
	require.Contains(t, content, "Disabled Channels: 1 (11)")
	require.Contains(t, content, "Auto Disabled: yes")
	require.Contains(t, content, "LINKED CHANNELS ARE STILL SERVING")
}

func TestBuildDingTalkCodexModelGovernanceAlertContentHighlightsNotDisabled(t *testing.T) {
	record := &model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.4-codex",
		Status:             model.CodexModelGovernanceStatusUnsupportedPendingReview,
		Source:             model.CodexModelGovernanceSourceOfficialCodexNotice,
		MatchedRule:        "ai_analysis:deprecated",
		LastError:          "gpt-5.4-codex is deprecated",
		AffectedChannelIDs: "21",
		AbilitiesDisabled:  false,
	}

	content := BuildDingTalkCodexModelGovernanceAlertContent(record)

	require.Contains(t, content, "Auto Disabled: no")
	require.Contains(t, content, "MODEL IS STILL SERVING")
	require.Contains(t, content, "review and disable it as soon as possible")
}

func TestBuildDingTalkCodexModelGovernanceAlertContentDoesNotHighlightReviewedDisabled(t *testing.T) {
	record := &model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.4-codex",
		Status:             model.CodexModelGovernanceStatusUnsupportedDisabled,
		Source:             model.CodexModelGovernanceSourceOfficialCodexNotice,
		MatchedRule:        "ai_analysis:deprecated",
		LastError:          "gpt-5.4-codex is deprecated",
		AffectedChannelIDs: "21",
		AbilitiesDisabled:  true,
	}

	content := BuildDingTalkCodexModelGovernanceAlertContent(record)

	require.Contains(t, content, "Auto Disabled: yes")
	require.NotContains(t, content, "MODEL IS STILL SERVING")
	require.NotContains(t, content, "review and disable it as soon as possible")
}

func TestNotifyDingTalkCodexModelGovernanceSkipsWhenMonitorAlertDisabled(t *testing.T) {
	originalSetting := *operation_setting.GetMonitorSetting()
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
	})
	setting := operation_setting.GetMonitorSetting()
	setting.DingTalkAlertEnabled = false
	setting.DingTalkAlertWebhookURL = ""

	err := NotifyDingTalkCodexModelGovernance(&model.CodexModelGovernanceRecord{
		ModelName: "gpt-5.3-codex",
		Status:    model.CodexModelGovernanceStatusUnsupportedPendingReview,
	})

	require.NoError(t, err)
}

func TestNotifyDingTalkCodexModelGovernanceUsesAlertCooldown(t *testing.T) {
	allowDingTalkTestServer(t)
	originalSetting := *operation_setting.GetMonitorSetting()
	originalGovernanceSetting := *operation_setting.GetCodexModelGovernanceSetting()
	originalGovernanceCooldown := codexGovernanceAlertCooldown
	originalHTTPClient := httpClient
	originalDB := model.DB
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
		*operation_setting.GetCodexModelGovernanceSetting() = originalGovernanceSetting
		codexGovernanceAlertCooldown = originalGovernanceCooldown
		httpClient = originalHTTPClient
		model.DB = originalDB
	})
	model.DB = nil
	codexGovernanceAlertCooldown = NewDingTalkModelAlertCooldown()

	var requests int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
	setting := operation_setting.GetMonitorSetting()
	setting.DingTalkAlertEnabled = true
	setting.DingTalkAlertWebhookURL = server.URL
	setting.DingTalkAlertSecret = ""
	operation_setting.GetCodexModelGovernanceSetting().AlertCooldownMinutes = 60

	record := &model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.3-codex-cooldown",
		Status:             model.CodexModelGovernanceStatusUnsupportedPendingReview,
		Source:             model.CodexModelGovernanceSourceProbe,
		MatchedRule:        "unsupported",
		LastError:          "unsupported",
		AffectedChannelIDs: "11",
		AbilitiesDisabled:  true,
	}

	require.NoError(t, NotifyDingTalkCodexModelGovernance(record))
	require.NoError(t, NotifyDingTalkCodexModelGovernance(record))

	require.Equal(t, int32(1), atomic.LoadInt32(&requests))
}

func TestNotifyDingTalkCodexModelGovernanceAllowsNewDisabledScopeAfterReviewOnlyAlert(t *testing.T) {
	allowDingTalkTestServer(t)
	originalSetting := *operation_setting.GetMonitorSetting()
	originalGovernanceSetting := *operation_setting.GetCodexModelGovernanceSetting()
	originalGovernanceCooldown := codexGovernanceAlertCooldown
	originalHTTPClient := httpClient
	originalDB := model.DB
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
		*operation_setting.GetCodexModelGovernanceSetting() = originalGovernanceSetting
		codexGovernanceAlertCooldown = originalGovernanceCooldown
		httpClient = originalHTTPClient
		model.DB = originalDB
	})
	model.DB = nil
	codexGovernanceAlertCooldown = NewDingTalkModelAlertCooldown()

	var requests int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
	setting := operation_setting.GetMonitorSetting()
	setting.DingTalkAlertEnabled = true
	setting.DingTalkAlertWebhookURL = server.URL
	setting.DingTalkAlertSecret = ""
	operation_setting.GetCodexModelGovernanceSetting().AlertCooldownMinutes = 60

	reviewOnly := &model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.3-codex-scope",
		Status:             model.CodexModelGovernanceStatusUnsupportedPendingReview,
		Source:             model.CodexModelGovernanceSourceOfficialCodexNotice,
		MatchedRule:        "deprecated",
		LastError:          "official notice mentioned the model",
		AffectedChannelIDs: "11,12",
		AbilitiesDisabled:  false,
	}
	disabled := &model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.3-codex-scope",
		Status:             model.CodexModelGovernanceStatusUnsupportedPendingReview,
		Source:             model.CodexModelGovernanceSourceProbe,
		MatchedRule:        "unsupported",
		LastError:          "probe rejected the model",
		AffectedChannelIDs: "11,12",
		DisabledChannelIDs: "11",
		AbilitiesDisabled:  true,
	}

	require.NoError(t, NotifyDingTalkCodexModelGovernance(reviewOnly))
	require.NoError(t, NotifyDingTalkCodexModelGovernance(disabled))
	require.NoError(t, NotifyDingTalkCodexModelGovernance(disabled))

	require.Equal(t, int32(2), atomic.LoadInt32(&requests))
}

func TestNotifyDingTalkCodexModelGovernanceAllowsAffectedScopeExpansionWithSameDisabledScope(t *testing.T) {
	allowDingTalkTestServer(t)
	originalSetting := *operation_setting.GetMonitorSetting()
	originalGovernanceSetting := *operation_setting.GetCodexModelGovernanceSetting()
	originalGovernanceCooldown := codexGovernanceAlertCooldown
	originalHTTPClient := httpClient
	originalDB := model.DB
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
		*operation_setting.GetCodexModelGovernanceSetting() = originalGovernanceSetting
		codexGovernanceAlertCooldown = originalGovernanceCooldown
		httpClient = originalHTTPClient
		model.DB = originalDB
	})
	model.DB = nil
	codexGovernanceAlertCooldown = NewDingTalkModelAlertCooldown()

	var requests int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
	setting := operation_setting.GetMonitorSetting()
	setting.DingTalkAlertEnabled = true
	setting.DingTalkAlertWebhookURL = server.URL
	setting.DingTalkAlertSecret = ""
	operation_setting.GetCodexModelGovernanceSetting().AlertCooldownMinutes = 60

	first := &model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.3-codex-affected-scope",
		Status:             model.CodexModelGovernanceStatusUnsupportedDisabled,
		Source:             model.CodexModelGovernanceSourceProbe,
		MatchedRule:        "unsupported",
		LastError:          "probe rejected the model",
		AffectedChannelIDs: "11",
		DisabledChannelIDs: "11",
		AbilitiesDisabled:  true,
	}
	expanded := &model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.3-codex-affected-scope",
		Status:             model.CodexModelGovernanceStatusUnsupportedDisabled,
		Source:             model.CodexModelGovernanceSourceOfficialCodexNotice,
		MatchedRule:        "deprecated",
		LastError:          "official notice mentioned linked channel",
		AffectedChannelIDs: "11,12",
		DisabledChannelIDs: "11",
		AbilitiesDisabled:  true,
	}

	require.NoError(t, NotifyDingTalkCodexModelGovernance(first))
	require.NoError(t, NotifyDingTalkCodexModelGovernance(expanded))
	require.NoError(t, NotifyDingTalkCodexModelGovernance(expanded))

	require.Equal(t, int32(2), atomic.LoadInt32(&requests))
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

func TestDingTalkChannelAlertAISummaryTimeoutAllowsOneMinute(t *testing.T) {
	require.Equal(t, time.Minute, dingTalkChannelAlertAISummaryTimeout)
}

func TestDingTalkAlertPendingReservationTTLCoversAISummaryAndSendWindow(t *testing.T) {
	require.GreaterOrEqual(t, dingTalkAlertPendingReservationTTL, dingTalkChannelAlertAISummaryTimeout+2*dingTalkRequestTimeout)
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

func TestNotifyDingTalkFailuresLeavesContentUnchangedWithoutAIKey(t *testing.T) {
	setting := setupDingTalkChannelAlertTestState(t)

	var aiRequests int32
	contents := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/responses" {
			atomic.AddInt32(&aiRequests, 1)
			http.Error(w, "ai should not be called", http.StatusInternalServerError)
			return
		}
		contents <- readDingTalkTextContent(t, r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
	setting.DingTalkAlertWebhookURL = server.URL + "/robot/send?access_token=dingtalk-token"
	setting.AIAnalysisAPIKey = ""
	setting.AIAnalysisBaseURL = server.URL + "/v1"
	setting.AIAnalysisModel = "gpt-monitor"

	alerts := []DingTalkChannelAlert{
		{
			ChannelID:       301,
			ChannelName:     "codex-prod",
			ChannelTypeName: "Codex",
			Error:           types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, http.StatusUnauthorized),
			Now:             time.Date(2026, 7, 2, 10, 0, 0, 0, time.UTC),
		},
	}
	rawContent := BuildDingTalkChannelAlertBatchContent(alerts)

	require.NoError(t, NotifyDingTalkChannelTestFailures(alerts))

	require.Equal(t, int32(0), atomic.LoadInt32(&aiRequests))
	require.Equal(t, rawContent, <-contents)
}

func TestNotifyDingTalkFailuresPrependsAISummaryWhenConfigured(t *testing.T) {
	setting := setupDingTalkChannelAlertTestState(t)

	var aiRequests int32
	contents := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/responses" {
			atomic.AddInt32(&aiRequests, 1)
			require.Equal(t, "Bearer sk-monitor", r.Header.Get("Authorization"))
			w.Header().Set("Content-Type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(map[string]string{
				"output_text": "- 本批次 2 个渠道测试失败，集中在 Codex 和 Gemini。\n- 其中 1 个为 401 鉴权错误，建议优先检查密钥状态。",
			}))
			return
		}
		contents <- readDingTalkTextContent(t, r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
	setting.DingTalkAlertWebhookURL = server.URL + "/robot/send?access_token=dingtalk-token"
	setting.AIAnalysisAPIKey = "sk-monitor"
	setting.AIAnalysisBaseURL = server.URL + "/v1"
	setting.AIAnalysisModel = "gpt-monitor"

	alerts := []DingTalkChannelAlert{
		{
			ChannelID:       302,
			ChannelName:     "codex-prod",
			ChannelTypeName: "Codex",
			Error:           types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, http.StatusUnauthorized),
			Now:             time.Date(2026, 7, 2, 10, 0, 0, 0, time.UTC),
		},
		{
			ChannelID:       303,
			ChannelName:     "gemini-backup",
			ChannelTypeName: "Gemini",
			Error:           types.NewErrorWithStatusCode(errors.New("timeout"), types.ErrorCodeBadResponse, http.StatusGatewayTimeout),
			AutoDisabled:    true,
			Now:             time.Date(2026, 7, 2, 10, 0, 5, 0, time.UTC),
		},
	}

	require.NoError(t, NotifyDingTalkChannelTestFailures(alerts))

	require.Equal(t, int32(1), atomic.LoadInt32(&aiRequests))
	content := <-contents
	require.True(t, strings.HasPrefix(content, "AI 中文总结：\n- 本批次 2 个渠道测试失败"), content)
	require.Contains(t, content, "\n\nNew API channel test failures")
	require.Contains(t, content, "Total Failures: 2")
	require.Contains(t, content, "Channel ID: 302")
	require.Contains(t, content, "Channel ID: 303")
	require.Contains(t, content, "Auto Disabled: yes")
}

func TestNotifyDingTalkFailuresFallsBackWhenAISummaryFails(t *testing.T) {
	setting := setupDingTalkChannelAlertTestState(t)

	var aiRequests int32
	contents := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/responses" {
			atomic.AddInt32(&aiRequests, 1)
			http.Error(w, "ai unavailable", http.StatusBadGateway)
			return
		}
		contents <- readDingTalkTextContent(t, r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
	setting.DingTalkAlertWebhookURL = server.URL + "/robot/send?access_token=dingtalk-token"
	setting.AIAnalysisAPIKey = "sk-monitor"
	setting.AIAnalysisBaseURL = server.URL + "/v1"
	setting.AIAnalysisModel = "gpt-monitor"

	alerts := []DingTalkChannelAlert{
		{
			ChannelID:       304,
			ChannelName:     "codex-prod",
			ChannelTypeName: "Codex",
			Error:           types.NewErrorWithStatusCode(errors.New("429"), types.ErrorCodeBadResponse, http.StatusTooManyRequests),
			Now:             time.Date(2026, 7, 2, 10, 0, 0, 0, time.UTC),
		},
	}
	rawContent := BuildDingTalkChannelAlertBatchContent(alerts)

	require.NoError(t, NotifyDingTalkChannelTestFailures(alerts))

	require.Equal(t, int32(1), atomic.LoadInt32(&aiRequests))
	require.Equal(t, rawContent, <-contents)
}

func TestNotifyDingTalkFailuresSendsSanitizedAlertContentToAI(t *testing.T) {
	setting := setupDingTalkChannelAlertTestState(t)

	var aiRequests int32
	aiBodies := make(chan string, 1)
	contents := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/responses" {
			atomic.AddInt32(&aiRequests, 1)
			body, err := io.ReadAll(r.Body)
			require.NoError(t, err)
			aiBodies <- string(body)
			w.Header().Set("Content-Type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(map[string]string{
				"output_text": "- 已收到脱敏后的渠道测试失败信息。",
			}))
			return
		}
		contents <- readDingTalkTextContent(t, r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
	setting.DingTalkAlertWebhookURL = server.URL + "/robot/send?access_token=dingtalk-token"
	setting.AIAnalysisAPIKey = "sk-monitor"
	setting.AIAnalysisBaseURL = server.URL + "/v1"
	setting.AIAnalysisModel = "gpt-monitor"

	alerts := []DingTalkChannelAlert{
		{
			ChannelID:       305,
			ChannelName:     "bedrock AKIAIOSFODNN7EXAMPLE",
			ChannelTypeName: "gemini AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70",
			Error: types.NewErrorWithStatusCode(
				errors.New("Authorization: Bearer ya29.secret-token access_token oauth-secret sk-sensitive-token"),
				types.ErrorCodeBadResponse,
				http.StatusUnauthorized,
			),
			Now: time.Date(2026, 7, 2, 10, 0, 0, 0, time.UTC),
		},
	}

	require.NoError(t, NotifyDingTalkChannelTestFailures(alerts))

	require.Equal(t, int32(1), atomic.LoadInt32(&aiRequests))
	aiBody := <-aiBodies
	require.Contains(t, aiBody, "Channel ID: 305")
	require.NotContains(t, aiBody, "AKIAIOSFODNN7EXAMPLE")
	require.NotContains(t, aiBody, "AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70")
	require.NotContains(t, aiBody, "ya29.secret-token")
	require.NotContains(t, aiBody, "oauth-secret")
	require.NotContains(t, aiBody, "sk-sensitive-token")
	require.NotEmpty(t, <-contents)
}

func TestNotifyDingTalkFailuresSanitizesAISummaryBeforeDingTalk(t *testing.T) {
	setting := setupDingTalkChannelAlertTestState(t)

	contents := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/responses" {
			w.Header().Set("Content-Type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(map[string]string{
				"output_text": "- access_token leaked-secret sk-ai-secret should be redacted before DingTalk.",
			}))
			return
		}
		contents <- readDingTalkTextContent(t, r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
	setting.DingTalkAlertWebhookURL = server.URL + "/robot/send?access_token=dingtalk-token"
	setting.AIAnalysisAPIKey = "sk-monitor"
	setting.AIAnalysisBaseURL = server.URL + "/v1"
	setting.AIAnalysisModel = "gpt-monitor"

	alerts := []DingTalkChannelAlert{
		{
			ChannelID:       306,
			ChannelName:     "codex-prod",
			ChannelTypeName: "Codex",
			Error:           types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, http.StatusUnauthorized),
			Now:             time.Date(2026, 7, 2, 10, 0, 0, 0, time.UTC),
		},
	}

	require.NoError(t, NotifyDingTalkChannelTestFailures(alerts))

	content := <-contents
	require.True(t, strings.HasPrefix(content, "AI 中文总结：\n- "), content)
	require.NotContains(t, content, "leaked-secret")
	require.NotContains(t, content, "sk-ai-secret")
	require.Contains(t, content, "access_token ***")
	require.Contains(t, content, "sk-***")
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

func TestSendReservedDingTalkBatchCommitFailureDoesNotAbortRemainingCommits(t *testing.T) {
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

	db, err := gorm.Open(sqlite.Open("file:dingtalk-alert-commit-failure?mode=memory&cache=shared"), &gorm.Config{})
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

	now := time.Date(2026, 6, 2, 13, 0, 0, 0, time.UTC)
	cooldown := time.Duration(setting.DingTalkAlertCooldownMinutes) * time.Minute

	const failingChannel = 41
	const committedChannel = 42

	failing, allowed := reserveDingTalkAlertCooldown(failingChannel, now, cooldown)
	require.True(t, allowed)
	require.NotNil(t, failing)
	committed, allowed := reserveDingTalkAlertCooldown(committedChannel, now, cooldown)
	require.True(t, allowed)
	require.NotNil(t, committed)

	// Sabotage the first reservation so its Commit fails (pending_at/token cleared),
	// mimicking another instance taking ownership between send and commit. The
	// failing reservation is ordered first so a regression that aborts on the first
	// Commit error would leave the second reservation uncommitted.
	require.NoError(t, model.RollbackDingTalkAlertCooldown(failing.dbReservation))

	alerts := []DingTalkChannelAlert{
		{ChannelID: failingChannel, ChannelName: "codex-a", ChannelTypeName: "Codex", Error: types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, http.StatusUnauthorized), Now: now},
		{ChannelID: committedChannel, ChannelName: "codex-b", ChannelTypeName: "Codex", Error: types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, http.StatusUnauthorized), Now: now},
	}

	// The alert was delivered, so a Commit failure must be non-fatal: the batch
	// returns nil and the remaining reservation is still committed.
	require.NoError(t, sendReservedDingTalkChannelAlertBatch(setting, []*dingTalkAlertCooldownReservation{failing, committed}, alerts))
	require.Equal(t, int32(1), atomic.LoadInt32(&requests))

	var committedRecord model.DingTalkAlertCooldownRecord
	require.NoError(t, db.First(&committedRecord, "channel_id = ?", committedChannel).Error)
	require.Equal(t, committed.dbReservation.ReservedAt, committedRecord.LastAt)
	require.Equal(t, int64(0), committedRecord.PendingAt)

	var failingRecord model.DingTalkAlertCooldownRecord
	require.NoError(t, db.First(&failingRecord, "channel_id = ?", failingChannel).Error)
	require.Equal(t, int64(0), failingRecord.LastAt)
}

func TestNotifyDingTalkFailureDatabaseCooldownUsesDatabaseTime(t *testing.T) {
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

	db, err := gorm.Open(sqlite.Open("file:dingtalk-alert-db-time?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.DingTalkAlertCooldownRecord{}))
	model.DB = db

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

	require.NoError(t, NotifyDingTalkChannelTestFailure(DingTalkChannelAlert{
		ChannelID:       32,
		ChannelName:     "codex-prod",
		ChannelTypeName: "Codex",
		Error:           types.NewErrorWithStatusCode(errors.New("401"), types.ErrorCodeBadResponse, http.StatusUnauthorized),
		Now:             time.Now().Add(24 * time.Hour),
	}))

	var record model.DingTalkAlertCooldownRecord
	require.NoError(t, db.First(&record, "channel_id = ?", 32).Error)
	require.Less(t, record.LastAt, time.Now().Add(time.Minute).UnixMilli())
}

func TestNotifyDingTalkFailureFallsBackToLocalCooldownWhenDatabaseReservationErrors(t *testing.T) {
	allowDingTalkTestServer(t)
	originalSetting := *operation_setting.GetMonitorSetting()
	originalDB := model.DB
	originalCooldown := dingTalkAlertCooldown
	originalHTTPClient := httpClient
	t.Cleanup(func() {
		*operation_setting.GetMonitorSetting() = originalSetting
		model.DB = originalDB
		dingTalkAlertCooldown = originalCooldown
		httpClient = originalHTTPClient
	})

	db, err := gorm.Open(sqlite.Open("file:dingtalk-alert-closed-db?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())
	model.DB = db
	dingTalkAlertCooldown = NewDingTalkAlertCooldown()

	var requests int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errcode":0,"errmsg":"ok"}`))
	}))
	defer server.Close()

	httpClient = server.Client()
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
	alert.Now = alert.Now.Add(5 * time.Second)
	require.NoError(t, NotifyDingTalkChannelTestFailure(alert))
	require.Equal(t, int32(1), atomic.LoadInt32(&requests))
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

func setupDingTalkChannelAlertTestState(t *testing.T) *operation_setting.MonitorSetting {
	t.Helper()

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
	dingTalkAlertCooldown = NewDingTalkAlertCooldown()

	setting := operation_setting.GetMonitorSetting()
	setting.DingTalkAlertEnabled = true
	setting.DingTalkAlertWebhookURL = ""
	setting.DingTalkAlertSecret = ""
	setting.DingTalkAlertCooldownMinutes = 60
	setting.AIAnalysisAPIKey = ""
	setting.AIAnalysisBaseURL = operation_setting.DefaultMonitorAIAnalysisBaseURL
	setting.AIAnalysisModel = operation_setting.DefaultMonitorAIAnalysisModelName
	return setting
}

func readDingTalkTextContent(t *testing.T, body io.Reader) string {
	t.Helper()

	var payload struct {
		Text struct {
			Content string `json:"content"`
		} `json:"text"`
	}
	require.NoError(t, json.NewDecoder(body).Decode(&payload))
	return payload.Text.Content
}
