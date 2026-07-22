package service

import (
	"context"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelMonitorAvailabilityOverrideValidation(t *testing.T) {
	valid := 99.95
	require.NoError(t, validateChannelMonitorAvailabilityOverride(&valid))
	require.NoError(t, validateChannelMonitorAvailabilityOverride(nil))

	for _, invalid := range []float64{-0.01, 100.01, math.NaN(), math.Inf(1)} {
		t.Run("invalid", func(t *testing.T) {
			require.Error(t, validateChannelMonitorAvailabilityOverride(&invalid))
		})
	}
}

func TestResolveChannelMonitorAvailabilityPrefersManualValue(t *testing.T) {
	calculated := 80.0
	manual := 99.5

	resolved := resolveChannelMonitorAvailability(&calculated, &manual)
	require.NotNil(t, resolved)
	assert.Equal(t, manual, *resolved)
	assert.Equal(t, &calculated, resolveChannelMonitorAvailability(&calculated, nil))
}

func TestChannelMonitorAPIKeyEncryptionRoundTrip(t *testing.T) {
	originalSecret := common.CryptoSecret
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	t.Setenv("CRYPTO_SECRET", "stable-test-secret")
	common.CryptoSecret = "stable-test-secret"

	encrypted, err := encryptChannelMonitorAPIKey("sk-test-secret")
	require.NoError(t, err)
	assert.NotEqual(t, "sk-test-secret", encrypted)
	assert.Contains(t, encrypted, channelMonitorEncryptionPrefix)

	decrypted, err := decryptChannelMonitorAPIKey(encrypted)
	require.NoError(t, err)
	assert.Equal(t, "sk-test-secret", decrypted)

	common.CryptoSecret = "different-secret"
	_, err = decryptChannelMonitorAPIKey(encrypted)
	require.Error(t, err)
}

func TestChannelMonitorRequestURL(t *testing.T) {
	tests := []struct {
		name     string
		apiURL   string
		expected string
	}{
		{name: "origin", apiURL: "https://example.com", expected: "https://example.com/v1/chat/completions"},
		{name: "v1 base", apiURL: "https://example.com/v1", expected: "https://example.com/v1/chat/completions"},
		{name: "full endpoint", apiURL: "https://example.com/v1/chat/completions", expected: "https://example.com/v1/chat/completions"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, channelMonitorRequestURL(test.apiURL))
		})
	}
}

func TestExecuteChannelMonitorRequestSendsOpenAICompatibleProbe(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	originalSetting := *fetchSetting
	t.Cleanup(func() {
		*fetchSetting = originalSetting
		InitHttpClient()
	})
	fetchSetting.EnableSSRFProtection = false
	InitHttpClient()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/chat/completions", r.URL.Path)
		assert.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))
		var body struct {
			Model     string `json:"model"`
			MaxTokens int    `json:"max_tokens"`
			Stream    bool   `json:"stream"`
		}
		require.NoError(t, common.DecodeJson(r.Body, &body))
		assert.Equal(t, "gpt-test", body.Model)
		assert.Equal(t, 1, body.MaxTokens)
		assert.False(t, body.Stream)
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	statusCode, latencyMs, err := executeChannelMonitorRequest(
		context.Background(),
		&model.ChannelMonitor{
			ApiURL:         server.URL,
			TestModel:      "gpt-test",
			TimeoutSeconds: 2,
		},
		"sk-test",
	)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, statusCode)
	assert.GreaterOrEqual(t, latencyMs, 0)
}
