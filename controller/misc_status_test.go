package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetStatusIncludesPlaygroundDefaultModel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = map[string]string{
		"PlaygroundDefaultModel": "gpt-4.1-mini",
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

	GetStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d", recorder.Code, http.StatusOK)
	}

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			PlaygroundDefaultModel string `json:"playground_default_model"`
		} `json:"data"`
	}
	if err := common.DecodeJson(recorder.Body, &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !response.Success {
		t.Fatal("success = false, want true")
	}
	if response.Data.PlaygroundDefaultModel != "gpt-4.1-mini" {
		t.Fatalf("playground_default_model = %q, want %q", response.Data.PlaygroundDefaultModel, "gpt-4.1-mini")
	}
}

func TestGetStatusIncludesConfiguredInviterRewardUSD(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaForInviter = 3_250_000
	common.QuotaPerUnit = 500_000
	t.Cleanup(func() {
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

	GetStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d", recorder.Code, http.StatusOK)
	}

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			InviterRewardUSD float64 `json:"inviter_reward_usd"`
		} `json:"data"`
	}
	if err := common.DecodeJson(recorder.Body, &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !response.Success {
		t.Fatal("success = false, want true")
	}
	if response.Data.InviterRewardUSD != 6.5 {
		t.Fatalf("inviter_reward_usd = %v, want 6.5", response.Data.InviterRewardUSD)
	}
}

func TestGetStatusIncludesTokenBatchGroupCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("TOKEN_BATCH_GROUP_ENABLED", "true")

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

	GetStatus(ctx)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			TokenBatchGroupEnabled bool `json:"token_batch_group_enabled"`
		} `json:"data"`
	}
	require.NoError(t, common.DecodeJson(recorder.Body, &response))
	require.True(t, response.Success)
	require.True(t, response.Data.TokenBatchGroupEnabled)
}
