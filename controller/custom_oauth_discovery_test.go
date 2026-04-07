package controller

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestFetchCustomOAuthDiscoveryReturnsDiscoveryPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)

	discoveryServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"issuer":"https://issuer.example.com","jwks_uri":"https://issuer.example.com/jwks"}`)
	}))
	defer discoveryServer.Close()

	payload, err := common.Marshal(map[string]string{
		"well_known_url": discoveryServer.URL,
	})
	if err != nil {
		t.Fatalf("failed to marshal discovery request: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/custom-oauth/discovery", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	FetchCustomOAuthDiscovery(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response, got %d with body %s", recorder.Code, recorder.Body.String())
	}

	var response oauthJWTAPIResponse
	if err := common.DecodeJson(recorder.Body, &response); err != nil {
		t.Fatalf("failed to decode discovery response: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected discovery fetch success, got message: %s", response.Message)
	}
}

func TestFetchCustomOAuthDiscoveryRejectsOversizedSuccessBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	oversizedBody := bytes.Repeat([]byte("a"), customOAuthDiscoveryResponseLimit+1)
	discoveryServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"issuer":"`))
		_, _ = w.Write(oversizedBody)
		_, _ = w.Write([]byte(`"}`))
	}))
	defer discoveryServer.Close()

	payload, err := common.Marshal(map[string]string{
		"well_known_url": discoveryServer.URL,
	})
	if err != nil {
		t.Fatalf("failed to marshal oversized discovery request: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/custom-oauth/discovery", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	FetchCustomOAuthDiscovery(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response envelope, got %d with body %s", recorder.Code, recorder.Body.String())
	}

	var response oauthJWTAPIResponse
	if err := common.DecodeJson(recorder.Body, &response); err != nil {
		t.Fatalf("failed to decode oversized discovery response: %v", err)
	}
	if response.Success {
		t.Fatal("expected oversized discovery response to fail")
	}
}
