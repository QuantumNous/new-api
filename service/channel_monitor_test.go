package service

import (
	"context"
	"errors"
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

func TestChannelMonitorAvailabilityBoostValidation(t *testing.T) {
	require.NoError(t, validateChannelMonitorAvailabilityBoost(99.95))

	for _, invalid := range []float64{-0.01, 100.01, math.NaN(), math.Inf(1)} {
		t.Run("invalid", func(t *testing.T) {
			require.Error(t, validateChannelMonitorAvailabilityBoost(invalid))
		})
	}
}

func TestApplyChannelMonitorAvailabilityBoostUsesFailureGap(t *testing.T) {
	tests := []struct {
		name     string
		raw      float64
		boost    float64
		expected float64
	}{
		{name: "zero boost preserves raw value", raw: 80, boost: 0, expected: 80},
		{name: "ten percent recovers ten percent of failures", raw: 80, boost: 10, expected: 82},
		{name: "twenty percent recovers twenty percent of failures", raw: 95, boost: 20, expected: 96},
		{name: "result keeps two decimals", raw: 99.5, boost: 10, expected: 99.55},
		{name: "one hundred stays capped", raw: 100, boost: 100, expected: 100},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resolved := applyChannelMonitorAvailabilityBoost(&test.raw, test.boost)
			require.NotNil(t, resolved)
			assert.Equal(t, test.expected, *resolved)
		})
	}
	assert.Nil(t, applyChannelMonitorAvailabilityBoost(nil, 100))
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

func TestRunUserChannelMonitorTestPersistsOfficialHistory(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	originalSetting := *fetchSetting
	originalSecret := common.CryptoSecret
	t.Cleanup(func() {
		*fetchSetting = originalSetting
		common.CryptoSecret = originalSecret
		InitHttpClient()
	})
	t.Setenv("CRYPTO_SECRET", "channel-monitor-user-test-secret")
	common.CryptoSecret = "channel-monitor-user-test-secret"
	fetchSetting.EnableSSRFProtection = false
	InitHttpClient()

	require.NoError(t, model.DB.AutoMigrate(&model.ChannelMonitor{}, &model.ChannelMonitorHistory{}))
	require.NoError(t, model.DB.Exec("DELETE FROM channel_monitor_histories").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM channel_monitors").Error)
	t.Cleanup(func() {
		_ = model.DB.Exec("DELETE FROM channel_monitor_histories").Error
		_ = model.DB.Exec("DELETE FROM channel_monitors").Error
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	monitor, err := CreateChannelMonitor(ChannelMonitorInput{
		Name:            "User test history isolation",
		ApiURL:          server.URL,
		ApiKey:          "sk-test",
		TestModel:       "gpt-test",
		IntervalSeconds: 60,
		TimeoutSeconds:  2,
		Enabled:         true,
		Visible:         true,
	})
	require.NoError(t, err)
	require.NotNil(t, monitor.NextCheckAt)
	result, err := RunUserChannelMonitorTest(context.Background(), monitor.Id)
	require.NoError(t, err)
	assert.True(t, result.Success)
	assert.GreaterOrEqual(t, result.NextTestAt, result.CheckedAt+ChannelMonitorUserTestCooldownSeconds)

	var historyCount int64
	require.NoError(t, model.DB.Model(&model.ChannelMonitorHistory{}).
		Where("monitor_id = ?", monitor.Id).
		Count(&historyCount).Error)
	assert.Equal(t, int64(1), historyCount)

	var history model.ChannelMonitorHistory
	require.NoError(t, model.DB.Where("monitor_id = ?", monitor.Id).First(&history).Error)
	assert.True(t, history.Success)
	assert.Equal(t, result.CheckedAt, history.CheckedAt)

	updated, err := model.GetChannelMonitorByID(monitor.Id)
	require.NoError(t, err)
	require.NotNil(t, updated.LastCheckedAt)
	assert.Equal(t, result.CheckedAt, *updated.LastCheckedAt)
	require.NotNil(t, updated.NextCheckAt)
	assert.Equal(t, result.CheckedAt+int64(monitor.IntervalSeconds), *updated.NextCheckAt)

	_, err = RunUserChannelMonitorTest(context.Background(), monitor.Id)
	var cooldownErr *ChannelMonitorUserTestCooldownError
	require.True(t, errors.As(err, &cooldownErr))
	assert.Equal(t, result.NextTestAt, cooldownErr.NextTestAt)
}
