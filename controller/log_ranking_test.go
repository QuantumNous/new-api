package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type usageRankingControllerResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Items    []model.UsageRankingItem `json:"items"`
		Total    int64                    `json:"total"`
		Page     int                      `json:"page"`
		PageSize int                      `json:"page_size"`
	} `json:"data"`
}

func performUsageRankingRequest(t *testing.T, rawQuery string) (*httptest.ResponseRecorder, usageRankingControllerResponse) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/log/ranking?"+rawQuery, nil)

	GetUsageRanking(ctx)

	var response usageRankingControllerResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return recorder, response
}

func TestGetUsageRankingRejectsMalformedParameters(t *testing.T) {
	cases := []string{
		"start_timestamp=not-a-number",
		"end_timestamp=-1",
		"channel=-1",
		"start_timestamp=200&end_timestamp=100",
		"p=not-a-number",
		"page_size=not-a-number",
	}
	for _, rawQuery := range cases {
		t.Run(rawQuery, func(t *testing.T) {
			recorder, response := performUsageRankingRequest(t, rawQuery)
			assert.Equal(t, http.StatusBadRequest, recorder.Code)
			assert.False(t, response.Success)
			assert.NotEmpty(t, response.Message)
		})
	}
}

func TestGetUsageRankingCapsHugePageWithoutOverflow(t *testing.T) {
	recorder, response := performUsageRankingRequest(t, "p=999999999999999999999999&page_size=100")
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.False(t, response.Success)
}

func TestGetUsageRankingNormalizesPaginationAndReturnsEnvelope(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	originalLogDB := model.LOG_DB
	originalLogType := common.LogDatabaseType()
	model.LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogType)
	})

	recorder, response := performUsageRankingRequest(t, "p=2000000000&page_size=1000&sort_by=unsupported")

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.True(t, response.Success)
	assert.Empty(t, response.Message)
	assert.Equal(t, 1000000, response.Data.Page)
	assert.Equal(t, 100, response.Data.PageSize)
	assert.Equal(t, int64(0), response.Data.Total)
	assert.NotNil(t, response.Data.Items)
}
