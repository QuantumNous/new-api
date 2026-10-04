package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestUpdatePasskeyDomainOptionsRequiresConfirmationAndSupportsPreview(t *testing.T) {
	oldDB := DB
	oldServerAddress := system_setting.ServerAddress
	common.OptionMapRWMutex.Lock()
	oldOptionMap := make(map[string]string, len(common.OptionMap))
	for key, value := range common.OptionMap {
		oldOptionMap[key] = value
	}
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	common.OptionMap["ServerAddress"] = "https://example.com"
	common.OptionMap[passkeyRPIDOption] = "example.com"
	common.OptionMap[passkeyLegacyRPIDsOption] = "old.example.org"
	common.OptionMap[passkeyOriginsOption] = "https://example.com,https://old.example.org"
	common.OptionMapRWMutex.Unlock()
	system_setting.ServerAddress = "https://example.com"
	defer func() {
		DB = oldDB
		system_setting.ServerAddress = oldServerAddress
		common.OptionMapRWMutex.Lock()
		common.OptionMap = oldOptionMap
		common.OptionMapRWMutex.Unlock()
	}()

	db, err := gorm.Open(sqlite.Open("file:passkey-domain-options?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&Option{}, &PasskeyCredential{}); err != nil {
		t.Fatal(err)
	}
	DB = db
	for key, value := range map[string]string{
		"ServerAddress":          "https://example.com",
		passkeyRPIDOption:        "example.com",
		passkeyLegacyRPIDsOption: "old.example.org",
		passkeyOriginsOption:     "https://example.com,https://old.example.org",
	} {
		if err := db.Create(&Option{Key: key, Value: value}).Error; err != nil {
			t.Fatal(err)
		}
	}
	oldRPID := "old.example.org"
	if err := db.Create(&PasskeyCredential{UserID: 1, RPID: &oldRPID, CredentialID: "id", PublicKey: "key"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&PasskeyCredential{UserID: 2, CredentialID: "id2", PublicKey: "key2"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&PasskeyCredential{UserID: 3, CredentialID: "id3", PublicKey: "key3"}).Error; err != nil {
		t.Fatal(err)
	}
	var legacy PasskeyCredential
	if err := db.First(&legacy, "user_id = ?", 3).Error; err != nil {
		t.Fatal(err)
	}
	if legacy.RPID != nil {
		t.Fatalf("legacy credential RPID = %v, want NULL", legacy.RPID)
	}
	if err := BindPasskeyRPIDIfEmpty(2, "example.com"); err != nil {
		t.Fatal(err)
	}
	if err := BindPasskeyRPIDIfEmpty(2, "old.example.org"); err != nil {
		t.Fatal(err)
	}
	var bound PasskeyCredential
	if err := db.First(&bound, "user_id = ?", 2).Error; err != nil {
		t.Fatal(err)
	}
	if bound.RPID == nil || *bound.RPID != "example.com" {
		t.Fatalf("RPID was overwritten: %v", bound.RPID)
	}
	if err := UpsertPasskeyCredential(&PasskeyCredential{UserID: 2, CredentialID: "replacement", PublicKey: "replacement"}); err != nil {
		t.Fatal(err)
	}
	bound = PasskeyCredential{}
	if err := db.First(&bound, "user_id = ?", 2).Error; err != nil {
		t.Fatal(err)
	}
	if bound.RPID == nil || *bound.RPID != "example.com" {
		t.Fatalf("UpsertPasskeyCredential lost RPID: %v", bound.RPID)
	}

	values := map[string]string{
		passkeyRPIDOption:        "example.com",
		passkeyLegacyRPIDsOption: "",
		passkeyOriginsOption:     "https://example.com",
	}
	change, err := UpdatePasskeyDomainOptions(values, false, "")
	var removal *PasskeyDomainRemovalError
	if !errors.As(err, &removal) || change == nil || change.Affected != 1 || change.Unknown != 1 {
		t.Fatalf("expected confirmation requirement, change=%+v err=%v", change, err)
	}
	var stored Option
	if err := db.First(&stored, "key = ?", passkeyLegacyRPIDsOption).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Value != "old.example.org" {
		t.Fatalf("domain change was persisted before confirmation: %q", stored.Value)
	}
	if _, err := UpdatePasskeyDomainOptions(values, false, removal.Change.Confirmation); err != nil {
		t.Fatalf("confirmed domain change failed: %v", err)
	}
	if err := db.First(&stored, "key = ?", passkeyLegacyRPIDsOption).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Value != "" {
		t.Fatalf("legacy RP IDs = %q", stored.Value)
	}

	previewValues := map[string]string{
		passkeyRPIDOption:        "example.com",
		passkeyLegacyRPIDsOption: "preview.example.org",
		passkeyOriginsOption:     "https://example.com,https://preview.example.org",
	}
	if _, err := UpdatePasskeyDomainOptions(previewValues, true, ""); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&stored, "key = ?", passkeyLegacyRPIDsOption).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Value != "" {
		t.Fatalf("preview changed legacy RP IDs: %q", stored.Value)
	}
}
