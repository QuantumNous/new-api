package smart_router_client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestClient_Route_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/route" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(Decision{
			Primary:         "claude-haiku-4-5",
			FallbackChain:   []string{"gpt-4o-mini"},
			Reason:          "short_question",
			StrategyVersion: "test-v1",
		})
	}))
	defer srv.Close()

	c := &Client{baseURL: srv.URL, http: &http.Client{Timeout: time.Second}}
	dec, err := c.Route(context.Background(), RouteRequest{
		TenantID: "1",
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if dec == nil || dec.Primary != "claude-haiku-4-5" {
		t.Errorf("unexpected decision: %+v", dec)
	}
}

func TestClient_Route_DisabledWhenURLEmpty(t *testing.T) {
	c := &Client{baseURL: "", http: &http.Client{}}
	dec, err := c.Route(context.Background(), RouteRequest{TenantID: "1"})
	if err != nil {
		t.Fatal(err)
	}
	if dec != nil {
		t.Errorf("expected nil decision when disabled, got %+v", dec)
	}
}

func TestClient_Route_ErrorResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":               "no_model_matches_constraints",
			"fallback_to_default": "gpt-4o-mini",
		})
	}))
	defer srv.Close()

	c := &Client{baseURL: srv.URL, http: &http.Client{Timeout: time.Second}}
	dec, err := c.Route(context.Background(), RouteRequest{TenantID: "1"})
	if err != nil {
		t.Fatal(err)
	}
	if dec != nil {
		t.Errorf("expected nil decision on error response, got %+v", dec)
	}
}

func TestClient_Route_NonOKStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := &Client{baseURL: srv.URL, http: &http.Client{Timeout: time.Second}}
	_, err := c.Route(context.Background(), RouteRequest{TenantID: "1"})
	if err == nil {
		t.Error("expected error on 500")
	}
}

func TestClient_CircuitBreaker(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := &Client{baseURL: srv.URL, http: &http.Client{Timeout: time.Second}}
	// Trigger breaker
	for i := 0; i < breakerThreshold; i++ {
		_, _ = c.Route(context.Background(), RouteRequest{TenantID: "1"})
	}
	// Next call should fast-fail (nil decision, nil error)
	dec, err := c.Route(context.Background(), RouteRequest{TenantID: "1"})
	if err != nil {
		t.Errorf("breaker should fast-fail without error, got %v", err)
	}
	if dec != nil {
		t.Errorf("breaker should return nil decision")
	}
}

func TestClient_Timeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(200 * time.Millisecond)
	}))
	defer srv.Close()

	c := &Client{baseURL: srv.URL, http: &http.Client{Timeout: 20 * time.Millisecond}}
	_, err := c.Route(context.Background(), RouteRequest{TenantID: "1"})
	if err == nil {
		t.Error("expected timeout error")
	}
}
