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

func setupInvitationRebateControllerTestDB(t *testing.T) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	oldDB := model.DB
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "invitation_rebate_controller.db")), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
		model.DB = oldDB
	})

	require.NoError(t, model.DB.AutoMigrate(
		&model.User{},
		&model.InvitationRebateRecord{},
		&model.InvitationRebateConsumption{},
		&model.InvitationRebateAccumulation{},
		&model.InvitationRebateSettlementItem{},
	))
}

func TestGetInvitationRebateRecordDetailReturnsSettlementItems(t *testing.T) {
	setupInvitationRebateControllerTestDB(t)
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

func TestGetSelfInvitationRebateSummaryReturnsOwnTotals(t *testing.T) {
	setupInvitationRebateControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{
		Id:              11,
		Username:        "self_summary",
		Password:        "password",
		AffCode:         "sum11",
		AffQuota:        30,
		AffHistoryQuota: 100,
		AffCount:        2,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 11)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/invitation_rebate/self/summary", nil)

	GetSelfInvitationRebateSummary(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := recorder.Body.String()
	assert.Contains(t, body, `"pending_rebate_quota":30`)
	assert.Contains(t, body, `"total_rebate_quota":100`)
	assert.Contains(t, body, `"converted_quota":70`)
	assert.Contains(t, body, `"invite_count":2`)
}

func TestGetSelfInvitationRebateInviteesOnlyReturnsOwnInvitees(t *testing.T) {
	setupInvitationRebateControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{Id: 20, Username: "inviter", Password: "password", AffCode: "inv20"}).Error)
	require.NoError(t, model.DB.Create(&model.User{Id: 21, Username: "invitee_one", DisplayName: "Invitee One", Password: "password", AffCode: "inv21", InviterId: 20, CreatedAt: 100}).Error)
	require.NoError(t, model.DB.Create(&model.User{Id: 22, Username: "other_invitee", Password: "password", AffCode: "inv22", InviterId: 99, CreatedAt: 101}).Error)
	require.NoError(t, model.DB.Create(&model.InvitationRebateAccumulation{
		InviterUserId:           20,
		InviteeUserId:           21,
		PendingSourceQuota:      30,
		TotalSourceQuota:        120,
		TotalSettledSourceQuota: 90,
		TotalRebateQuota:        9,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 20)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/invitation_rebate/self/invitees?p=1&page_size=10", nil)

	GetSelfInvitationRebateInvitees(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := recorder.Body.String()
	assert.Contains(t, body, `"invitee_user_id":21`)
	assert.Contains(t, body, `"username":"invitee_one"`)
	assert.Contains(t, body, `"total_rebate_quota":9`)
	assert.NotContains(t, body, `"other_invitee"`)
	assert.NotContains(t, body, `"password"`)
}

func TestGetSelfInvitationRebateRecordsOnlyReturnsOwnRecords(t *testing.T) {
	setupInvitationRebateControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.InvitationRebateRecord{
		InviterUserId:  30,
		InviteeUserId:  31,
		SourceType:     "sync_relay_request",
		SourceKey:      "req_self_record",
		SourceQuota:    100,
		RebateQuota:    10,
		RebateRatioBps: 1000,
	}).Error)
	require.NoError(t, model.DB.Create(&model.InvitationRebateRecord{
		InviterUserId:  99,
		InviteeUserId:  32,
		SourceType:     "sync_relay_request",
		SourceKey:      "req_other_record",
		SourceQuota:    100,
		RebateQuota:    10,
		RebateRatioBps: 1000,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 30)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/invitation_rebate/self/records?p=1&page_size=10", nil)

	GetSelfInvitationRebateRecords(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := recorder.Body.String()
	assert.Contains(t, body, `"source_type":"sync_relay_request"`)
	assert.Contains(t, body, `"rebate_quota":10`)
	assert.NotContains(t, body, `"req_self_record"`)
	assert.NotContains(t, body, `"req_other_record"`)
}

func TestGetSelfInvitationRebateRecordDetailRejectsOtherInviter(t *testing.T) {
	setupInvitationRebateControllerTestDB(t)
	record := &model.InvitationRebateRecord{
		InviterUserId:  41,
		InviteeUserId:  42,
		SourceType:     "sync_relay_request",
		SourceKey:      "req_other_detail",
		SourceQuota:    100,
		RebateQuota:    10,
		RebateRatioBps: 1000,
	}
	require.NoError(t, model.DB.Create(record).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 40)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/invitation_rebate/self/records/"+strconv.Itoa(record.Id), nil)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(record.Id)}}

	GetSelfInvitationRebateRecordDetail(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	assert.NotContains(t, recorder.Body.String(), `"req_other_detail"`)
}

func TestGetSelfInvitationRebateRecordDetailMasksSourceKeys(t *testing.T) {
	setupInvitationRebateControllerTestDB(t)
	record := &model.InvitationRebateRecord{
		InviterUserId:  50,
		InviteeUserId:  51,
		SourceType:     "sync_relay_request",
		SourceKey:      "req_self_detail",
		SourceQuota:    100,
		RebateQuota:    10,
		RebateRatioBps: 1000,
	}
	require.NoError(t, model.DB.Create(record).Error)
	require.NoError(t, model.DB.Create(&model.InvitationRebateSettlementItem{
		RebateRecordId:     record.Id,
		ConsumptionId:      500,
		InviterUserId:      50,
		InviteeUserId:      51,
		SourceType:         "sync_relay_request",
		SourceKey:          "request_sensitive_123456",
		SettledSourceQuota: 100,
		RebateRatioBps:     1000,
		RebateQuota:        10,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 50)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/invitation_rebate/self/records/"+strconv.Itoa(record.Id), nil)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(record.Id)}}

	GetSelfInvitationRebateRecordDetail(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := recorder.Body.String()
	assert.Contains(t, body, `"success":true`)
	assert.Contains(t, body, `"source_key":"requ...3456"`)
	assert.NotContains(t, body, `"request_sensitive_123456"`)
	assert.NotContains(t, body, `"req_self_detail"`)
}
