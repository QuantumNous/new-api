package service

import (
	"bytes"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestYooKassaCreatePaymentRequest(t *testing.T) {
	var capturedRequest YooKassaPaymentRequest
	var capturedIdempotenceKey string

	client := NewYooKassaClient(&http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			capturedIdempotenceKey = req.Header.Get("Idempotence-Key")
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			require.NoError(t, common.Unmarshal(body, &capturedRequest))
			username, password, ok := req.BasicAuth()
			require.True(t, ok)
			require.Equal(t, "shop", username)
			require.Equal(t, "secret", password)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(bytes.NewBufferString(`{
					"id":"pay_1",
					"status":"pending",
					"paid":false,
					"amount":{"value":"100.00","currency":"RUB"},
					"confirmation":{"confirmation_url":"https://yookassa.test/pay"}
				}`)),
				Header: make(http.Header),
			}, nil
		}),
	})
	client.baseURL = "https://unit.test"
	client.shopID = "shop"
	client.secretKey = "secret"

	request := NewYooKassaPaymentRequest("trade-1", 7, 11, "100.00", "https://example.com/return", "sbp")
	payment, err := client.CreatePayment(t.Context(), "trade-1", request)
	require.NoError(t, err)

	require.Equal(t, "trade-1", capturedIdempotenceKey)
	require.Equal(t, "100.00", capturedRequest.Amount.Value)
	require.Equal(t, YooKassaCurrencyRUB, capturedRequest.Amount.Currency)
	require.Equal(t, "sbp", capturedRequest.PaymentMethodData.Type)
	require.Equal(t, "trade-1", capturedRequest.Metadata["trade_no"])
	require.Equal(t, "7", capturedRequest.Metadata["user_id"])
	require.Equal(t, "11", capturedRequest.Metadata["topup_id"])
	require.Equal(t, "https://yookassa.test/pay", payment.Confirmation.ConfirmationURL)
}

func TestYooKassaGetPaymentEscapesPaymentID(t *testing.T) {
	var capturedURI string
	client := NewYooKassaClient(&http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			capturedURI = req.URL.RequestURI()
			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(`{
					"id":"pay/../1?bad=true",
					"status":"succeeded",
					"paid":true,
					"amount":{"value":"100.00","currency":"RUB"},
					"metadata":{"trade_no":"trade-1"}
				}`)),
				Header: make(http.Header),
			}, nil
		}),
	})
	client.baseURL = "https://unit.test"

	_, err := client.GetPayment(t.Context(), " pay/../1?bad=true ")
	require.NoError(t, err)
	require.Equal(t, "/payments/pay%2F..%2F1%3Fbad=true", capturedURI)
}
