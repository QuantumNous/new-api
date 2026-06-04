package service

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func newSMSTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := append([]interface{}{&model.User{}}, model.SMSSidecarModels()...)
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("migrate sms sidecar models: %v", err)
	}
	return db
}

func TestRecordSMSSendLogStoresOnlyRedactedFields(t *testing.T) {
	db := newSMSTestDB(t)

	log, err := RecordSMSSendLog(db, SMSSendLogInput{
		Phone:           "13800138000",
		Scene:           "register",
		Provider:        "smsbao",
		TemplateVersion: "register:template-v1",
		ProviderCode:    "0",
		DurationMs:      25,
	})
	if err != nil {
		t.Fatalf("RecordSMSSendLog returned error: %v", err)
	}
	if log.PhoneMasked != "138****8000" || log.Scene != "register" || log.Provider != "smsbao" || log.TemplateVersion != "register:template-v1" || log.ProviderCode != "0" || log.DurationMs != 25 {
		t.Fatalf("unexpected sms send log: %+v", log)
	}

	var stored model.SMSSendLog
	if err := db.First(&stored, log.Id).Error; err != nil {
		t.Fatalf("read stored log: %v", err)
	}
	payload, err := json.Marshal(stored)
	if err != nil {
		t.Fatalf("marshal stored log: %v", err)
	}
	for _, forbidden := range []string{"13800138000", "123456", "短信正文", "leak-me-token"} {
		if strings.Contains(string(payload), forbidden) {
			t.Fatalf("sms send log leaked %q: %s", forbidden, string(payload))
		}
	}
}

func TestBindUserPhoneStoresHashAndMaskedPhoneOnly(t *testing.T) {
	db := newSMSTestDB(t)

	binding, err := BindUserPhone(db, UserPhoneBindingInput{
		UserID:     101,
		Phone:      " 13800138000 ",
		Provider:   "smsbao",
		VerifiedAt: 1710000000,
	})
	if err != nil {
		t.Fatalf("BindUserPhone returned error: %v", err)
	}
	if binding.UserId != 101 || binding.PhoneMasked != "138****8000" || binding.PhoneHash == "" || binding.Status != model.UserPhoneBindingStatusActive || binding.Provider != "smsbao" || binding.VerifiedAt != 1710000000 {
		t.Fatalf("unexpected phone binding: %+v", binding)
	}
	payload, err := json.Marshal(binding)
	if err != nil {
		t.Fatalf("marshal binding: %v", err)
	}
	if strings.Contains(string(payload), "13800138000") {
		t.Fatalf("binding leaked full phone: %s", string(payload))
	}
}

func TestBindUserPhoneReplacesExistingActiveBindingForUser(t *testing.T) {
	db := newSMSTestDB(t)

	first, err := BindUserPhone(db, UserPhoneBindingInput{
		UserID: 101,
		Phone:  "13800138000",
	})
	if err != nil {
		t.Fatalf("first BindUserPhone returned error: %v", err)
	}
	second, err := BindUserPhone(db, UserPhoneBindingInput{
		UserID: 101,
		Phone:  "13900139000",
	})
	if err != nil {
		t.Fatalf("second BindUserPhone returned error: %v", err)
	}

	var firstStored model.UserPhoneBinding
	if err := db.First(&firstStored, first.Id).Error; err != nil {
		t.Fatalf("read first binding: %v", err)
	}
	if firstStored.Status != model.UserPhoneBindingStatusReplaced || firstStored.UnboundAt == 0 {
		t.Fatalf("expected first binding to be replaced, got %+v", firstStored)
	}
	if second.Status != model.UserPhoneBindingStatusActive {
		t.Fatalf("expected second binding active, got %+v", second)
	}
	var activeCount int64
	if err := db.Model(&model.UserPhoneBinding{}).Where("user_id = ? AND status = ?", 101, model.UserPhoneBindingStatusActive).Count(&activeCount).Error; err != nil {
		t.Fatalf("count active bindings: %v", err)
	}
	if activeCount != 1 {
		t.Fatalf("expected one active binding, got %d", activeCount)
	}
}

func TestBindUserPhoneRejectsPhoneAlreadyActiveForAnotherUser(t *testing.T) {
	db := newSMSTestDB(t)

	if _, err := BindUserPhone(db, UserPhoneBindingInput{
		UserID: 101,
		Phone:  "13800138000",
	}); err != nil {
		t.Fatalf("first BindUserPhone returned error: %v", err)
	}
	_, err := BindUserPhone(db, UserPhoneBindingInput{
		UserID: 102,
		Phone:  "13800138000",
	})
	if err == nil || !strings.Contains(err.Error(), "phone already bound") {
		t.Fatalf("expected phone already bound error, got %v", err)
	}
}

func TestFindUserByActivePhoneBindingReturnsEnabledUser(t *testing.T) {
	db := newSMSTestDB(t)
	user := model.User{
		Id:          201,
		Username:    "phone-login-user",
		DisplayName: "Phone Login User",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := BindUserPhone(db, UserPhoneBindingInput{
		UserID:   user.Id,
		Phone:    "1003",
		Provider: "smsbao",
	}); err != nil {
		t.Fatalf("bind user phone: %v", err)
	}

	resolved, err := FindUserByActivePhoneBinding(db, " 1003 ")
	if err != nil {
		t.Fatalf("FindUserByActivePhoneBinding returned error: %v", err)
	}
	if resolved.Id != user.Id || resolved.Username != user.Username || resolved.Status != common.UserStatusEnabled {
		t.Fatalf("unexpected resolved user: %+v", resolved)
	}
}

func TestFindUserByActivePhoneBindingRejectsUnboundPhone(t *testing.T) {
	db := newSMSTestDB(t)

	_, err := FindUserByActivePhoneBinding(db, "1004")

	if err == nil || !strings.Contains(err.Error(), "phone is not bound") {
		t.Fatalf("expected unbound phone error, got %v", err)
	}
}

func TestFindUserByActivePhoneBindingRejectsDisabledUser(t *testing.T) {
	db := newSMSTestDB(t)
	user := model.User{
		Id:       202,
		Username: "disabled-phone-login-user",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusDisabled,
		Group:    "default",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed disabled user: %v", err)
	}
	if _, err := BindUserPhone(db, UserPhoneBindingInput{
		UserID: user.Id,
		Phone:  "1005",
	}); err != nil {
		t.Fatalf("bind disabled user phone: %v", err)
	}

	_, err := FindUserByActivePhoneBinding(db, "1005")

	if err == nil || !strings.Contains(err.Error(), "phone is not bound") {
		t.Fatalf("expected disabled user to be rejected as unbound, got %v", err)
	}
}
