package controller

import (
	"encoding/json"
	"fmt"
	"math"
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

func rangeQuery(start, end int64) string {
	return fmt.Sprintf("start_timestamp=%d&end_timestamp=%d", start, end)
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

	var quota, count int64
	for _, row := range response.Data {
		assert.Equal(t, 7, row.UserID)
		quota += row.Quota
		count += row.Count
	}
	assert.EqualValues(t, 600, quota)
	assert.EqualValues(t, 6, count)
}

func TestQuotaDataHandlersRangeBoundaryMatrix(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		wantStatus int
		wantCode   string
	}{
		{name: "cross month within 31 days", query: rangeQuery(usedataReportedStart, usedataReportedStart+20*usedataDay), wantStatus: http.StatusOK},
		{name: "exactly 31 days", query: rangeQuery(usedataReportedStart, usedataReportedStart+31*usedataDay), wantStatus: http.StatusOK},
		{name: "31 days plus one second", query: rangeQuery(usedataReportedStart, usedataReportedStart+31*usedataDay+1), wantStatus: http.StatusOK},
		{name: "reported 35 day range", query: rangeQuery(usedataReportedStart, usedataReportedEnd), wantStatus: http.StatusOK},
		{name: "exactly 90 days", query: rangeQuery(usedataReportedStart, usedataReportedStart+90*usedataDay), wantStatus: http.StatusOK},
		{name: "90 days plus one second", query: rangeQuery(usedataReportedStart, usedataReportedStart+90*usedataDay+1), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_too_large"},
		{name: "inverted", query: rangeQuery(usedataReportedStart, usedataReportedStart-1), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},

		// A missing, empty, malformed, or out-of-int64-range bound must never be
		// coerced to 0. Coercion previously turned every one of these into the
		// degenerate window [0, 0] (or a one-sided scan) that silently answered
		// "no data" instead of reporting a bad request.
		{name: "both bounds missing", query: "", wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "start missing", query: fmt.Sprintf("end_timestamp=%d", usedataReportedEnd), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "end missing", query: fmt.Sprintf("start_timestamp=%d", usedataReportedStart), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "start empty string", query: fmt.Sprintf("start_timestamp=&end_timestamp=%d", usedataReportedEnd), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "end empty string", query: fmt.Sprintf("start_timestamp=%d&end_timestamp=", usedataReportedStart), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "start whitespace only", query: fmt.Sprintf("start_timestamp=%%20&end_timestamp=%d", usedataReportedEnd), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "start not a number", query: fmt.Sprintf("start_timestamp=abc&end_timestamp=%d", usedataReportedEnd), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "end not a number", query: fmt.Sprintf("start_timestamp=%d&end_timestamp=not-a-number", usedataReportedStart), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "start float", query: fmt.Sprintf("start_timestamp=1782835242.5&end_timestamp=%d", usedataReportedEnd), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "start zero", query: fmt.Sprintf("start_timestamp=0&end_timestamp=%d", usedataReportedEnd), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "end zero", query: fmt.Sprintf("start_timestamp=%d&end_timestamp=0", usedataReportedStart), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "both zero", query: "start_timestamp=0&end_timestamp=0", wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "start negative", query: fmt.Sprintf("start_timestamp=-1&end_timestamp=%d", usedataReportedEnd), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "end negative", query: fmt.Sprintf("start_timestamp=%d&end_timestamp=-1", usedataReportedStart), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "start overflows int64", query: fmt.Sprintf("start_timestamp=9223372036854775808&end_timestamp=%d", usedataReportedEnd), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "end overflows int64", query: fmt.Sprintf("start_timestamp=%d&end_timestamp=99999999999999999999", usedataReportedStart), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		// Bounds the fixed +28800 CST bucket shift cannot represent.
		{name: "end at max int64 overflows the CST shift", query: fmt.Sprintf("start_timestamp=%d&end_timestamp=%d", usedataReportedStart, int64(math.MaxInt64)), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "end one past the CST shift limit", query: fmt.Sprintf("start_timestamp=%d&end_timestamp=%d", int64(common.DashboardMaxTimestamp), int64(common.DashboardMaxTimestamp)+1), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "start one past the CST shift limit", query: fmt.Sprintf("start_timestamp=%d&end_timestamp=%d", int64(common.DashboardMaxTimestamp)+1, int64(common.DashboardMaxTimestamp)+2), wantStatus: http.StatusBadRequest, wantCode: "dashboard_range_invalid"},
		{name: "exactly at the CST shift limit is served", query: fmt.Sprintf("start_timestamp=%d&end_timestamp=%d", int64(common.DashboardMaxTimestamp)-usedataDay, int64(common.DashboardMaxTimestamp)), wantStatus: http.StatusOK},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupQuotaDataTestDB(t)
			ctx, recorder := newAuthenticatedContext(t, http.MethodGet,
				"/api/data/self?"+test.query, nil, 7)

			GetUserQuotaDates(ctx)

			assert.Equal(t, test.wantStatus, recorder.Code)
			response := decodeQuotaDataResponse(t, recorder)
			if test.wantCode == "" {
				assert.True(t, response.Success, response.Message)
				assert.Empty(t, response.Code)
				return
			}
			assert.False(t, response.Success)
			assert.Equal(t, test.wantCode, response.Code)
			assert.NotEmpty(t, response.Message)
			assert.Empty(t, response.Data, "a rejected query must not return rows")
		})
	}
}

// Every quota-series handler must reject the same malformed input identically;
// a normal user and an administrator must not see different contracts.
func TestQuotaDataAllHandlersRejectMalformedTimestampsIdentically(t *testing.T) {
	// Sub-test names stay free of URL punctuation: the shared SQLite test helper
	// builds its DSN from t.Name(), and a "?" there would turn the in-memory DSN
	// into a real file on disk.
	queries := []struct {
		name  string
		query string
	}{
		{name: "both_missing", query: ""},
		{name: "start_empty", query: fmt.Sprintf("start_timestamp=&end_timestamp=%d", usedataReportedEnd)},
		{name: "start_not_a_number", query: fmt.Sprintf("start_timestamp=oops&end_timestamp=%d", usedataReportedEnd)},
		{name: "end_zero", query: fmt.Sprintf("start_timestamp=%d&end_timestamp=0", usedataReportedStart)},
		{name: "both_overflow_int64", query: "start_timestamp=9223372036854775808&end_timestamp=9223372036854775809"},
	}
	handlers := []struct {
		name    string
		path    string
		handler func(ctx *gin.Context)
	}{
		{name: "self", path: "/api/data/self", handler: GetUserQuotaDates},
		{name: "admin_all", path: "/api/data/", handler: GetAllQuotaDates},
		{name: "admin_users", path: "/api/data/users", handler: GetQuotaDatesByUser},
	}
	for _, target := range handlers {
		for _, query := range queries {
			t.Run(target.name+"_"+query.name, func(t *testing.T) {
				setupQuotaDataTestDB(t)
				ctx, recorder := newAuthenticatedContext(
					t, http.MethodGet, target.path+"?"+query.query, nil, 7)
				target.handler(ctx)

				assert.Equal(t, http.StatusBadRequest, recorder.Code)
				response := decodeQuotaDataResponse(t, recorder)
				assert.False(t, response.Success)
				assert.Equal(t, "dashboard_range_invalid", response.Code)
				assert.Empty(t, response.Data)
			})
		}
	}
}

func TestQuotaDataAdminHandlersShareTheSameRangeBound(t *testing.T) {
	handlers := []struct {
		name    string
		path    string
		handler func(ctx *gin.Context)
	}{
		{name: "admin_all", path: "/api/data/", handler: GetAllQuotaDates},
		{name: "admin_users", path: "/api/data/users", handler: GetQuotaDatesByUser},
	}
	for _, target := range handlers {
		path, handler := target.path, target.handler
		t.Run(target.name, func(t *testing.T) {
			setupQuotaDataTestDB(t)
			ctx, recorder := newAuthenticatedContext(t, http.MethodGet, fmt.Sprintf(
				"%s?start_timestamp=%d&end_timestamp=%d", path, usedataReportedStart, usedataReportedStart+90*usedataDay+1,
			), nil, 1)

			handler(ctx)

			assert.Equal(t, http.StatusBadRequest, recorder.Code)
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

// selfScopedUserId is defence in depth behind the route middleware: a
// self-scoped filter with UserId 0 omits the user_id predicate entirely, so a
// handler reached without an authenticated id would answer with every user's
// data. These tests drive the handlers directly with a missing/zero/negative
// id to prove they refuse rather than widen.
func TestSelfScopedHandlersRefuseMissingOrZeroUserId(t *testing.T) {
	const validRange = "start_timestamp=1782835242&end_timestamp=1785899265"

	handlers := []struct {
		name    string
		path    string
		handler func(ctx *gin.Context)
	}{
		{name: "quota_self", path: "/api/data/self", handler: GetUserQuotaDates},
		{name: "log_self_analysis", path: "/api/log/self/analysis", handler: GetLogSelfUsageAnalysis},
		{name: "log_self_summary", path: "/api/log/self/export/summary", handler: GetLogSelfUsageSummary},
	}
	identities := []struct {
		name   string
		userId int
		set    bool
	}{
		{name: "id_absent", set: false},
		{name: "id_zero", userId: 0, set: true},
		{name: "id_negative", userId: -1, set: true},
	}

	for _, target := range handlers {
		for _, identity := range identities {
			t.Run(target.name+"_"+identity.name, func(t *testing.T) {
				setupQuotaDataTestDB(t)
				// Another user's rows exist; a widened query would return them.
				require.NoError(t, model.DB.Create(&model.QuotaData{
					UserID: 42, Username: "victim", ModelName: "gpt-image-2",
					CreatedAt: usedataReportedStart, Count: 5, Quota: 5000, TokenUsed: 50,
				}).Error)

				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Request = httptest.NewRequest(http.MethodGet, target.path+"?"+validRange, nil)
				if identity.set {
					ctx.Set("id", identity.userId)
				}

				target.handler(ctx)

				assert.Equal(t, http.StatusUnauthorized, recorder.Code)
				response := decodeQuotaDataResponse(t, recorder)
				assert.False(t, response.Success)
				assert.Equal(t, "unauthorized", response.Code)
				assert.Empty(t, response.Data, "a self handler without an identity must return no rows")
				assert.NotContains(t, recorder.Body.String(), "victim")
			})
		}
	}
}

// The admin endpoints are deliberately not self-scoped and must keep working
// exactly as before; the new guard must not leak into their path.
func TestAdminQuotaHandlersAreUnaffectedByTheSelfScopeGuard(t *testing.T) {
	const validRange = "start_timestamp=1782835242&end_timestamp=1785899265"
	handlers := []struct {
		name    string
		path    string
		handler func(ctx *gin.Context)
	}{
		{name: "admin_all", path: "/api/data/", handler: GetAllQuotaDates},
		{name: "admin_users", path: "/api/data/users", handler: GetQuotaDatesByUser},
	}
	for _, target := range handlers {
		// No "id" is set at all: AdminAuth owns that route's authorization, and
		// the handler must still serve rather than 401.
		t.Run(target.name, func(t *testing.T) {
			setupQuotaDataTestDB(t)
			require.NoError(t, model.DB.Create(&model.QuotaData{
				UserID: 42, Username: "tenant", ModelName: "gpt-image-2",
				CreatedAt: usedataReportedStart, Count: 5, Quota: 5000, TokenUsed: 50,
			}).Error)

			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, target.path+"?"+validRange, nil)

			target.handler(ctx)

			assert.Equal(t, http.StatusOK, recorder.Code)
			response := decodeQuotaDataResponse(t, recorder)
			assert.True(t, response.Success, response.Message)
			assert.Len(t, response.Data, 1)
		})
	}
}
