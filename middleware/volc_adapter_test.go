package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

func TestVolcRequestConvert_ImageGeneration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/volc/api/v3/images/generations", VolcRequestConvert(), func(c *gin.Context) {
		if got := c.Request.URL.Path; got != "/v1/images/generations" {
			t.Fatalf("unexpected rewritten path: %s", got)
		}

		var req map[string]any
		if err := common.UnmarshalBodyReusable(c, &req); err != nil {
			t.Fatalf("failed to parse rewritten body: %v", err)
		}
		if req["model"] != "doubao-seedream-3-0-t2i-250415" {
			t.Fatalf("unexpected model: %#v", req["model"])
		}
		if req["prompt"] != "a running corgi" {
			t.Fatalf("unexpected prompt: %#v", req["prompt"])
		}
		meta, ok := req["metadata"].(map[string]any)
		if !ok {
			t.Fatalf("metadata should be map, got: %#v", req["metadata"])
		}
		if meta["foo"] != "bar" {
			t.Fatalf("metadata should preserve original body")
		}
	})

	body := `{"model":"doubao-seedream-3-0-t2i-250415","prompt":"a running corgi","foo":"bar"}`
	req := httptest.NewRequest(http.MethodPost, "/volc/api/v3/images/generations", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d", rec.Code)
	}
}

func TestVolcRequestConvert_VideoTaskSubmit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/volc/api/v3/contents/generations/tasks", VolcRequestConvert(), func(c *gin.Context) {
		if got := c.Request.URL.Path; got != "/v1/video/generations" {
			t.Fatalf("unexpected rewritten path: %s", got)
		}

		var req map[string]any
		if err := common.UnmarshalBodyReusable(c, &req); err != nil {
			t.Fatalf("failed to parse rewritten body: %v", err)
		}
		if req["model"] != "veo-1" {
			t.Fatalf("unexpected model: %#v", req["model"])
		}
		if req["prompt"] != "sunset over ocean" {
			t.Fatalf("unexpected prompt: %#v", req["prompt"])
		}
		if action := c.GetString("action"); action == "" {
			t.Fatalf("action should be set for text-to-video requests")
		}
		meta, ok := req["metadata"].(map[string]any)
		if !ok || meta["duration"] != float64(5) {
			t.Fatalf("metadata should preserve original body, got: %#v", req["metadata"])
		}
	})

	body := `{"model_name":"veo-1","content":"sunset over ocean","duration":5}`
	req := httptest.NewRequest(http.MethodPost, "/volc/api/v3/contents/generations/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d", rec.Code)
	}
}

func TestVolcRequestConvert_VideoTaskFetch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/volc/api/v3/contents/generations/tasks/:id", VolcRequestConvert(), func(c *gin.Context) {
		if got := c.Request.URL.Path; got != "/v1/video/generations/task_123" {
			t.Fatalf("unexpected rewritten path: %s", got)
		}
		if taskID := c.GetString("task_id"); taskID != "task_123" {
			t.Fatalf("unexpected task_id: %s", taskID)
		}
		relayMode, ok := c.Get("relay_mode")
		if !ok {
			t.Fatalf("relay_mode should be set")
		}
		if relayMode != relayconstant.RelayModeVideoFetchByID {
			t.Fatalf("unexpected relay_mode: %#v", relayMode)
		}
	})

	req := httptest.NewRequest(http.MethodGet, "/volc/api/v3/contents/generations/tasks/task_123", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d", rec.Code)
	}
}
