package service

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type accountBalanceTransport func(*http.Request) (*http.Response, error)

func (f accountBalanceTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestAccountBalanceWalletContract(t *testing.T) {
	for _, test := range []struct {
		name, status, account string
		want                  float64
		currency, errorText   string
	}{
		{"GoEasy wallet", `{"success":true,"data":{"quota_per_unit":500000,"quota_display_type":"CNY","usd_exchange_rate":1}}`, `{"success":true,"data":{"id":42,"quota":49945000,"used_quota":50555000,"unlimited_quota":true}}`, 99.89, "CNY", ""},
		{"zero wallet", `{"success":true,"data":{"quota_per_unit":500000,"quota_display_type":"USD"}}`, `{"success":true,"data":{"id":42,"quota":0}}`, 0, "USD", ""},
		{"upstream exchange rate", `{"success":true,"data":{"quota_per_unit":500000,"quota_display_type":"CNY","usd_exchange_rate":7}}`, `{"success":true,"data":{"id":42,"quota":5000000}}`, 70, "CNY", ""},
		{"missing quota", `{"success":true,"data":{"quota_per_unit":500000,"quota_display_type":"USD"}}`, `{"success":true,"data":{"id":42}}`, 0, "", "account query failed"},
		{"wrong user", `{"success":true,"data":{"quota_per_unit":500000,"quota_display_type":"USD"}}`, `{"success":true,"data":{"id":43,"quota":1}}`, 0, "", "user ID"},
		{"business error with secret", `{"success":true,"data":{"quota_per_unit":500000,"quota_display_type":"USD"}}`, `{"success":false,"message":"account-secret"}`, 0, "", "account query failed"},
		{"missing conversion", `{"success":true,"data":{"quota_display_type":"CNY"}}`, "", 0, "", "conversion"},
		{"unknown currency", `{"success":true,"data":{"quota_per_unit":500000,"quota_display_type":"CUSTOM"}}`, "", 0, "", "supports"},
		{"HTML login", `<html>account-secret</html>`, "", 0, "", "valid JSON"},
	} {
		t.Run(test.name, func(t *testing.T) {
			client := &http.Client{Transport: accountBalanceTransport(func(r *http.Request) (*http.Response, error) {
				assert.Equal(t, "wallet.example", r.URL.Host)
				assert.Equal(t, http.MethodGet, r.Method)
				assert.Equal(t, "application/json", r.Header.Get("Accept"))
				assert.Equal(t, "Mozilla/5.0 (compatible; NewAPI-AccountBalance/1.0)", r.Header.Get("User-Agent"))
				_, ok := r.Context().Deadline()
				assert.True(t, ok)
				body := test.status
				if r.URL.Path == "/api/user/self" {
					assert.Equal(t, "Bearer account-secret", r.Header.Get("Authorization"))
					assert.Equal(t, "42", r.Header.Get("New-Api-User"))
					body = test.account
				} else {
					assert.Equal(t, "/api/status", r.URL.Path)
					assert.Empty(t, r.Header.Get("Authorization"))
				}
				return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(body)), Request: r}, nil
			})}
			balance, currency, err := fetchAccountBalance(context.Background(), client, model.ChannelBalanceConfig{BaseURL: "https://wallet.example", UserID: 42, AccessToken: "account-secret", Enabled: true})
			if test.errorText != "" {
				require.ErrorContains(t, err, test.errorText)
				assert.NotContains(t, err.Error(), "account-secret")
				assert.Empty(t, currency)
				return
			}
			require.NoError(t, err)
			assert.InDelta(t, test.want, balance, 0.000001)
			assert.Equal(t, test.currency, currency)
		})
	}
}

func TestAccountBalanceRejectsRedirectAndOversizedResponse(t *testing.T) {
	for _, code := range []int{302, 401, 403, 429, 500, 200} {
		calls := 0
		client := &http.Client{Transport: accountBalanceTransport(func(r *http.Request) (*http.Response, error) {
			calls++
			return &http.Response{StatusCode: code, Header: http.Header{"Location": []string{"https://different.example/"}}, Body: io.NopCloser(strings.NewReader(strings.Repeat("x", (256<<10)+1))), Request: r}, nil
		})}
		_, _, err := fetchAccountBalance(context.Background(), client, model.ChannelBalanceConfig{BaseURL: "https://wallet.example", UserID: 42, AccessToken: "account-secret", Enabled: true})
		require.Error(t, err)
		assert.Equal(t, 1, calls)
	}
}

func TestValidateAccountBalanceConfiguration(t *testing.T) {
	for _, endpoint := range []string{"http://wallet.example", "https://user:secret@wallet.example", "https://wallet.example?token=secret", "https://wallet.example/#fragment"} {
		config := model.ChannelBalanceConfig{Enabled: true, BaseURL: endpoint, UserID: 42}
		require.Error(t, ValidateAccountBalanceConfig(&config))
	}
}
