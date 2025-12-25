package controller

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestDashboardListModels_DataIsArray(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orig := channelId2Models
	channelId2Models = map[int][]string{
		1: {"gpt-4o", "gpt-4o-mini"},
		4: {"llama3-7b"},
	}
	t.Cleanup(func() {
		channelId2Models = orig
	})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	DashboardListModels(c)

	var resp struct {
		Success bool            `json:"success"`
		Data    json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v; body=%s", err, w.Body.String())
	}
	if !resp.Success {
		t.Fatalf("expected success=true; body=%s", w.Body.String())
	}

	var dataAny any
	if err := json.Unmarshal(resp.Data, &dataAny); err != nil {
		t.Fatalf("unmarshal data: %v; data=%s", err, string(resp.Data))
	}
	if _, ok := dataAny.([]any); !ok {
		t.Fatalf("expected data to be JSON array; got %T; data=%s", dataAny, string(resp.Data))
	}
}