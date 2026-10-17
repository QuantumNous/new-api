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

func setupUserQuotaControllerTestDB(t *testing.T) {
	t.Helper()
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.QuotaData{}))
	for _, row := range []model.QuotaData{
		{UserID: 1, Username: "alice", ModelName: "gpt-a", CreatedAt: 1100, Count: 2, Quota: 100, TokenUsed: 40},
		{UserID: 2, Username: "bob", ModelName: "gpt-b", CreatedAt: 1200, Count: 1, Quota: 70, TokenUsed: 30},
		{UserID: 3, Username: "carol", ModelName: "gpt-c", CreatedAt: 1300, Count: 3, Quota: 50, TokenUsed: 10},
	} {
		require.NoError(t, model.DB.Create(&row).Error)
	}
}

func callUserQuotaDates(t *testing.T, query string) userQuotaResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/data/users?"+query, nil)

	GetQuotaDatesByUser(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload userQuotaResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success, payload.Message)
	return payload
}

func usernamesOf(rows []*model.QuotaData) []string {
	names := make([]string, 0, len(rows))
	for _, row := range rows {
		names = append(names, row.Username)
	}
	return names
}

func TestGetQuotaDatesByUserReturnsEveryUserWithoutFilter(t *testing.T) {
	setupUserQuotaControllerTestDB(t)

	payload := callUserQuotaDates(t, "start_timestamp=1000&end_timestamp=2000")

	require.ElementsMatch(t, []string{"alice", "bob", "carol"}, usernamesOf(payload.Data))
}

func TestGetQuotaDatesByUserFiltersSingleUsername(t *testing.T) {
	setupUserQuotaControllerTestDB(t)

	payload := callUserQuotaDates(t, "start_timestamp=1000&end_timestamp=2000&usernames=bob")

	require.ElementsMatch(t, []string{"bob"}, usernamesOf(payload.Data))
}

func TestGetQuotaDatesByUserFiltersMultipleUsernames(t *testing.T) {
	setupUserQuotaControllerTestDB(t)

	payload := callUserQuotaDates(t, "start_timestamp=1000&end_timestamp=2000&usernames=alice,carol")

	require.ElementsMatch(t, []string{"alice", "carol"}, usernamesOf(payload.Data))
}

func TestGetQuotaDatesByUserTrimsAndDropsBlankUsernames(t *testing.T) {
	setupUserQuotaControllerTestDB(t)

	// Surrounding spaces, an empty entry and a trailing comma must not widen
	// the filter back to every user.
	payload := callUserQuotaDates(t, "start_timestamp=1000&end_timestamp=2000&usernames=%20alice%20,,bob,")

	require.ElementsMatch(t, []string{"alice", "bob"}, usernamesOf(payload.Data))
}

func TestGetQuotaDatesByUserAcceptsLegacySingleUsernameParameter(t *testing.T) {
	setupUserQuotaControllerTestDB(t)

	payload := callUserQuotaDates(t, "start_timestamp=1000&end_timestamp=2000&username=carol")

	require.ElementsMatch(t, []string{"carol"}, usernamesOf(payload.Data))
}

func TestGetQuotaDatesByUserHonoursTimeRange(t *testing.T) {
	setupUserQuotaControllerTestDB(t)

	payload := callUserQuotaDates(t, "start_timestamp=1000&end_timestamp=1150")

	require.ElementsMatch(t, []string{"alice"}, usernamesOf(payload.Data))
}
