package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useChannelMonitorCustomTestFetchSettings(t *testing.T) {
	t.Helper()
	fetchSetting := system_setting.GetFetchSetting()
	original := *fetchSetting
	t.Cleanup(func() {
		*fetchSetting = original
	})
	fetchSetting.EnableSSRFProtection = false
}

func TestNormalizeChannelMonitorCustomBaseURLPreservesPath(t *testing.T) {
	baseURL, err := NormalizeChannelMonitorCustomBaseURL(" https://example.com/panel/v1/ ")
	require.NoError(t, err)
	assert.Equal(t, "https://example.com/panel/v1", baseURL)
}

func TestNormalizeChannelMonitorCustomBaseURLRejectsOversizedValue(t *testing.T) {
	_, err := NormalizeChannelMonitorCustomBaseURL("https://example.com/" + strings.Repeat("a", maxChannelMonitorCustomBaseURL))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "不能超过 2048")
}

func TestNormalizeChannelMonitorCustomRequestRejectsEncodedQueryDelimiter(t *testing.T) {
	balance := 0.0
	_, err := NormalizeChannelMonitorCustomUpstreamConfig(ChannelMonitorCustomUpstreamConfig{
		Ratio: ChannelMonitorCustomMetricConfig{
			Source: ChannelMonitorCustomSourceHTTP,
			Request: &ChannelMonitorCustomRequestConfig{
				Method:   http.MethodGet,
				Path:     "/ratio%3Ftoken=secret",
				BodyType: ChannelMonitorCustomBodyNone,
			},
			Result: &ChannelMonitorCustomResultConfig{
				ResponseType: ChannelMonitorCustomResponseJSON,
				ValuePath:    "ratio",
				Multiplier:   1,
			},
		},
		Balance: ChannelMonitorCustomMetricConfig{
			Source:     ChannelMonitorCustomSourceFixed,
			FixedValue: &balance,
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "没有查询参数的相对路径")
}

func TestNormalizeChannelMonitorCustomRequestRejectsInvalidHeader(t *testing.T) {
	balance := 0.0
	_, err := NormalizeChannelMonitorCustomUpstreamConfig(ChannelMonitorCustomUpstreamConfig{
		Ratio: ChannelMonitorCustomMetricConfig{
			Source: ChannelMonitorCustomSourceHTTP,
			Request: &ChannelMonitorCustomRequestConfig{
				Method:   http.MethodGet,
				Path:     "/ratio",
				BodyType: ChannelMonitorCustomBodyNone,
				Headers: []ChannelMonitorCustomKeyValue{
					{Key: "Invalid Header", Value: "value"},
				},
			},
			Result: &ChannelMonitorCustomResultConfig{
				ResponseType: ChannelMonitorCustomResponseJSON,
				ValuePath:    "ratio",
				Multiplier:   1,
			},
		},
		Balance: ChannelMonitorCustomMetricConfig{
			Source:     ChannelMonitorCustomSourceFixed,
			FixedValue: &balance,
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "请求头 Invalid Header 不允许配置")
}

func TestChannelMonitorCustomConfigPreservesAndSanitizesSecrets(t *testing.T) {
	fixedBalance := 20.0
	existing, err := NormalizeChannelMonitorCustomUpstreamConfig(ChannelMonitorCustomUpstreamConfig{
		Ratio: ChannelMonitorCustomMetricConfig{
			Source: ChannelMonitorCustomSourceHTTP,
			Request: &ChannelMonitorCustomRequestConfig{
				Method:     http.MethodPost,
				Path:       "/api/ratio",
				BodyType:   ChannelMonitorCustomBodyJSON,
				Body:       `{"token":"body-secret"}`,
				BodySecret: true,
				Headers: []ChannelMonitorCustomKeyValue{
					{Key: "Authorization", Value: "Bearer secret"},
				},
			},
			Result: &ChannelMonitorCustomResultConfig{
				ResponseType: ChannelMonitorCustomResponseJSON,
				ValuePath:    "data.ratio",
				Multiplier:   1,
			},
		},
		Balance: ChannelMonitorCustomMetricConfig{
			Source:     ChannelMonitorCustomSourceFixed,
			FixedValue: &fixedBalance,
		},
	})
	require.NoError(t, err)

	publicConfig := SanitizeChannelMonitorCustomUpstreamConfig(existing)
	require.Len(t, publicConfig.Ratio.Request.Headers, 1)
	assert.Empty(t, publicConfig.Ratio.Request.Headers[0].Value)
	assert.True(t, publicConfig.Ratio.Request.Headers[0].Secret)
	assert.True(t, publicConfig.Ratio.Request.Headers[0].HasValue)
	assert.Empty(t, publicConfig.Ratio.Request.Body)
	assert.True(t, publicConfig.Ratio.Request.BodySecret)
	assert.True(t, publicConfig.Ratio.Request.HasBody)

	merged, err := NormalizeChannelMonitorCustomUpstreamConfigWithExisting(publicConfig, &existing)
	require.NoError(t, err)
	assert.Equal(t, "Bearer secret", merged.Ratio.Request.Headers[0].Value)
	assert.JSONEq(t, `{"token":"body-secret"}`, merged.Ratio.Request.Body)
}

func TestNormalizeChannelMonitorCustomConfigRejectsOversizedDocument(t *testing.T) {
	query := make([]ChannelMonitorCustomKeyValue, 8)
	for index := range query {
		query[index] = ChannelMonitorCustomKeyValue{
			Key:   "parameter" + strconv.Itoa(index),
			Value: strings.Repeat("x", maxChannelMonitorCustomValueLength),
		}
	}
	balance := 0.0
	_, err := NormalizeChannelMonitorCustomUpstreamConfig(ChannelMonitorCustomUpstreamConfig{
		Ratio: ChannelMonitorCustomMetricConfig{
			Source: ChannelMonitorCustomSourceHTTP,
			Request: &ChannelMonitorCustomRequestConfig{
				Method:   http.MethodGet,
				Path:     "/ratio",
				BodyType: ChannelMonitorCustomBodyNone,
				Query:    query,
			},
			Result: &ChannelMonitorCustomResultConfig{
				ResponseType: ChannelMonitorCustomResponseJSON,
				ValuePath:    "ratio",
				Multiplier:   1,
			},
		},
		Balance: ChannelMonitorCustomMetricConfig{
			Source:     ChannelMonitorCustomSourceFixed,
			FixedValue: &balance,
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "总大小不能超过 60 KB")
}

func TestChannelMonitorCustomRequestRedactsSecrets(t *testing.T) {
	useChannelMonitorCustomTestFetchSettings(t)

	t.Run("network error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
		client := server.Client()
		baseURL := server.URL
		server.Close()

		_, err := requestChannelMonitorCustomUpstream(context.Background(), client, baseURL, ChannelMonitorCustomRequestConfig{
			Method:   http.MethodGet,
			Path:     "/ratio",
			BodyType: ChannelMonitorCustomBodyNone,
			Query: []ChannelMonitorCustomKeyValue{
				{Key: "access_token", Value: "query-secret", Secret: true},
			},
		}, true)
		require.Error(t, err)
		assert.NotContains(t, err.Error(), "query-secret")
		assert.Contains(t, err.Error(), "[REDACTED]")
	})

	t.Run("sensitive body response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "body-secret", http.StatusBadRequest)
		}))
		defer server.Close()

		_, err := requestChannelMonitorCustomUpstream(context.Background(), server.Client(), server.URL, ChannelMonitorCustomRequestConfig{
			Method:     http.MethodPost,
			Path:       "/ratio",
			BodyType:   ChannelMonitorCustomBodyJSON,
			Body:       `{"token":"body-secret"}`,
			BodySecret: true,
		}, true)
		require.Error(t, err)
		assert.NotContains(t, err.Error(), "body-secret")
		assert.Contains(t, err.Error(), "响应预览已隐藏")
	})
}

func TestFetchChannelMonitorCustomUpstreamRatioReusesRequest(t *testing.T) {
	useChannelMonitorCustomTestFetchSettings(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/account", r.URL.Path)
		assert.Equal(t, "vip", r.URL.Query().Get("group"))
		assert.Equal(t, "Bearer secret", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"ratio":"2","balance":1234},"token":"Bearer secret"}`))
	}))
	defer server.Close()

	config := ChannelMonitorCustomUpstreamConfig{
		Ratio: ChannelMonitorCustomMetricConfig{
			Source: ChannelMonitorCustomSourceHTTP,
			Request: &ChannelMonitorCustomRequestConfig{
				Method:   http.MethodGet,
				Path:     "/account",
				BodyType: ChannelMonitorCustomBodyNone,
				Query: []ChannelMonitorCustomKeyValue{
					{Key: "group", Value: "vip"},
				},
				Headers: []ChannelMonitorCustomKeyValue{
					{Key: "Authorization", Value: "Bearer secret", Secret: true},
				},
			},
			Result: &ChannelMonitorCustomResultConfig{
				ResponseType: ChannelMonitorCustomResponseJSON,
				ValuePath:    "data.ratio",
				Multiplier:   0.5,
			},
		},
		Balance: ChannelMonitorCustomMetricConfig{
			Source: ChannelMonitorCustomSourceHTTP,
			Result: &ChannelMonitorCustomResultConfig{
				ResponseType: ChannelMonitorCustomResponseJSON,
				ValuePath:    "data.balance",
				Multiplier:   0.01,
			},
		},
		BalanceReuseRatioRequest: true,
	}

	result, err := fetchChannelMonitorCustomUpstreamRatio(context.Background(), server.Client(), server.URL, config, false, true)
	require.NoError(t, err)
	assert.Equal(t, 1.0, result.Ratio)
	require.NotNil(t, result.Balance.Amount)
	assert.InDelta(t, 12.34, *result.Balance.Amount, 1e-9)
	require.NotNil(t, result.Debug)
	assert.Equal(t, http.StatusOK, result.Debug.StatusCode)
	assert.NotContains(t, result.Debug.ResponsePreview, "Bearer secret")
	assert.Contains(t, result.Debug.ResponsePreview, "[REDACTED]")
}

func TestFetchChannelMonitorCustomUpstreamRatioStillReturnsIndependentBalance(t *testing.T) {
	useChannelMonitorCustomTestFetchSettings(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ratio" {
			http.Error(w, "ratio unavailable", http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write([]byte(`{"balance":30}`))
	}))
	defer server.Close()

	config := ChannelMonitorCustomUpstreamConfig{
		Ratio: ChannelMonitorCustomMetricConfig{
			Source:  ChannelMonitorCustomSourceHTTP,
			Request: &ChannelMonitorCustomRequestConfig{Method: http.MethodGet, Path: "/ratio", BodyType: ChannelMonitorCustomBodyNone},
			Result:  &ChannelMonitorCustomResultConfig{ResponseType: ChannelMonitorCustomResponseJSON, ValuePath: "ratio", Multiplier: 1},
		},
		Balance: ChannelMonitorCustomMetricConfig{
			Source:  ChannelMonitorCustomSourceHTTP,
			Request: &ChannelMonitorCustomRequestConfig{Method: http.MethodGet, Path: "/balance", BodyType: ChannelMonitorCustomBodyNone},
			Result:  &ChannelMonitorCustomResultConfig{ResponseType: ChannelMonitorCustomResponseJSON, ValuePath: "balance", Multiplier: 1},
		},
	}

	result, err := fetchChannelMonitorCustomUpstreamRatio(context.Background(), server.Client(), server.URL, config, false, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "503")
	require.NotNil(t, result.Balance.Amount)
	assert.Equal(t, 30.0, *result.Balance.Amount)
}

func TestFetchChannelMonitorCustomUpstreamRatioFailsWhenBalanceFails(t *testing.T) {
	useChannelMonitorCustomTestFetchSettings(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ratio" {
			_, _ = w.Write([]byte(`{"ratio":1.2}`))
			return
		}
		http.Error(w, "balance unavailable", http.StatusServiceUnavailable)
	}))
	defer server.Close()

	result, err := fetchChannelMonitorCustomUpstreamRatio(context.Background(), server.Client(), server.URL, ChannelMonitorCustomUpstreamConfig{
		Ratio: ChannelMonitorCustomMetricConfig{
			Source:  ChannelMonitorCustomSourceHTTP,
			Request: &ChannelMonitorCustomRequestConfig{Method: http.MethodGet, Path: "/ratio", BodyType: ChannelMonitorCustomBodyNone},
			Result:  &ChannelMonitorCustomResultConfig{ResponseType: ChannelMonitorCustomResponseJSON, ValuePath: "ratio", Multiplier: 1},
		},
		Balance: ChannelMonitorCustomMetricConfig{
			Source:  ChannelMonitorCustomSourceHTTP,
			Request: &ChannelMonitorCustomRequestConfig{Method: http.MethodGet, Path: "/balance", BodyType: ChannelMonitorCustomBodyNone},
			Result:  &ChannelMonitorCustomResultConfig{ResponseType: ChannelMonitorCustomResponseJSON, ValuePath: "balance", Multiplier: 1},
		},
	}, false, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "自定义余额更新失败")
	assert.Equal(t, 1.2, result.Ratio)
	assert.Contains(t, result.Balance.Error, "503")
}

func TestFetchChannelMonitorCustomFixedValues(t *testing.T) {
	ratio := 0.8
	balance := -5.0
	result, err := fetchChannelMonitorCustomUpstreamRatio(context.Background(), http.DefaultClient, "https://example.com", ChannelMonitorCustomUpstreamConfig{
		Ratio:   ChannelMonitorCustomMetricConfig{Source: ChannelMonitorCustomSourceFixed, FixedValue: &ratio},
		Balance: ChannelMonitorCustomMetricConfig{Source: ChannelMonitorCustomSourceFixed, FixedValue: &balance},
	}, false, false)
	require.NoError(t, err)
	assert.Equal(t, ratio, result.Ratio)
	require.NotNil(t, result.Balance.Amount)
	assert.Equal(t, balance, *result.Balance.Amount)
}

func TestFetchChannelMonitorCustomUpstreamUsesChannelProxy(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	originalFetchSetting := *fetchSetting
	t.Cleanup(func() {
		*fetchSetting = originalFetchSetting
		ResetProxyClientCache()
	})
	fetchSetting.EnableSSRFProtection = true
	fetchSetting.AllowPrivateIp = true
	fetchSetting.DomainFilterMode = false
	fetchSetting.IpFilterMode = false
	fetchSetting.DomainList = nil
	fetchSetting.IpList = nil
	fetchSetting.AllowedPorts = []string{"80"}
	fetchSetting.ApplyIPFilterForDomain = true
	ResetProxyClientCache()

	var requestCount atomic.Int32
	proxyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount.Add(1)
		assert.Equal(t, "93.184.216.34", r.URL.Host)
		assert.Equal(t, "/metrics", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ratio":0.9}`))
	}))
	defer proxyServer.Close()

	balance := 0.0
	result, err := FetchChannelMonitorUpstreamGroupRatio(context.Background(), ChannelMonitorUpstreamConfig{
		Type:        CustomUpstreamType,
		BaseURL:     "http://93.184.216.34",
		Proxy:       proxyServer.URL,
		SkipBalance: true,
		CustomConfig: ChannelMonitorCustomUpstreamConfig{
			Ratio: ChannelMonitorCustomMetricConfig{
				Source: ChannelMonitorCustomSourceHTTP,
				Request: &ChannelMonitorCustomRequestConfig{
					Method:   http.MethodGet,
					Path:     "/metrics",
					BodyType: ChannelMonitorCustomBodyNone,
				},
				Result: &ChannelMonitorCustomResultConfig{
					ResponseType: ChannelMonitorCustomResponseJSON,
					ValuePath:    "ratio",
					Multiplier:   1,
				},
			},
			Balance: ChannelMonitorCustomMetricConfig{
				Source:     ChannelMonitorCustomSourceFixed,
				FixedValue: &balance,
			},
		},
	})
	require.NoError(t, err)
	assert.Equal(t, 0.9, result.Ratio)
	assert.EqualValues(t, 1, requestCount.Load())
}
