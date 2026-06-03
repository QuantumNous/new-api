package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func TestAdminSaveAffiliateRuleSetDraft(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/rule-sets/draft", jsonBody(t, newAffiliateRuleSetDraftRequest("rules-api-2026-06")))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", 9)
	ctx.Set("role", common.RoleAdminUser)

	AdminSaveAffiliateRuleSetDraft(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateRuleSetTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success || body.Data.Status != model.AffiliateRuleSetStatusDraft || body.Data.UpdatedByUserId != 9 {
		t.Fatalf("unexpected save response: %+v", body)
	}
	assertAffiliateControllerChildCount(t, db, &model.AffiliateCommissionRule{}, body.Data.Id, 2)
}

func TestAdminGetAffiliateRuleSetDefaultSeed(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/admin/rule-sets/default-seed?version=api-default-seed", nil)
	ctx.Set("id", 9)
	ctx.Set("role", common.RoleAdminUser)

	AdminGetAffiliateRuleSetDefaultSeed(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateRuleSetSeedTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success || body.Data.Version != "api-default-seed" || body.Data.ActorUserId != 9 {
		t.Fatalf("unexpected default seed response: %+v", body)
	}
	if len(body.Data.CommissionTiers) != 10 || len(body.Data.KPITiers) != 8 || len(body.Data.HeadFeeRules) != 8 {
		t.Fatalf("unexpected default seed child counts: %+v", body.Data)
	}
	if body.Data.CommissionTiers[1].MinNetPaidAmountCents != 20000 ||
		body.Data.CommissionTiers[1].BaseRateBps != 1333 ||
		body.Data.HeadFeeRules[3].AmountCents != 200 {
		t.Fatalf("default seed should return converted cents and bps values: %+v", body.Data)
	}
}

func TestAdminPublishAffiliateRuleSetArchivesPreviousPublished(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	first, err := service.SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftRequest("rules-api-2026-07"))
	if err != nil {
		t.Fatalf("save first draft: %v", err)
	}
	if _, err := service.PublishAffiliateRuleSet(db, first.Id, service.AffiliateRuleSetStatusInput{ActorUserId: 1, Reason: "seed"}); err != nil {
		t.Fatalf("publish first draft: %v", err)
	}
	second, err := service.SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftRequest("rules-api-2026-08"))
	if err != nil {
		t.Fatalf("save second draft: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPatch, "/api/affiliate/admin/rule-sets/"+strconv.Itoa(second.Id)+"/publish", bytes.NewBufferString(`{"reason":"replace"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(second.Id)}}
	ctx.Set("id", 10)
	ctx.Set("role", common.RoleAdminUser)

	AdminPublishAffiliateRuleSet(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateRuleSetTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success || body.Data.Status != model.AffiliateRuleSetStatusPublished || body.Data.PublishedAt == 0 {
		t.Fatalf("unexpected publish response: %+v", body)
	}

	var archivedFirst model.AffiliateRuleSet
	if err := db.Where("id = ?", first.Id).First(&archivedFirst).Error; err != nil {
		t.Fatalf("query first rule set: %v", err)
	}
	if archivedFirst.Status != model.AffiliateRuleSetStatusArchived {
		t.Fatalf("expected first rule set archived, got %+v", archivedFirst)
	}
}

func TestAdminRollbackAffiliateRuleSetToDraft(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	source, err := service.SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftRequest("rules-api-rollback-source"))
	if err != nil {
		t.Fatalf("save rollback source draft: %v", err)
	}
	published, err := service.PublishAffiliateRuleSet(db, source.Id, service.AffiliateRuleSetStatusInput{ActorUserId: 1, Reason: "seed rollback"})
	if err != nil {
		t.Fatalf("publish rollback source: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/rule-sets/"+strconv.Itoa(published.Id)+"/rollback-draft", jsonBody(t, service.AffiliateRuleSetRollbackInput{
		Version: "rules-api-rollback-source-rollback",
		Name:    "API Rollback Draft",
		Reason:  "controller rollback",
	}))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(published.Id)}}
	ctx.Set("id", 11)
	ctx.Set("role", common.RoleAdminUser)

	AdminRollbackAffiliateRuleSetToDraft(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateRuleSetTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success || body.Data.Status != model.AffiliateRuleSetStatusDraft || body.Data.Version != "rules-api-rollback-source-rollback" {
		t.Fatalf("unexpected rollback response: %+v", body)
	}
	if body.Data.CreatedByUserId != 11 || body.Data.UpdatedByUserId != 11 {
		t.Fatalf("expected rollback actor from request context, got %+v", body.Data)
	}
	assertAffiliateControllerChildCount(t, db, &model.AffiliateCommissionRule{}, body.Data.Id, 2)
}

func TestAdminListAffiliateRuleSetsFiltersStatus(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	if _, err := service.SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftRequest("rules-api-2026-09")); err != nil {
		t.Fatalf("save draft: %v", err)
	}
	published, err := service.SaveAffiliateRuleSetDraft(db, newAffiliateRuleSetDraftRequest("rules-api-2026-10"))
	if err != nil {
		t.Fatalf("save published seed: %v", err)
	}
	if _, err := service.PublishAffiliateRuleSet(db, published.Id, service.AffiliateRuleSetStatusInput{ActorUserId: 1, Reason: "seed"}); err != nil {
		t.Fatalf("publish seed: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/admin/rule-sets?status=published&p=0&page_size=10", nil)
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminListAffiliateRuleSets(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateRuleSetsListTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success || body.Data.Total != 1 || len(body.Data.Items) != 1 || body.Data.Items[0].Status != model.AffiliateRuleSetStatusPublished {
		t.Fatalf("unexpected list response: %+v", body)
	}
}

func TestAffiliateRuleSetAdminRoutesRejectCommonUser(t *testing.T) {
	router := newAffiliateAdminRouteTestRouter(t, common.RoleCommonUser)

	loginRecorder := httptest.NewRecorder()
	loginRequest := httptest.NewRequest(http.MethodGet, "/login", nil)
	router.ServeHTTP(loginRecorder, loginRequest)
	if loginRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected login status 204, got %d body=%s", loginRecorder.Code, loginRecorder.Body.String())
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/rule-sets/draft", jsonBody(t, newAffiliateRuleSetDraftRequest("rules-api-unauthorized")))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("New-Api-User", "10")
	for _, loginCookie := range loginRecorder.Result().Cookies() {
		request.AddCookie(loginCookie)
	}
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateRuleSetTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body.Success {
		t.Fatalf("expected insufficient privilege response, got body=%s", recorder.Body.String())
	}
}

type affiliateRuleSetTestResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Data    model.AffiliateRuleSet `json:"data"`
}

type affiliateRuleSetSeedTestResponse struct {
	Success bool                               `json:"success"`
	Message string                             `json:"message"`
	Data    service.AffiliateRuleSetDraftInput `json:"data"`
}

type affiliateRuleSetsListTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Total int                      `json:"total"`
		Items []model.AffiliateRuleSet `json:"items"`
	} `json:"data"`
}

func newAffiliateRuleSetDraftRequest(version string) service.AffiliateRuleSetDraftInput {
	return service.AffiliateRuleSetDraftInput{
		Version:        version,
		Name:           "API Native Affiliate Rules",
		EffectiveStart: 1000,
		EffectiveEnd:   2000,
		Reason:         "api test",
		CommissionRules: []service.AffiliateCommissionRuleInput{
			{AffiliateLevel: 1, Name: "Level 1", DefaultRateBps: 1200, DefaultCapRateBps: 3000, MinSettlementAmountCents: 10000, AllowManualApprovalRate: true},
			{AffiliateLevel: 2, Name: "Level 2", DefaultRateBps: 600, DefaultCapRateBps: 1500, MinSettlementAmountCents: 10000},
		},
		CommissionTiers: []service.AffiliateCommissionTierInput{
			{AffiliateLevel: 1, MinNetPaidAmountCents: 0, MaxNetPaidAmountCents: 0, BaseRateBps: 1200, CapRateBps: 3000, SortOrder: 1},
			{AffiliateLevel: 2, MinNetPaidAmountCents: 0, MaxNetPaidAmountCents: 0, BaseRateBps: 600, CapRateBps: 1500, SortOrder: 1},
		},
		KPITiers: []service.AffiliateKPITierInput{
			{AffiliateLevel: 1, Code: "base", Name: "Base", MinEffectiveNewUsers: 1, MinNetPaidAmountCents: 10000, CoefficientBps: 10000, MaxGiftOnlyRatioBps: 5000, MaxAbnormalRatioBps: 1000, MinSecondPaymentRatioBps: 0, SortOrder: 1},
			{AffiliateLevel: 2, Code: "base", Name: "Base", MinEffectiveNewUsers: 1, MinNetPaidAmountCents: 10000, CoefficientBps: 10000, MaxGiftOnlyRatioBps: 5000, MaxAbnormalRatioBps: 1000, MinSecondPaymentRatioBps: 0, SortOrder: 1},
		},
		HeadFeeRules: []service.AffiliateHeadFeeRuleInput{
			{AffiliateLevel: 1, KPITierCode: "base", AmountCents: 1000, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 500, QualificationDays: 14, UnlockDelayDays: 7},
			{AffiliateLevel: 2, KPITierCode: "base", AmountCents: 500, FirstRechargeMinCents: 100, PeriodNetPaidMinCents: 500, QualificationDays: 14, UnlockDelayDays: 7},
		},
		RiskRules: []service.AffiliateRiskRuleInput{
			{AffiliateLevel: 1, Code: "default", MaxGiftOnlyRatioBps: 5000, MaxAbnormalRatioBps: 1000, MaxRefundRatioBps: 1000, MinSecondPaymentRatioBps: 0},
			{AffiliateLevel: 2, Code: "default", MaxGiftOnlyRatioBps: 5000, MaxAbnormalRatioBps: 1000, MaxRefundRatioBps: 1000, MinSecondPaymentRatioBps: 0},
		},
		SettlementConfig: service.AffiliateSettlementRuleConfig{
			Cycle:                    "monthly",
			FreezeDays:               7,
			MinSettlementAmountCents: 10000,
			ManualReviewEnabled:      true,
		},
	}
}

func jsonBody(t *testing.T, value interface{}) *bytes.Buffer {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	return bytes.NewBuffer(body)
}

func assertAffiliateControllerChildCount(t *testing.T, db *gorm.DB, modelValue interface{}, ruleSetId int, want int64) {
	t.Helper()
	var count int64
	if err := db.Model(modelValue).Where("rule_set_id = ?", ruleSetId).Count(&count).Error; err != nil {
		t.Fatalf("count child rows for rule set %d: %v", ruleSetId, err)
	}
	if count != want {
		t.Fatalf("expected %d child rows for rule set %d, got %d", want, ruleSetId, count)
	}
}
