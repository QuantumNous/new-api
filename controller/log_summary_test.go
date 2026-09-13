package controller

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserLogSummaryIncludesCompleteWindowAndChargedStreamFailures(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	const start int64 = 1704067200
	logs := make([]model.Log, 0, 106)
	for i := 0; i < 101; i++ {
		logs = append(logs, model.Log{UserId: 42, Type: model.LogTypeConsume, CreatedAt: start + 60,
			Quota: 100, PromptTokens: 3, CompletionTokens: 2, Other: `{"group_ratio":0.5}`})
	}
	logs = append(logs,
		model.Log{UserId: 42, Type: model.LogTypeConsume, CreatedAt: start + 16*3600, IsStream: true,
			Quota: 200, PromptTokens: 4, CompletionTokens: 1, Other: `{"group_ratio":1,"stream_status":{"status":"error","end_error":"timeout"}}`},
		model.Log{UserId: 42, Type: model.LogTypeError, CreatedAt: start + 16*3600},
		model.Log{UserId: 99, Type: model.LogTypeConsume, CreatedAt: start + 60, Quota: 9000},
		model.Log{UserId: 42, Type: model.LogTypeTopup, CreatedAt: start + 60, Quota: 8000},
		model.Log{UserId: 42, Type: model.LogTypeConsume, CreatedAt: start - 1, Quota: 7000})
	require.NoError(t, db.Create(&logs).Error)
	ctx, recorder := newAuthenticatedContext(t, http.MethodGet,
		fmt.Sprintf("/api/log/self/summary?start_timestamp=%d&end_timestamp=%d&timezone_offset=480&user_id=99", start, start+2*86400-1), nil, 42)

	GetUserLogSummary(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var result struct {
		Success bool                 `json:"success"`
		Data    model.UserLogSummary `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
	require.True(t, result.Success)
	assert.EqualValues(t, 103, result.Data.Requests)
	assert.EqualValues(t, 101, result.Data.Succeeded)
	assert.EqualValues(t, 2, result.Data.Failed)
	assert.EqualValues(t, 10300, result.Data.Quota)
	assert.EqualValues(t, 510, result.Data.Tokens)
	assert.InDelta(t, 10100, result.Data.SavedQuota, 0.001)
	require.Len(t, result.Data.Daily, 2)
	assert.Equal(t, "2024-01-02", result.Data.Daily[0].Date)
	assert.EqualValues(t, 2, result.Data.Daily[0].Requests)
	assert.EqualValues(t, 200, result.Data.Daily[0].Quota)
	assert.Equal(t, "2024-01-01", result.Data.Daily[1].Date)
}

func TestGetUserLogSummaryUsesRecordedRatesAndSkipsIncomparableCharges(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	logs := []model.Log{
		{Other: `{"group_ratio":1}`},
		{Other: `{"group_ratio":0.5,"user_group_ratio":0.4,"fee_quota":200}`},
		{Other: `{"group_ratio":0.5,"billing_source":"subscription"}`},
		{Other: `{}`},
		{Other: `{"group_ratio":0}`},
		{Other: `{"group_ratio":0.5,"user_group_ratio":0}`},
		{Other: `not-json`},
		{Other: `{"group_ratio":0.5,"violation_fee":true}`},
		{Other: `{"group_ratio":0.5,"violation_fee_code":"penalty"}`},
		{Other: `{"group_ratio":0.5,"violation_fee_marker":"penalty"}`},
	}
	for i := range logs {
		logs[i].UserId = 42
		logs[i].Type = model.LogTypeConsume
		logs[i].CreatedAt = 1000
		logs[i].Quota = 900
	}
	require.NoError(t, db.Create(&logs).Error)
	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/log/self/summary?start_timestamp=1&end_timestamp=2000", nil, 42)
	GetUserLogSummary(ctx)
	var result struct {
		Data model.UserLogSummary `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
	// A user override of zero denotes the legacy unset sentinel; use group 0.5.
	assert.InDelta(t, 300+900, result.Data.SavedQuota, 0.001)
	assert.EqualValues(t, 8100, result.Data.Quota)
	assert.EqualValues(t, 3, result.Data.Failed)
}

func TestGetUserLogSummaryRejectsInvalidWindows(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	for _, query := range []string{
		"", "start_timestamp=x&end_timestamp=2", "start_timestamp=2&end_timestamp=1",
		"start_timestamp=1&end_timestamp=864001", "start_timestamp=1&end_timestamp=950400",
		"start_timestamp=1&end_timestamp=2678401", "start_timestamp=1&end_timestamp=2&timezone_offset=841",
	} {
		t.Run(query, func(t *testing.T) {
			ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/log/self/summary?"+query, nil, 42)
			GetUserLogSummary(ctx)
			assert.Equal(t, http.StatusBadRequest, recorder.Code)
		})
	}
}

func TestGetUserLogSummaryAcceptsTenDayWindow(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	for _, offset := range []int{-840, 0, 480, 840} {
		t.Run(fmt.Sprint(offset), func(t *testing.T) {
			ctx, recorder := newAuthenticatedContext(t, http.MethodGet,
				fmt.Sprintf("/api/log/self/summary?start_timestamp=1&end_timestamp=864000&timezone_offset=%d", offset), nil, 42)
			GetUserLogSummary(ctx)
			require.Equal(t, http.StatusOK, recorder.Code)
		})
	}
}

func TestGetUserLogsFiltersMultipleRequestTypes(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	require.NoError(t, db.Create(&[]model.Log{
		{UserId: 42, Type: model.LogTypeConsume, CreatedAt: 1000, ModelName: "consume"},
		{UserId: 42, Type: model.LogTypeError, CreatedAt: 1001, ModelName: "error"},
		{UserId: 42, Type: model.LogTypeManage, CreatedAt: 1002, ModelName: "manage"},
		{UserId: 99, Type: model.LogTypeConsume, CreatedAt: 1003, ModelName: "other-user"},
	}).Error)
	for page, expectedType := range []int{model.LogTypeError, model.LogTypeConsume} {
		t.Run(fmt.Sprintf("page-%d", page+1), func(t *testing.T) {
			ctx, recorder := newAuthenticatedContext(t, http.MethodGet,
				fmt.Sprintf("/api/log/self?types=2,5&p=%d&page_size=1", page+1), nil, 42)

			GetUserLogs(ctx)

			require.Equal(t, http.StatusOK, recorder.Code)
			var result struct {
				Success bool `json:"success"`
				Data    struct {
					Items []model.Log `json:"items"`
					Total int         `json:"total"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
			require.True(t, result.Success)
			assert.Equal(t, 2, result.Data.Total)
			require.Len(t, result.Data.Items, 1)
			assert.Equal(t, expectedType, result.Data.Items[0].Type)
		})
	}
}

func TestLogSummaryRetryOutcomesAndCharges(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	const midnight int64 = 1704153600
	logs := []model.Log{
		{RequestId: "retry", Type: model.LogTypeError, CreatedAt: midnight - 1},
		{RequestId: "retry", Type: model.LogTypeConsume, CreatedAt: midnight, Quota: 30},
		{RequestId: "failed", Type: model.LogTypeError, CreatedAt: midnight},
		{RequestId: "failed", Type: model.LogTypeError, CreatedAt: midnight + 1},
		{RequestId: "fee", Type: model.LogTypeConsume, CreatedAt: midnight, Quota: 20, Other: `{"violation_fee":true,"status_code":400}`},
		{Type: model.LogTypeError, CreatedAt: midnight},
		{Type: model.LogTypeConsume, CreatedAt: midnight, Quota: 10},
	}
	for i := range logs {
		logs[i].UserId = 42
	}
	require.NoError(t, db.Create(&logs).Error)
	// Create hooks populate IDs; explicitly restore historical missing IDs.
	require.NoError(t, db.Model(&model.Log{}).Where("id IN ?", []int{logs[5].Id, logs[6].Id}).Update("request_id", "").Error)
	result, err := model.GetUserLogSummary(context.Background(), 42, midnight-10, midnight+10, 0)
	require.NoError(t, err)
	assert.EqualValues(t, 5, result.Requests)
	assert.EqualValues(t, 2, result.Succeeded)
	assert.EqualValues(t, 3, result.Failed)
	assert.EqualValues(t, 60, result.Quota)
	require.Len(t, result.Daily, 2)
	assert.EqualValues(t, 5, result.Daily[0].Requests)
	assert.Zero(t, result.Daily[1].Requests)
}

func TestLogSummarySubscriptionDoesNotIncreaseWalletSpending(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	require.NoError(t, db.Create(&[]model.Log{
		{UserId: 42, Type: model.LogTypeConsume, CreatedAt: 1000, Quota: 900, Other: `{"billing_source":"subscription","wallet_quota_deducted":0,"subscription_consumed":700}`},
		{UserId: 42, Type: model.LogTypeConsume, CreatedAt: 1000, Quota: 100, Other: `{"billing_source":"subscription"}`},
	}).Error)
	result, err := model.GetUserLogSummary(context.Background(), 42, 1, 2000, 0)
	require.NoError(t, err)
	assert.Zero(t, result.Quota)
	assert.EqualValues(t, 800, result.SubscriptionQuota)
	require.Len(t, result.Daily, 1)
	assert.EqualValues(t, 800, result.Daily[0].SubscriptionQuota)
	assert.EqualValues(t, 2, result.Succeeded)
}

func TestLogSummarySettledOutcomeWinsOverRetryErrors(t *testing.T) {
	for _, tc := range []struct {
		name   string
		other  string
		failed int64
	}{
		{"success", "{}", 0},
		{"stream failure", `{"stream_status":{"status":"error"}}`, 1},
		{"charged rejection", `{"violation_fee":true}`, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupTokenControllerTestDB(t)
			require.NoError(t, db.AutoMigrate(&model.Log{}))
			require.NoError(t, db.Create(&[]model.Log{
				{UserId: 42, RequestId: "retry", Type: model.LogTypeError, CreatedAt: 1000},
				{UserId: 42, RequestId: "retry", Type: model.LogTypeConsume, CreatedAt: 1000, Quota: 20, IsStream: true, Other: tc.other},
				{UserId: 42, RequestId: "retry", Type: model.LogTypeError, CreatedAt: 1001},
			}).Error)
			result, err := model.GetUserLogSummary(context.Background(), 42, 1, 2000, 0)
			require.NoError(t, err)
			assert.EqualValues(t, 1, result.Requests)
			assert.Equal(t, tc.failed, result.Failed)
			assert.Equal(t, 1-tc.failed, result.Succeeded)
			assert.EqualValues(t, 20, result.Quota)
		})
	}
}
