package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestRecordAffiliateRegistrationAttributionStoresEventAndRelation(t *testing.T) {
	db := newAffiliateRegistrationAttributionTestDB(t)
	common.AffiliateEnabled = true
	seedAffiliateInviter(t, db, 101, "AFF101")

	ctx, err := resolveAffiliateInviteContextForRegistration(db, affiliateRegistrationAttributionInput{
		InviteCode:     "AFF101",
		RegisterMethod: service.AffiliateRegisterMethodPassword,
	})
	if err != nil {
		t.Fatalf("resolveAffiliateInviteContextForRegistration returned error: %v", err)
	}
	if ctx.Source != service.AffiliateInviteSourceAffiliate || ctx.InviterUserId != 101 {
		t.Fatalf("unexpected invite context: %+v", ctx)
	}

	event, err := recordAffiliateInviteAttributionForRegistration(db, ctx, affiliateRegistrationAttributionInput{
		InviteeUserId:  201,
		RegisterMethod: service.AffiliateRegisterMethodPassword,
		InitialQuota:   500,
	})
	if err != nil {
		t.Fatalf("recordAffiliateInviteAttributionForRegistration returned error: %v", err)
	}
	if event == nil || event.InviteSource != service.AffiliateInviteSourceAffiliate || event.RegisterMethod != service.AffiliateRegisterMethodPassword {
		t.Fatalf("unexpected invite event: %+v", event)
	}
	if event.InitialQuotaRule != "affiliate_invite" || event.InitialQuota != 500 {
		t.Fatalf("unexpected initial quota metadata: %+v", event)
	}

	var relation model.AffiliateRelation
	if err := db.Where("ancestor_user_id = ? AND descendant_user_id = ? AND depth = ?", 101, 201, 1).First(&relation).Error; err != nil {
		t.Fatalf("expected affiliate relation: %v", err)
	}
}

func TestRecordAffiliateRegistrationAttributionDowngradesWhenModuleDisabled(t *testing.T) {
	db := newAffiliateRegistrationAttributionTestDB(t)
	common.AffiliateEnabled = false
	seedAffiliateInviter(t, db, 102, "AFF102")

	ctx, err := resolveAffiliateInviteContextForRegistration(db, affiliateRegistrationAttributionInput{
		InviteCode:     "AFF102",
		RegisterMethod: service.AffiliateRegisterMethodOAuth,
		Provider:       "github",
	})
	if err != nil {
		t.Fatalf("resolveAffiliateInviteContextForRegistration returned error: %v", err)
	}
	if ctx.Source != service.AffiliateInviteSourceNormal || ctx.InviterUserId != 102 {
		t.Fatalf("expected active affiliate code to downgrade to normal invite, got %+v", ctx)
	}

	event, err := recordAffiliateInviteAttributionForRegistration(db, ctx, affiliateRegistrationAttributionInput{
		InviteeUserId:  202,
		RegisterMethod: service.AffiliateRegisterMethodOAuth,
		Provider:       "github",
	})
	if err != nil {
		t.Fatalf("recordAffiliateInviteAttributionForRegistration returned error: %v", err)
	}
	if event == nil || event.InviteSource != service.AffiliateInviteSourceNormal || event.Provider != "github" {
		t.Fatalf("unexpected downgraded invite event: %+v", event)
	}
	if event.InitialQuotaRule != "normal_invite" {
		t.Fatalf("expected normal invite quota rule, got %+v", event)
	}

	var relationCount int64
	if err := db.Model(&model.AffiliateRelation{}).Count(&relationCount).Error; err != nil {
		t.Fatalf("count relations: %v", err)
	}
	if relationCount != 0 {
		t.Fatalf("normal invite should not create affiliate relations, got %d", relationCount)
	}
}

func TestRecordAffiliateRegistrationAttributionSupportsWeChatMethod(t *testing.T) {
	db := newAffiliateRegistrationAttributionTestDB(t)
	common.AffiliateEnabled = true
	seedAffiliateInviter(t, db, 103, "AFF103")

	ctx, err := resolveAffiliateInviteContextForRegistration(db, affiliateRegistrationAttributionInput{
		InviteCode:     "AFF103",
		RegisterMethod: service.AffiliateRegisterMethodWeChat,
		Provider:       "wechat",
	})
	if err != nil {
		t.Fatalf("resolveAffiliateInviteContextForRegistration returned error: %v", err)
	}
	event, err := recordAffiliateInviteAttributionForRegistration(db, ctx, affiliateRegistrationAttributionInput{
		InviteeUserId:  203,
		RegisterMethod: service.AffiliateRegisterMethodWeChat,
		Provider:       "wechat",
	})
	if err != nil {
		t.Fatalf("recordAffiliateInviteAttributionForRegistration returned error: %v", err)
	}
	if event == nil || event.RegisterMethod != service.AffiliateRegisterMethodWeChat || event.Provider != "wechat" {
		t.Fatalf("unexpected wechat invite event: %+v", event)
	}
}

func TestPasswordRegisterRecordsAffiliateAttribution(t *testing.T) {
	db := newAffiliateRegistrationAttributionTestDB(t)
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	common.AffiliateEnabled = true
	common.QuotaForInvitee = 777
	paymentSetting := operation_setting.GetPaymentSetting()
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	seedAffiliateInviter(t, db, 104, "AFF104")

	body := bytes.NewBufferString(`{
		"username":"invitee104",
		"password":"password104",
		"aff_code":"AFF104"
	}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/register", body)

	Register(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected successful register, got %q", response.Message)
	}

	var invitee model.User
	if err := db.Where("username = ?", "invitee104").First(&invitee).Error; err != nil {
		t.Fatalf("load invitee: %v", err)
	}
	var event model.AffiliateInviteEvent
	if err := db.Where("invitee_user_id = ?", invitee.Id).First(&event).Error; err != nil {
		t.Fatalf("expected invite event: %v", err)
	}
	if event.InviterUserId != 104 || event.InviteSource != service.AffiliateInviteSourceAffiliate {
		t.Fatalf("unexpected event attribution: %+v", event)
	}
	if event.InitialQuota != 777 || event.InitialQuotaRule != "affiliate_invite" {
		t.Fatalf("unexpected event quota metadata: %+v", event)
	}

	var relation model.AffiliateRelation
	if err := db.Where("ancestor_user_id = ? AND descendant_user_id = ? AND depth = ?", 104, invitee.Id, 1).First(&relation).Error; err != nil {
		t.Fatalf("expected affiliate relation: %v", err)
	}
}

func newAffiliateRegistrationAttributionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalEnabled := common.AffiliateEnabled
	originalRegisterEnabled := common.RegisterEnabled
	originalPasswordRegisterEnabled := common.PasswordRegisterEnabled
	originalEmailVerificationEnabled := common.EmailVerificationEnabled
	originalQuotaForInvitee := common.QuotaForInvitee
	originalRedisEnabled := common.RedisEnabled
	originalPaymentSetting := *operation_setting.GetPaymentSetting()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := append([]interface{}{&model.User{}, &model.Log{}}, model.AffiliateSidecarModels()...)
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("migrate test models: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.AffiliateEnabled = originalEnabled
		common.RegisterEnabled = originalRegisterEnabled
		common.PasswordRegisterEnabled = originalPasswordRegisterEnabled
		common.EmailVerificationEnabled = originalEmailVerificationEnabled
		common.QuotaForInvitee = originalQuotaForInvitee
		common.RedisEnabled = originalRedisEnabled
		*operation_setting.GetPaymentSetting() = originalPaymentSetting
	})
	return db
}

func seedAffiliateInviter(t *testing.T, db *gorm.DB, userId int, affCode string) {
	t.Helper()
	if err := db.Create(&model.User{Id: userId, Username: "aff" + affCode, AffCode: affCode}).Error; err != nil {
		t.Fatalf("seed inviter: %v", err)
	}
	if _, err := service.CreateAffiliateProfile(db, service.AffiliateProfileCreateInput{
		UserId:      userId,
		Level:       1,
		InviteCode:  affCode,
		ActorUserId: 1,
		Reason:      "seed",
	}); err != nil {
		t.Fatalf("seed affiliate profile: %v", err)
	}
}
