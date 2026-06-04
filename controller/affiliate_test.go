package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestGetAffiliateStatusDisabled(t *testing.T) {
	originalEnabled := common.AffiliateEnabled
	defer func() {
		common.AffiliateEnabled = originalEnabled
	}()
	common.AffiliateEnabled = false

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/status", nil)
	ctx.Set("id", 3)
	ctx.Set("role", common.RoleCommonUser)

	GetAffiliateStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var body affiliateStatusTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success {
		t.Fatalf("expected success response: %+v", body)
	}
	if body.Data.Enabled {
		t.Fatalf("expected affiliate disabled response: %+v", body.Data)
	}
	if body.Data.Scope.Kind != service.AffiliateScopeNone {
		t.Fatalf("expected none scope, got %+v", body.Data.Scope)
	}
}

func TestGetAffiliateStatusAdminGlobal(t *testing.T) {
	originalEnabled := common.AffiliateEnabled
	defer func() {
		common.AffiliateEnabled = originalEnabled
	}()
	common.AffiliateEnabled = true

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/status", nil)
	ctx.Set("id", 4)
	ctx.Set("role", common.RoleAdminUser)

	GetAffiliateStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var body affiliateStatusTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Data.Enabled {
		t.Fatalf("expected affiliate enabled response: %+v", body.Data)
	}
	if body.Data.Scope.Kind != service.AffiliateScopeGlobal {
		t.Fatalf("expected global scope, got %+v", body.Data.Scope)
	}
}

func TestGetAffiliateStatusCommonUserNotOpenedMessage(t *testing.T) {
	newAffiliateControllerTestDB(t)
	originalEnabled := common.AffiliateEnabled
	defer func() {
		common.AffiliateEnabled = originalEnabled
	}()
	common.AffiliateEnabled = true

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/status", nil)
	ctx.Set("id", 5)
	ctx.Set("role", common.RoleCommonUser)

	GetAffiliateStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var body affiliateStatusTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success {
		t.Fatalf("expected success response: %+v", body)
	}
	if body.Data.Available {
		t.Fatalf("expected affiliate page unavailable for unopened common user: %+v", body.Data)
	}
	if body.Data.UnavailableReason != "not_opened" {
		t.Fatalf("expected not_opened reason, got %+v", body.Data)
	}
	if body.Data.Message != "分销功能未开通，请联系管理员开通。" {
		t.Fatalf("expected friendly unopened message, got %+v", body.Data)
	}
}

func TestAdminSetAffiliateProfile(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/profiles", bytes.NewBufferString(`{
		"user_id":501,
		"level":1,
		"invite_code":"aff501",
		"reason":"admin create"
	}`))
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminSetAffiliateProfile(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var profile model.AffiliateProfile
	if err := db.Where("user_id = ?", 501).First(&profile).Error; err != nil {
		t.Fatalf("query profile: %v", err)
	}
	if profile.Level != 1 || profile.Status != model.AffiliateProfileStatusActive || profile.InviteCode != "aff501" {
		t.Fatalf("unexpected profile: %+v", profile)
	}
}

func TestAdminUpdateAffiliateProfileStatusDisabled(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	if _, err := service.CreateAffiliateProfile(db, service.AffiliateProfileCreateInput{
		UserId:      601,
		Level:       1,
		InviteCode:  "aff601",
		ActorUserId: 1,
		Reason:      "seed",
	}); err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPatch, "/api/affiliate/admin/profiles/601/status", bytes.NewBufferString(`{
		"status":"disabled",
		"reason":"risk"
	}`))
	ctx.Params = gin.Params{{Key: "user_id", Value: "601"}}
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminUpdateAffiliateProfileStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var profile model.AffiliateProfile
	if err := db.Where("user_id = ?", 601).First(&profile).Error; err != nil {
		t.Fatalf("query profile: %v", err)
	}
	if profile.Status != model.AffiliateProfileStatusDisabled || profile.DisabledAt == 0 {
		t.Fatalf("expected disabled profile, got %+v", profile)
	}
}

func TestAdminUpdateAffiliateProfileStatusActive(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	if _, err := service.CreateAffiliateProfile(db, service.AffiliateProfileCreateInput{
		UserId:      602,
		Level:       1,
		InviteCode:  "aff602",
		ActorUserId: 1,
		Reason:      "seed",
	}); err != nil {
		t.Fatalf("seed profile: %v", err)
	}
	if err := service.DisableAffiliateProfile(db, service.AffiliateProfileStatusInput{
		UserId:      602,
		ActorUserId: 1,
		Reason:      "disable seed",
	}); err != nil {
		t.Fatalf("disable profile: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPatch, "/api/affiliate/admin/profiles/602/status", bytes.NewBufferString(`{
		"status":"active",
		"reason":"restore"
	}`))
	ctx.Params = gin.Params{{Key: "user_id", Value: "602"}}
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminUpdateAffiliateProfileStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var profile model.AffiliateProfile
	if err := db.Where("user_id = ?", 602).First(&profile).Error; err != nil {
		t.Fatalf("query profile: %v", err)
	}
	if profile.Status != model.AffiliateProfileStatusActive || profile.DisabledAt != 0 {
		t.Fatalf("expected active profile, got %+v", profile)
	}
}

func TestAdminListAffiliateProfiles(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	if _, err := service.CreateAffiliateProfile(db, service.AffiliateProfileCreateInput{
		UserId:      610,
		Level:       1,
		InviteCode:  "aff610",
		ActorUserId: 1,
		Reason:      "seed",
	}); err != nil {
		t.Fatalf("seed level one: %v", err)
	}
	if _, err := service.CreateAffiliateProfile(db, service.AffiliateProfileCreateInput{
		UserId:       611,
		Level:        2,
		ParentUserId: 610,
		InviteCode:   "aff611",
		ActorUserId:  1,
		Reason:       "seed",
	}); err != nil {
		t.Fatalf("seed level two: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/admin/profiles?p=0&page_size=10&level=2&status=active", nil)
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminListAffiliateProfiles(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateProfilesListTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success || body.Data.Total != 1 || len(body.Data.Items) != 1 {
		t.Fatalf("unexpected list response: %+v", body)
	}
	if body.Data.Items[0].UserId != 611 || body.Data.Items[0].ParentUserId != 610 {
		t.Fatalf("unexpected listed profile: %+v", body.Data.Items[0])
	}
}

func TestAdminListAffiliateCommissionsCanFilterAffiliate(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	seedAffiliateCommissionEventForList(t, db, model.AffiliateCommissionEvent{
		AffiliateUserId:  100,
		DownstreamUserId: 200,
		RuleSetId:        1,
		Status:           model.AffiliateEventStatusReady,
		Kind:             service.AffiliateCommissionEventKindAccrual,
		CommissionCents:  1000,
	})
	seedAffiliateCommissionEventForList(t, db, model.AffiliateCommissionEvent{
		AffiliateUserId:  999,
		DownstreamUserId: 888,
		RuleSetId:        1,
		Status:           model.AffiliateEventStatusReady,
		Kind:             service.AffiliateCommissionEventKindAccrual,
		CommissionCents:  9999,
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/admin/commissions?affiliate_user_id=999&p=1&page_size=10", nil)
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminListAffiliateCommissions(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateCommissionEventsTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success || body.Data.Total != 1 || len(body.Data.Items) != 1 || body.Data.Items[0].AffiliateUserId != 999 {
		t.Fatalf("expected filtered global commission list, got %+v", body)
	}
}

func TestAdminCreateVoidAndRecomputeAffiliateCommissions(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	ruleSet := seedPublishedAffiliateRuleSetForAdminRun(t, db, "admin-commission-manage")
	seedAffiliateInviterControllerProfile(t, db, 100, 1)
	seedAffiliateInviterControllerRelation(t, db, 100, 300, 1)
	seedAffiliateLog(t, db, model.Log{UserId: 300, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})

	adjustment := performAdminCreateAffiliateCommissionAdjustmentRequest(t, `{
		"affiliate_user_id":100,
		"downstream_user_id":300,
		"rule_set_id":`+strconv.Itoa(ruleSet.Id)+`,
		"period_start":1000,
		"period_end":2000,
		"commission_cents":-250,
		"reason":"support approved clawback"
	}`)
	if !adjustment.Success || adjustment.Data.Kind != service.AffiliateCommissionEventKindManualAdjustment || adjustment.Data.CommissionCents != -250 {
		t.Fatalf("expected manual adjustment event, got %+v", adjustment)
	}

	voided := performAdminVoidAffiliateCommissionEventRequest(t, adjustment.Data.Id, `{"reason":"entered twice"}`)
	if !voided.Success || voided.Data.Status != model.AffiliateEventStatusVoid {
		t.Fatalf("expected voided manual adjustment, got %+v", voided)
	}

	recomputed := performAdminRecomputeAffiliateCommissionsRequest(t, `{
		"rule_set_id":`+strconv.Itoa(ruleSet.Id)+`,
		"period_start":1000,
		"period_end":2000,
		"quota_per_unit":1000,
		"usd_exchange_rate":7,
		"reason":"recompute period"
	}`)
	if !recomputed.Success || recomputed.Data.CreatedEventCount != 1 || recomputed.Data.VoidedEventCount != 0 || len(recomputed.Data.CreatedEvents) != 1 {
		t.Fatalf("expected one recomputed commission event, got %+v", recomputed)
	}
	if recomputed.Data.CreatedEvents[0].AffiliateUserId != 100 || recomputed.Data.CreatedEvents[0].CommissionCents <= 0 {
		t.Fatalf("unexpected recomputed event: %+v", recomputed.Data.CreatedEvents[0])
	}
}

func TestAdminSettlementLifecycleGenerateFreezePay(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	ruleSet := seedPublishedAffiliateRuleSetForAdminSettlement(t, db, "admin-settlement-pay")
	seedAffiliateCommissionEventForList(t, db, model.AffiliateCommissionEvent{
		AffiliateUserId:  100,
		DownstreamUserId: 200,
		RuleSetId:        ruleSet.Id,
		Status:           model.AffiliateEventStatusPending,
		Kind:             service.AffiliateCommissionEventKindAccrual,
		PeriodStart:      1000,
		PeriodEnd:        2000,
		CommissionCents:  1500,
	})

	generated := performAdminGenerateAffiliateSettlementsRequest(t, `{
		"rule_set_id":`+strconv.Itoa(ruleSet.Id)+`,
		"period_start":1000,
		"period_end":2000,
		"freeze_days":7,
		"reason":"monthly close"
	}`)
	if !generated.Success || len(generated.Data) != 1 {
		t.Fatalf("expected one generated settlement, got %+v", generated)
	}
	settlement := generated.Data[0]
	if settlement.AffiliateUserId != 100 || settlement.Status != model.AffiliateSettlementStatusDraft || settlement.PayableCents != 1500 {
		t.Fatalf("unexpected generated settlement: %+v", settlement)
	}
	var jobRun model.AffiliateJobRun
	if err := db.Where("job_type = ?", model.AffiliateJobRunTypeSettlementGenerate).First(&jobRun).Error; err != nil {
		t.Fatalf("expected standalone settlement generate job run: %v", err)
	}
	if jobRun.Status != model.AffiliateJobRunStatusSucceeded || jobRun.SettlementCount != 1 || jobRun.ActorUserId != 1 {
		t.Fatalf("unexpected standalone settlement generate job run: %+v", jobRun)
	}
	if !strings.Contains(jobRun.InputSnapshot, `"has_reason":true`) || strings.Contains(jobRun.InputSnapshot, "monthly close") {
		t.Fatalf("expected job run input snapshot to redact reason content, got %q", jobRun.InputSnapshot)
	}

	frozen := performAdminSettlementStatusRequest(t, http.MethodPatch, "/api/affiliate/admin/settlements/"+strconv.Itoa(settlement.Id)+"/freeze", settlement.Id, "freeze", `{"reason":"reviewed"}`)
	if !frozen.Success || frozen.Data.Status != model.AffiliateSettlementStatusFrozen {
		t.Fatalf("expected frozen settlement, got %+v", frozen)
	}

	paid := performAdminSettlementStatusRequest(t, http.MethodPatch, "/api/affiliate/admin/settlements/"+strconv.Itoa(settlement.Id)+"/pay", settlement.Id, "pay", `{
		"paid_at":3000,
		"payment_reference":"settlement-pay-001",
		"reason":"bank transfer"
	}`)
	if !paid.Success || paid.Data.Status != model.AffiliateSettlementStatusPaid || paid.Data.PaidByUserId != 1 || paid.Data.PaymentReference != "settlement-pay-001" {
		t.Fatalf("expected paid settlement, got %+v", paid)
	}
	var event model.AffiliateCommissionEvent
	if err := db.Where("settlement_id = ?", settlement.Id).First(&event).Error; err != nil {
		t.Fatalf("load linked event: %v", err)
	}
	if event.Status != model.AffiliateEventStatusSettled {
		t.Fatalf("expected linked commission event settled, got %+v", event)
	}
}

func TestAdminRunAffiliateSettlementPipeline(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	ruleSet := seedPublishedAffiliateRuleSetForAdminRun(t, db, "admin-settlement-run")
	seedAffiliateInviterControllerProfile(t, db, 100, 1)
	seedAffiliateInviterControllerRelation(t, db, 100, 200, 1)
	seedAffiliateInviterControllerRelation(t, db, 100, 300, 2)
	seedAffiliateRunInviteEvent(t, db, 100, 200, 1100)
	seedAffiliateRunInviteEvent(t, db, 100, 300, 1100)
	seedAffiliateLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateLog(t, db, model.Log{UserId: 300, CreatedAt: 1300, Type: model.LogTypeConsume, Quota: 3000, Other: `{"quota_source":"paid"}`})

	body := performAdminRunAffiliateSettlementPipelineRequest(t, `{
		"rule_set_id":`+strconv.Itoa(ruleSet.Id)+`,
		"period_start":1000,
		"period_end":2000,
		"freeze_days":7,
		"now":1815500,
		"quota_per_unit":100,
		"usd_exchange_rate":1,
		"reason":"monthly close"
	}`)
	if !body.Success {
		t.Fatalf("expected successful settlement run, got %+v", body)
	}
	if body.Data.KPISnapshotCount != 1 || body.Data.CommissionEventCount != 3 || body.Data.HeadFeeEventCount != 2 || len(body.Data.Settlements) != 1 {
		t.Fatalf("unexpected settlement run counts: %+v", body.Data)
	}
	if body.Data.Settlements[0].PayableCents != 5900 {
		t.Fatalf("expected settlement payable 5900 cents, got %+v", body.Data.Settlements[0])
	}
}

func TestAdminRunAffiliateSettlementPipelineDryRun(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	ruleSet := seedPublishedAffiliateRuleSetForAdminRun(t, db, "admin-settlement-run-dry-run")
	seedAffiliateInviterControllerProfile(t, db, 100, 1)
	seedAffiliateInviterControllerRelation(t, db, 100, 200, 1)
	seedAffiliateInviterControllerRelation(t, db, 100, 300, 2)
	seedAffiliateRunInviteEvent(t, db, 100, 200, 1100)
	seedAffiliateRunInviteEvent(t, db, 100, 300, 1100)
	seedAffiliateLog(t, db, model.Log{UserId: 200, CreatedAt: 1100, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateLog(t, db, model.Log{UserId: 200, CreatedAt: 1200, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateLog(t, db, model.Log{UserId: 300, CreatedAt: 1300, Type: model.LogTypeConsume, Quota: 3000, Other: `{"quota_source":"paid"}`})

	body := performAdminRunAffiliateSettlementPipelineRequest(t, `{
		"rule_set_id":`+strconv.Itoa(ruleSet.Id)+`,
		"period_start":1000,
		"period_end":2000,
		"freeze_days":7,
		"dry_run":true,
		"now":1815500,
		"quota_per_unit":100,
		"usd_exchange_rate":1,
		"reason":"monthly close dry-run"
	}`)
	if !body.Success {
		t.Fatalf("expected successful settlement dry-run, got %+v", body)
	}
	if !body.Data.DryRun || body.Data.JobRunId != 0 || body.Data.JobRunStatus != "dry_run" {
		t.Fatalf("expected dry-run result without persisted job run, got %+v", body.Data)
	}
	if body.Data.KPISnapshotCount != 1 || body.Data.CommissionEventCount != 3 || body.Data.HeadFeeEventCount != 2 || len(body.Data.Settlements) != 1 {
		t.Fatalf("unexpected settlement dry-run counts: %+v", body.Data)
	}
	if body.Data.Settlements[0].PayableCents != 5900 {
		t.Fatalf("expected dry-run payable 5900 cents, got %+v", body.Data.Settlements[0])
	}
	var jobRunCount int64
	if err := db.Model(&model.AffiliateJobRun{}).Count(&jobRunCount).Error; err != nil {
		t.Fatalf("count job runs: %v", err)
	}
	var settlementCount int64
	if err := db.Model(&model.AffiliateSettlement{}).Count(&settlementCount).Error; err != nil {
		t.Fatalf("count settlements: %v", err)
	}
	if jobRunCount != 0 || settlementCount != 0 {
		t.Fatalf("expected dry-run to avoid persisted job runs and settlements, job_runs=%d settlements=%d", jobRunCount, settlementCount)
	}
}

func TestAdminVoidAffiliateSettlement(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	ruleSet := seedPublishedAffiliateRuleSetForAdminSettlement(t, db, "admin-settlement-void")
	seedAffiliateCommissionEventForList(t, db, model.AffiliateCommissionEvent{
		AffiliateUserId:  100,
		DownstreamUserId: 200,
		RuleSetId:        ruleSet.Id,
		Status:           model.AffiliateEventStatusPending,
		Kind:             service.AffiliateCommissionEventKindAccrual,
		PeriodStart:      1000,
		PeriodEnd:        2000,
		CommissionCents:  1500,
	})

	generated := performAdminGenerateAffiliateSettlementsRequest(t, `{
		"rule_set_id":`+strconv.Itoa(ruleSet.Id)+`,
		"period_start":1000,
		"period_end":2000
	}`)
	if !generated.Success || len(generated.Data) != 1 {
		t.Fatalf("expected one generated settlement, got %+v", generated)
	}

	voided := performAdminSettlementStatusRequest(t, http.MethodPatch, "/api/affiliate/admin/settlements/"+strconv.Itoa(generated.Data[0].Id)+"/void", generated.Data[0].Id, "void", `{"reason":"invalid"}`)
	if !voided.Success || voided.Data.Status != model.AffiliateSettlementStatusVoid {
		t.Fatalf("expected void settlement, got %+v", voided)
	}
	var event model.AffiliateCommissionEvent
	if err := db.Where("settlement_id = ?", generated.Data[0].Id).First(&event).Error; err != nil {
		t.Fatalf("load linked event: %v", err)
	}
	if event.Status != model.AffiliateEventStatusVoid {
		t.Fatalf("expected linked commission event void, got %+v", event)
	}
}

func TestAdminSearchAffiliateInviterCandidates(t *testing.T) {
	db := newAffiliateInviterControllerTestDB(t)
	seedAffiliateInviterControllerUser(t, db, model.User{Id: 100, Username: "alpha"})
	seedAffiliateInviterControllerUser(t, db, model.User{Id: 200, Username: "bravo"})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/admin/inviter-candidates?keyword=bra&p=1&page_size=10", nil)
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminSearchAffiliateInviterCandidates(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateInviterCandidatesTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success || body.Data.Total != 1 || len(body.Data.Items) != 1 || body.Data.Items[0].Id != 200 {
		t.Fatalf("unexpected candidates response: %+v", body)
	}
}

func TestAdminPreviewAndUpdateAffiliateInviter(t *testing.T) {
	db := newAffiliateInviterControllerTestDB(t)
	seedAffiliateInviterControllerUser(t, db, model.User{Id: 100, Username: "new-affiliate", AffCode: "AFF100"})
	seedAffiliateInviterControllerUser(t, db, model.User{Id: 200, Username: "old-affiliate", AffCode: "AFF200"})
	seedAffiliateInviterControllerUser(t, db, model.User{Id: 300, Username: "target", InviterId: 200})
	seedAffiliateInviterControllerProfile(t, db, 100, 1)
	seedAffiliateInviterControllerProfile(t, db, 200, 1)
	seedAffiliateInviterControllerRelation(t, db, 200, 300, 1)

	previewRecorder := httptest.NewRecorder()
	previewCtx, _ := gin.CreateTestContext(previewRecorder)
	previewCtx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/admin/users/300/inviter/preview?new_inviter_user_id=100", nil)
	previewCtx.Params = gin.Params{{Key: "user_id", Value: "300"}}
	previewCtx.Set("id", 1)
	previewCtx.Set("role", common.RoleAdminUser)

	AdminPreviewAffiliateInviterChange(previewCtx)

	if previewRecorder.Code != http.StatusOK {
		t.Fatalf("expected preview status 200, got %d body=%s", previewRecorder.Code, previewRecorder.Body.String())
	}
	var previewBody affiliateInviterChangePreviewTestResponse
	if err := json.Unmarshal(previewRecorder.Body.Bytes(), &previewBody); err != nil {
		t.Fatalf("unmarshal preview response: %v", err)
	}
	if !previewBody.Success || previewBody.Data.CurrentInviterUserId != 200 || previewBody.Data.NewInviterUserId != 100 {
		t.Fatalf("unexpected preview response: %+v", previewBody)
	}

	updateRecorder := httptest.NewRecorder()
	updateCtx, _ := gin.CreateTestContext(updateRecorder)
	updateCtx.Request = httptest.NewRequest(http.MethodPatch, "/api/affiliate/admin/users/300/inviter", bytes.NewBufferString(`{
		"new_inviter_user_id":100,
		"reason":"manual correction"
	}`))
	updateCtx.Params = gin.Params{{Key: "user_id", Value: "300"}}
	updateCtx.Set("id", 9)
	updateCtx.Set("role", common.RoleAdminUser)

	AdminUpdateAffiliateInviter(updateCtx)

	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("expected update status 200, got %d body=%s", updateRecorder.Code, updateRecorder.Body.String())
	}
	var updateBody affiliateInviterChangePreviewTestResponse
	if err := json.Unmarshal(updateRecorder.Body.Bytes(), &updateBody); err != nil {
		t.Fatalf("unmarshal update response: %v", err)
	}
	if !updateBody.Success || updateBody.Data.CurrentInviterUserId != 200 || updateBody.Data.NewInviterUserId != 100 {
		t.Fatalf("unexpected update response: %+v", updateBody)
	}

	var user model.User
	if err := db.First(&user, 300).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	if user.InviterId != 100 {
		t.Fatalf("expected inviter_id updated to 100, got %+v", user)
	}
	var audit model.AffiliateAuditLog
	if err := db.Where("target_user_id = ? AND action = ?", 300, service.AffiliateAuditActionUpdateInviter).First(&audit).Error; err != nil {
		t.Fatalf("load audit: %v", err)
	}
	if audit.ActorUserId != 9 || audit.Reason != "manual correction" {
		t.Fatalf("unexpected audit: %+v", audit)
	}
}

func TestAffiliateAdminRoutesRequireLogin(t *testing.T) {
	router := newAffiliateAdminRouteTestRouter(t, common.RoleAdminUser)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/profiles", bytes.NewBufferString(`{
		"user_id":701,
		"level":1
	}`))
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestAffiliateAdminRoutesRejectCommonUser(t *testing.T) {
	router := newAffiliateAdminRouteTestRouter(t, common.RoleCommonUser)

	loginRecorder := httptest.NewRecorder()
	loginRequest := httptest.NewRequest(http.MethodGet, "/login", nil)
	router.ServeHTTP(loginRecorder, loginRequest)
	if loginRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected login status 204, got %d body=%s", loginRecorder.Code, loginRecorder.Body.String())
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/profiles", bytes.NewBufferString(`{
		"user_id":702,
		"level":1
	}`))
	request.Header.Set("New-Api-User", "10")
	for _, loginCookie := range loginRecorder.Result().Cookies() {
		request.AddCookie(loginCookie)
	}
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateStatusTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body.Success {
		t.Fatalf("expected insufficient privilege response, got body=%s", recorder.Body.String())
	}
}

func TestAffiliateInviterAdminRouteRejectsCommonUser(t *testing.T) {
	router := newAffiliateAdminRouteTestRouter(t, common.RoleCommonUser)

	loginRecorder := httptest.NewRecorder()
	loginRequest := httptest.NewRequest(http.MethodGet, "/login", nil)
	router.ServeHTTP(loginRecorder, loginRequest)
	if loginRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected login status 204, got %d body=%s", loginRecorder.Code, loginRecorder.Body.String())
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/api/affiliate/admin/users/300/inviter", bytes.NewBufferString(`{
		"new_inviter_user_id":100
	}`))
	request.Header.Set("New-Api-User", "10")
	for _, loginCookie := range loginRecorder.Result().Cookies() {
		request.AddCookie(loginCookie)
	}
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateStatusTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body.Success {
		t.Fatalf("expected insufficient privilege response, got body=%s", recorder.Body.String())
	}
}

func TestGetAffiliateScopedLogsFiltersScopeAndRedactsSensitiveFields(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	seedAffiliateRelation(t, db, 100, 200, 1, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 300, 2, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 400, 3, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 500, 1, model.AffiliateProfileStatusDisabled)
	seedAffiliateLog(t, db, model.Log{UserId: 200, Username: "level2", CreatedAt: 20, Type: model.LogTypeConsume, ModelName: "gpt-4", Group: "default", ChannelId: 9, ChannelName: "secret-channel", TokenId: 88, TokenName: "secret-token", Ip: "127.0.0.1", RequestId: "req-secret", UpstreamRequestId: "upstream-secret", Other: `{"admin_info":{"ip":"secret"},"stream_status":"secret","safe":"kept"}`})
	seedAffiliateLog(t, db, model.Log{UserId: 300, Username: "downstream", CreatedAt: 30, Type: model.LogTypeConsume, ModelName: "gpt-4", Group: "default", ChannelId: 10, TokenId: 89, TokenName: "another-token", Ip: "127.0.0.2", RequestId: "req-secret-2", UpstreamRequestId: "upstream-secret-2", Other: `{"safe":"kept"}`})
	seedAffiliateLog(t, db, model.Log{UserId: 400, Username: "too-deep", CreatedAt: 40, Type: model.LogTypeConsume, ModelName: "gpt-4", Group: "default"})
	seedAffiliateLog(t, db, model.Log{UserId: 500, Username: "disabled", CreatedAt: 50, Type: model.LogTypeConsume, ModelName: "gpt-4", Group: "default"})
	seedAffiliateLog(t, db, model.Log{UserId: 200, Username: "wrong-group", CreatedAt: 60, Type: model.LogTypeConsume, ModelName: "gpt-4", Group: "vip"})

	body := performAffiliateScopedLogsRequest(t, "/api/affiliate/logs?type=2&model_name=gpt-4&group=default&p=1&page_size=10", service.AffiliateScope{
		Kind:           service.AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})

	if !body.Success {
		t.Fatalf("expected success response: %+v", body)
	}
	if body.Data.Total != 2 {
		t.Fatalf("expected total 2, got %+v", body.Data)
	}
	if len(body.Data.Items) != 2 {
		t.Fatalf("expected 2 logs, got %+v", body.Data.Items)
	}
	if body.Data.Items[0].UserId != 300 || body.Data.Items[1].UserId != 200 {
		t.Fatalf("unexpected scoped log order/items: %+v", body.Data.Items)
	}
	for _, item := range body.Data.Items {
		if item.Username == "" {
			t.Fatalf("scoped log should keep authorized user display fields: %+v", item)
		}
		if item.ChannelId != 0 || item.ChannelName != "" || item.TokenId != 0 || item.TokenName != "" {
			t.Fatalf("scoped log leaked channel/token fields: %+v", item)
		}
		if item.Ip != "" || item.RequestId != "" || item.UpstreamRequestId != "" {
			t.Fatalf("scoped log leaked request identity fields: %+v", item)
		}
		if item.Other == "" || item.Other == "null" {
			t.Fatalf("expected sanitized other to preserve safe fields: %+v", item)
		}
		if item.Other == `{"admin_info":{"ip":"secret"},"stream_status":"secret","safe":"kept"}` {
			t.Fatalf("expected admin fields to be removed from other: %+v", item)
		}
	}
}

func TestGetAffiliateScopedLogsFallsBackToLegacyInviterTree(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	seedAffiliateControllerUser(t, db, model.User{Id: 100, Username: "level-one"})
	seedAffiliateControllerUser(t, db, model.User{Id: 200, Username: "level-two", InviterId: 100})
	seedAffiliateControllerUser(t, db, model.User{Id: 300, Username: "downstream", InviterId: 200})
	seedAffiliateControllerUser(t, db, model.User{Id: 400, Username: "too-deep", InviterId: 300})
	seedAffiliateControllerProfile(t, db, 100, 1, 0)
	seedAffiliateControllerProfile(t, db, 200, 2, 100)
	seedAffiliateLog(t, db, model.Log{UserId: 200, Username: "level-two", CreatedAt: 20, Type: model.LogTypeConsume, ModelName: "gpt-4"})
	seedAffiliateLog(t, db, model.Log{UserId: 300, Username: "downstream", CreatedAt: 30, Type: model.LogTypeConsume, ModelName: "gpt-4"})
	seedAffiliateLog(t, db, model.Log{UserId: 400, Username: "too-deep", CreatedAt: 40, Type: model.LogTypeConsume, ModelName: "gpt-4"})

	body := performAffiliateScopedLogsRequest(t, "/api/affiliate/logs?type=2&p=1&page_size=10", service.AffiliateScope{
		Kind:           service.AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})

	if !body.Success {
		t.Fatalf("expected success response: %+v", body)
	}
	if body.Data.Total != 2 || len(body.Data.Items) != 2 {
		t.Fatalf("expected legacy inviter descendants at depth 1 and 2, got %+v", body.Data)
	}
	if body.Data.Items[0].UserId != 300 || body.Data.Items[1].UserId != 200 {
		t.Fatalf("unexpected legacy scoped log order/items: %+v", body.Data.Items)
	}
}

func TestGetAffiliateScopedLogsFiltersByTokenName(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	seedAffiliateRelation(t, db, 100, 200, 1, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 300, 2, model.AffiliateProfileStatusActive)
	seedAffiliateLog(t, db, model.Log{UserId: 200, Username: "level2", CreatedAt: 20, Type: model.LogTypeConsume, TokenName: "team-token"})
	seedAffiliateLog(t, db, model.Log{UserId: 300, Username: "downstream", CreatedAt: 30, Type: model.LogTypeConsume, TokenName: "selected-token"})

	body := performAffiliateScopedLogsRequest(t, "/api/affiliate/logs?type=2&token_name=selected-token&p=1&page_size=10", service.AffiliateScope{
		Kind:           service.AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})

	if !body.Success {
		t.Fatalf("expected success response: %+v", body)
	}
	if body.Data.Total != 1 || len(body.Data.Items) != 1 || body.Data.Items[0].UserId != 300 {
		t.Fatalf("expected only selected token log, got %+v", body.Data)
	}
}

func TestGetAffiliateTeamTreeReturnsScopedLegacyTree(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	seedAffiliateControllerUser(t, db, model.User{Id: 100, Username: "level-one"})
	seedAffiliateControllerUser(t, db, model.User{Id: 200, Username: "level-two", InviterId: 100})
	seedAffiliateControllerUser(t, db, model.User{Id: 300, Username: "downstream", InviterId: 200})
	seedAffiliateControllerUser(t, db, model.User{Id: 400, Username: "too-deep", InviterId: 300})
	seedAffiliateControllerProfile(t, db, 100, 1, 0)
	seedAffiliateControllerProfile(t, db, 200, 2, 100)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/team", nil)
	ctx.Set("affiliate_scope", service.AffiliateScope{
		Kind:           service.AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})

	GetAffiliateTeamTree(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateTeamTreeTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success {
		t.Fatalf("expected success response: %+v", body)
	}
	if len(body.Data.Items) != 1 || body.Data.Items[0].UserId != 200 {
		t.Fatalf("expected direct level-two child, got %+v", body.Data.Items)
	}
	if len(body.Data.Items[0].Children) != 1 || body.Data.Items[0].Children[0].UserId != 300 {
		t.Fatalf("expected level-two downstream child, got %+v", body.Data.Items[0])
	}
}

func TestGetAffiliateScopedLogsRejectsUserOutsideScope(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	seedAffiliateRelation(t, db, 100, 200, 1, model.AffiliateProfileStatusActive)

	body := performAffiliateScopedLogsRequest(t, "/api/affiliate/logs?user_id=999", service.AffiliateScope{
		Kind:           service.AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})

	if body.Success {
		t.Fatalf("expected outside user filter to be rejected, got %+v", body)
	}
}

func TestGetAffiliateScopedLogsSupportsSecondaryAffiliateAndRequestStatusFilters(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	seedAffiliateRelation(t, db, 100, 200, 1, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 201, 1, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 300, 2, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 400, 2, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 200, 300, 1, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 201, 400, 1, model.AffiliateProfileStatusActive)
	seedAffiliateLog(t, db, model.Log{UserId: 200, Username: "second", CreatedAt: 20, Type: model.LogTypeConsume, ModelName: "gpt-4", Group: "default"})
	seedAffiliateLog(t, db, model.Log{UserId: 300, Username: "second-downstream", CreatedAt: 30, Type: model.LogTypeError, ModelName: "gpt-4", Group: "default"})
	seedAffiliateLog(t, db, model.Log{UserId: 400, Username: "other-second-downstream", CreatedAt: 30, Type: model.LogTypeError, ModelName: "gpt-4", Group: "default"})
	seedAffiliateLog(t, db, model.Log{UserId: 300, Username: "old-second-downstream", CreatedAt: 10, Type: model.LogTypeError, ModelName: "gpt-4", Group: "default"})

	body := performAffiliateScopedLogsRequest(t, "/api/affiliate/logs?second_level_user_id=200&request_status=error&start_timestamp=25&end_timestamp=35&p=1&page_size=10", service.AffiliateScope{
		Kind:           service.AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})

	if !body.Success {
		t.Fatalf("expected success response: %+v", body)
	}
	if body.Data.Total != 1 || len(body.Data.Items) != 1 || body.Data.Items[0].UserId != 300 {
		t.Fatalf("expected only second-level downstream error log, got %+v", body.Data)
	}
}

func TestExportAffiliateScopedLogsReturnsScopedRmbCsv(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	originalQuotaPerUnit := common.QuotaPerUnit
	originalUSDExchangeRate := operation_setting.USDExchangeRate
	t.Cleanup(func() {
		common.QuotaPerUnit = originalQuotaPerUnit
		operation_setting.USDExchangeRate = originalUSDExchangeRate
	})
	common.QuotaPerUnit = 1000
	operation_setting.USDExchangeRate = 7

	seedAffiliateRelation(t, db, 100, 200, 1, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 300, 2, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 400, 3, model.AffiliateProfileStatusActive)
	seedAffiliateLog(t, db, model.Log{UserId: 200, Username: "level2", CreatedAt: 20, Type: model.LogTypeConsume, ModelName: "gpt-4", Group: "default", Quota: 2500, ChannelId: 9, ChannelName: "secret-channel", TokenId: 88, TokenName: "secret-token", Ip: "127.0.0.1", RequestId: "req-secret", UpstreamRequestId: "upstream-secret", Other: `{"admin_info":{"ip":"secret"},"safe":"kept"}`})
	seedAffiliateLog(t, db, model.Log{UserId: 300, Username: "downstream", CreatedAt: 30, Type: model.LogTypeConsume, ModelName: "gpt-4", Group: "default", Quota: 1})
	seedAffiliateLog(t, db, model.Log{UserId: 400, Username: "too-deep", CreatedAt: 40, Type: model.LogTypeConsume, ModelName: "gpt-4", Group: "default", Quota: 9000})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/logs/export?type=2&model_name=gpt-4&group=default&p=1&page_size=1", nil)
	ctx.Set("affiliate_scope", service.AffiliateScope{
		Kind:           service.AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})

	ExportAffiliateScopedLogs(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Header().Get("Content-Type"), "text/csv") {
		t.Fatalf("expected csv content type, got %q", recorder.Header().Get("Content-Type"))
	}
	body := recorder.Body.String()
	lines := strings.Split(strings.TrimSpace(body), "\n")
	if len(lines) != 3 {
		t.Fatalf("expected header plus 2 scoped rows, got %d lines body=%s", len(lines), body)
	}
	if lines[0] != "time,user_id,username,type,model,group,consumption_rmb,raw_quota" {
		t.Fatalf("unexpected csv header: %q", lines[0])
	}
	if !strings.Contains(lines[1], ",300,downstream,2,gpt-4,default,¥0.007,1") {
		t.Fatalf("expected newest scoped row with minimum RMB display, got %q", lines[1])
	}
	if !strings.Contains(lines[2], ",200,level2,2,gpt-4,default,¥17.5,2500") {
		t.Fatalf("expected older scoped row with RMB conversion, got %q", lines[2])
	}
	for _, forbidden := range []string{"secret-channel", "secret-token", "127.0.0.1", "req-secret", "upstream-secret"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("scoped export leaked sensitive field %q in body=%s", forbidden, body)
		}
	}
}

func TestBuildAffiliateScopedLogsCsvKeepsTinyNegativeRefundVisible(t *testing.T) {
	csv := buildAffiliateScopedLogsCsv([]*model.Log{
		{
			UserId:    200,
			CreatedAt: 1780416000,
			Type:      model.LogTypeRefund,
			ModelName: "gpt-4",
			Group:     "default",
			Quota:     -1,
		},
	}, 10000000, 1)

	if !strings.Contains(csv, ",200,,6,gpt-4,default,-¥0.000001,-1") {
		t.Fatalf("expected tiny negative refund RMB to stay visible, got %s", csv)
	}
}

func TestGetAffiliateCommissionsFiltersOwnScope(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	seedAffiliateCommissionEventForList(t, db, model.AffiliateCommissionEvent{
		AffiliateUserId:         100,
		DownstreamUserId:        200,
		RuleSetId:               1,
		Status:                  model.AffiliateEventStatusReady,
		Kind:                    service.AffiliateCommissionEventKindAccrual,
		PeriodStart:             1000,
		PeriodEnd:               2000,
		CommissionCents:         1234,
		NetPaidConsumptionCents: 10000,
	})
	seedAffiliateCommissionEventForList(t, db, model.AffiliateCommissionEvent{
		AffiliateUserId:         999,
		DownstreamUserId:        888,
		RuleSetId:               1,
		Status:                  model.AffiliateEventStatusReady,
		Kind:                    service.AffiliateCommissionEventKindAccrual,
		PeriodStart:             1000,
		PeriodEnd:               2000,
		CommissionCents:         9999,
		NetPaidConsumptionCents: 99999,
	})

	body := performAffiliateCommissionsRequest(t, "/api/affiliate/commissions?status=ready&p=1&page_size=10", service.AffiliateScope{
		Kind:           service.AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})

	if !body.Success || body.Data.Total != 1 || len(body.Data.Items) != 1 {
		t.Fatalf("expected one scoped commission event, got %+v", body)
	}
	item := body.Data.Items[0]
	if item.AffiliateUserId != 100 || item.DownstreamUserId != 200 || item.CommissionCents != 1234 {
		t.Fatalf("unexpected commission event item: %+v", item)
	}
}

func TestGetAffiliateSettlementsFiltersOwnScopeAndStatus(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	seedAffiliateSettlementForList(t, db, model.AffiliateSettlement{
		AffiliateUserId: 100,
		RuleSetId:       1,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Status:          model.AffiliateSettlementStatusPaid,
		CommissionCents: 1000,
		HeadFeeCents:    500,
		PayableCents:    1500,
	})
	seedAffiliateSettlementForList(t, db, model.AffiliateSettlement{
		AffiliateUserId: 100,
		RuleSetId:       1,
		PeriodStart:     2001,
		PeriodEnd:       3000,
		Status:          model.AffiliateSettlementStatusDraft,
		PayableCents:    2000,
	})
	seedAffiliateSettlementForList(t, db, model.AffiliateSettlement{
		AffiliateUserId: 999,
		RuleSetId:       1,
		PeriodStart:     1000,
		PeriodEnd:       2000,
		Status:          model.AffiliateSettlementStatusPaid,
		PayableCents:    9999,
	})

	body := performAffiliateSettlementsRequest(t, "/api/affiliate/settlements?status=paid&p=1&page_size=10", service.AffiliateScope{
		Kind:           service.AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})

	if !body.Success || body.Data.Total != 1 || len(body.Data.Items) != 1 {
		t.Fatalf("expected one scoped paid settlement, got %+v", body)
	}
	item := body.Data.Items[0]
	if item.AffiliateUserId != 100 || item.Status != model.AffiliateSettlementStatusPaid || item.PayableCents != 1500 {
		t.Fatalf("unexpected settlement item: %+v", item)
	}
}

func TestGetAffiliateSummaryReturnsScopedDashboard(t *testing.T) {
	db := newAffiliateLogsControllerTestDB(t)
	seedAffiliateRelation(t, db, 100, 200, 1, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 300, 2, model.AffiliateProfileStatusActive)
	seedAffiliateRelation(t, db, 100, 400, 3, model.AffiliateProfileStatusActive)
	if err := db.Create(&[]model.AffiliateInviteEvent{
		{InviteeUserId: 200, InviterUserId: 100, InviteSource: service.AffiliateInviteSourceAffiliate, CreatedAt: 20},
		{InviteeUserId: 300, InviterUserId: 200, InviteSource: service.AffiliateInviteSourceAffiliate, CreatedAt: 30},
		{InviteeUserId: 400, InviterUserId: 100, InviteSource: service.AffiliateInviteSourceAffiliate, CreatedAt: 40},
	}).Error; err != nil {
		t.Fatalf("seed invite events: %v", err)
	}
	seedAffiliateLog(t, db, model.Log{UserId: 200, CreatedAt: 20, Type: model.LogTypeConsume, Quota: 1000, Other: `{"quota_source":"paid"}`})
	seedAffiliateLog(t, db, model.Log{UserId: 300, CreatedAt: 30, Type: model.LogTypeConsume, Quota: 2000, Other: `{"quota_source":"paid"}`})
	seedAffiliateLog(t, db, model.Log{UserId: 300, CreatedAt: 35, Type: model.LogTypeRefund, Quota: 500, Other: `{"quota_source":"paid"}`})
	seedAffiliateLog(t, db, model.Log{UserId: 400, CreatedAt: 40, Type: model.LogTypeConsume, Quota: 4000})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/summary?trend_start_timestamp=20&trend_end_timestamp=35", nil)
	ctx.Set("affiliate_scope", service.AffiliateScope{
		Kind:           service.AffiliateScopeAffiliate,
		UserId:         100,
		AffiliateLevel: 1,
		MaxDepth:       2,
	})

	GetAffiliateSummary(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateSummaryTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success {
		t.Fatalf("expected success response: %+v", body)
	}
	if body.Data.TeamUserCount != 2 || body.Data.EffectiveNewUserCount != 0 {
		t.Fatalf("unexpected team summary: %+v", body.Data)
	}
	if body.Data.NetConsumptionQuota != 2500 || body.Data.RuleStatus != "pending_rules" || body.Data.KPITierName != "待配置" {
		t.Fatalf("unexpected summary metrics: %+v", body.Data)
	}
	if len(body.Data.DailyTrends) != 1 || body.Data.DailyTrends[0].PeriodStart != 20 || body.Data.DailyTrends[0].PeriodEnd != 35 || body.Data.DailyTrends[0].NetConsumptionQuota != 2500 {
		t.Fatalf("unexpected trend metrics: %+v", body.Data.DailyTrends)
	}
}

type affiliateStatusTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Enabled           bool                   `json:"enabled"`
		Available         bool                   `json:"available"`
		UnavailableReason string                 `json:"unavailable_reason"`
		Message           string                 `json:"message"`
		Scope             service.AffiliateScope `json:"scope"`
	} `json:"data"`
}

type affiliateLogsTestResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Total int         `json:"total"`
		Items []model.Log `json:"items"`
	} `json:"data"`
}

type affiliateSummaryTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		TeamUserCount         int    `json:"team_user_count"`
		EffectiveNewUserCount int    `json:"effective_new_user_count"`
		NetConsumptionQuota   int64  `json:"net_consumption_quota"`
		RuleStatus            string `json:"rule_status"`
		KPITierName           string `json:"kpi_tier_name"`
		DailyTrends           []struct {
			PeriodStart         int64 `json:"period_start"`
			PeriodEnd           int64 `json:"period_end"`
			NetConsumptionQuota int64 `json:"net_consumption_quota"`
		} `json:"daily_trends"`
	} `json:"data"`
}

type affiliateTeamTreeTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Items []service.AffiliateTeamTreeNode `json:"items"`
	} `json:"data"`
}

type affiliateCommissionEventsTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Total int                              `json:"total"`
		Items []model.AffiliateCommissionEvent `json:"items"`
	} `json:"data"`
}

type affiliateSettlementsTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Total int                         `json:"total"`
		Items []model.AffiliateSettlement `json:"items"`
	} `json:"data"`
}

type affiliateSettlementListDirectTestResponse struct {
	Success bool                        `json:"success"`
	Data    []model.AffiliateSettlement `json:"data"`
}

type affiliateSettlementDirectTestResponse struct {
	Success bool                      `json:"success"`
	Data    model.AffiliateSettlement `json:"data"`
}

type affiliateCommissionDirectTestResponse struct {
	Success bool                           `json:"success"`
	Data    model.AffiliateCommissionEvent `json:"data"`
}

type affiliateCommissionRecomputeDirectTestResponse struct {
	Success bool                                       `json:"success"`
	Data    service.AffiliateCommissionRecomputeResult `json:"data"`
}

type affiliateSettlementRunDirectTestResponse struct {
	Success bool                                 `json:"success"`
	Data    service.AffiliateSettlementRunResult `json:"data"`
}

type affiliateProfilesListTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Total int `json:"total"`
		Items []struct {
			UserId       int    `json:"user_id"`
			Level        int    `json:"level"`
			Status       string `json:"status"`
			ParentUserId int    `json:"parent_user_id"`
		} `json:"items"`
	} `json:"data"`
}

type affiliateInviterCandidatesTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Total int          `json:"total"`
		Items []model.User `json:"items"`
	} `json:"data"`
}

type affiliateInviterChangePreviewTestResponse struct {
	Success bool                                  `json:"success"`
	Data    service.AffiliateInviterChangePreview `json:"data"`
}

func newAffiliateControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(model.AffiliateSidecarModels()...); err != nil {
		t.Fatalf("migrate affiliate sidecar models: %v", err)
	}
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
	})
	return db
}

func newAffiliateInviterControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(append(model.AffiliateSidecarModels(), &model.User{})...); err != nil {
		t.Fatalf("migrate affiliate inviter models: %v", err)
	}
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
	})
	return db
}

func newAffiliateLogsControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	name := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := append(model.AffiliateSidecarModels(), model.QuotaSourceSidecarModels()...)
	models = append(models, &model.Log{}, &model.User{})
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("migrate affiliate log models: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
	})
	return db
}

func performAffiliateScopedLogsRequest(t *testing.T, target string, scope service.AffiliateScope) affiliateLogsTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	ctx.Set("affiliate_scope", scope)

	GetAffiliateScopedLogs(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateLogsTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, recorder.Body.String())
	}
	return body
}

func performAdminGenerateAffiliateSettlementsRequest(t *testing.T, payload string) affiliateSettlementListDirectTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/settlements/generate", bytes.NewBufferString(payload))
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminGenerateAffiliateSettlements(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateSettlementListDirectTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, recorder.Body.String())
	}
	return body
}

func performAdminCreateAffiliateCommissionAdjustmentRequest(t *testing.T, payload string) affiliateCommissionDirectTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/commissions/adjust", bytes.NewBufferString(payload))
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminCreateAffiliateCommissionAdjustment(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateCommissionDirectTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, recorder.Body.String())
	}
	return body
}

func performAdminVoidAffiliateCommissionEventRequest(t *testing.T, eventId int, payload string) affiliateCommissionDirectTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPatch, "/api/affiliate/admin/commissions/"+strconv.Itoa(eventId)+"/void", bytes.NewBufferString(payload))
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(eventId)}}
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminVoidAffiliateCommissionEvent(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateCommissionDirectTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, recorder.Body.String())
	}
	return body
}

func performAdminRecomputeAffiliateCommissionsRequest(t *testing.T, payload string) affiliateCommissionRecomputeDirectTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/commissions/recompute", bytes.NewBufferString(payload))
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminRecomputeAffiliateCommissions(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateCommissionRecomputeDirectTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, recorder.Body.String())
	}
	return body
}

func performAdminRunAffiliateSettlementPipelineRequest(t *testing.T, payload string) affiliateSettlementRunDirectTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/settlement-runs", bytes.NewBufferString(payload))
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminRunAffiliateSettlementPipeline(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateSettlementRunDirectTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, recorder.Body.String())
	}
	return body
}

func performAdminSettlementStatusRequest(t *testing.T, method string, target string, settlementId int, action string, payload string) affiliateSettlementDirectTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, bytes.NewBufferString(payload))
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(settlementId)}}
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	switch action {
	case "freeze":
		AdminFreezeAffiliateSettlement(ctx)
	case "void":
		AdminVoidAffiliateSettlement(ctx)
	case "pay":
		AdminMarkAffiliateSettlementPaid(ctx)
	default:
		t.Fatalf("unknown settlement action %q", action)
	}

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateSettlementDirectTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, recorder.Body.String())
	}
	return body
}

func performAffiliateCommissionsRequest(t *testing.T, target string, scope service.AffiliateScope) affiliateCommissionEventsTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	ctx.Set("affiliate_scope", scope)

	GetAffiliateCommissions(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateCommissionEventsTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, recorder.Body.String())
	}
	return body
}

func performAffiliateSettlementsRequest(t *testing.T, target string, scope service.AffiliateScope) affiliateSettlementsTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, target, nil)
	ctx.Set("affiliate_scope", scope)

	GetAffiliateSettlements(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateSettlementsTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, recorder.Body.String())
	}
	return body
}

func seedAffiliateRelation(t *testing.T, db *gorm.DB, ancestor int, descendant int, depth int, status string) {
	t.Helper()
	if err := db.Create(&model.AffiliateRelation{
		AncestorUserId:   ancestor,
		DescendantUserId: descendant,
		Depth:            depth,
		Status:           status,
		EffectiveAt:      100,
	}).Error; err != nil {
		t.Fatalf("seed relation: %v", err)
	}
}

func seedAffiliateControllerUser(t *testing.T, db *gorm.DB, user model.User) {
	t.Helper()
	if user.Username == "" {
		user.Username = "user" + strconv.Itoa(user.Id)
	}
	if user.AffCode == "" {
		user.AffCode = "AFF" + strconv.Itoa(user.Id)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
}

func seedAffiliateControllerProfile(t *testing.T, db *gorm.DB, userId int, level int, parentUserId int) {
	t.Helper()
	if err := db.Create(&model.AffiliateProfile{
		UserId:       userId,
		Level:        level,
		ParentUserId: parentUserId,
		Status:       model.AffiliateProfileStatusActive,
	}).Error; err != nil {
		t.Fatalf("seed profile: %v", err)
	}
}

func seedAffiliateLog(t *testing.T, db *gorm.DB, log model.Log) {
	t.Helper()
	if err := db.Create(&log).Error; err != nil {
		t.Fatalf("seed log: %v", err)
	}
}

func seedAffiliateCommissionEventForList(t *testing.T, db *gorm.DB, event model.AffiliateCommissionEvent) {
	t.Helper()
	if err := db.Create(&event).Error; err != nil {
		t.Fatalf("seed commission event: %v", err)
	}
}

func seedAffiliateSettlementForList(t *testing.T, db *gorm.DB, settlement model.AffiliateSettlement) {
	t.Helper()
	if err := db.Create(&settlement).Error; err != nil {
		t.Fatalf("seed settlement: %v", err)
	}
}

func seedAffiliateInviterControllerUser(t *testing.T, db *gorm.DB, user model.User) {
	t.Helper()
	if user.Password == "" {
		user.Password = "hashed"
	}
	if user.AffCode == "" {
		user.AffCode = "AFF" + strconv.Itoa(user.Id)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed inviter user: %v", err)
	}
}

func seedAffiliateInviterControllerProfile(t *testing.T, db *gorm.DB, userId int, level int) {
	t.Helper()
	if err := db.Create(&model.AffiliateProfile{
		UserId: userId,
		Level:  level,
		Status: model.AffiliateProfileStatusActive,
	}).Error; err != nil {
		t.Fatalf("seed inviter profile: %v", err)
	}
}

func seedAffiliateInviterControllerRelation(t *testing.T, db *gorm.DB, ancestor int, descendant int, depth int) {
	t.Helper()
	if err := db.Create(&model.AffiliateRelation{
		AncestorUserId:   ancestor,
		DescendantUserId: descendant,
		Depth:            depth,
		DirectInviterId:  ancestor,
		Status:           model.AffiliateProfileStatusActive,
		Source:           service.AffiliateInviteSourceAffiliate,
		EffectiveAt:      100,
	}).Error; err != nil {
		t.Fatalf("seed inviter relation: %v", err)
	}
}

func seedPublishedAffiliateRuleSetForAdminSettlement(t *testing.T, db *gorm.DB, version string) model.AffiliateRuleSet {
	t.Helper()
	ruleSet := model.AffiliateRuleSet{
		Version:     version,
		Name:        version,
		Status:      model.AffiliateRuleSetStatusPublished,
		PublishedAt: 900,
	}
	if err := db.Create(&ruleSet).Error; err != nil {
		t.Fatalf("seed published rule set: %v", err)
	}
	return ruleSet
}

func seedPublishedAffiliateRuleSetForAdminRun(t *testing.T, db *gorm.DB, version string) model.AffiliateRuleSet {
	t.Helper()
	input := newAffiliateRuleSetDraftRequest(version)
	input.KPITiers = []service.AffiliateKPITierInput{
		{AffiliateLevel: 1, Code: "base", Name: "Base", MinEffectiveNewUsers: 1, MinNetPaidAmountCents: 100, CoefficientBps: 10000, MaxGiftOnlyRatioBps: 10000, MaxAbnormalRatioBps: 10000, MinSecondPaymentRatioBps: 0, SortOrder: 1},
		{AffiliateLevel: 1, Code: "growth", Name: "Growth", MinEffectiveNewUsers: 2, MinNetPaidAmountCents: 500, CoefficientBps: 15000, MaxGiftOnlyRatioBps: 2500, MaxAbnormalRatioBps: 2500, MinSecondPaymentRatioBps: 5000, SortOrder: 2},
		{AffiliateLevel: 2, Code: "base", Name: "Base", MinEffectiveNewUsers: 1, MinNetPaidAmountCents: 100, CoefficientBps: 10000, MaxGiftOnlyRatioBps: 10000, MaxAbnormalRatioBps: 10000, MinSecondPaymentRatioBps: 0, SortOrder: 1},
	}
	input.HeadFeeRules = []service.AffiliateHeadFeeRuleInput{
		{AffiliateLevel: 1, KPITierCode: "base", AmountCents: 1000, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 100, QualificationDays: 14, UnlockDelayDays: 7},
		{AffiliateLevel: 1, KPITierCode: "growth", AmountCents: 2500, FirstRechargeMinCents: 1000, PeriodNetPaidMinCents: 1500, QualificationDays: 14, UnlockDelayDays: 7},
		{AffiliateLevel: 2, KPITierCode: "base", AmountCents: 500, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 100, QualificationDays: 14, UnlockDelayDays: 7},
	}
	ruleSet, err := service.SaveAffiliateRuleSetDraft(db, input)
	if err != nil {
		t.Fatalf("save admin run rule set: %v", err)
	}
	published, err := service.PublishAffiliateRuleSet(db, ruleSet.Id, service.AffiliateRuleSetStatusInput{
		ActorUserId: 1,
		Reason:      "publish admin run rules",
	})
	if err != nil {
		t.Fatalf("publish admin run rule set: %v", err)
	}
	return *published
}

func seedAffiliateRunInviteEvent(t *testing.T, db *gorm.DB, inviterUserId int, inviteeUserId int, createdAt int64) {
	t.Helper()
	if err := db.Create(&model.AffiliateInviteEvent{
		InviterUserId: inviterUserId,
		InviteeUserId: inviteeUserId,
		InviteSource:  service.AffiliateInviteSourceAffiliate,
		CreatedAt:     createdAt,
	}).Error; err != nil {
		t.Fatalf("seed run invite event: %v", err)
	}
}

func newAffiliateAdminRouteTestRouter(t *testing.T, role int) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("affiliate-admin-test"))))
	router.GET("/login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("username", "tester")
		session.Set("role", role)
		session.Set("id", 10)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		if err := session.Save(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false})
			return
		}
		c.Status(http.StatusNoContent)
	})
	adminRoute := router.Group("/api/affiliate/admin")
	adminRoute.Use(middleware.AdminAuth())
	{
		adminRoute.GET("/profiles", AdminListAffiliateProfiles)
		adminRoute.POST("/profiles", AdminSetAffiliateProfile)
		adminRoute.GET("/rule-sets", AdminListAffiliateRuleSets)
		adminRoute.POST("/rule-sets/draft", AdminSaveAffiliateRuleSetDraft)
		adminRoute.PATCH("/rule-sets/:id/publish", AdminPublishAffiliateRuleSet)
		adminRoute.PATCH("/rule-sets/:id/archive", AdminArchiveAffiliateRuleSet)
		adminRoute.GET("/commissions", AdminListAffiliateCommissions)
		adminRoute.POST("/commissions/adjust", AdminCreateAffiliateCommissionAdjustment)
		adminRoute.POST("/commissions/recompute", AdminRecomputeAffiliateCommissions)
		adminRoute.PATCH("/commissions/:id/void", AdminVoidAffiliateCommissionEvent)
		adminRoute.GET("/settlements", AdminListAffiliateSettlements)
		adminRoute.POST("/settlements/generate", AdminGenerateAffiliateSettlements)
		adminRoute.POST("/settlement-runs", AdminRunAffiliateSettlementPipeline)
		adminRoute.PATCH("/settlements/:id/freeze", AdminFreezeAffiliateSettlement)
		adminRoute.PATCH("/settlements/:id/void", AdminVoidAffiliateSettlement)
		adminRoute.PATCH("/settlements/:id/pay", AdminMarkAffiliateSettlementPaid)
		adminRoute.GET("/inviter-candidates", AdminSearchAffiliateInviterCandidates)
		adminRoute.GET("/users/:user_id/inviter/preview", AdminPreviewAffiliateInviterChange)
		adminRoute.PATCH("/users/:user_id/inviter", AdminUpdateAffiliateInviter)
	}
	return router
}
