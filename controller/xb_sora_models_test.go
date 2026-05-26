package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func TestXBSoraModelsHelpers(t *testing.T) {
	if !isXBSoraModelsAPI("https://example.com/api/v1") {
		t.Fatalf("expected /api/v1 base URL to use xb-sora models API")
	}
	if !isXBSoraModelsAPI("https://localhost:3000/v1") {
		t.Fatalf("expected documented localhost /v1 base URL to use xb-sora models API")
	}
	if !isXBSoraModelsAPI("https://xb-sora2.example.com") {
		t.Fatalf("expected xb-sora2 host to use xb-sora models API")
	}
	if isXBSoraModelsAPI("https://xgapi.top") {
		t.Fatalf("xgapi should keep OpenAI-compatible models API")
	}

	if got := xbSoraModelsURL("https://example.com/api/v1/"); got != "https://example.com/api/v1/models" {
		t.Fatalf("xbSoraModelsURL api base = %q", got)
	}
	if got := xbSoraModelsURL("https://localhost:3000/v1"); got != "https://localhost:3000/v1/models" {
		t.Fatalf("xbSoraModelsURL v1 base = %q", got)
	}
	if got := xbSoraModelsURL("https://example.com"); got != "https://example.com/api/v1/models" {
		t.Fatalf("xbSoraModelsURL host root = %q", got)
	}
}

func TestParseXBSoraModelIDs(t *testing.T) {
	models, err := parseXBSoraModelIDs([]byte(`{"code":200,"message":"ok","data":{"models":[{"id":"openai-sora-2"},{"id":"sora-2-image-to-video"},{"id":""}]}}`))
	if err != nil {
		t.Fatalf("parseXBSoraModelIDs error: %v", err)
	}
	if len(models) != 2 || models[0] != "openai-sora-2" || models[1] != "sora-2-image-to-video" {
		t.Fatalf("models = %#v", models)
	}

	models, err = parseXBSoraModelIDs([]byte(`{"code":"0000","msg":"success","data":{"code":200,"message":"ok","data":{"models":[{"id":"ss-sora-2"},{"id":"xb-sora2"}]}}}`))
	if err != nil {
		t.Fatalf("parse nested parseXBSoraModelIDs error: %v", err)
	}
	if len(models) != 2 || models[0] != "ss-sora-2" || models[1] != "xb-sora2" {
		t.Fatalf("nested models = %#v", models)
	}

	_, err = parseXBSoraModelIDs([]byte(`{"code":401,"message":"bad key","data":{"models":[]}}`))
	if err == nil {
		t.Fatalf("expected error for non-%d code", http.StatusOK)
	}
}

func TestFetchModelsUsesXBSoraModelsAPI(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var gotPath string
	var gotAPIKey string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAPIKey = r.Header.Get("X-API-Key")
		if auth := r.Header.Get("Authorization"); auth != "" {
			t.Fatalf("Authorization should not be sent, got %q", auth)
		}
		_, _ = w.Write([]byte(`{"code":200,"message":"ok","data":{"models":[{"id":"openai-sora-2"},{"id":"future-video-model"}]}}`))
	}))
	defer server.Close()

	body := []byte(`{"base_url":"` + server.URL + `/api/v1","type":58,"key":"sk_test"}`)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/channel/fetch_models", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	FetchModels(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if gotPath != "/api/v1/models" {
		t.Fatalf("upstream path = %q", gotPath)
	}
	if gotAPIKey != "sk_test" {
		t.Fatalf("X-API-Key = %q", gotAPIKey)
	}

	var resp struct {
		Success bool     `json:"success"`
		Data    []string `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !resp.Success || len(resp.Data) != 2 || resp.Data[1] != "future-video-model" {
		t.Fatalf("response = %+v", resp)
	}
}

func TestBuildFetchModelsHeadersUsesXAPIKeyForXBSora(t *testing.T) {
	baseURL := "https://example.com/api/v1"
	headers, err := buildFetchModelsHeaders(&model.Channel{
		Type:    constant.ChannelTypeOpenAIVideo,
		BaseURL: &baseURL,
	}, "sk_test")
	if err != nil {
		t.Fatalf("buildFetchModelsHeaders error: %v", err)
	}
	if got := headers.Get("X-API-Key"); got != "sk_test" {
		t.Fatalf("X-API-Key = %q", got)
	}
	if got := headers.Get("Authorization"); got != "" {
		t.Fatalf("Authorization should be empty, got %q", got)
	}
}
