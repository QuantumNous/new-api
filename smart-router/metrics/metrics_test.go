package metrics

import (
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func TestRegistryRendersDeterministicPrometheusCounters(t *testing.T) {
	registry := New()
	registry.ObserveHTTP("route", 200)
	registry.ObserveHTTP("route", 200)
	registry.ObserveHTTP("outcome", 409)

	recorder := httptest.NewRecorder()
	registry.Handler().ServeHTTP(recorder, httptest.NewRequest("GET", "/metrics", nil))

	if recorder.Code != 200 {
		t.Fatalf("metrics status = %d, want 200", recorder.Code)
	}
	want := strings.Join([]string{
		"# HELP smart_router_http_requests_total HTTP requests handled by the router.",
		"# TYPE smart_router_http_requests_total counter",
		`smart_router_http_requests_total{route="outcome",status="409"} 1`,
		`smart_router_http_requests_total{route="route",status="200"} 2`,
		"",
	}, "\n")
	if recorder.Body.String() != want {
		t.Fatalf("metrics body = %q, want %q", recorder.Body.String(), want)
	}
}

func TestRegistryIsConcurrentSafe(t *testing.T) {
	registry := New()
	var group sync.WaitGroup
	for index := 0; index < 100; index++ {
		group.Add(1)
		go func() {
			defer group.Done()
			registry.ObserveHTTP("route", 200)
		}()
	}
	group.Wait()

	recorder := httptest.NewRecorder()
	registry.Handler().ServeHTTP(recorder, httptest.NewRequest("GET", "/metrics", nil))
	if !strings.Contains(recorder.Body.String(), `status="200"} 100`) {
		t.Fatalf("metrics body = %q, want count 100", recorder.Body.String())
	}
}
