package integration_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"smart-router/api"
	"smart-router/internal/catalog"
	"smart-router/metrics"
	"smart-router/routing"
	"smart-router/signing"
	"smart-router/store"
	"smart-router/tests/integration/mocks"
)

func TestMockHostProviderFlowUsesOpaqueBindingsAndPersistsCooldown(t *testing.T) {
	const (
		firstBindingID  = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"
		secondBindingID = "bnd_BBBBBBBBBBBBBBBBBBBBBBBB"
	)
	ctx := context.Background()
	database, err := store.OpenSQLite(ctx, t.TempDir()+"/router.db")
	if err != nil {
		t.Fatalf("OpenSQLite() error = %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := database.UpsertSource(ctx, store.Source{
		ID: "fixture-source", Connector: "ebond", Enabled: true,
	}); err != nil {
		t.Fatalf("UpsertSource() error = %v", err)
	}
	for _, binding := range []store.BindingRecord{
		{
			ID: firstBindingID, SourceID: "fixture-source", Group: "default",
			Model: "model-a", Protocol: api.ProtocolChat,
			ProtocolPlugin: "chat-v1", Enabled: true, CostMicrounits: 10,
		},
		{
			ID: secondBindingID, SourceID: "fixture-source", Group: "default",
			Model: "model-a", Protocol: api.ProtocolChat,
			ProtocolPlugin: "chat-v1", Enabled: true, CostMicrounits: 20,
		},
	} {
		if err := database.UpsertBinding(ctx, binding); err != nil {
			t.Fatalf("UpsertBinding(%q) error = %v", binding.ID, err)
		}
		if err := database.SetObservation(ctx, binding.ID, store.Observation{
			Health: routing.HealthHealthy, Fingerprint: strings.Repeat("f", 64),
			ObservedAt: time.Unix(1, 0),
		}); err != nil {
			t.Fatalf("SetObservation(%q) error = %v", binding.ID, err)
		}
	}

	key := []byte(strings.Repeat("k", 32))
	now := time.Unix(1700000000, 0).UTC()
	runtime := catalog.NewRuntime(catalog.RuntimeConfig{
		Store: database, SigningKey: key, Now: func() time.Time { return now },
		SnapshotTTL: time.Minute, ConfigSHA256: strings.Repeat("a", 64),
		PluginManifestSHA256: strings.Repeat("b", 64),
	})
	registry := metrics.New()
	router := httptest.NewServer(api.NewServer(runtime, registry))
	t.Cleanup(router.Close)

	firstProvider := mocks.NewProvider(http.StatusTooManyRequests, 3000)
	t.Cleanup(firstProvider.Close)
	secondProvider := mocks.NewProvider(http.StatusOK, 0)
	t.Cleanup(secondProvider.Close)
	host := mocks.Host{
		RouterURL: router.URL, SigningKey: key,
		Providers: map[string]*mocks.Provider{
			firstBindingID: firstProvider, secondBindingID: secondProvider,
		},
		Clock: &fakeClock{now: now},
	}
	request := api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "req-1",
		Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
		AttemptLimit: 2,
	}
	execution, err := host.Execute(ctx, request)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if strings.Join(execution.Attempts, ",") != firstBindingID+","+secondBindingID {
		t.Fatalf("attempts = %#v, want price order then retry", execution.Attempts)
	}
	if firstProvider.Calls() != 1 || secondProvider.Calls() != 1 {
		t.Fatalf("provider calls = %d/%d, want 1/1", firstProvider.Calls(), secondProvider.Calls())
	}

	request.RequestID = "req-2"
	execution, err = host.Execute(ctx, request)
	if err != nil {
		t.Fatalf("second Execute() error = %v", err)
	}
	if len(execution.Attempts) != 1 || execution.Attempts[0] != secondBindingID {
		t.Fatalf("attempts during cooldown = %#v, want second binding only", execution.Attempts)
	}

	response, err := http.Get(router.URL + "/metrics")
	if err != nil {
		t.Fatalf("GET /metrics error = %v", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read metrics: %v", err)
	}
	if !strings.Contains(string(body), `route="route",status="200"} 2`) ||
		!strings.Contains(string(body), `route="outcome",status="204"} 3`) {
		t.Fatalf("metrics = %q", body)
	}
}

func TestMockHostWaitsForRetryAfterBeforeNextProviderAttempt(t *testing.T) {
	const (
		firstBindingID  = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"
		secondBindingID = "bnd_BBBBBBBBBBBBBBBBBBBBBBBB"
	)
	key := []byte(strings.Repeat("k", 32))
	start := time.Unix(1700000000, 0).UTC()
	routeResponse := api.RouteResponse{
		Kind: "route_response", SchemaVersion: 1, RequestID: "req-delay",
		SnapshotRevision: "rev-1", ExpiresAt: start.Add(time.Minute).UnixMilli(),
		Bindings: []api.Binding{
			{BindingID: firstBindingID, ProtocolPlugin: "chat-v1", Rank: 1},
			{BindingID: secondBindingID, ProtocolPlugin: "chat-v1", Rank: 2},
		},
	}
	signature, err := signing.Sign(routeResponse, key)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	routeResponse.Signature = signature
	router := httptest.NewServer(http.HandlerFunc(
		func(writer http.ResponseWriter, request *http.Request) {
			switch request.URL.Path {
			case "/v1/route":
				writer.Header().Set("Content-Type", "application/json")
				if err := json.NewEncoder(writer).Encode(routeResponse); err != nil {
					t.Errorf("encode route response: %v", err)
				}
			case "/v1/outcomes":
				writer.WriteHeader(http.StatusNoContent)
			default:
				writer.WriteHeader(http.StatusNotFound)
			}
		},
	))
	t.Cleanup(router.Close)

	firstProvider := mocks.NewProvider(http.StatusTooManyRequests, 3000)
	t.Cleanup(firstProvider.Close)
	secondProvider := mocks.NewProvider(http.StatusOK, 0)
	t.Cleanup(secondProvider.Close)
	clock := &fakeClock{now: start}
	host := mocks.Host{
		RouterURL: router.URL, SigningKey: key,
		Providers: map[string]*mocks.Provider{
			firstBindingID: firstProvider, secondBindingID: secondProvider,
		},
		Clock: clock,
	}
	execution, err := host.Execute(context.Background(), api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "req-delay",
		Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
		AttemptLimit: 2,
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if len(clock.sleeps) != 1 || clock.sleeps[0] != 3*time.Second {
		t.Fatalf("clock sleeps = %v, want [3s]", clock.sleeps)
	}
	if len(execution.AttemptedAt) != 2 {
		t.Fatalf("attempt timestamps = %v, want two", execution.AttemptedAt)
	}
	if delay := execution.AttemptedAt[1].Sub(execution.AttemptedAt[0]); delay != 3*time.Second {
		t.Fatalf("second provider attempted after %v, want 3s", delay)
	}
}

func TestMockHostRejectsRouteAtInjectedClockExpiryBeforeProviderAttempt(t *testing.T) {
	const bindingID = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"
	key := []byte(strings.Repeat("k", 32))
	expiresAt := time.Unix(1700000000, 0).UTC()
	routeResponse := api.RouteResponse{
		Kind: "route_response", SchemaVersion: 1, RequestID: "req-expired",
		SnapshotRevision: "rev-1", ExpiresAt: expiresAt.UnixMilli(),
		Bindings: []api.Binding{{
			BindingID: bindingID, ProtocolPlugin: "chat-v1", Rank: 1,
		}},
	}
	signature, err := signing.Sign(routeResponse, key)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	routeResponse.Signature = signature
	router := httptest.NewServer(http.HandlerFunc(
		func(writer http.ResponseWriter, request *http.Request) {
			switch request.URL.Path {
			case "/v1/route":
				writer.Header().Set("Content-Type", "application/json")
				if err := json.NewEncoder(writer).Encode(routeResponse); err != nil {
					t.Errorf("encode route response: %v", err)
				}
			default:
				writer.WriteHeader(http.StatusNotFound)
			}
		},
	))
	t.Cleanup(router.Close)

	provider := mocks.NewProvider(http.StatusOK, 0)
	t.Cleanup(provider.Close)
	host := mocks.Host{
		RouterURL: router.URL, SigningKey: key,
		Providers: map[string]*mocks.Provider{bindingID: provider},
		Clock:     &fakeClock{now: expiresAt},
	}
	_, err = host.Execute(context.Background(), api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "req-expired",
		Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
		AttemptLimit: 1,
	})
	if err == nil {
		t.Fatal("Execute() error = nil, want expired route rejection")
	}
	if provider.Calls() != 0 {
		t.Fatalf("provider calls = %d, want zero for expired route", provider.Calls())
	}
}

func TestMockHostRechecksExpiryAfterRetryDelay(t *testing.T) {
	const (
		firstBindingID  = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"
		secondBindingID = "bnd_BBBBBBBBBBBBBBBBBBBBBBBB"
	)
	key := []byte(strings.Repeat("k", 32))
	start := time.Unix(1700000000, 0).UTC()
	routeResponse := api.RouteResponse{
		Kind: "route_response", SchemaVersion: 1, RequestID: "req-expiry-delay",
		SnapshotRevision: "rev-1", ExpiresAt: start.Add(2 * time.Second).UnixMilli(),
		Bindings: []api.Binding{
			{BindingID: firstBindingID, ProtocolPlugin: "chat-v1", Rank: 1},
			{BindingID: secondBindingID, ProtocolPlugin: "chat-v1", Rank: 2},
		},
	}
	signature, err := signing.Sign(routeResponse, key)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	routeResponse.Signature = signature
	router := httptest.NewServer(http.HandlerFunc(
		func(writer http.ResponseWriter, request *http.Request) {
			switch request.URL.Path {
			case "/v1/route":
				writer.Header().Set("Content-Type", "application/json")
				if err := json.NewEncoder(writer).Encode(routeResponse); err != nil {
					t.Errorf("encode route response: %v", err)
				}
			case "/v1/outcomes":
				writer.WriteHeader(http.StatusNoContent)
			default:
				writer.WriteHeader(http.StatusNotFound)
			}
		},
	))
	t.Cleanup(router.Close)

	firstProvider := mocks.NewProvider(http.StatusTooManyRequests, 3000)
	t.Cleanup(firstProvider.Close)
	secondProvider := mocks.NewProvider(http.StatusOK, 0)
	t.Cleanup(secondProvider.Close)
	clock := &fakeClock{now: start}
	host := mocks.Host{
		RouterURL: router.URL, SigningKey: key,
		Providers: map[string]*mocks.Provider{
			firstBindingID: firstProvider, secondBindingID: secondProvider,
		},
		Clock: clock,
	}
	_, err = host.Execute(context.Background(), api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "req-expiry-delay",
		Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
		AttemptLimit: 2,
	})
	if err == nil {
		t.Fatal("Execute() error = nil, want expiry after Retry-After rejection")
	}
	if len(clock.sleeps) != 1 || clock.sleeps[0] != 3*time.Second {
		t.Fatalf("clock sleeps = %v, want [3s]", clock.sleeps)
	}
	if firstProvider.Calls() != 1 || secondProvider.Calls() != 0 {
		t.Fatalf(
			"provider calls = %d/%d, want first only before expiry",
			firstProvider.Calls(),
			secondProvider.Calls(),
		)
	}
}

func TestMockHostFailsClosedOnRetryAfterOver24Hours(t *testing.T) {
	const (
		firstBindingID  = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"
		secondBindingID = "bnd_BBBBBBBBBBBBBBBBBBBBBBBB"
	)
	key := []byte(strings.Repeat("k", 32))
	start := time.Unix(1700000000, 0).UTC()
	routeResponse := api.RouteResponse{
		Kind: "route_response", SchemaVersion: 1, RequestID: "req-retry-invalid",
		SnapshotRevision: "rev-1", ExpiresAt: start.Add(time.Minute).UnixMilli(),
		Bindings: []api.Binding{
			{BindingID: firstBindingID, ProtocolPlugin: "chat-v1", Rank: 1},
			{BindingID: secondBindingID, ProtocolPlugin: "chat-v1", Rank: 2},
		},
	}
	signature, err := signing.Sign(routeResponse, key)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	routeResponse.Signature = signature
	router := httptest.NewServer(http.HandlerFunc(
		func(writer http.ResponseWriter, request *http.Request) {
			switch request.URL.Path {
			case "/v1/route":
				writer.Header().Set("Content-Type", "application/json")
				if err := json.NewEncoder(writer).Encode(routeResponse); err != nil {
					t.Errorf("encode route response: %v", err)
				}
			case "/v1/outcomes":
				writer.WriteHeader(http.StatusNoContent)
			default:
				writer.WriteHeader(http.StatusNotFound)
			}
		},
	))
	t.Cleanup(router.Close)

	firstProvider := mocks.NewProvider(
		http.StatusTooManyRequests,
		(24*time.Hour).Milliseconds()+1,
	)
	t.Cleanup(firstProvider.Close)
	secondProvider := mocks.NewProvider(http.StatusOK, 0)
	t.Cleanup(secondProvider.Close)
	clock := &fakeClock{now: start}
	host := mocks.Host{
		RouterURL: router.URL, SigningKey: key,
		Providers: map[string]*mocks.Provider{
			firstBindingID: firstProvider, secondBindingID: secondProvider,
		},
		Clock: clock,
	}
	_, err = host.Execute(context.Background(), api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "req-retry-invalid",
		Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
		AttemptLimit: 2,
	})
	if err == nil {
		t.Fatal("Execute() error = nil, want invalid Retry-After fail-closed error")
	}
	if len(clock.sleeps) != 0 {
		t.Fatalf("clock sleeps = %v, want none for invalid Retry-After", clock.sleeps)
	}
	if firstProvider.Calls() != 1 || secondProvider.Calls() != 0 {
		t.Fatalf(
			"provider calls = %d/%d, want first only",
			firstProvider.Calls(),
			secondProvider.Calls(),
		)
	}
}

func TestMockHostFailsClosedOnMalformedRetryAfter(t *testing.T) {
	const (
		firstBindingID  = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"
		secondBindingID = "bnd_BBBBBBBBBBBBBBBBBBBBBBBB"
	)
	key := []byte(strings.Repeat("k", 32))
	start := time.Unix(1700000000, 0).UTC()
	routeResponse := api.RouteResponse{
		Kind: "route_response", SchemaVersion: 1, RequestID: "req-retry-malformed",
		SnapshotRevision: "rev-1", ExpiresAt: start.Add(time.Minute).UnixMilli(),
		Bindings: []api.Binding{
			{BindingID: firstBindingID, ProtocolPlugin: "chat-v1", Rank: 1},
			{BindingID: secondBindingID, ProtocolPlugin: "chat-v1", Rank: 2},
		},
	}
	signature, err := signing.Sign(routeResponse, key)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	routeResponse.Signature = signature
	router := httptest.NewServer(http.HandlerFunc(
		func(writer http.ResponseWriter, request *http.Request) {
			switch request.URL.Path {
			case "/v1/route":
				writer.Header().Set("Content-Type", "application/json")
				if err := json.NewEncoder(writer).Encode(routeResponse); err != nil {
					t.Errorf("encode route response: %v", err)
				}
			case "/v1/outcomes":
				writer.WriteHeader(http.StatusNoContent)
			default:
				writer.WriteHeader(http.StatusNotFound)
			}
		},
	))
	t.Cleanup(router.Close)

	firstProvider := mocks.NewProviderWithRetryAfterHeader(
		http.StatusTooManyRequests,
		"not-a-duration",
	)
	t.Cleanup(firstProvider.Close)
	secondProvider := mocks.NewProvider(http.StatusOK, 0)
	t.Cleanup(secondProvider.Close)
	host := mocks.Host{
		RouterURL: router.URL, SigningKey: key,
		Providers: map[string]*mocks.Provider{
			firstBindingID: firstProvider, secondBindingID: secondProvider,
		},
		Clock: &fakeClock{now: start},
	}
	_, err = host.Execute(context.Background(), api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "req-retry-malformed",
		Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
		AttemptLimit: 2,
	})
	if err == nil {
		t.Fatal("Execute() error = nil, want malformed Retry-After rejection")
	}
	if firstProvider.Calls() != 1 || secondProvider.Calls() != 0 {
		t.Fatalf(
			"provider calls = %d/%d, want first only",
			firstProvider.Calls(),
			secondProvider.Calls(),
		)
	}
}

type fakeClock struct {
	now    time.Time
	sleeps []time.Duration
}

func (clock *fakeClock) Now() time.Time {
	return clock.now
}

func (clock *fakeClock) Sleep(ctx context.Context, delay time.Duration) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		clock.sleeps = append(clock.sleeps, delay)
		clock.now = clock.now.Add(delay)
		return nil
	}
}
