package controller

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type dogPayTestRoundTripper func(*http.Request) (*http.Response, error)

func (roundTripper dogPayTestRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	return roundTripper(request)
}

func dogPayTestHTTPResponse(request *http.Request, body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    request,
	}
}

func TestGetDogPayCurrencyConfigIDRequestsCurrencyConfigEndpoint(t *testing.T) {
	previousTransport := http.DefaultTransport
	previousBaseURL := setting.DogPayBaseUrl
	previousAppID := setting.DogPayAppId
	previousSecret := setting.DogPaySecret
	t.Cleanup(func() {
		http.DefaultTransport = previousTransport
		setting.DogPayBaseUrl = previousBaseURL
		setting.DogPayAppId = previousAppID
		setting.DogPaySecret = previousSecret
	})

	setting.DogPayBaseUrl = "https://dogpay.test"
	setting.DogPayAppId = "test-app-id"
	setting.DogPaySecret = "test-secret"

	authRequested := false
	currencyConfigRequested := false
	http.DefaultTransport = dogPayTestRoundTripper(func(request *http.Request) (*http.Response, error) {
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/open-api/v1/auth/access_token":
			authRequested = true
			return dogPayTestHTTPResponse(request, `{"code":0,"data":{"access_token":"test-access-token","expires_in":3600}}`), nil
		case request.Method == http.MethodGet && request.URL.Path == "/open-api/v1/pay/currency-config":
			currencyConfigRequested = true
			if request.Header.Get("Authorization") != "Bearer test-access-token" {
				return nil, fmt.Errorf("unexpected authorization header: %q", request.Header.Get("Authorization"))
			}
			return dogPayTestHTTPResponse(request, `{"code":0,"data":[{"id":"currency-config-usdc","pay_channel":"pay_001","currency":"USDC","status":"active"},{"id":"currency-config-usdt","pay_channel":"pay_002","currency":"USDT","status":"active"}],"message":"success"}`), nil
		default:
			return nil, fmt.Errorf("unexpected DogPay request: %s %s", request.Method, request.URL.Path)
		}
	})

	currencyConfigID, payChannel, err := getDogPayCurrencyConfigID()

	require.NoError(t, err)
	assert.Equal(t, "currency-config-usdt", currencyConfigID)
	assert.Equal(t, "pay_002", payChannel)
	assert.True(t, authRequested)
	assert.True(t, currencyConfigRequested)
}

func TestGetDogPayCurrencyConfigIDRejectsNonArrayData(t *testing.T) {
	previousTransport := http.DefaultTransport
	previousBaseURL := setting.DogPayBaseUrl
	previousAppID := setting.DogPayAppId
	previousSecret := setting.DogPaySecret
	t.Cleanup(func() {
		http.DefaultTransport = previousTransport
		setting.DogPayBaseUrl = previousBaseURL
		setting.DogPayAppId = previousAppID
		setting.DogPaySecret = previousSecret
	})

	setting.DogPayBaseUrl = "https://dogpay.test"
	setting.DogPayAppId = "test-app-id"
	setting.DogPaySecret = "test-secret"
	http.DefaultTransport = dogPayTestRoundTripper(func(request *http.Request) (*http.Response, error) {
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/open-api/v1/auth/access_token":
			return dogPayTestHTTPResponse(request, `{"code":0,"data":{"access_token":"test-access-token","expires_in":3600}}`), nil
		case request.Method == http.MethodGet && request.URL.Path == "/open-api/v1/pay/currency-config":
			return dogPayTestHTTPResponse(request, `{"code":0,"data":{"id":"currency-config-usdt","pay_channel":"pay_002","currency":"USDT","status":"active"}}`), nil
		default:
			return nil, fmt.Errorf("unexpected DogPay request: %s %s", request.Method, request.URL.Path)
		}
	})

	_, _, err := getDogPayCurrencyConfigID()

	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid currency config data")
}
