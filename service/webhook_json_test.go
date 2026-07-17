package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSendJSONWebhookWithClientSignsExactPayload(t *testing.T) {
	secret := "webhook-secret"
	payload := map[string]any{
		"task_id": "task_123",
		"status":  "completed",
	}

	var receivedBody []byte
	var receivedSignature string
	var receivedDeliveryID string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var err error
		receivedBody, err = io.ReadAll(r.Body)
		require.NoError(t, err)
		receivedSignature = r.Header.Get("X-Webhook-Signature")
		receivedDeliveryID = r.Header.Get(WebhookDeliveryIDHeader)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	require.NoError(t, sendJSONWebhookWithClient(context.Background(), server.Client(), server.URL, secret, "task_123", payload))

	var decoded map[string]any
	require.NoError(t, common.Unmarshal(receivedBody, &decoded))
	assert.Equal(t, "task_123", decoded["task_id"])

	mac := hmac.New(sha256.New, []byte(secret))
	_, err := mac.Write(receivedBody)
	require.NoError(t, err)
	assert.Equal(t, hex.EncodeToString(mac.Sum(nil)), receivedSignature)
	assert.Equal(t, "task_123", receivedDeliveryID)
}

func TestSendJSONWebhookWithClientRejectsNonSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer server.Close()

	err := sendJSONWebhookWithClient(context.Background(), server.Client(), server.URL, "", "task_failed", map[string]string{"status": "failed"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "502")
}

func TestSendJSONWebhookWithClientRejectsRedirectWithoutForwardingSignature(t *testing.T) {
	var redirected bool
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		redirected = true
		assert.Empty(t, r.Header.Get("X-Webhook-Signature"))
		assert.Empty(t, r.Header.Get(WebhookDeliveryIDHeader))
		w.WriteHeader(http.StatusNoContent)
	}))
	defer target.Close()

	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer redirect.Close()

	err := sendJSONWebhookWithClient(context.Background(), redirect.Client(), redirect.URL, "secret", "task_redirect", map[string]string{"status": "completed"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "302")
	assert.False(t, redirected)
}

func TestSendJSONWebhookWithClientHonorsContextDeadline(t *testing.T) {
	releaseHandler := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		<-releaseHandler
	}))
	defer server.Close()
	defer close(releaseHandler)

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	err := sendJSONWebhookWithClient(ctx, server.Client(), server.URL, "", "task_timeout", map[string]string{"status": "completed"})
	require.Error(t, err)
	assert.ErrorIs(t, err, context.DeadlineExceeded)
}

func TestValidateJSONWebhookURLMatchesWorkerSchemePolicy(t *testing.T) {
	oldWorkerURL := system_setting.WorkerUrl
	oldAllowHTTP := system_setting.WorkerAllowHttpImageRequestEnabled
	system_setting.WorkerUrl = "https://worker.example.com"
	system_setting.WorkerAllowHttpImageRequestEnabled = false
	t.Cleanup(func() {
		system_setting.WorkerUrl = oldWorkerURL
		system_setting.WorkerAllowHttpImageRequestEnabled = oldAllowHTTP
	})

	err := ValidateJSONWebhookURL("http://8.8.8.8/webhook")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "https")
	require.NoError(t, ValidateJSONWebhookURL("https://8.8.8.8/webhook"))

	system_setting.WorkerAllowHttpImageRequestEnabled = true
	require.NoError(t, ValidateJSONWebhookURL("http://8.8.8.8/webhook"))
}

func TestValidateJSONWebhookURLRejectsPrivateTargetsWhenGeneralProtectionDisabled(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	original := *fetchSetting
	fetchSetting.EnableSSRFProtection = false
	fetchSetting.AllowPrivateIp = true
	fetchSetting.DomainFilterMode = false
	fetchSetting.IpFilterMode = false
	fetchSetting.AllowedPorts = []string{"80", "443"}
	fetchSetting.ApplyIPFilterForDomain = false
	t.Cleanup(func() { *fetchSetting = original })

	err := ValidateJSONWebhookURL("http://127.0.0.1/webhook")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "private IP address not allowed")
	require.NoError(t, ValidateJSONWebhookURL("https://8.8.8.8/webhook"))
}
