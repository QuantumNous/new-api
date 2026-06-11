package service

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestSendGAEventPostsMeasurementProtocolPayload(t *testing.T) {
	var gotPath string
	var gotQuery url.Values
	var gotPayload gaMeasurementPayload

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotQuery = r.URL.Query()
		if err := common.DecodeJson(r.Body, &gotPayload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := server.Client()
	cfg := GAConfig{
		MeasurementID: "G-TEST123",
		APISecret:     "secret-123",
		Endpoint:      server.URL + "/mp/collect",
		HTTPClient:    client,
	}

	if err := SendGAEventWithConfig(cfg, GAEvent{
		Name:      "sign_up_success",
		ClientID:  "123.456",
		SessionID: "789",
		Params: map[string]any{
			"user_id": 42,
			"method":  "password",
		},
	}); err != nil {
		t.Fatalf("SendGAEventWithConfig returned error: %v", err)
	}

	if gotPath != "/mp/collect" {
		t.Fatalf("expected /mp/collect path, got %q", gotPath)
	}
	if gotQuery.Get("measurement_id") != "G-TEST123" {
		t.Fatalf("expected measurement_id query, got %q", gotQuery.Get("measurement_id"))
	}
	if gotQuery.Get("api_secret") != "secret-123" {
		t.Fatalf("expected api_secret query, got %q", gotQuery.Get("api_secret"))
	}
	if gotPayload.ClientID != "123.456" {
		t.Fatalf("expected client_id 123.456, got %q", gotPayload.ClientID)
	}
	if len(gotPayload.Events) != 1 {
		t.Fatalf("expected one event, got %d", len(gotPayload.Events))
	}
	event := gotPayload.Events[0]
	if event.Name != "sign_up_success" {
		t.Fatalf("expected event name sign_up_success, got %q", event.Name)
	}
	if event.Params["session_id"] != "789" {
		t.Fatalf("expected session_id 789, got %#v", event.Params["session_id"])
	}
	if event.Params["engagement_time_msec"] != float64(1) {
		t.Fatalf("expected engagement_time_msec 1, got %#v", event.Params["engagement_time_msec"])
	}
	if event.Params["user_id"] != float64(42) {
		t.Fatalf("expected user_id 42, got %#v", event.Params["user_id"])
	}
}

func TestSendGAEventSkipsWhenSecretMissing(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	err := SendGAEventWithConfig(GAConfig{
		MeasurementID: "G-TEST123",
		APISecret:     "",
		Endpoint:      server.URL + "/mp/collect",
		HTTPClient:    server.Client(),
	}, GAEvent{
		Name:      "payment_success",
		ClientID:  "123.456",
		SessionID: "789",
	})
	if err != nil {
		t.Fatalf("expected missing secret to be a no-op, got %v", err)
	}
	if called {
		t.Fatal("expected no request when api secret is missing")
	}
}

func TestDefaultGAConfigUsesEnvironmentAndFallbackMeasurementID(t *testing.T) {
	t.Setenv("GA_MEASURE_PROTOCOL_API_SECRET", "secret-env")
	t.Setenv("GA_MESSUREMENT_ID", "G-ENV123")

	cfg := DefaultGAConfig()
	if cfg.APISecret != "secret-env" {
		t.Fatalf("expected API secret from env, got %q", cfg.APISecret)
	}
	if cfg.MeasurementID != "G-ENV123" {
		t.Fatalf("expected measurement id from GA_MESSUREMENT_ID, got %q", cfg.MeasurementID)
	}

	t.Setenv("GA_MESSUREMENT_ID", "")
	cfg = DefaultGAConfig()
	if cfg.MeasurementID != defaultGAMeasurementID {
		t.Fatalf("expected fallback measurement id, got %q", cfg.MeasurementID)
	}
	if !strings.Contains(cfg.Endpoint, "google-analytics.com/mp/collect") {
		t.Fatalf("expected default endpoint, got %q", cfg.Endpoint)
	}
}
