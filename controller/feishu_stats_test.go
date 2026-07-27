package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestManualPushFeishuDailyStatsReturnsErrorWhenUsageReportPipelineFails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	oldDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:manual_push_daily_red?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	oldUsageReportEnabled := system_setting.GetFeishuSettings().UsageReportEnabled
	oldBaseSyncEnabled := system_setting.GetFeishuSettings().UsageReportBaseSyncEnabled
	system_setting.GetFeishuSettings().UsageReportEnabled = true
	system_setting.GetFeishuSettings().UsageReportBaseSyncEnabled = true
	t.Cleanup(func() {
		model.DB = oldDB
		system_setting.GetFeishuSettings().UsageReportEnabled = oldUsageReportEnabled
		system_setting.GetFeishuSettings().UsageReportBaseSyncEnabled = oldBaseSyncEnabled
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	ManualPushFeishuDailyStats(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, strings.ToLower(recorder.Body.String()), "usage_report_snapshots")
}
