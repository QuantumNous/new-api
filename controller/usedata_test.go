package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type quotaDatesResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Data    []model.QuotaData `json:"data"`
}

func decodeQuotaDatesResponse(t *testing.T, recorder *httptest.ResponseRecorder) quotaDatesResponse {
	t.Helper()
	require.Equal(t, http.StatusOK, recorder.Code)
	var payload quotaDatesResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, payload.Message)
	return payload
}

func TestGetAllQuotaDatesFiltersByTokenID(t *testing.T) {
	setupFlowControllerTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/data?start_timestamp=1000&end_timestamp=2000&token_id=11", nil)

	GetAllQuotaDates(ctx)

	payload := decodeQuotaDatesResponse(t, recorder)
	require.Len(t, payload.Data, 1)
	require.Equal(t, "gpt-a", payload.Data[0].ModelName)
	require.Equal(t, 2, payload.Data[0].Count)
	require.Equal(t, 100, payload.Data[0].Quota)
}

func TestGetAllQuotaDatesIgnoresZeroTokenID(t *testing.T) {
	setupFlowControllerTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/data?start_timestamp=1000&end_timestamp=2000&token_id=0", nil)

	GetAllQuotaDates(ctx)

	payload := decodeQuotaDatesResponse(t, recorder)
	require.Len(t, payload.Data, 2)
}

func TestGetUserQuotaDatesFiltersByTokenID(t *testing.T) {
	setupFlowControllerTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 1)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/data/self?start_timestamp=1000&end_timestamp=2000&token_id=11", nil)

	GetUserQuotaDates(ctx)

	payload := decodeQuotaDatesResponse(t, recorder)
	require.Len(t, payload.Data, 1)
	require.Equal(t, "gpt-a", payload.Data[0].ModelName)
	require.Equal(t, "alice", payload.Data[0].Username)
}

func TestGetUserQuotaDatesIgnoresOtherUserTokenID(t *testing.T) {
	setupFlowControllerTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 1)
	// token_id=22 属于 user 2，当前用户是 user 1，因此应返回空
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/data/self?start_timestamp=1000&end_timestamp=2000&token_id=22", nil)

	GetUserQuotaDates(ctx)

	payload := decodeQuotaDatesResponse(t, recorder)
	require.Empty(t, payload.Data)
}
