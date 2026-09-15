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
	"gorm.io/gorm"
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

func TestGetUserRequestLogsCollapsesOutcomesBeforePagination(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	require.NoError(t, db.Create(&[]model.Log{
		{UserId: 42, RequestId: "retry", Type: model.LogTypeError, CreatedAt: 100},
		{UserId: 42, RequestId: "retry", Type: model.LogTypeConsume, CreatedAt: 101, ModelName: "settled-retry"},
		{UserId: 42, RequestId: "retry", Type: model.LogTypeError, CreatedAt: 102},
		{UserId: 42, RequestId: "failed", Type: model.LogTypeError, CreatedAt: 103, ModelName: "old-failure"},
		{UserId: 42, RequestId: "failed", Type: model.LogTypeError, CreatedAt: 104, ModelName: "latest-failure"},
		{UserId: 42, RequestId: "success", Type: model.LogTypeConsume, CreatedAt: 105, ModelName: "success"},
		{UserId: 42, Type: model.LogTypeError, CreatedAt: 106, ModelName: "unlinked-error"},
		{UserId: 42, Type: model.LogTypeConsume, CreatedAt: 107, ModelName: "unlinked-consume"},
		{UserId: 99, RequestId: "other-user", Type: model.LogTypeConsume, CreatedAt: 108},
	}).Error)

	getPage := func(page int) struct {
		Items []model.Log `json:"items"`
		Total int         `json:"total"`
	} {
		ctx, recorder := newAuthenticatedContext(t, http.MethodGet,
			fmt.Sprintf("/api/log/self/requests?p=%d&page_size=2&start_timestamp=1&end_timestamp=200", page), nil, 42)
		GetUserRequestLogs(ctx)
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
		return result.Data
	}

	first := getPage(1)
	assert.Equal(t, 5, first.Total)
	require.Len(t, first.Items, 2)
	assert.Equal(t, []string{"unlinked-consume", "unlinked-error"}, []string{first.Items[0].ModelName, first.Items[1].ModelName})
	assert.Equal(t, "", first.Items[0].RequestId)
	assert.Equal(t, "", first.Items[1].RequestId)

	second := getPage(2)
	assert.Equal(t, 5, second.Total)
	require.Len(t, second.Items, 2)
	assert.Equal(t, []string{"success", "latest-failure"}, []string{second.Items[0].ModelName, second.Items[1].ModelName})
	assert.Equal(t, []int{model.LogTypeConsume, model.LogTypeError}, []int{second.Items[0].Type, second.Items[1].Type})

	last := getPage(3)
	assert.Equal(t, 5, last.Total)
	require.Len(t, last.Items, 1)
	assert.Equal(t, "settled-retry", last.Items[0].ModelName)
	assert.Equal(t, model.LogTypeConsume, last.Items[0].Type)
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

func TestGetUserRequestLogsRejectsUnsafePagination(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	require.NoError(t, db.Create(&model.Log{UserId: 42, Type: model.LogTypeConsume, CreatedAt: 100}).Error)
	for _, query := range []string{"p=-1", "page_size=-1", "ps=-2", fmt.Sprintf("p=%d&page_size=50", int(^uint(0)>>1))} {
		t.Run(query, func(t *testing.T) {
			ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/log/self/requests?start_timestamp=1&end_timestamp=200&"+query, nil, 42)
			require.NotPanics(t, func() { GetUserRequestLogs(ctx) })
			var result struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
			assert.False(t, result.Success)
			assert.NotEmpty(t, result.Message)
		})
	}
}

func TestGetUserRequestLogsAcrossFiftyRawRows(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	logs := []model.Log{
		{UserId: 42, RequestId: "retry", Type: model.LogTypeConsume, CreatedAt: 100, ModelName: "old-settlement"},
		{UserId: 42, RequestId: "retry", Type: model.LogTypeConsume, CreatedAt: 101, ModelName: "settled"},
	}
	for i := 0; i < 51; i++ {
		logs = append(logs, model.Log{UserId: 42, RequestId: fmt.Sprintf("filler-%02d", i), Type: model.LogTypeConsume, CreatedAt: int64(102 + i)})
	}
	logs = append(logs,
		model.Log{UserId: 42, RequestId: "retry", Type: model.LogTypeError, CreatedAt: 153},
		model.Log{UserId: 42, RequestId: "retry", Type: model.LogTypeError, CreatedAt: 154},
		model.Log{UserId: 42, Type: model.LogTypeTopup, CreatedAt: 150},
		model.Log{UserId: 99, Type: model.LogTypeConsume, CreatedAt: 150},
		model.Log{UserId: 42, Type: model.LogTypeConsume, CreatedAt: 201},
		model.Log{UserId: 42, Type: model.LogTypeConsume, CreatedAt: 99},
	)
	require.NoError(t, db.Create(&logs).Error)
	// Establish the actual regression: raw page 1 has the errors, raw page 2
	// has their settlements. Neither raw page can resolve the request alone.
	rawFirst, _, err := model.GetUserLogs(42, []int{2, 5}, 100, 200, "", "", 0, 50, "", "", "")
	require.NoError(t, err)
	require.Equal(t, model.LogTypeError, rawFirst[0].Type)
	rawSecond, _, err := model.GetUserLogs(42, []int{2, 5}, 100, 200, "", "", 50, 50, "", "", "")
	require.NoError(t, err)
	require.Equal(t, "settled", rawSecond[len(rawSecond)-2].ModelName)
	var all []model.Log
	for page, count := range []int{50, 2, 0} {
		ctx, recorder := newAuthenticatedContext(t, http.MethodGet,
			fmt.Sprintf("/api/log/self/requests?p=%d&page_size=50&start_timestamp=100&end_timestamp=200&user_id=99", page+1), nil, 42)
		GetUserRequestLogs(ctx)
		var result struct {
			Success bool `json:"success"`
			Data    struct {
				Total int         `json:"total"`
				Items []model.Log `json:"items"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
		require.True(t, result.Success)
		assert.Equal(t, 52, result.Data.Total)
		require.Len(t, result.Data.Items, count)
		all = append(all, result.Data.Items...)
	}
	settlements := 0
	for _, log := range all {
		if log.RequestId == "retry" {
			settlements++
			assert.Equal(t, "settled", log.ModelName)
			assert.Equal(t, model.LogTypeConsume, log.Type)
		}
	}
	assert.Equal(t, 1, settlements)
}

func TestGetUserRequestLogsOrderAndSanitize(t *testing.T) {
	for _, databaseType := range []common.DatabaseType{common.DatabaseTypeSQLite, common.DatabaseTypeClickHouse} {
		t.Run(string(databaseType), func(t *testing.T) {
			db := setupTokenControllerTestDB(t)
			require.NoError(t, db.AutoMigrate(&model.Log{}))
			require.NoError(t, db.Create(&[]model.Log{
				{UserId: 42, RequestId: "a", Type: model.LogTypeConsume, CreatedAt: 200},
				{UserId: 42, RequestId: "z", Type: model.LogTypeConsume, CreatedAt: 200},
				{UserId: 42, RequestId: "b", Type: model.LogTypeConsume, CreatedAt: 100},
			}).Error)
			require.NoError(t, db.Model(&model.Log{}).Where("user_id = ?", 42).Update("other", `{"admin_info":{"secret":"admin"},"root_info":{"secret":"root"},"audit_info":{"secret":"audit"},"group_ratio":0.5}`).Error)
			common.SetDatabaseTypes(common.DatabaseTypeSQLite, databaseType)
			t.Cleanup(func() { common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite) })
			items, total, err := model.GetUserRequestLogs(context.Background(), 42, 1, 300, 0, 2)
			require.NoError(t, err)
			assert.EqualValues(t, 3, total)
			require.Len(t, items, 2)
			want := []string{"b", "z"}
			if databaseType == common.DatabaseTypeClickHouse {
				want = []string{"z", "a"}
			}
			assert.Equal(t, want, []string{items[0].RequestId, items[1].RequestId})
			for i, log := range items {
				assert.Equal(t, i+1, log.Id)
				assert.Empty(t, log.ChannelName)
				assert.JSONEq(t, `{"group_ratio":0.5}`, log.Other)
			}
		})
	}
}

func TestGetUserRequestLogsPaginationDefaultsAndDatabaseError(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	for _, test := range []struct {
		query    string
		pageSize int
	}{
		{"p=0&page_size=0", common.ItemsPerPage}, {"p=no&page_size=no", common.ItemsPerPage}, {"page_size=101", 100}, {"page_size=1", 1},
	} {
		ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/log/self/requests?start_timestamp=1&end_timestamp=200&"+test.query, nil, 42)
		GetUserRequestLogs(ctx)
		var result struct {
			Success bool `json:"success"`
			Data    struct {
				Page     int         `json:"page"`
				PageSize int         `json:"page_size"`
				Items    []model.Log `json:"items"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
		assert.True(t, result.Success)
		assert.Equal(t, 1, result.Data.Page)
		assert.Equal(t, test.pageSize, result.Data.PageSize)
		assert.NotNil(t, result.Data.Items)
		assert.Empty(t, result.Data.Items)
	}
	require.NoError(t, db.Migrator().DropTable(&model.Log{}))
	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/log/self/requests?start_timestamp=1&end_timestamp=200", nil, 42)
	GetUserRequestLogs(ctx)
	var result struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
	assert.False(t, result.Success)
	assert.Equal(t, "查询日志失败", result.Message)
}

func TestGetUserRequestLogsUsesEventTimeForSettlementBeforeDisplayOrder(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	require.NoError(t, db.Create(&[]model.Log{
		{UserId: 42, RequestId: "settled", Type: model.LogTypeConsume, CreatedAt: 200, ModelName: "new-consume", IsStream: true, Other: `{"stream_status":{"status":"error"}}`},
		{UserId: 42, RequestId: "settled", Type: model.LogTypeConsume, CreatedAt: 100, ModelName: "late-old-consume"},
		{UserId: 42, RequestId: "settled", Type: model.LogTypeError, CreatedAt: 300},
		{UserId: 42, RequestId: "failed", Type: model.LogTypeError, CreatedAt: 200, ModelName: "new-error"},
		{UserId: 42, RequestId: "failed", Type: model.LogTypeError, CreatedAt: 100, ModelName: "late-old-error"},
		{UserId: 42, RequestId: "tie", Type: model.LogTypeConsume, CreatedAt: 200, ModelName: "old-tie"},
		{UserId: 42, RequestId: "tie", Type: model.LogTypeConsume, CreatedAt: 200, ModelName: "new-tie"},
	}).Error)
	items, total, err := model.GetUserRequestLogs(context.Background(), 42, 1, 400, 0, 50)
	require.NoError(t, err)
	assert.EqualValues(t, 3, total)
	require.Len(t, items, 3)
	assert.Equal(t, []string{"new-tie", "new-error", "new-consume"}, []string{items[0].ModelName, items[1].ModelName, items[2].ModelName})
	assert.True(t, items[2].IsStream)
	summary, err := model.GetUserLogSummary(context.Background(), 42, 1, 400, 0)
	require.NoError(t, err)
	assert.EqualValues(t, 2, summary.Failed)
	assert.EqualValues(t, 1, summary.Succeeded)
}

func TestGetUserRequestLogsRejectsUnboundedWindowsBeforeQuery(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	queries := 0
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("count_request_queries", func(*gorm.DB) { queries++ }))
	for _, query := range []string{
		"", "start_timestamp=1", "end_timestamp=2", "start_timestamp=x&end_timestamp=2",
		"start_timestamp=1&end_timestamp=x", "start_timestamp=0&end_timestamp=1",
		"start_timestamp=1&end_timestamp=0", "start_timestamp=-1&end_timestamp=1",
		"start_timestamp=2&end_timestamp=1", "start_timestamp=1&end_timestamp=86401",
		"start_timestamp=1&end_timestamp=9223372036854775807",
		"start_timestamp=-9223372036854775808&end_timestamp=9223372036854775807",
		"start_timestamp=9223372036854775808&end_timestamp=9223372036854775809",
	} {
		t.Run(query, func(t *testing.T) {
			before := queries
			ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/log/self/requests?"+query, nil, 42)
			GetUserRequestLogs(ctx)
			var result struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
			assert.False(t, result.Success)
			assert.NotEmpty(t, result.Message)
			assert.Equal(t, before, queries, "invalid window must not query the database")
		})
	}
}

func TestGetUserRequestLogsWindowBoundariesAndCancellation(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	for _, query := range []string{
		"start_timestamp=1&end_timestamp=1", "start_timestamp=1&end_timestamp=86400",
		"start_timestamp=9223372036854775807&end_timestamp=9223372036854775807",
	} {
		ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/log/self/requests?"+query, nil, 42)
		GetUserRequestLogs(ctx)
		var result struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
		assert.True(t, result.Success, query)
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/log/self/requests?start_timestamp=1&end_timestamp=86400", nil, 42)
	requestCtx, cancel := context.WithCancel(ctx.Request.Context())
	cancel()
	ctx.Request = ctx.Request.WithContext(requestCtx)
	GetUserRequestLogs(ctx)
	var result struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
	assert.False(t, result.Success, "canceled request must reach the database context")
}

func TestRequestOutcomeZeroIDTiesAgreeAcrossListAndSummary(t *testing.T) {
	for _, reverse := range []bool{false, true} {
		t.Run(fmt.Sprintf("reverse=%t", reverse), func(t *testing.T) {
			db := setupTokenControllerTestDB(t)
			// ClickHouse does not assign the unique auto-increment IDs supplied by
			// SQLite's normal Log table. Use its zero-ID shape, without a PK.
			require.NoError(t, db.Exec(`CREATE TABLE logs (id INTEGER, user_id INTEGER, request_id TEXT, created_at INTEGER, type INTEGER, is_stream BOOLEAN, other TEXT, quota INTEGER, prompt_tokens INTEGER, completion_tokens INTEGER)`).Error)
			common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeClickHouse)
			t.Cleanup(func() { common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite) })
			values := []bool{true, false}
			if reverse {
				values = []bool{false, true}
			}
			for _, streaming := range values {
				require.NoError(t, db.Exec(`INSERT INTO logs VALUES (0, 42, 'same-request', 100, 2, ?, ?, 10, 4, 1)`, streaming, `{"stream_status":{"status":"error"}}`).Error)
			}
			items, total, err := model.GetUserRequestLogs(context.Background(), 42, 1, 200, 0, 50)
			require.NoError(t, err)
			require.Len(t, items, 1)
			assert.EqualValues(t, 1, total)
			assert.True(t, items[0].IsStream, "deterministic tie-break prefers true is_stream")
			summary, err := model.GetUserLogSummary(context.Background(), 42, 1, 200, 0)
			require.NoError(t, err)
			assert.EqualValues(t, 1, summary.Requests)
			assert.EqualValues(t, 1, summary.Failed)
			assert.Zero(t, summary.Succeeded)
			assert.EqualValues(t, 20, summary.Quota, "both consumption rows remain charged")
			assert.EqualValues(t, 10, summary.Tokens)
		})
	}
}
