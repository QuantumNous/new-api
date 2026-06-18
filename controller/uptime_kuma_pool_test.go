package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const samplePoolResponse = `{
  "data": {
    "affected_models": ["gpt-5.5", "claude-opus-4-8"],
    "enabled": true,
    "health_percent": 98.86,
    "pools": [
      {"type": "gemini", "count": 527, "health_percent": 97.15, "status": "healthy"},
      {"type": "anthropic", "count": 308, "health_percent": 98.7, "status": "healthy"},
      {"type": "codex", "count": 1264, "health_percent": 99.6, "status": "healthy"}
    ],
    "reset_quota": {"daily": {"limit": 3, "used": 1}},
    "updated_at": 1780529390
  },
  "success": true
}`

// TestGetUptimeKumaStatusInjectsPoolGroup drives the real /api/uptime/status
// handler end-to-end: a mock upstream feeds the sample payload, the background
// fetch desensitizes + caches it, and the handler must inject it as a pool
// category that the dashboard frontends render. This is the contract the
// frontend consumes.
func TestGetUptimeKumaStatusInjectsPoolGroup(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(samplePoolResponse))
	}))
	t.Cleanup(srv.Close)

	prevEnabled := common.PoolStatusEnabled.Load()
	prevURL := common.PoolStatusUpstreamURL
	prevCategory := common.PoolStatusCategoryName
	common.PoolStatusEnabled.Store(true)
	common.PoolStatusUpstreamURL = srv.URL
	common.PoolStatusCategoryName = "号池状态"
	t.Cleanup(func() {
		common.PoolStatusEnabled.Store(prevEnabled)
		common.PoolStatusUpstreamURL = prevURL
		common.PoolStatusCategoryName = prevCategory
	})

	if err := service.RefreshPoolStatusOnce(); err != nil {
		t.Fatalf("RefreshPoolStatusOnce failed: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/uptime/status", nil)

	GetUptimeKumaStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}

	var resp struct {
		Success bool                `json:"success"`
		Data    []UptimeGroupResult `json:"data"`
	}
	if err := common.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !resp.Success {
		t.Fatal("response success = false")
	}

	var poolGroup *UptimeGroupResult
	for i := range resp.Data {
		if resp.Data[i].CategoryName == "号池状态" {
			poolGroup = &resp.Data[i]
			break
		}
	}
	if poolGroup == nil {
		t.Fatalf("pool category not injected into response: %+v", resp.Data)
	}
	if len(poolGroup.Monitors) != 3 {
		t.Fatalf("pool monitors = %d, want 3", len(poolGroup.Monitors))
	}
	if poolGroup.Monitors[0].Name != "Gemini" || poolGroup.Monitors[0].Status != 1 {
		t.Errorf("monitor[0] = %+v, want Gemini/status1", poolGroup.Monitors[0])
	}

	// The desensitization guarantee must hold through the public API too.
	body := recorder.Body.String()
	for _, forbidden := range []string{"reset_quota", "affected_models", "daily", "gpt-5.5"} {
		if strings.Contains(body, forbidden) {
			t.Errorf("response leaked forbidden token %q", forbidden)
		}
	}
}
