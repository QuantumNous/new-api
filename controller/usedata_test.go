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

type userQuotaResponse struct {
	Success bool               `json:"success"`
	Message string             `json:"message"`
	Data    []*model.QuotaData `json:"data"`
}

func TestGetQuotaDatesByUserIncludesHistoryAfterUsernameChange(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.QuotaData{}))
	require.NoError(t, db.Create(&model.User{
		Id:          1,
		Username:    "new-alice",
		Password:    "password",
		DisplayName: "Alice",
	}).Error)
	require.NoError(t, db.Create(&model.QuotaData{
		UserID:    1,
		Username:  "old-alice",
		CreatedAt: 1000,
		Count:     1,
		Quota:     100,
		TokenUsed: 10,
	}).Error)
	require.NoError(t, db.Create(&model.QuotaData{
		UserID:    1,
		Username:  "new-alice",
		CreatedAt: 1000,
		Count:     1,
		Quota:     50,
		TokenUsed: 5,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodGet,
		"/api/data/users?start_timestamp=900&end_timestamp=1100&username=new-alice",
		nil,
	)

	GetQuotaDatesByUser(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload userQuotaResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, payload.Message)
	require.Len(t, payload.Data, 2)

	totalQuota := 0
	for _, row := range payload.Data {
		totalQuota += row.Quota
		require.Equal(t, "new-alice", row.Username)
		require.Equal(t, "Alice", row.DisplayName)
	}
	require.Equal(t, 150, totalQuota)
}
