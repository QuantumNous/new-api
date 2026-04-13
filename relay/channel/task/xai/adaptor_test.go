package xai

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func TestEstimateBillingUsesDurationSeconds(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Duration: 10,
	})

	adaptor := &TaskAdaptor{}
	ratios := adaptor.EstimateBilling(ctx, nil)
	if ratios["seconds"] != 10 {
		t.Fatalf("expected seconds ratio 10, got %v", ratios["seconds"])
	}
}

func TestEstimateBillingMetadataOverridesRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Duration: 6,
		Metadata: map[string]any{
			"duration": 12,
		},
	})

	adaptor := &TaskAdaptor{}
	ratios := adaptor.EstimateBilling(ctx, nil)
	if ratios["seconds"] != 12 {
		t.Fatalf("expected seconds ratio 12, got %v", ratios["seconds"])
	}
}
