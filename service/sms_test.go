package service

import (
	"encoding/json"
	"strings"
	"testing"

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
	if err := db.AutoMigrate(model.SMSSidecarModels()...); err != nil {
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
