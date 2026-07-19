package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeNewAPIBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		want    string
		wantErr bool
	}{
		{name: "root", value: " https://example.com/ ", want: "https://example.com"},
		{name: "openai suffix", value: "https://example.com/panel/v1/", want: "https://example.com/panel"},
		{name: "panel path", value: "https://example.com/new-api", want: "https://example.com/new-api"},
		{name: "missing scheme", value: "example.com", wantErr: true},
		{name: "credentials", value: "https://user:pass@example.com", wantErr: true},
		{name: "query", value: "https://example.com?token=secret", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := NormalizeNewAPIBaseURL(test.value)
			if test.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.want, got)
		})
	}
}

func TestFetchNewAPIGroupRatioFromPublicPricing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/pricing", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"group_ratio":{"vip":0.75}}`))
	}))
	defer server.Close()

	result, err := fetchNewAPIGroupRatio(context.Background(), server.Client(), NewAPIGroupRatioConfig{
		BaseURL:  server.URL,
		Group:    "vip",
		AuthType: NewAPIUpstreamAuthPublic,
	}, nil)
	require.NoError(t, err)
	assert.Equal(t, 0.75, result.Ratio)
	assert.Equal(t, "/api/pricing", result.Endpoint)
}

func TestFetchChannelMonitorUpstreamGroupRatioUsesChannelProxy(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	originalFetchSetting := *fetchSetting
	t.Cleanup(func() {
		*fetchSetting = originalFetchSetting
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
	t.Cleanup(ResetProxyClientCache)

	var requestCount atomic.Int32
	proxyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount.Add(1)
		assert.Equal(t, "93.184.216.34", r.URL.Host)
		assert.Equal(t, "/api/pricing", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"group_ratio":{"vip":0.75}}`))
	}))
	defer proxyServer.Close()

	result, err := FetchChannelMonitorUpstreamGroupRatio(context.Background(), ChannelMonitorUpstreamConfig{
		Type:        NewAPIUpstreamType,
		BaseURL:     "http://93.184.216.34",
		Group:       "vip",
		AuthType:    NewAPIUpstreamAuthPublic,
		Proxy:       proxyServer.URL,
		SkipBalance: true,
	})
	require.NoError(t, err)
	assert.Equal(t, 0.75, result.Ratio)
	assert.EqualValues(t, 1, requestCount.Load())
}

func TestFetchNewAPIGroupRatioFallsBackToPublicUserGroups(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/pricing":
			_, _ = w.Write([]byte(`{"success":true,"group_ratio":{}}`))
		case "/api/user/groups":
			_, _ = w.Write([]byte(`{"success":true,"data":{"vip":{"ratio":"0.8"}}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result, err := fetchNewAPIGroupRatio(context.Background(), server.Client(), NewAPIGroupRatioConfig{
		BaseURL:  server.URL,
		Group:    "vip",
		AuthType: NewAPIUpstreamAuthPublic,
	}, nil)
	require.NoError(t, err)
	assert.Equal(t, 0.8, result.Ratio)
	assert.Equal(t, "/api/user/groups", result.Endpoint)
}

func TestFetchNewAPIGroupRatioUsesAuthenticatedUserGroups(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/user/self/groups", r.URL.Path)
		assert.Equal(t, "Bearer dashboard-token", r.Header.Get("Authorization"))
		assert.Equal(t, "42", r.Header.Get("New-Api-User"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"data":{"auto":{"ratio":"自动"},"vip":{"ratio":1.25}}}`))
	}))
	defer server.Close()

	result, err := fetchNewAPIGroupRatio(context.Background(), server.Client(), NewAPIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    NewAPIUpstreamAuthUser,
		UserID:      42,
		AccessToken: "Bearer dashboard-token",
	}, nil)
	require.NoError(t, err)
	assert.Equal(t, 1.25, result.Ratio)
	assert.Equal(t, "/api/user/self/groups", result.Endpoint)
}

func TestFetchNewAPIUpstreamBalanceConvertsQuotaToUSD(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/user/self":
			assert.Equal(t, "Bearer dashboard-token", r.Header.Get("Authorization"))
			assert.Equal(t, "42", r.Header.Get("New-Api-User"))
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota":6250000}}`))
		case "/api/status":
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":500000}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result, err := fetchNewAPIUpstreamBalance(context.Background(), server.Client(), NewAPIGroupRatioConfig{
		BaseURL:     server.URL,
		AuthType:    NewAPIUpstreamAuthUser,
		UserID:      42,
		AccessToken: "dashboard-token",
	}, nil)
	require.NoError(t, err)
	require.NotNil(t, result.Amount)
	assert.InDelta(t, 12.5, *result.Amount, 1e-9)
	assert.Equal(t, "/api/user/self", result.Endpoint)
}

func TestFetchNewAPIUpstreamKeyGroupUsesChannelAPIKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/token/search", r.URL.Path)
		assert.Equal(t, "sk-channel", r.URL.Query().Get("token"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"data":{"items":[{"id":31,"name":"channel","group":"vip"}]}}`))
	}))
	defer server.Close()

	group, err := fetchNewAPIUpstreamKeyGroup(context.Background(), server.Client(), NewAPIGroupRatioConfig{
		BaseURL:     server.URL,
		AuthType:    NewAPIUpstreamAuthUser,
		UserID:      42,
		AccessToken: "dashboard-token",
	}, []string{"sk-channel"}, nil)
	require.NoError(t, err)
	assert.Equal(t, "vip", group)
}

func TestFetchSub2APITokenReadsGroupsRatesAndBalance(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer legacy-jwt", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/groups/available":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":[{"id":7,"name":"vip","rate_multiplier":1.25}]}`))
		case "/api/v1/groups/rates":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"7":1.75}}`))
		case "/api/v1/user/profile":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"balance":7.25}}`))
		case "/api/v1/auth/refresh":
			t.Fatal("legacy token mode must not call refresh endpoint")
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    Sub2APIAuthToken,
		AccessToken: "legacy-jwt",
	}, nil)
	require.NoError(t, err)
	assert.InDelta(t, 1.75, result.Ratio, 1e-9)
	assert.Equal(t, "/api/v1/groups/rates", result.Endpoint)
	require.NotNil(t, result.Balance.Amount)
	assert.InDelta(t, 7.25, *result.Balance.Amount, 1e-9)
}

func TestFetchNewAPIGroupRatioRejectsAutomaticGroupWithoutFixedRatio(t *testing.T) {
	_, err := fetchNewAPIGroupRatio(context.Background(), http.DefaultClient, NewAPIGroupRatioConfig{
		BaseURL:  "https://example.com",
		Group:    "auto",
		AuthType: NewAPIUpstreamAuthPublic,
	}, nil)

	require.EqualError(t, err, "上游自动分组没有固定倍率，无法用于倍率监控")
}

func TestFetchNewAPIUpstreamGroupsReturnsSortedOptions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/pricing", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"group_ratio":{"alpha":1.25,"zeta":"0.8"}}`))
	}))
	defer server.Close()

	result, err := fetchNewAPIUpstreamGroups(context.Background(), server.Client(), NewAPIGroupRatioConfig{
		BaseURL:  server.URL,
		AuthType: NewAPIUpstreamAuthPublic,
	}, nil)
	require.NoError(t, err)
	require.Len(t, result.Groups, 2)
	assert.Equal(t, "zeta", result.Groups[0].Name)
	assert.Equal(t, 0.8, result.Groups[0].Ratio)
	assert.Equal(t, "alpha", result.Groups[1].Name)
	assert.Equal(t, 1.25, result.Groups[1].Ratio)
}

func TestFetchNewAPIGroupRatioRejectsInvalidRatio(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "missing", body: `{"success":true,"data":{}}`},
		{name: "not numeric", body: `{"success":true,"data":{"vip":{"ratio":"auto"}}}`},
		{name: "out of range", body: `{"success":true,"data":{"vip":{"ratio":1000001}}}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()

			_, err := fetchNewAPIGroupRatio(context.Background(), server.Client(), NewAPIGroupRatioConfig{
				BaseURL:     server.URL,
				Group:       "vip",
				AuthType:    NewAPIUpstreamAuthUser,
				UserID:      42,
				AccessToken: "dashboard-token",
			}, nil)
			require.Error(t, err)
		})
	}
}

func TestApplyNewAPIUpstreamGroupUpdatesAllChannelTokens(t *testing.T) {
	updatedTokenIDs := make([]int, 0, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		assert.Equal(t, "Bearer dashboard-token", r.Header.Get("Authorization"))
		assert.Equal(t, "42", r.Header.Get("New-Api-User"))
		switch r.URL.Path {
		case "/api/user/self/groups":
			assert.Equal(t, http.MethodGet, r.Method)
			_, _ = w.Write([]byte(`{"success":true,"data":{"vip":{"ratio":1.5}}}`))
		case "/api/token/search":
			assert.Equal(t, http.MethodGet, r.Method)
			switch r.URL.Query().Get("token") {
			case "sk-first":
				_, _ = w.Write([]byte(`{"success":true,"data":{"items":[{"id":11,"name":"first","expired_time":-1,"remain_quota":100,"unlimited_quota":false,"model_limits_enabled":true,"model_limits":"gpt-4o","allow_ips":"127.0.0.1","group":"default","cross_group_retry":true}]}}`))
			case "sk-second":
				_, _ = w.Write([]byte(`{"success":true,"data":{"items":[{"id":12,"name":"second","expired_time":123,"remain_quota":0,"unlimited_quota":true,"model_limits_enabled":false,"model_limits":"","allow_ips":null,"group":"default","cross_group_retry":false}]}}`))
			default:
				http.NotFound(w, r)
			}
		case "/api/token/":
			assert.Equal(t, http.MethodPut, r.Method)
			var token newAPIUpstreamToken
			require.NoError(t, common.DecodeJson(r.Body, &token))
			assert.Equal(t, "vip", token.Group)
			if token.ID == 11 {
				require.NotNil(t, token.AllowIPs)
				assert.Equal(t, "127.0.0.1", *token.AllowIPs)
				assert.True(t, token.ModelLimitsEnabled)
				assert.True(t, token.CrossGroupRetry)
			}
			updatedTokenIDs = append(updatedTokenIDs, token.ID)
			_, _ = w.Write([]byte(`{"success":true,"message":""}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result, err := applyChannelMonitorUpstreamGroup(context.Background(), server.Client(), ChannelMonitorUpstreamConfig{
		Type:        NewAPIUpstreamType,
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    NewAPIUpstreamAuthUser,
		UserID:      42,
		AccessToken: "dashboard-token",
	}, []string{"sk-first", "sk-second", "sk-first"}, nil)
	require.NoError(t, err)
	assert.Equal(t, 1.5, result.Result.Ratio)
	assert.Equal(t, "/api/user/self/groups", result.Result.Endpoint)
	assert.Equal(t, 2, result.KeysUpdated)
	assert.Equal(t, []int{11, 12}, updatedTokenIDs)
}

func TestApplyNewAPIUpstreamGroupRequiresUserAuthentication(t *testing.T) {
	result, err := applyChannelMonitorUpstreamGroup(context.Background(), http.DefaultClient, ChannelMonitorUpstreamConfig{
		Type:     NewAPIUpstreamType,
		BaseURL:  "https://example.com",
		Group:    "vip",
		AuthType: NewAPIUpstreamAuthPublic,
	}, []string{"sk-test"}, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "用户认证")
	assert.Zero(t, result.KeysUpdated)
}

func TestApplySub2APITokenUpdatesMatchingAPIKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/groups/available":
			assert.Equal(t, "Bearer legacy-jwt", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":[{"id":7,"name":"vip","rate_multiplier":1.25}]}`))
		case "/api/v1/groups/rates":
			assert.Equal(t, "Bearer legacy-jwt", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"7":1.75}}`))
		case "/api/v1/keys":
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Equal(t, "sk-sub2api", r.URL.Query().Get("search"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"items":[{"id":99,"key":"sk-sub2api","ip_whitelist":["10.0.0.1"],"ip_blacklist":["192.0.2.1"]}],"total":1,"page":1,"page_size":100,"pages":1}}`))
		case "/api/v1/keys/99":
			assert.Equal(t, http.MethodPut, r.Method)
			assert.Equal(t, "Bearer legacy-jwt", r.Header.Get("Authorization"))
			var request sub2APIKeyUpdateRequest
			require.NoError(t, common.DecodeJson(r.Body, &request))
			assert.Equal(t, int64(7), request.GroupID)
			assert.Equal(t, []string{"10.0.0.1"}, request.IPWhitelist)
			assert.Equal(t, []string{"192.0.2.1"}, request.IPBlacklist)
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"id":99,"group_id":7}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result, err := applyChannelMonitorUpstreamGroup(context.Background(), server.Client(), ChannelMonitorUpstreamConfig{
		Type:        Sub2APIUpstreamType,
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    Sub2APIAuthToken,
		AccessToken: "legacy-jwt",
	}, []string{"sk-sub2api"}, nil)
	require.NoError(t, err)
	assert.Equal(t, 1, result.KeysUpdated)
	assert.Equal(t, 1.75, result.Result.Ratio)
	assert.Equal(t, "/api/v1/groups/rates", result.Result.Endpoint)
}

func TestFetchSub2APITokenCanSkipBalance(t *testing.T) {
	var balanceRequests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/groups/available":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":[{"id":7,"name":"vip","rate_multiplier":1.375}]}`))
		case "/api/v1/groups/rates":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{}}`))
		case "/api/v1/user/profile":
			balanceRequests.Add(1)
			http.Error(w, "unsupported", http.StatusNotFound)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    Sub2APIAuthToken,
		AccessToken: "legacy-jwt",
		SkipBalance: true,
	}, nil)
	require.NoError(t, err)
	assert.Equal(t, 1.375, result.Ratio)
	assert.Nil(t, result.Balance.Amount)
	assert.Empty(t, result.Balance.Error)
	assert.Zero(t, balanceRequests.Load())
}

func TestFetchSub2APITokenPrefersUserRateAndCanMatchGroupID(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/groups/available":
			assert.Equal(t, "Bearer legacy-jwt", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":[{"id":42,"name":"standard","rate_multiplier":"0.625"}]}`))
		case "/api/v1/groups/rates":
			assert.Equal(t, "Bearer legacy-jwt", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"42":1.75}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "42",
		AuthType:    Sub2APIAuthToken,
		AccessToken: "legacy-jwt",
	}, nil)
	require.NoError(t, err)
	assert.Equal(t, 1.75, result.Ratio)
	assert.Equal(t, "/api/v1/groups/rates", result.Endpoint)
}

func TestFetchSub2APIUpstreamGroupsMergesUserRates(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/groups/available":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":[{"id":9,"name":"alpha","rate_multiplier":1.2},{"id":3,"name":"zeta","rate_multiplier":0.8}]}`))
		case "/api/v1/groups/rates":
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"9":1.75}}`))
		case "/api/v1/user/profile":
			assert.Equal(t, "Bearer legacy-jwt", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"balance":23.5}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result, err := fetchSub2APIUpstreamGroups(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		AuthType:    Sub2APIAuthToken,
		AccessToken: "legacy-jwt",
	}, nil, nil)
	require.NoError(t, err)
	require.Len(t, result.Groups, 2)
	assert.Equal(t, "3", result.Groups[0].ID)
	assert.Equal(t, "zeta", result.Groups[0].Name)
	assert.Equal(t, 0.8, result.Groups[0].Ratio)
	assert.Equal(t, "/api/v1/groups/available", result.Groups[0].Endpoint)
	assert.Equal(t, "9", result.Groups[1].ID)
	assert.Equal(t, "alpha", result.Groups[1].Name)
	assert.Equal(t, 1.75, result.Groups[1].Ratio)
	assert.Equal(t, "/api/v1/groups/rates", result.Groups[1].Endpoint)
	require.NotNil(t, result.Balance.Amount)
	assert.InDelta(t, 23.5, *result.Balance.Amount, 1e-9)
	assert.Equal(t, "/api/v1/user/profile", result.Balance.Endpoint)

}

func TestFetchSub2APITokenClassifiesAuthenticationFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"code":401,"message":"token expired"}`))
	}))
	defer server.Close()

	_, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    Sub2APIAuthToken,
		AccessToken: "legacy-jwt",
		SkipBalance: true,
	}, nil)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrChannelMonitorUpstreamAuthentication)
}

func TestFetchSub2APIGroupRatioUsesChannelKeyBillingAndUsage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/sub2api/billing":
			assert.Equal(t, "Bearer sk-direct", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"object":"sub2api.key_billing","schema_version":1,"billing_scope":"token","effective_rate_multiplier":1.375}`))
		case "/v1/usage":
			assert.Equal(t, "Bearer sk-direct", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"mode":"unrestricted","balance":12.5}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	result, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    Sub2APIAuthAPIKey,
		ChannelKeys: []string{"sk-direct"},
	}, nil)
	require.NoError(t, err)
	assert.InDelta(t, 1.375, result.Ratio, 1e-9)
	require.NotNil(t, result.Balance.Amount)
	assert.InDelta(t, 12.5, *result.Balance.Amount, 1e-9)
	assert.Equal(t, "/v1/usage", result.Balance.Endpoint)
}

func TestFetchSub2APIGroupRatioAPIKeyModeDoesNotUseTokenBranch(t *testing.T) {
	var directRequests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/sub2api/billing":
			directRequests.Add(1)
			http.NotFound(w, r)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	_, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    Sub2APIAuthAPIKey,
		ChannelKeys: []string{"sk-old-version"},
		SkipBalance: true,
	}, nil)
	require.Error(t, err)
	assert.EqualValues(t, 1, directRequests.Load())
	assert.Contains(t, err.Error(), "404")
}

func TestFetchSub2APIGroupRatioAPIKeyModeReportsAuthenticationFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/v1/sub2api/billing" {
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"error":{"type":"permission_error","message":"invalid API key"}}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	_, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    Sub2APIAuthAPIKey,
		ChannelKeys: []string{"sk-invalid"},
		SkipBalance: true,
	}, nil)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrChannelMonitorUpstreamAuthentication)
	assert.NotContains(t, err.Error(), "sk-invalid")
}

func TestFetchSub2APIUpstreamBalanceAPIKeyModeRequiresWalletBalance(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/usage":
			_, _ = w.Write([]byte(`{"mode":"quota_limited","remaining":100,"balance":999}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	_, err := fetchSub2APIUpstreamBalance(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		AuthType:    Sub2APIAuthAPIKey,
		ChannelKeys: []string{"sk-quota"},
	}, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "没有钱包余额")
}

func TestFetchSub2APIGroupRatioRejectsDifferentChannelKeyBillingRatios(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/sub2api/billing" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		ratio := "1.0"
		if r.Header.Get("Authorization") == "Bearer sk-two" {
			ratio = "1.2"
		}
		_, _ = w.Write([]byte(`{"object":"sub2api.key_billing","effective_rate_multiplier":` + ratio + `}`))
	}))
	defer server.Close()

	_, err := fetchSub2APIGroupRatio(context.Background(), server.Client(), Sub2APIGroupRatioConfig{
		BaseURL:     server.URL,
		Group:       "vip",
		AuthType:    Sub2APIAuthAPIKey,
		ChannelKeys: []string{"sk-one", "sk-two"},
		SkipBalance: true,
	}, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "多个 API Key")
}
