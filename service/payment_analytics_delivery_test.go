package service

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestDeliverPaymentAnalyticsEventSendsCanonicalPurchase(t *testing.T) {
	var body []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "G-test", r.URL.Query().Get("measurement_id"))
		require.Equal(t, "secret", r.URL.Query().Get("api_secret"))
		var err error
		body, err = io.ReadAll(r.Body)
		require.NoError(t, err)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	err := deliverPaymentAnalyticsEvent(GAConfig{
		MeasurementID: "G-test", APISecret: "secret", Endpoint: server.URL, HTTPClient: server.Client(),
	}, model.PaymentAnalyticsOutbox{
		TransactionId: "order-1", Value: 12.5, Currency: "USD", PaymentProvider: "stripe", PaymentMethod: "card",
		ProductType: "top_up", ItemId: "wallet_top_up", ItemName: "Wallet top-up", ClientId: "123.456", SessionId: "789",
		OccurredAt: 1_800_000_000,
	})
	require.NoError(t, err)

	var payload struct {
		ClientID        string `json:"client_id"`
		TimestampMicros int64  `json:"timestamp_micros"`
		Events          []struct {
			Name   string         `json:"name"`
			Params map[string]any `json:"params"`
		} `json:"events"`
	}
	require.NoError(t, common.Unmarshal(body, &payload))
	require.Equal(t, "123.456", payload.ClientID)
	require.Len(t, payload.Events, 1)
	require.Equal(t, "purchase", payload.Events[0].Name)
	require.Equal(t, "order-1", payload.Events[0].Params["transaction_id"])
	require.Equal(t, "USD", payload.Events[0].Params["currency"])
	require.Equal(t, "stripe", payload.Events[0].Params["payment_provider"])
	require.Equal(t, "top_up", payload.Events[0].Params["product_type"])
	require.EqualValues(t, 1_800_000_000_000_000, payload.TimestampMicros)
	require.NotContains(t, payload.Events[0].Params, "timestamp_micros")
}

func TestGA4DeliveryErrorClassification(t *testing.T) {
	require.True(t, IsGAPermanentDeliveryError(&GAHTTPStatusError{StatusCode: http.StatusBadRequest}))
	require.False(t, IsGAPermanentDeliveryError(&GAHTTPStatusError{StatusCode: http.StatusUnauthorized}))
	require.False(t, IsGAPermanentDeliveryError(&GAHTTPStatusError{StatusCode: http.StatusForbidden}))
	require.False(t, IsGAPermanentDeliveryError(&GAHTTPStatusError{StatusCode: http.StatusRequestTimeout}))
	require.False(t, IsGAPermanentDeliveryError(&GAHTTPStatusError{StatusCode: http.StatusTooManyRequests}))
	require.False(t, IsGAPermanentDeliveryError(&GAHTTPStatusError{StatusCode: http.StatusInternalServerError}))
}
