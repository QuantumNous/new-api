package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func signAirwallex(secret, timestamp string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyAirwallexSignature(t *testing.T) {
	prev := setting.AirwallexWebhookSecret
	setting.AirwallexWebhookSecret = "whsec_test"
	t.Cleanup(func() { setting.AirwallexWebhookSecret = prev })

	body := []byte(`{"name":"subscription.active"}`)
	ts := "1783380000"
	good := signAirwallex("whsec_test", ts, body)

	require.True(t, verifyAirwallexSignature(ts, good, body))
	require.True(t, verifyAirwallexSignature(ts, strings.ToUpper(good), body), "uppercase hex signature should verify")
	require.False(t, verifyAirwallexSignature(ts, good, []byte(`{"name":"tampered"}`)))
	require.False(t, verifyAirwallexSignature("1783380001", good, body), "timestamp is part of the signed payload")
	require.False(t, verifyAirwallexSignature("", good, body))
	require.False(t, verifyAirwallexSignature(ts, "", body))
	require.False(t, verifyAirwallexSignature(ts, signAirwallex("wrong_secret", ts, body), body))
}

func webhookRequest(t *testing.T, secret string, body []byte, sign bool) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/airwallex/webhook", bytes.NewReader(body))
	if sign {
		ts := "1783380000"
		req.Header.Set("x-timestamp", ts)
		req.Header.Set("x-signature", signAirwallex(secret, ts, body))
	}
	c.Request = req
	AirwallexWebhook(c)
	return w
}

func TestAirwallexWebhookRejectsBadSignature(t *testing.T) {
	prev := setting.AirwallexWebhookSecret
	setting.AirwallexWebhookSecret = "whsec_test"
	t.Cleanup(func() { setting.AirwallexWebhookSecret = prev })

	w := webhookRequest(t, "attacker_secret", []byte(`{"name":"subscription.active"}`), true)
	require.Equal(t, http.StatusUnauthorized, w.Code)

	w = webhookRequest(t, "whsec_test", []byte(`{"name":"x"}`), false)
	require.Equal(t, http.StatusUnauthorized, w.Code, "missing signature headers must be rejected")
}

func TestAirwallexWebhookUnconfiguredReturns503(t *testing.T) {
	prev := setting.AirwallexWebhookSecret
	setting.AirwallexWebhookSecret = ""
	t.Cleanup(func() { setting.AirwallexWebhookSecret = prev })

	w := webhookRequest(t, "whatever", []byte(`{}`), true)
	require.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestAirwallexWebhookAcceptsUnknownEvent(t *testing.T) {
	prev := setting.AirwallexWebhookSecret
	setting.AirwallexWebhookSecret = "whsec_test"
	t.Cleanup(func() { setting.AirwallexWebhookSecret = prev })

	w := webhookRequest(t, "whsec_test", []byte(`{"name":"spend.expense.updated","data":{"object":{}}}`), true)
	require.Equal(t, http.StatusOK, w.Code, "unknown events are acknowledged, not retried")
}

func TestAirwallexObjectHelpers(t *testing.T) {
	obj := map[string]any{
		"id":          "sub_1",
		"customer_id": "cus_1",
		"metadata":    map[string]any{"trade_no": "sub_ref_abc", "n": 1.0},
	}
	require.Equal(t, "sub_1", airwallexObjectString(obj, "id"))
	require.Equal(t, "", airwallexObjectString(obj, "missing"))
	require.Equal(t, "sub_ref_abc", airwallexObjectMetadata(obj, "trade_no"))
	require.Equal(t, "", airwallexObjectMetadata(obj, "n"), "non-string metadata values are ignored")
	require.Equal(t, "", airwallexObjectMetadata(map[string]any{}, "trade_no"))
}

func TestAirwallexMethodMapCoversAllConstants(t *testing.T) {
	for _, m := range []string{"card", "applepay", "googlepay", "alipay", "wechat"} {
		names, ok := airwallexMethodNames[m]
		require.True(t, ok, m)
		require.NotEmpty(t, names, m)
	}
	_, ok := airwallexMethodNames["paypal"]
	require.False(t, ok)
}
