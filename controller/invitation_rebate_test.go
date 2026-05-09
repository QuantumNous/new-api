package controller

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetInvitationRebateRecordDetailReturnsSettlementItems(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldDB := model.DB
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "invitation_rebate_detail.db")), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
		model.DB = oldDB
	})

	require.NoError(t, model.DB.AutoMigrate(
		&model.InvitationRebateRecord{},
		&model.InvitationRebateSettlementItem{},
	))
	require.NoError(t, model.DB.Exec("DELETE FROM invitation_rebate_settlement_items").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM invitation_rebate_records").Error)
	t.Cleanup(func() {
		_ = model.DB.Exec("DELETE FROM invitation_rebate_settlement_items").Error
		_ = model.DB.Exec("DELETE FROM invitation_rebate_records").Error
	})

	record := &model.InvitationRebateRecord{
		InviterUserId:   1,
		InviteeUserId:   2,
		SourceType:      "sync_relay_request",
		SourceKey:       "req_detail_trigger",
		SourceRequestId: "req_detail_trigger",
		SourceQuota:     100,
		RebateQuota:     10,
		RebateRatioBps:  1000,
	}
	require.NoError(t, model.DB.Create(record).Error)
	item := &model.InvitationRebateSettlementItem{
		RebateRecordId:     record.Id,
		ConsumptionId:      10,
		InviterUserId:      1,
		InviteeUserId:      2,
		SourceType:         "sync_relay_request",
		SourceKey:          "req_detail_source",
		SourceRequestId:    "req_detail_source",
		SettledSourceQuota: 100,
		RebateRatioBps:     1000,
		RebateQuota:        10,
		RemainderBefore:    0,
		RemainderAfter:     0,
	}
	require.NoError(t, model.DB.Create(item).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/invitation_rebate/"+strconv.Itoa(record.Id), nil)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(record.Id)}}

	GetInvitationRebateRecordDetail(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":true`)
	assert.Contains(t, recorder.Body.String(), `"legacy":false`)
	assert.Contains(t, recorder.Body.String(), `"source_key":"req_detail_source"`)
}
