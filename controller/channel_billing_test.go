package controller

import (
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetDeepSeekBalanceUSD(t *testing.T) {
	tests := []struct {
		name            string
		responseJSON    string
		usdExchangeRate float64
		want            float64
		wantErrContains string
	}{
		{
			name:            "prefers USD when USD precedes CNY",
			responseJSON:    `{"balance_infos":[{"currency":"USD","total_balance":"12.50"},{"currency":"CNY","total_balance":"73.00"}]}`,
			usdExchangeRate: 7.3,
			want:            12.5,
		},
		{
			name:            "prefers USD when CNY precedes USD",
			responseJSON:    `{"balance_infos":[{"currency":"CNY","total_balance":"73.00"},{"currency":"USD","total_balance":"12.50"}]}`,
			usdExchangeRate: 7.3,
			want:            12.5,
		},
		{
			name:            "converts CNY when USD is absent",
			responseJSON:    `{"balance_infos":[{"currency":"CNY","total_balance":"73.00"}]}`,
			usdExchangeRate: 7.3,
			want:            10,
		},
		{
			name:            "returns error when USD and CNY are absent",
			responseJSON:    `{"balance_infos":[{"currency":"EUR","total_balance":"10.00"}]}`,
			usdExchangeRate: 7.3,
			wantErrContains: "currency USD or CNY not found",
		},
		{
			name:            "returns USD parse error instead of falling back to CNY",
			responseJSON:    `{"balance_infos":[{"currency":"USD","total_balance":"invalid"},{"currency":"CNY","total_balance":"73.00"}]}`,
			usdExchangeRate: 7.3,
			wantErrContains: "invalid syntax",
		},
		{
			name:            "rejects NaN USD balance",
			responseJSON:    `{"balance_infos":[{"currency":"USD","total_balance":"NaN"}]}`,
			usdExchangeRate: 7.3,
			wantErrContains: "USD balance must be finite",
		},
		{
			name:            "rejects negative USD balance",
			responseJSON:    `{"balance_infos":[{"currency":"USD","total_balance":"-1.00"}]}`,
			usdExchangeRate: 7.3,
			wantErrContains: "USD balance must be non-negative",
		},
		{
			name:            "rejects positive infinity CNY balance",
			responseJSON:    `{"balance_infos":[{"currency":"CNY","total_balance":"+Inf"}]}`,
			usdExchangeRate: 7.3,
			wantErrContains: "CNY balance must be finite",
		},
		{
			name:            "rejects negative CNY balance",
			responseJSON:    `{"balance_infos":[{"currency":"CNY","total_balance":"-7.30"}]}`,
			usdExchangeRate: 7.3,
			wantErrContains: "CNY balance must be non-negative",
		},
		{
			name:            "returns error for non-positive CNY exchange rate",
			responseJSON:    `{"balance_infos":[{"currency":"CNY","total_balance":"73.00"}]}`,
			usdExchangeRate: 0,
			wantErrContains: "USD exchange rate must be greater than zero",
		},
		{
			name:            "rejects NaN CNY exchange rate",
			responseJSON:    `{"balance_infos":[{"currency":"CNY","total_balance":"73.00"}]}`,
			usdExchangeRate: math.NaN(),
			wantErrContains: "USD exchange rate must be finite",
		},
		{
			name:            "rejects positive infinity CNY exchange rate",
			responseJSON:    `{"balance_infos":[{"currency":"CNY","total_balance":"73.00"}]}`,
			usdExchangeRate: math.Inf(1),
			wantErrContains: "USD exchange rate must be finite",
		},
		{
			name:            "rejects CNY conversion overflow",
			responseJSON:    `{"balance_infos":[{"currency":"CNY","total_balance":"1.7976931348623157e+308"}]}`,
			usdExchangeRate: math.SmallestNonzeroFloat64,
			wantErrContains: "converted USD balance must be finite",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var response DeepSeekUsageResponse
			require.NoError(t, common.Unmarshal([]byte(test.responseJSON), &response))

			balance, err := getDeepSeekBalanceUSD(response, test.usdExchangeRate)
			if test.wantErrContains != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), test.wantErrContains)
				return
			}

			require.NoError(t, err)
			assert.InDelta(t, test.want, balance, 1e-12)
		})
	}
}

func TestUpdateChannelNewAPIBalanceUsesTheSmallerRemainingQuota(t *testing.T) {
	for _, tc := range []struct {
		name    string
		usage   string
		want    float64
		wantErr string
	}{
		{name: "user quota below the key quota", usage: `{"code":true,"data":{"total_available":2000000,"unlimited_quota":false,"user_quota":{"total_available":500000}}}`, want: 0.5},
		{name: "key quota below the user quota", usage: `{"code":true,"data":{"total_available":500000,"unlimited_quota":false,"user_quota":{"total_available":2000000}}}`, want: 0.5},
		{name: "unlimited key uses the user quota", usage: `{"code":true,"data":{"total_available":0,"unlimited_quota":true,"user_quota":{"total_available":3000000}}}`, want: 3},
		{name: "key quota alone without user quota", usage: `{"code":true,"data":{"total_available":1500000,"unlimited_quota":false}}`, want: 1.5},
		{name: "unlimited key without user quota", usage: `{"code":true,"data":{"total_available":0,"unlimited_quota":true}}`, wantErr: "Allow querying user quota"},
		{name: "upstream rejects the key", usage: `{"success":false,"message":"invalid token"}`, wantErr: "invalid token"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupSub2APIBalanceTest(t)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/api/usage/token/":
					assert.Equal(t, "Bearer sk-upstream", r.Header.Get("Authorization"))
					_, _ = w.Write([]byte(tc.usage))
				case "/api/status":
					assert.Empty(t, r.Header.Get("Authorization"), "the key is not sent to the public status endpoint")
					_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":1000000}}`))
				default:
					http.NotFound(w, r)
				}
			}))
			defer server.Close()
			baseURL := server.URL + "/"
			channel := &model.Channel{Type: constant.ChannelTypeNewAPI, BaseURL: &baseURL, Key: "sk-upstream", Name: "new-api-upstream"}
			require.NoError(t, model.DB.Create(channel).Error)

			result, err := updateChannelBalance(channel)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.InDelta(t, tc.want, result.Balance, 1e-9)
			assert.InDelta(t, tc.want, channel.Balance, 1e-9)
		})
	}
}

func TestUpdateChannelBalanceAggregatesMultiKeyChannel(t *testing.T) {
	setupSub2APIBalanceTest(t)
	usageByKey := map[string]string{
		"Bearer sk-aaaaaaaaaa": `{"code":true,"data":{"total_available":1000000,"unlimited_quota":false}}`,
		"Bearer sk-bbbbbbbbbb": `{"code":true,"data":{"total_available":2000000,"unlimited_quota":false}}`,
		"Bearer sk-cccccccccc": `{"code":true,"data":{"total_available":4000000,"unlimited_quota":false}}`,
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/usage/token/":
			body, ok := usageByKey[r.Header.Get("Authorization")]
			if !ok {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_, _ = w.Write([]byte(body))
		case "/api/status":
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":1000000}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	baseURL := server.URL
	channel := &model.Channel{
		Type:    constant.ChannelTypeNewAPI,
		BaseURL: &baseURL,
		Key:     "sk-aaaaaaaaaa\nsk-bbbbbbbbbb\nsk-cccccccccc",
		Name:    "multi-key-new-api",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:         true,
			MultiKeySize:       3,
			MultiKeyStatusList: map[int]int{2: common.ChannelStatusManuallyDisabled},
		},
	}
	require.NoError(t, model.DB.Create(channel).Error)

	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	// The disabled third key is skipped, so the total is 1 + 2 USD.
	assert.InDelta(t, 3, result.Balance, 1e-9)
	assert.False(t, result.Partial)
	require.Len(t, result.Keys, 2)
	assert.Equal(t, 0, result.Keys[0].Index)
	assert.Equal(t, 1, result.Keys[1].Index)
	require.NotNil(t, result.Keys[0].Balance)
	assert.InDelta(t, 1, *result.Keys[0].Balance, 1e-9)
	assert.Empty(t, result.Keys[0].Error)
	// Only a preview of the key leaves the backend.
	assert.Equal(t, "sk-aaaaaaa...", result.Keys[0].KeyPreview)
	assert.NotContains(t, result.Keys[0].KeyPreview, "sk-aaaaaaaaaa")
	assert.InDelta(t, 3, channel.Balance, 1e-9)
}

func TestUpdateChannelBalanceCapsMultiKeySumBySharedOwnerQuota(t *testing.T) {
	setupSub2APIBalanceTest(t)
	// Every key of one upstream account reports the same shared owner quota.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/usage/token/":
			_, _ = w.Write([]byte(`{"code":true,"data":{"total_available":1000000,"unlimited_quota":false,"user_quota":{"total_available":1500000}}}`))
		case "/api/status":
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":1000000}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	baseURL := server.URL
	channel := &model.Channel{
		Type:        constant.ChannelTypeNewAPI,
		BaseURL:     &baseURL,
		Key:         "sk-one\nsk-two",
		Name:        "multi-key-capped",
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2},
	}
	require.NoError(t, model.DB.Create(channel).Error)

	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	// Two keys report 1 USD each, but the shared owner quota is 1.5 USD.
	assert.InDelta(t, 1.5, result.Balance, 1e-9)
	assert.False(t, result.Partial)
}

func TestUpdateChannelBalanceKeepsTheKeysThatAnswered(t *testing.T) {
	setupSub2APIBalanceTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/usage/token/":
			if r.Header.Get("Authorization") == "Bearer sk-broken" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_, _ = w.Write([]byte(`{"code":true,"data":{"total_available":2000000,"unlimited_quota":false}}`))
		case "/api/status":
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":1000000}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	baseURL := server.URL
	channel := &model.Channel{
		Type:        constant.ChannelTypeNewAPI,
		BaseURL:     &baseURL,
		Key:         "sk-broken\nsk-good",
		Name:        "multi-key-partial",
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2},
	}
	require.NoError(t, model.DB.Create(channel).Error)

	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	assert.True(t, result.Partial, "a key that failed makes the total partial")
	assert.InDelta(t, 2, result.Balance, 1e-9)
	require.Len(t, result.Keys, 2)
	assert.Nil(t, result.Keys[0].Balance)
	assert.NotEmpty(t, result.Keys[0].Error)
	require.NotNil(t, result.Keys[1].Balance)
	assert.InDelta(t, 2, *result.Keys[1].Balance, 1e-9)
}

func TestUpdateChannelBalanceFailsWhenEveryKeyFails(t *testing.T) {
	setupSub2APIBalanceTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The channel-level endpoint is healthy; every key lookup fails.
		if r.URL.Path == "/api/status" {
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":1000000}}`))
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	baseURL := server.URL
	channel := &model.Channel{
		Type:        constant.ChannelTypeNewAPI,
		BaseURL:     &baseURL,
		Key:         "sk-one\nsk-two",
		Name:        "multi-key-all-failed",
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2},
	}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Model(channel).Update("balance", 12.5).Error)

	_, err := updateChannelBalance(channel)
	require.ErrorContains(t, err, "every enabled key failed to report a balance")

	stored := model.Channel{}
	require.NoError(t, model.DB.First(&stored, channel.Id).Error)
	assert.InDelta(t, 12.5, stored.Balance, 1e-9)
}

func TestUpdateChannelBalanceRejectsMultiKeyChannelWithoutEnabledKey(t *testing.T) {
	setupSub2APIBalanceTest(t)
	channel := &model.Channel{
		Type: constant.ChannelTypeNewAPI,
		Key:  "sk-one\nsk-two",
		Name: "multi-key-disabled",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:         true,
			MultiKeySize:       2,
			MultiKeyStatusList: map[int]int{0: common.ChannelStatusManuallyDisabled, 1: common.ChannelStatusAutoDisabled},
		},
	}
	require.NoError(t, model.DB.Create(channel).Error)

	_, err := updateChannelBalance(channel)
	require.ErrorContains(t, err, "no enabled key")
}

func TestUpdateChannelBalanceCountsSharedSub2APIWalletOnce(t *testing.T) {
	setupSub2APIBalanceTest(t)
	// Both keys fall back to the same account wallet, which must not be added up.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/usage", r.URL.Path)
		_, _ = w.Write([]byte(`{"balance": 42.5, "isValid": true, "unit": "USD"}`))
	}))
	defer server.Close()

	baseURL := server.URL
	channel := &model.Channel{
		Type:        constant.ChannelTypeSub2API,
		BaseURL:     &baseURL,
		Key:         "sk-one\nsk-two",
		Name:        "multi-key-sub2api-wallet",
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2},
	}
	require.NoError(t, model.DB.Create(channel).Error)

	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	assert.InDelta(t, 42.5, result.Balance, 1e-9)
}

func TestUpdateChannelBalanceCountsUnlimitedKeyBySharedOwnerQuota(t *testing.T) {
	setupSub2APIBalanceTest(t)
	// An unlimited key has no ceiling of its own, so the shared owner quota is
	// what bounds the channel.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/usage/token/":
			_, _ = w.Write([]byte(`{"code":true,"data":{"total_available":0,"unlimited_quota":true,"user_quota":{"total_available":3000000}}}`))
		case "/api/status":
			_, _ = w.Write([]byte(`{"success":true,"data":{"quota_per_unit":1000000}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	baseURL := server.URL
	channel := &model.Channel{
		Type:        constant.ChannelTypeNewAPI,
		BaseURL:     &baseURL,
		Key:         "sk-one\nsk-two",
		Name:        "multi-key-unlimited",
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2},
	}
	require.NoError(t, model.DB.Create(channel).Error)

	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	assert.InDelta(t, 3, result.Balance, 1e-9)
	assert.False(t, result.Partial)
	require.Len(t, result.Keys, 2)
	for _, entry := range result.Keys {
		require.NotNil(t, entry.Balance)
		assert.False(t, math.IsInf(*entry.Balance, 0), "an unbounded key reports the shared quota, not infinity")
	}
}

func TestUpdateChannelBalanceKeepsOverdrawnSharedSub2APIWallet(t *testing.T) {
	setupSub2APIBalanceTest(t)
	// Both keys fall back to the same overdrawn wallet; the overdraft must
	// survive instead of being clamped to zero.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"balance": -1, "isValid": true, "unit": "USD"}`))
	}))
	defer server.Close()

	baseURL := server.URL
	channel := &model.Channel{
		Type:        constant.ChannelTypeSub2API,
		BaseURL:     &baseURL,
		Key:         "sk-one\nsk-two",
		Name:        "multi-key-sub2api-overdrawn",
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2},
	}
	require.NoError(t, model.DB.Create(channel).Error)

	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	assert.InDelta(t, -1, result.Balance, 1e-9)
}

func TestUpdateChannelBalancePersistsAdvancedCustomSingleKey(t *testing.T) {
	setupSub2APIBalanceTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/provider/balance", r.URL.Path)
		assert.Equal(t, "Bearer sk-custom", r.Header.Get("Authorization"))
		_, _ = w.Write([]byte(`{"object":"credit_summary","total_available":12.5}`))
	}))
	defer server.Close()

	config := &dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: dto.AdvancedCustomBalancePath,
				UpstreamPath: "/provider/balance",
				Converter:    "none",
			},
		},
	}
	baseURL := server.URL
	channel := &model.Channel{
		Type:    constant.ChannelTypeAdvancedCustom,
		Key:     "sk-custom",
		BaseURL: &baseURL,
		Name:    "advanced-custom-balance",
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: config})
	require.NoError(t, model.DB.Create(channel).Error)

	result, err := updateChannelBalance(channel)
	require.NoError(t, err)
	assert.InDelta(t, 12.5, result.Balance, 1e-9)

	stored := model.Channel{}
	require.NoError(t, model.DB.First(&stored, channel.Id).Error)
	assert.InDelta(t, 12.5, stored.Balance, 1e-9)
}
