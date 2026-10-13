package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeBackend struct {
	routeRequest   RouteRequest
	outcomeRequest AttemptOutcome
	routeResponse  RouteResponse
	snapshot       SignedSnapshot
	err            error
}

func (backend *fakeBackend) Route(_ context.Context, request RouteRequest) (RouteResponse, error) {
	backend.routeRequest = request
	return backend.routeResponse, backend.err
}

func (backend *fakeBackend) RecordOutcome(_ context.Context, outcome AttemptOutcome) error {
	backend.outcomeRequest = outcome
	return backend.err
}

func (backend *fakeBackend) Snapshot(context.Context) (SignedSnapshot, error) {
	return backend.snapshot, backend.err
}

type fakeMetrics struct {
	observations []string
}

func (metrics *fakeMetrics) ObserveHTTP(route string, status int) {
	metrics.observations = append(metrics.observations, route+":"+http.StatusText(status))
}

func (metrics *fakeMetrics) Handler() http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("metric 1\n"))
	})
}

func TestServerImplementsStrictRouteOutcomeAndSnapshotContracts(t *testing.T) {
	backend := &fakeBackend{
		routeResponse: RouteResponse{
			Kind: "route_response", SchemaVersion: 1, RequestID: "req-1",
			SnapshotRevision: "rev-1", ExpiresAt: 10,
			Bindings: []Binding{{
				BindingID:      "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
				ProtocolPlugin: "chat-v1", Rank: 1,
			}},
			Signature: strings.Repeat("s", 43),
		},
		snapshot: SignedSnapshot{
			Kind: "signed_snapshot", SchemaVersion: 1, Revision: "rev-1",
			IssuedAt: 1, ExpiresAt: 10, ConfigSHA256: strings.Repeat("a", 64),
			PluginManifestSHA256: strings.Repeat("b", 64),
			Signature:            strings.Repeat("s", 43),
		},
	}
	metrics := &fakeMetrics{}
	server := NewServer(backend, metrics)

	routeBody := `{
		"kind":"route_request","schema_version":1,"request_id":"req-1",
		"group":"default","model":"model-a","protocol":"chat","attempt_limit":2
	}`
	route := httptest.NewRecorder()
	server.ServeHTTP(route, httptest.NewRequest("POST", "/v1/route", strings.NewReader(routeBody)))
	if route.Code != http.StatusOK {
		t.Fatalf("route status = %d, body = %s", route.Code, route.Body.String())
	}
	if backend.routeRequest.RequestID != "req-1" {
		t.Fatalf("backend route request = %#v", backend.routeRequest)
	}
	var routeResponse RouteResponse
	if err := json.Unmarshal(route.Body.Bytes(), &routeResponse); err != nil {
		t.Fatalf("decode route response: %v", err)
	}
	if routeResponse.Signature != backend.routeResponse.Signature {
		t.Fatalf("route signature = %q, want backend signature", routeResponse.Signature)
	}

	outcomeBody := `{
		"kind":"attempt_outcome","schema_version":1,"event_id":"evt-1",
		"request_id":"req-1","binding_id":"bnd_AAAAAAAAAAAAAAAAAAAAAAAA","protocol":"chat",
		"outcome":"rate_limited_429","retry_after_ms":5000
	}`
	outcome := httptest.NewRecorder()
	server.ServeHTTP(outcome, httptest.NewRequest("POST", "/v1/outcomes", strings.NewReader(outcomeBody)))
	if outcome.Code != http.StatusNoContent {
		t.Fatalf("outcome status = %d, body = %s", outcome.Code, outcome.Body.String())
	}
	if backend.outcomeRequest.RetryAfterMS != 5000 {
		t.Fatalf("backend outcome = %#v", backend.outcomeRequest)
	}

	snapshot := httptest.NewRecorder()
	server.ServeHTTP(snapshot, httptest.NewRequest("GET", "/v1/snapshot", nil))
	if snapshot.Code != http.StatusOK || !strings.Contains(snapshot.Body.String(), `"revision":"rev-1"`) {
		t.Fatalf("snapshot status/body = %d %q", snapshot.Code, snapshot.Body.String())
	}

	health := httptest.NewRecorder()
	server.ServeHTTP(health, httptest.NewRequest("GET", "/healthz", nil))
	if health.Code != http.StatusOK || health.Body.String() != "ok\n" {
		t.Fatalf("health status/body = %d %q", health.Code, health.Body.String())
	}

	renderedMetrics := httptest.NewRecorder()
	server.ServeHTTP(renderedMetrics, httptest.NewRequest("GET", "/metrics", nil))
	if renderedMetrics.Code != http.StatusOK || renderedMetrics.Body.String() != "metric 1\n" {
		t.Fatalf("metrics status/body = %d %q", renderedMetrics.Code, renderedMetrics.Body.String())
	}
}

func TestServerRejectsUnknownFieldsAndMapsContractErrors(t *testing.T) {
	backend := &fakeBackend{}
	server := NewServer(backend, &fakeMetrics{})

	invalid := httptest.NewRecorder()
	server.ServeHTTP(invalid, httptest.NewRequest(
		"POST",
		"/v1/route",
		strings.NewReader(`{
			"kind":"route_request","schema_version":1,"request_id":"req-1",
			"group":"default","model":"m","protocol":"chat","attempt_limit":1,
			"provider_token":"forbidden"
		}`),
	))
	assertContractError(t, invalid, http.StatusBadRequest, ErrorInvalidRequest)

	backend.err = ContractError{
		Kind: "error", SchemaVersion: 1, Code: ErrorBindingUnavailable,
		Retryable: true, RequestID: "req-1", Message: "no eligible binding",
	}
	unavailable := httptest.NewRecorder()
	server.ServeHTTP(unavailable, httptest.NewRequest(
		"POST",
		"/v1/route",
		strings.NewReader(`{
			"kind":"route_request","schema_version":1,"request_id":"req-1",
			"group":"default","model":"m","protocol":"chat","attempt_limit":1
		}`),
	))
	assertContractError(t, unavailable, http.StatusServiceUnavailable, ErrorBindingUnavailable)

	backend.err = errors.New("database detail that must not cross the boundary")
	internal := httptest.NewRecorder()
	server.ServeHTTP(internal, httptest.NewRequest("GET", "/v1/snapshot", nil))
	assertContractError(t, internal, http.StatusInternalServerError, ErrorSnapshotUnavailable)
	if strings.Contains(internal.Body.String(), "database detail") {
		t.Fatal("internal error details crossed the HTTP boundary")
	}

	wrongMethod := httptest.NewRecorder()
	server.ServeHTTP(wrongMethod, httptest.NewRequest(http.MethodPost, "/metrics", nil))
	assertContractError(t, wrongMethod, http.StatusMethodNotAllowed, ErrorInvalidRequest)
}

func TestServerRejectsProviderDerivedBindingIDsFromBackendResponses(t *testing.T) {
	const providerURL = "https://api.provider.example/v1"
	backend := &fakeBackend{
		routeResponse: RouteResponse{
			Kind: "route_response", SchemaVersion: 1, RequestID: "req-1",
			SnapshotRevision: "rev-1", ExpiresAt: 10,
			Bindings: []Binding{{
				BindingID: providerURL, ProtocolPlugin: "chat-v1", Rank: 1,
			}},
			Signature: strings.Repeat("s", 43),
		},
		snapshot: SignedSnapshot{
			Kind: "signed_snapshot", SchemaVersion: 1, Revision: "rev-1",
			IssuedAt: 1, ExpiresAt: 10, ConfigSHA256: strings.Repeat("a", 64),
			PluginManifestSHA256: strings.Repeat("b", 64),
			Routes: []SnapshotRoute{{
				Group: "default", Model: "model-a", Protocol: ProtocolChat,
				Bindings: []Binding{{
					BindingID: "ebond", ProtocolPlugin: "chat-v1", Rank: 1,
				}},
			}},
			Signature: strings.Repeat("s", 43),
		},
	}
	server := NewServer(backend, &fakeMetrics{})

	route := httptest.NewRecorder()
	server.ServeHTTP(route, httptest.NewRequest(
		http.MethodPost,
		"/v1/route",
		strings.NewReader(`{
			"kind":"route_request","schema_version":1,"request_id":"req-1",
			"group":"default","model":"model-a","protocol":"chat","attempt_limit":1
		}`),
	))
	assertContractError(t, route, http.StatusInternalServerError, ErrorSnapshotUnavailable)
	if strings.Contains(route.Body.String(), providerURL) {
		t.Fatalf("route response leaked provider URL: %s", route.Body.String())
	}

	snapshot := httptest.NewRecorder()
	server.ServeHTTP(snapshot, httptest.NewRequest(http.MethodGet, "/v1/snapshot", nil))
	assertContractError(t, snapshot, http.StatusInternalServerError, ErrorSnapshotUnavailable)
	if strings.Contains(snapshot.Body.String(), "ebond") {
		t.Fatalf("snapshot response leaked provider name: %s", snapshot.Body.String())
	}
}

func assertContractError(t *testing.T, recorder *httptest.ResponseRecorder, status int, code ErrorCode) {
	t.Helper()
	if recorder.Code != status {
		t.Fatalf("status = %d, want %d; body = %s", recorder.Code, status, recorder.Body.String())
	}
	var response ContractError
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode contract error: %v", err)
	}
	if response.Kind != "error" || response.SchemaVersion != 1 || response.Code != code {
		t.Fatalf("contract error = %#v, want code %q", response, code)
	}
}
