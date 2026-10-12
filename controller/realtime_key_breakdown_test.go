package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// Tests for the API-key per-key realtime breakdown endpoint.

func TestGetTokenRealtimeKeyBreakdownReturnsOwnKeysOnly(t *testing.T) {
	enableRealtimeForTest(t)
	// The shared controller harness migrates the model-list tables only; the
	// expiry check re-reads the token by id, so the tokens table is needed.
	require.NoError(t, model.DB.AutoMigrate(&model.Token{}))

	require.NoError(t, model.DB.Create(&model.Token{
		Id: 10, UserId: 1, Key: "sk-alive", Name: "alive-key",
		Status: common.TokenStatusEnabled, UnlimitedQuota: true,
	}).Error)

	model.RecordRealtimeRequest(1, 10, "gpt-4o", 100, 0, 0, false, 1)
	model.RecordRealtimeRequest(2, 20, "gpt-4o", 500, 0, 0, false, 1)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	// The caller authenticated with a key belonging to user 1; the handler
	// must scope to that account and never see user 2's key.
	ctx.Set("id", 1)
	ctx.Set("token_id", 10)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/usage/realtime/keys", nil)

	GetTokenRealtimeKeyBreakdown(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var body struct {
		Success bool `json:"success"`
		Data    struct {
			Keys []model.RealtimeKeyBreakdown `json:"keys"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.True(t, body.Success)
	require.Len(t, body.Data.Keys, 1)
	require.Equal(t, 10, body.Data.Keys[0].TokenID)
	require.Equal(t, "alive-key", body.Data.Keys[0].TokenName)
}

func TestGetTokenRealtimeKeyBreakdownDeniesExpiredKey(t *testing.T) {
	enableRealtimeForTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Token{}))

	require.NoError(t, model.DB.Create(&model.Token{
		Id: 30, UserId: 1, Key: "sk-expired", Name: "expired-key",
		Status:      common.TokenStatusEnabled,
		ExpiredTime: common.GetTimestamp() - 100,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 1)
	ctx.Set("token_id", 30)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/usage/realtime/keys", nil)

	GetTokenRealtimeKeyBreakdown(ctx)

	require.Equal(t, http.StatusUnauthorized, recorder.Code)
	require.Contains(t, recorder.Body.String(), "token expired")
}
