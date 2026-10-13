package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"smart-router/config"
)

func TestBuildCreatesHealthyIndependentHandler(t *testing.T) {
	configuration := config.Config{
		ListenAddress: "127.0.0.1:0",
		DatabasePath:  t.TempDir() + "/router.db",
		SigningKey:    []byte(strings.Repeat("k", 32)),
		SnapshotTTL:   time.Minute,
	}
	handler, closer, err := build(context.Background(), configuration)
	if err != nil {
		t.Fatalf("build() error = %v", err)
	}
	t.Cleanup(func() { _ = closer.Close() })

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if recorder.Code != http.StatusOK || recorder.Body.String() != "ok\n" {
		t.Fatalf("health response = %d %q", recorder.Code, recorder.Body.String())
	}
}
