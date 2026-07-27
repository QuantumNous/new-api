package service

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDeleteBaseRecordsByPeriodTypeIsolatesDailyWeeklyMonthly(t *testing.T) {
	originalGet := feishuStatsAPIGet
	t.Cleanup(func() { feishuStatsAPIGet = originalGet })

	feishuStatsAPIGet = func(_, _ string) ([]byte, error) {
		return []byte(`{"code":0,"data":{"items":[{"record_id":"daily-id","fields":{"统计周期类型":"daily"}},{"record_id":"weekly-id","fields":{"统计周期类型":"weekly"}},{"record_id":"monthly-id","fields":{"统计周期类型":"monthly"}}],"has_more":false}}`), nil
	}

	for _, period := range []string{model.ReportPeriodDaily, model.ReportPeriodWeekly, model.ReportPeriodMonthly} {
		t.Run(period, func(t *testing.T) {
			originalPost := feishuStatsAPIPost
			t.Cleanup(func() { feishuStatsAPIPost = originalPost })
			var deleted []string
			feishuStatsAPIPost = func(_, _ string, body []byte) ([]byte, error) {
				var payload struct {
					Records []string `json:"records"`
				}
				require.NoError(t, common.Unmarshal(body, &payload))
				deleted = payload.Records
				return []byte(`{"code":0,"msg":"success"}`), nil
			}

			require.NoError(t, deleteBaseRecordsByPeriodType("token", "base", "table", period))
			require.Equal(t, []string{period + "-id"}, deleted)
		})
	}
}

func TestBatchCreateBaseRecordsIsolatesInvalidUserForEveryPeriod(t *testing.T) {
	periods := []string{model.ReportPeriodDaily, model.ReportPeriodWeekly, model.ReportPeriodMonthly}
	for _, period := range periods {
		t.Run(period, func(t *testing.T) {
			originalPost := feishuStatsAPIPost
			t.Cleanup(func() { feishuStatsAPIPost = originalPost })

			calls := make([]int, 0)
			feishuStatsAPIPost = func(_, _ string, body []byte) ([]byte, error) {
				var payload struct {
					Records []struct {
						Fields map[string]any `json:"fields"`
					} `json:"records"`
				}
				require.NoError(t, common.Unmarshal(body, &payload))
				calls = append(calls, len(payload.Records))
				for _, record := range payload.Records {
					if record.Fields["用户名"] == "bad" {
						return []byte(`{"code":1254066,"msg":"UserFieldConvFail"}`), nil
					}
				}
				return []byte(`{"code":0,"msg":"success"}`), nil
			}

			records := []map[string]any{
				{"统计周期类型": period, "用户名": "good-1"},
				{"统计周期类型": period, "用户名": "bad", "接收人员": []map[string]string{{"id": "ou_bad"}}},
				{"统计周期类型": period, "用户名": "good-2"},
			}
			results, err := batchCreateBaseRecords("token", "base", "table", records)
			require.NoError(t, err)
			require.Equal(t, []int{3, 1, 2, 1, 1}, calls)
			require.Len(t, results, 3)
			require.True(t, results[0].Attempted)
			require.True(t, results[0].Success)
			require.True(t, results[1].Attempted)
			require.False(t, results[1].Success)
			require.Contains(t, results[1].Error, "UserFieldConvFail")
			require.True(t, results[2].Attempted)
			require.True(t, results[2].Success)
		})
	}
}

func TestBatchCreateBaseRecordsMarksAttemptedBatchOnSystemError(t *testing.T) {
	originalPost := feishuStatsAPIPost
	t.Cleanup(func() { feishuStatsAPIPost = originalPost })

	calls := 0
	feishuStatsAPIPost = func(_, _ string, _ []byte) ([]byte, error) {
		calls++
		if calls == 1 {
			return []byte(`{"code":0,"msg":"success"}`), nil
		}
		return nil, fmt.Errorf("rate limited")
	}

	records := make([]map[string]any, 401)
	results, err := batchCreateBaseRecords("token", "base", "table", records)
	require.ErrorContains(t, err, "rate limited")
	require.Len(t, results, 401)
	for i := 0; i < 200; i++ {
		require.True(t, results[i].Attempted)
		require.True(t, results[i].Success)
	}
	for i := 200; i < 400; i++ {
		require.True(t, results[i].Attempted)
		require.False(t, results[i].Success)
		require.Contains(t, results[i].Error, "rate limited")
	}
	require.False(t, results[400].Attempted)
	require.False(t, results[400].Success)
	require.Empty(t, results[400].Error)
}

func setupUsageReportTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	oldDB := model.DB
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.UsageReportSnapshot{}))
	t.Cleanup(func() {
		model.DB = oldDB
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestApplyAccountSyncResultsWritesOnlyAttemptedStatuses(t *testing.T) {
	db := setupUsageReportTestDB(t)
	items := []*model.UsageReportSnapshot{
		{PeriodType: model.ReportPeriodDaily, PeriodStart: 1, ScopeType: model.ReportScopeAccount, Username: "success", BaseSyncStatus: model.SyncStatusPending},
		{PeriodType: model.ReportPeriodDaily, PeriodStart: 1, ScopeType: model.ReportScopeAccount, Username: "bad-id", BaseSyncStatus: model.SyncStatusPending},
		{PeriodType: model.ReportPeriodDaily, PeriodStart: 1, ScopeType: model.ReportScopeAccount, Username: "system-error", BaseSyncStatus: model.SyncStatusPending},
		{PeriodType: model.ReportPeriodDaily, PeriodStart: 1, ScopeType: model.ReportScopeAccount, Username: "not-attempted", BaseSyncStatus: model.SyncStatusPending},
	}
	require.NoError(t, db.Create(&items).Error)

	applyAccountSyncResults(items, []baseRecordCreateResult{
		{Index: 0, Attempted: true, Success: true},
		{Index: 1, Attempted: true, Error: "UserFieldConvFail"},
		{Index: 2, Attempted: true, Error: "rate limited"},
		{Index: 3},
	})

	var got []model.UsageReportSnapshot
	require.NoError(t, db.Order("id").Find(&got).Error)
	require.Equal(t, model.SyncStatusSuccess, got[0].BaseSyncStatus)
	require.Equal(t, model.SyncStatusFailed, got[1].BaseSyncStatus)
	require.Contains(t, got[1].BaseSyncError, "UserFieldConvFail")
	require.Equal(t, model.SyncStatusFailed, got[2].BaseSyncStatus)
	require.Contains(t, got[2].BaseSyncError, "rate limited")
	require.Equal(t, model.SyncStatusPending, got[3].BaseSyncStatus)
}

func systemFeishuSettingsForTest(t *testing.T) *system_setting.FeishuSettings {
	t.Helper()
	settings := system_setting.GetFeishuSettings()
	original := *settings
	t.Cleanup(func() { *settings = original })
	return settings
}

func TestGenerateUsageReportForPeriodReturnsDeleteErrorWithScope(t *testing.T) {
	db := setupUsageReportTestDB(t)
	require.NoError(t, db.Migrator().DropTable(&model.UsageReportSnapshot{}))

	err := GenerateUsageReportForPeriod(ReportPeriod{PeriodType: model.ReportPeriodDaily, StartTimestamp: 1})
	require.ErrorContains(t, err, "delete old platform snapshots")
}

func TestApplySnapshotSyncResultsWritesStatusesForOrgModelAndAnomaly(t *testing.T) {
	for _, scope := range []string{model.ReportScopeOrgDept, model.ReportScopeModel, model.ReportScopeAnomaly} {
		t.Run(scope, func(t *testing.T) {
			db := setupUsageReportTestDB(t)
			items := []*model.UsageReportSnapshot{
				{PeriodType: model.ReportPeriodDaily, PeriodStart: 1, ScopeType: scope, ModelName: "ok", BaseSyncStatus: model.SyncStatusPending},
				{PeriodType: model.ReportPeriodDaily, PeriodStart: 1, ScopeType: scope, ModelName: "failed", BaseSyncStatus: model.SyncStatusPending},
				{PeriodType: model.ReportPeriodDaily, PeriodStart: 1, ScopeType: scope, ModelName: "untouched", BaseSyncStatus: model.SyncStatusPending},
			}
			require.NoError(t, db.Create(&items).Error)

			err := applySnapshotSyncResults(items, []baseRecordCreateResult{
				{Index: 0, Attempted: true, Success: true},
				{Index: 1, Attempted: true, Error: "rate limited"},
				{Index: 2},
			})
			require.NoError(t, err)

			var got []model.UsageReportSnapshot
			require.NoError(t, db.Order("id").Find(&got).Error)
			require.Equal(t, model.SyncStatusSuccess, got[0].BaseSyncStatus)
			require.Equal(t, model.SyncStatusFailed, got[1].BaseSyncStatus)
			require.Equal(t, model.SyncStatusPending, got[2].BaseSyncStatus)
		})
	}
}

func TestSyncTableWithDiagnosticsReportsPartialSkippedRecords(t *testing.T) {
	msgs, err := syncTableWithDiagnostics("account", "table-id", func() error {
		return &partialSyncError{skipped: 2}
	})
	require.NoError(t, err)
	require.Equal(t, []string{"table account: partial success (table_id=table-id, skipped 2 records)"}, msgs)
}

func TestSyncAnomalyTableReturnsPartialOnSkippedUserFieldRecords(t *testing.T) {
	db := setupUsageReportTestDB(t)
	item := &model.UsageReportSnapshot{
		PeriodType:           model.ReportPeriodDaily,
		PeriodStart:          1,
		ScopeType:            model.ReportScopeAnomaly,
		Username:             "bad-user",
		ReceiverFeishuOpenId: "ou_bad",
		BaseSyncStatus:       model.SyncStatusPending,
	}
	require.NoError(t, db.Create(item).Error)

	originalGet := feishuStatsAPIGet
	originalPost := feishuStatsAPIPost
	t.Cleanup(func() {
		feishuStatsAPIGet = originalGet
		feishuStatsAPIPost = originalPost
	})
	feishuStatsAPIGet = func(string, string) ([]byte, error) {
		return []byte(`{"code":0,"data":{"items":[],"has_more":false}}`), nil
	}
	feishuStatsAPIPost = func(string, string, []byte) ([]byte, error) {
		return []byte(`{"code":1254066,"msg":"UserFieldConvFail"}`), nil
	}

	err := syncAnomalyTable("token", "base", "table", ReportPeriod{PeriodType: model.ReportPeriodDaily, StartTimestamp: 1})
	var partial *partialSyncError
	require.ErrorAs(t, err, &partial)

	msgs, diagErr := syncTableWithDiagnostics("anomaly", "table-id", func() error { return err })
	require.NoError(t, diagErr)
	require.Equal(t, []string{"table anomaly: partial success (table_id=table-id, skipped 1 records)"}, msgs)
}

func TestBuildAdminGroupMessageReturnsSnapshotQueryError(t *testing.T) {
	db := setupUsageReportTestDB(t)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	_, _, err = buildAdminGroupMessage(ReportPeriod{PeriodType: model.ReportPeriodDaily, StartTimestamp: 1})
	require.ErrorContains(t, err, "query platform snapshot")
}

func TestPushUsageReportAdminTaskMarksPlatformFailedOnAccountQueryError(t *testing.T) {
	db := setupUsageReportTestDB(t)
	platform := &model.UsageReportSnapshot{PeriodType: model.ReportPeriodDaily, PeriodStart: 1, ScopeType: model.ReportScopePlatform, AdminGroupPushStatus: model.SyncStatusPending}
	require.NoError(t, db.Create(platform).Error)

	settings := systemFeishuSettingsForTest(t)
	settings.StatsBaseToken = "base"
	settings.ReportTableAdminPushID = "table"
	settings.AppID = "app"
	settings.AppSecret = "secret"

	queryCount := 0
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("fail_after_platform_snapshot", func(tx *gorm.DB) {
		queryCount++
		if queryCount == 2 {
			tx.AddError(fmt.Errorf("forced account query failure"))
		}
	}))

	err := PushUsageReportAdminTaskToBase(ReportPeriod{PeriodType: model.ReportPeriodDaily, StartTimestamp: 1})
	require.ErrorContains(t, err, "query account snapshots")
	var got model.UsageReportSnapshot
	require.NoError(t, db.First(&got, platform.Id).Error)
	require.Equal(t, model.SyncStatusFailed, got.AdminGroupPushStatus)
	require.Contains(t, got.AdminGroupPushError, "query account snapshots")
}

func TestPushUsageReportAdminTaskMarksPlatformFailedOnCreateError(t *testing.T) {
	db := setupUsageReportTestDB(t)
	platform := &model.UsageReportSnapshot{PeriodType: model.ReportPeriodDaily, PeriodStart: 1, ScopeType: model.ReportScopePlatform, AdminGroupPushStatus: model.SyncStatusPending}
	require.NoError(t, db.Create(platform).Error)

	settings := systemFeishuSettingsForTest(t)
	settings.StatsBaseToken = "base"
	settings.ReportTableAdminPushID = "table"
	settings.AppID = "app"
	settings.AppSecret = "secret"

	originalToken := usageReportAdminGetToken
	originalDelete := usageReportAdminDeleteRecords
	originalCreate := usageReportAdminCreateRecords
	t.Cleanup(func() {
		usageReportAdminGetToken = originalToken
		usageReportAdminDeleteRecords = originalDelete
		usageReportAdminCreateRecords = originalCreate
	})
	usageReportAdminGetToken = func(string, string) (string, error) { return "token", nil }
	usageReportAdminDeleteRecords = func(string, string, string, string) error { return nil }
	usageReportAdminCreateRecords = func(string, string, string, []map[string]any) ([]baseRecordCreateResult, error) {
		return []baseRecordCreateResult{{Attempted: true, Error: "rate limited"}}, fmt.Errorf("rate limited")
	}

	err := PushUsageReportAdminTaskToBase(ReportPeriod{PeriodType: model.ReportPeriodDaily, StartTimestamp: 1})
	require.ErrorContains(t, err, "rate limited")
	var got model.UsageReportSnapshot
	require.NoError(t, db.First(&got, platform.Id).Error)
	require.Equal(t, model.SyncStatusFailed, got.AdminGroupPushStatus)
	require.Contains(t, got.AdminGroupPushError, "rate limited")
}

func TestRunUsageReportFullPipelineStopsBeforeAdminPushOnSyncError(t *testing.T) {
	originalGenerate := generateUsageReportForPeriod
	originalSync := syncUsageReportPeriodToBaseWithDiagnostics
	originalPush := pushUsageReportAdminTaskToBase
	t.Cleanup(func() {
		generateUsageReportForPeriod = originalGenerate
		syncUsageReportPeriodToBaseWithDiagnostics = originalSync
		pushUsageReportAdminTaskToBase = originalPush
	})

	generateUsageReportForPeriod = func(ReportPeriod) error { return nil }
	syncUsageReportPeriodToBaseWithDiagnostics = func(ReportPeriod) ([]string, error) {
		return []string{"table account: failed"}, fmt.Errorf("rate limited")
	}
	pushCalled := false
	pushUsageReportAdminTaskToBase = func(ReportPeriod) error {
		pushCalled = true
		return nil
	}

	settings := systemFeishuSettingsForTest(t)
	settings.UsageReportBaseSyncEnabled = true
	settings.UsageReportAdminGroupPushEnabled = true

	result, err := RunUsageReportFullPipelineForPeriod(ReportPeriod{PeriodType: model.ReportPeriodDaily}, true, true)
	require.ErrorContains(t, err, "rate limited")
	require.Nil(t, result)
	require.False(t, pushCalled)
}
