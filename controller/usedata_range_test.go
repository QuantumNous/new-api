package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	// 2026-07-01 00:00:42 through 2026-08-05 11:07:45 Asia/Shanghai: the exact
	// dashboard selection that used to fail with "时间跨度不能超过 1 个月".
	usedataReportedStart int64 = 1782835242
	usedataReportedEnd   int64 = 1785899265
	usedataDay           int64 = 24 * 60 * 60
)

func setupQuotaDataTestDB(t *testing.T) {
	t.Helper()
	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.QuotaData{}))
}

type quotaDataResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Code    string            `json:"code"`
	Data    []model.QuotaData `json:"data"`
}

func decodeQuotaDataResponse(t *testing.T, recorder *httptest.ResponseRecorder) quotaDataResponse {
	t.Helper()
	var response quotaDataResponse
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response), recorder.Body.String())
	return response
}

func TestGetUserQuotaDatesServesTheReportedCrossMonthRange(t *testing.T) {
	setupQuotaDataTestDB(t)

	rows := []model.QuotaData{
		{UserID: 7, Username: "moni", ModelName: "gpt-image-2", CreatedAt: usedataReportedStart, Count: 1, Quota: 100, TokenUsed: 10},
		// Day 33 falls in the second bounded segment (the first covers 31 days).
		{UserID: 7, Username: "moni", ModelName: "gpt-image-2", CreatedAt: usedataReportedStart + 33*usedataDay, Count: 2, Quota: 200, TokenUsed: 20},
		{UserID: 7, Username: "moni", ModelName: "gpt-image-2", CreatedAt: usedataReportedEnd, Count: 3, Quota: 300, TokenUsed: 30},
		// Another user's rows must never appear in a self query.
		{UserID: 8, Username: "other", ModelName: "gpt-image-2", CreatedAt: usedataReportedStart, Count: 9, Quota: 90000, TokenUsed: 900},
	}
	require.NoError(t, model.DB.Create(&rows).Error)

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, fmt.Sprintf(
		"/api/data/self?start_timestamp=%d&end_timestamp=%d&default_time=hour",
		usedataReportedStart, usedataReportedEnd,
	), nil, 7)

	GetUserQuotaDates(ctx)

	assert.Equal(t, http.StatusOK, recorder.Code)
	response := decodeQuotaDataResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	require.Len(t, response.Data, 3)

	var quota, count int
	for _, row := range response.Data {
		assert.Equal(t, 7, row.UserID)
		quota += row.Quota
		count += row.Count
	}
	assert.Equal(t, 600, quota)
	assert.Equal(t, 6, count)
}

func TestQuotaDataHandlersRangeBoundaryMatrix(t *testing.T) {
	tests := []struct {
		name     string
		start    int64
		end      int64
		wantCode string
	}{
		{name: "cross month within 31 days", start: usedataReportedStart, end: usedataReportedStart + 20*usedataDay},
		{name: "exactly 31 days", start: usedataReportedStart, end: usedataReportedStart + 31*usedataDay},
		{name: "31 days plus one second", start: usedataReportedStart, end: usedataReportedStart + 31*usedataDay + 1},
		{name: "reported 35 day range", start: usedataReportedStart, end: usedataReportedEnd},
		{name: "exactly 90 days", start: usedataReportedStart, end: usedataReportedStart + 90*usedataDay},
		{name: "90 days plus one second", start: usedataReportedStart, end: usedataReportedStart + 90*usedataDay + 1, wantCode: "dashboard_range_too_large"},
		{name: "inverted", start: usedataReportedStart, end: usedataReportedStart - 1, wantCode: "dashboard_range_invalid"},
		{name: "empty", start: 0, end: 0},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupQuotaDataTestDB(t)
			ctx, recorder := newAuthenticatedContext(t, http.MethodGet, fmt.Sprintf(
				"/api/data/self?start_timestamp=%d&end_timestamp=%d", test.start, test.end,
			), nil, 7)

			GetUserQuotaDates(ctx)

			// These legacy endpoints keep the 200 + success:false envelope, so the
			// stable code is what clients must branch on.
			assert.Equal(t, http.StatusOK, recorder.Code)
			response := decodeQuotaDataResponse(t, recorder)
			if test.wantCode == "" {
				assert.True(t, response.Success, response.Message)
				assert.Empty(t, response.Code)
				return
			}
			assert.False(t, response.Success)
			assert.Equal(t, test.wantCode, response.Code)
			assert.NotEmpty(t, response.Message)
		})
	}
}

func TestQuotaDataAdminHandlersShareTheSameRangeBound(t *testing.T) {
	handlers := map[string]func(ctx *gin.Context){
		"/api/data/":      GetAllQuotaDates,
		"/api/data/users": GetQuotaDatesByUser,
	}
	for path, handler := range handlers {
		t.Run(path, func(t *testing.T) {
			setupQuotaDataTestDB(t)
			ctx, recorder := newAuthenticatedContext(t, http.MethodGet, fmt.Sprintf(
				"%s?start_timestamp=%d&end_timestamp=%d", path, usedataReportedStart, usedataReportedStart+90*usedataDay+1,
			), nil, 1)

			handler(ctx)

			assert.Equal(t, http.StatusOK, recorder.Code)
			response := decodeQuotaDataResponse(t, recorder)
			assert.False(t, response.Success)
			assert.Equal(t, "dashboard_range_too_large", response.Code)

			okCtx, okRecorder := newAuthenticatedContext(t, http.MethodGet, fmt.Sprintf(
				"%s?start_timestamp=%d&end_timestamp=%d", path, usedataReportedStart, usedataReportedEnd,
			), nil, 1)
			handler(okCtx)
			okResponse := decodeQuotaDataResponse(t, okRecorder)
			assert.True(t, okResponse.Success, okResponse.Message)
		})
	}
}

func TestQuotaDataRangeBoundMatchesSharedDashboardPolicy(t *testing.T) {
	// The bound the handlers enforce must be the shared one, not a local copy.
	assert.NoError(t, common.ValidateDashboardRange(usedataReportedStart, usedataReportedEnd))
	assert.ErrorIs(t,
		common.ValidateDashboardRange(usedataReportedStart, usedataReportedStart+common.DashboardMaxRangeSeconds+1),
		common.ErrDashboardRangeTooLarge,
	)
}
