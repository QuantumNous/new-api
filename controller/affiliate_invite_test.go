package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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
	if event.InitialQuotaRule != "affiliate_invite_level_1" || event.InitialQuota != 500 {
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
	if event.InitialQuota != 777 || event.InitialQuotaRule != "affiliate_invite_level_1" {
		t.Fatalf("unexpected event quota metadata: %+v", event)
	}

	var relation model.AffiliateRelation
	if err := db.Where("ancestor_user_id = ? AND descendant_user_id = ? AND depth = ?", 104, invitee.Id, 1).First(&relation).Error; err != nil {
		t.Fatalf("expected affiliate relation: %v", err)
	}
}

func TestPasswordRegisterAppliesAffiliateInviteeQuota(t *testing.T) {
	db := newAffiliateRegistrationAttributionTestDB(t)
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	common.AffiliateEnabled = true
	common.QuotaForNewUser = 100
	common.QuotaForInvitee = 111
	common.AffiliateQuotaForInvitee = 333
	paymentSetting := operation_setting.GetPaymentSetting()
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	seedAffiliateInviter(t, db, 105, "AFF105")

	body := bytes.NewBufferString(`{
		"username":"invitee105",
		"password":"password105",
		"aff_code":"AFF105"
	}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/register", body)

	Register(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var invitee model.User
	if err := db.Where("username = ?", "invitee105").First(&invitee).Error; err != nil {
		t.Fatalf("load invitee: %v", err)
	}
	if invitee.Quota != 433 {
		t.Fatalf("expected new user quota plus affiliate invitee quota, got %d", invitee.Quota)
	}

	var event model.AffiliateInviteEvent
	if err := db.Where("invitee_user_id = ?", invitee.Id).First(&event).Error; err != nil {
		t.Fatalf("expected invite event: %v", err)
	}
	if event.InitialQuota != 333 || event.InitialQuotaRule != "affiliate_invite_level_1" {
		t.Fatalf("unexpected affiliate quota event: %+v", event)
	}
}

func TestPasswordRegisterAppliesLevelSpecificAffiliateInviteeAndInviterQuota(t *testing.T) {
	db := newAffiliateRegistrationAttributionTestDB(t)
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	common.AffiliateEnabled = true
	common.QuotaForNewUser = 100
	common.QuotaForInvitee = 111
	common.QuotaForInviter = 222
	common.AffiliateQuotaForInvitee = 333
	common.AffiliateLevelOneQuotaForInvitee = 444
	common.AffiliateLevelTwoQuotaForInvitee = 555
	common.AffiliateLevelOneQuotaForInviter = 666
	common.AffiliateLevelTwoQuotaForInviter = 777
	paymentSetting := operation_setting.GetPaymentSetting()
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	seedAffiliateInviter(t, db, 107, "AFF107")
	seedAffiliateInviterWithLevel(t, db, 108, "AFF108", 2, 107)

	body := bytes.NewBufferString(`{
		"username":"invitee108",
		"password":"password108",
		"aff_code":"AFF108"
	}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/register", body)

	Register(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var invitee model.User
	if err := db.Where("username = ?", "invitee108").First(&invitee).Error; err != nil {
		t.Fatalf("load invitee: %v", err)
	}
	if invitee.Quota != 655 {
		t.Fatalf("expected new user quota plus level-two affiliate invitee quota, got %d", invitee.Quota)
	}

	var inviter model.User
	if err := db.Where("id = ?", 108).First(&inviter).Error; err != nil {
		t.Fatalf("load inviter: %v", err)
	}
	if inviter.AffQuota != 777 || inviter.AffHistoryQuota != 777 {
		t.Fatalf("expected level-two affiliate inviter reward, got aff=%d history=%d", inviter.AffQuota, inviter.AffHistoryQuota)
	}

	var event model.AffiliateInviteEvent
	if err := db.Where("invitee_user_id = ?", invitee.Id).First(&event).Error; err != nil {
		t.Fatalf("expected invite event: %v", err)
	}
	if event.InitialQuota != 555 || event.InitialQuotaRule != "affiliate_invite_level_2" {
		t.Fatalf("unexpected level-specific affiliate quota event: %+v", event)
	}
}

func TestPasswordRegisterKeepsNormalInviteeQuotaForNonAffiliateCode(t *testing.T) {
	db := newAffiliateRegistrationAttributionTestDB(t)
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.EmailVerificationEnabled = false
	common.AffiliateEnabled = true
	common.QuotaForNewUser = 100
	common.QuotaForInvitee = 111
	common.AffiliateQuotaForInvitee = 333
	paymentSetting := operation_setting.GetPaymentSetting()
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	if err := db.Create(&model.User{Id: 106, Username: "normal106", AffCode: "NORM106"}).Error; err != nil {
		t.Fatalf("seed normal inviter: %v", err)
	}

	body := bytes.NewBufferString(`{
		"username":"invitee106",
		"password":"password106",
		"aff_code":"NORM106"
	}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/register", body)

	Register(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	var invitee model.User
	if err := db.Where("username = ?", "invitee106").First(&invitee).Error; err != nil {
		t.Fatalf("load invitee: %v", err)
	}
	if invitee.Quota != 211 {
		t.Fatalf("expected new user quota plus normal invitee quota, got %d", invitee.Quota)
	}

	var event model.AffiliateInviteEvent
	if err := db.Where("invitee_user_id = ?", invitee.Id).First(&event).Error; err != nil {
		t.Fatalf("expected invite event: %v", err)
	}
	if event.InitialQuota != 111 || event.InitialQuotaRule != "normal_invite" {
		t.Fatalf("unexpected normal quota event: %+v", event)
	}
}

func TestSMSRegisterAppliesAffiliateAttributionAndBindsPhone(t *testing.T) {
	db := newAffiliateRegistrationAttributionTestDB(t)
	common.RegisterEnabled = true
	common.SMSEnabled = true
	common.AffiliateEnabled = true
	common.QuotaForNewUser = 100
	common.QuotaForInvitee = 111
	common.AffiliateQuotaForInvitee = 333
	common.AffiliateLevelOneQuotaForInvitee = 444
	paymentSetting := operation_setting.GetPaymentSetting()
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	seedAffiliateInviter(t, db, 109, "AFF109")

	phone := "13800138000"
	common.RegisterVerificationCodeWithKey(phone, "123456", common.SMSVerificationPurpose(common.SMSSceneRegister))
	t.Cleanup(func() {
		common.DeleteKey(phone, common.SMSVerificationPurpose(common.SMSSceneRegister))
	})
	body := bytes.NewBufferString(`{
		"username":"smsinvitee109",
		"password":"password109",
		"phone":"13800138000",
		"verification_code":"123456",
		"aff_code":"AFF109"
	}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/sms/register", body)

	SMSRegister(ctx)

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
		t.Fatalf("expected successful sms register, got %q", response.Message)
	}

	var invitee model.User
	if err := db.Where("username = ?", "smsinvitee109").First(&invitee).Error; err != nil {
		t.Fatalf("load sms invitee: %v", err)
	}
	if invitee.Quota != 544 || invitee.InviterId != 109 {
		t.Fatalf("expected new user quota plus level-one affiliate invitee quota, got %+v", invitee)
	}

	var binding model.UserPhoneBinding
	if err := db.Where("user_id = ? AND status = ?", invitee.Id, model.UserPhoneBindingStatusActive).First(&binding).Error; err != nil {
		t.Fatalf("expected active phone binding: %v", err)
	}
	if binding.PhoneMasked != "138****8000" || binding.PhoneHash == "" || binding.Provider != common.SMSProviderName {
		t.Fatalf("unexpected phone binding: %+v", binding)
	}
	bindingPayload, err := json.Marshal(binding)
	if err != nil {
		t.Fatalf("marshal binding: %v", err)
	}
	if strings.Contains(string(bindingPayload), phone) {
		t.Fatalf("phone binding leaked raw phone: %s", string(bindingPayload))
	}

	var event model.AffiliateInviteEvent
	if err := db.Where("invitee_user_id = ?", invitee.Id).First(&event).Error; err != nil {
		t.Fatalf("expected sms invite event: %v", err)
	}
	if event.InviterUserId != 109 || event.InviteSource != service.AffiliateInviteSourceAffiliate || event.RegisterMethod != service.AffiliateRegisterMethodSMS || event.Provider != common.SMSProviderName {
		t.Fatalf("unexpected sms event attribution: %+v", event)
	}
	if event.InitialQuota != 444 || event.InitialQuotaRule != "affiliate_invite_level_1" {
		t.Fatalf("unexpected sms quota event: %+v", event)
	}

	var relation model.AffiliateRelation
	if err := db.Where("ancestor_user_id = ? AND descendant_user_id = ? AND depth = ?", 109, invitee.Id, 1).First(&relation).Error; err != nil {
		t.Fatalf("expected sms affiliate relation: %v", err)
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
	originalSMSEnabled := common.SMSEnabled
	originalQuotaForNewUser := common.QuotaForNewUser
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInvitee := common.QuotaForInvitee
	originalAffiliateQuotaForInvitee := common.AffiliateQuotaForInvitee
	originalAffiliateLevelOneQuotaForInvitee := common.AffiliateLevelOneQuotaForInvitee
	originalAffiliateLevelTwoQuotaForInvitee := common.AffiliateLevelTwoQuotaForInvitee
	originalAffiliateLevelOneQuotaForInviter := common.AffiliateLevelOneQuotaForInviter
	originalAffiliateLevelTwoQuotaForInviter := common.AffiliateLevelTwoQuotaForInviter
	originalRedisEnabled := common.RedisEnabled
	originalPaymentSetting := *operation_setting.GetPaymentSetting()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := append([]interface{}{&model.User{}, &model.Log{}}, model.AffiliateSidecarModels()...)
	models = append(models, model.SMSSidecarModels()...)
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
		common.SMSEnabled = originalSMSEnabled
		common.QuotaForNewUser = originalQuotaForNewUser
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInvitee = originalQuotaForInvitee
		common.AffiliateQuotaForInvitee = originalAffiliateQuotaForInvitee
		common.AffiliateLevelOneQuotaForInvitee = originalAffiliateLevelOneQuotaForInvitee
		common.AffiliateLevelTwoQuotaForInvitee = originalAffiliateLevelTwoQuotaForInvitee
		common.AffiliateLevelOneQuotaForInviter = originalAffiliateLevelOneQuotaForInviter
		common.AffiliateLevelTwoQuotaForInviter = originalAffiliateLevelTwoQuotaForInviter
		common.RedisEnabled = originalRedisEnabled
		*operation_setting.GetPaymentSetting() = originalPaymentSetting
	})
	return db
}

func seedAffiliateInviter(t *testing.T, db *gorm.DB, userId int, affCode string) {
	t.Helper()
	seedAffiliateInviterWithLevel(t, db, userId, affCode, 1, 0)
}

func seedAffiliateInviterWithLevel(t *testing.T, db *gorm.DB, userId int, affCode string, level int, parentUserId int) {
	t.Helper()
	if err := db.Create(&model.User{Id: userId, Username: "aff" + affCode, AffCode: affCode}).Error; err != nil {
		t.Fatalf("seed inviter: %v", err)
	}
	if _, err := service.CreateAffiliateProfile(db, service.AffiliateProfileCreateInput{
		UserId:       userId,
		Level:        level,
		ParentUserId: parentUserId,
		InviteCode:   affCode,
		ActorUserId:  1,
		Reason:       "seed",
	}); err != nil {
		t.Fatalf("seed affiliate profile: %v", err)
	}
}
