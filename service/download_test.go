package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func configureUserOutboundTestSettings(t *testing.T, enabled bool, allowHTTP bool) {
	t.Helper()
	originalEnabled := system_setting.UserOutboundRequestsEnabled
	originalAllowHTTP := system_setting.WorkerAllowHttpImageRequestEnabled
	t.Cleanup(func() {
		system_setting.UserOutboundRequestsEnabled = originalEnabled
		system_setting.WorkerAllowHttpImageRequestEnabled = originalAllowHTTP
	})
	system_setting.UserOutboundRequestsEnabled = enabled
	system_setting.WorkerAllowHttpImageRequestEnabled = allowHTTP
}

func TestValidateUserOutboundRequestPolicy(t *testing.T) {
	tests := []struct {
		name      string
		enabled   bool
		allowHTTP bool
		role      int
		url       string
		wantErr   string
	}{
		{name: "ordinary user blocked by default", url: "https://example.com", wantErr: ErrUserOutboundRequestsDisabled.Error()},
		{name: "administrator bypasses ordinary-user policy", role: common.RoleAdminUser, url: "http://example.com"},
		{name: "https allowed when outbound requests enabled", enabled: true, url: "https://example.com"},
		{name: "plain http remains blocked", enabled: true, url: "http://example.com", wantErr: "unencrypted HTTP requests are disabled"},
		{name: "plain http allowed by protocol switch", enabled: true, allowHTTP: true, url: "http://example.com"},
		{name: "unsupported scheme rejected", enabled: true, allowHTTP: true, url: "ftp://example.com", wantErr: "only HTTP and HTTPS URLs are supported"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			configureUserOutboundTestSettings(t, test.enabled, test.allowHTTP)
			err := ValidateUserOutboundRequest(0, test.role, test.url)
			if test.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.EqualError(t, err, test.wantErr)
		})
	}
}

func TestUserNotificationTargetsAreBlockedBeforeSending(t *testing.T) {
	configureUserOutboundTestSettings(t, false, false)
	notification := dto.NewNotify(dto.NotifyTypeQuotaExceed, "title", "content", nil)

	err := SendWebhookNotify(0, "https://webhook.example", "", notification)
	require.ErrorIs(t, err, ErrUserOutboundRequestsDisabled)

	err = sendBarkNotify(0, "https://bark.example/{{title}}/{{content}}", notification)
	require.ErrorIs(t, err, ErrUserOutboundRequestsDisabled)

	err = sendGotifyNotify(0, "https://gotify.example", "token", 5, notification)
	require.ErrorIs(t, err, ErrUserOutboundRequestsDisabled)
}

func TestWorkerProxyTestAcceptsIPBodyRegardlessOfStatus(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	originalFetchSetting := *fetchSetting
	fetchSetting.EnableSSRFProtection = false
	t.Cleanup(func() {
		*fetchSetting = originalFetchSetting
	})

	received := make(chan WorkerRequest, 1)
	workerServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request WorkerRequest
		if err := common.DecodeJson(r.Body, &request); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		received <- request
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("203.0.113.10\n"))
	}))
	t.Cleanup(workerServer.Close)

	originalHTTPClient := httpClient
	httpClient = workerServer.Client()
	t.Cleanup(func() {
		httpClient = originalHTTPClient
	})

	ip, err := TestWorkerProxy(workerServer.URL, "worker-secret")
	require.NoError(t, err)
	assert.Equal(t, "203.0.113.10", ip)

	request := <-received
	assert.Equal(t, "https://ip.sb", request.URL)
	assert.Equal(t, "worker-secret", request.Key)
	assert.Equal(t, http.MethodGet, request.Method)
}

func TestWorkerProxyTestRejectsNonIPBody(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	originalFetchSetting := *fetchSetting
	fetchSetting.EnableSSRFProtection = false
	t.Cleanup(func() {
		*fetchSetting = originalFetchSetting
	})

	workerServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("not-an-ip"))
	}))
	t.Cleanup(workerServer.Close)

	originalHTTPClient := httpClient
	httpClient = workerServer.Client()
	t.Cleanup(func() {
		httpClient = originalHTTPClient
	})

	_, err := TestWorkerProxy(workerServer.URL, "")
	require.EqualError(t, err, "worker response is not a valid IP address")
}
