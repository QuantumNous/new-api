package service

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestIsTimeoutStatus(t *testing.T) {
	require.True(t, IsTimeoutStatus(http.StatusRequestTimeout))
	require.True(t, IsTimeoutStatus(http.StatusGatewayTimeout))
	require.True(t, IsTimeoutStatus(524))
	require.False(t, IsTimeoutStatus(http.StatusInternalServerError))
}

func TestIsTimeoutError(t *testing.T) {
	require.True(t, IsTimeoutError(context.DeadlineExceeded))
	require.True(t, IsTimeoutError(errors.New("Client.Timeout exceeded while awaiting headers")))
	require.False(t, IsTimeoutError(errors.New("upstream returned bad request")))
}

func TestSendRelayTimeoutAlert(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var gotBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "application/json", r.Header.Get("Content-Type"))
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		gotBody = string(body)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	oldURL := common.TimeoutAlertWebhookURL
	oldLabel := common.TimeoutAlertLabel
	oldTimeout := common.TimeoutAlertTimeoutMs
	t.Cleanup(func() {
		common.TimeoutAlertWebhookURL = oldURL
		common.TimeoutAlertLabel = oldLabel
		common.TimeoutAlertTimeoutMs = oldTimeout
	})
	common.TimeoutAlertWebhookURL = server.URL
	common.TimeoutAlertLabel = "prod cn"
	common.TimeoutAlertTimeoutMs = 1000

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	c.Set(common.RequestIdKey, "req-1")
	c.Set("original_model", "gpt-image-2")
	c.Set("channel_id", 12)
	c.Set("channel_name", "upstream-a")
	c.Set("channel_type", 3)

	text := formatRelayTimeoutAlert(c, &relaycommon.RelayInfo{OriginModelName: "gpt-image-2"}, TimeoutAlert{
		Kind:           "relay_request",
		TimeoutSeconds: 240,
		StatusCode:     http.StatusGatewayTimeout,
		Err:            errors.New("upstream timeout"),
	})
	err := sendTimeoutAlertText(text)

	require.NoError(t, err)
	require.Contains(t, gotBody, `"msg_type":"text"`)
	require.Contains(t, gotBody, `[prod cn] timeout, request-id: req-1, model-name: gpt-image-2`)
	require.Contains(t, gotBody, `kind: relay_request, timeout-seconds: 240`)
	require.Contains(t, gotBody, `channel-id: 12, channel-name: upstream-a, channel-type: 3`)
	require.Contains(t, strings.ToLower(gotBody), `upstream timeout`)
}
