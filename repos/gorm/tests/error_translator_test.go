package tests_test

import (
	"errors"
	"testing"

	"gorm.io/gorm"
	"gorm.io/gorm/utils/tests"
)

func TestDialectorWithErrorTranslatorSupport(t *testing.T) {
	// it shouldn't translate error when the TranslateError flag is false
	translatedErr := errors.New("translated error")
	untranslatedErr := errors.New("some random error")
	db, _ := gorm.Open(tests.DummyDialector{TranslatedErr: translatedErr})

	err := db.AddError(untranslatedErr)
	if !errors.Is(err, untranslatedErr) {
		t.Fatalf("expected err: %v got err: %v", untranslatedErr, err)
	}

	// it should translate error when the TranslateError flag is true
	db, _ = gorm.Open(tests.DummyDialector{TranslatedErr: translatedErr}, &gorm.Config{TranslateError: true})

	err = db.AddError(untranslatedErr)
	if !errors.Is(err, translatedErr) {
		t.Fatalf("expected err: %v got err: %v", translatedErr, err)
	}
}

func TestSupportedDialectorWithErrDuplicatedKey(t *testing.T) {
	type City struct {
		gorm.Model
		Name string `gorm:"unique"`
	}

	db, err := OpenTestConnection(&gorm.Config{TranslateError: true})
	if err != nil {
		t.Fatalf("failed to connect database, got error %v", err)
	}

	dialectors := map[string]bool{"sqlite": true, "postgres": true, "mysql": true, "sqlserver": true}
	if supported, found := dialectors[db.Dialector.Name()]; !(found && supported) {
		return
	}

	if err = db.AutoMigrate(&City{}); err != nil {
		t.Fatalf("failed to migrate cities table, got error: %v", err)
	}

	err = db.Create(&City{Name: "Kabul"}).Error
	if err != nil {
		t.Fatalf("failed to create record: %v", err)
	}

	err = db.Create(&City{Name: "Kabul"}).Error
	if !errors.Is(err, gorm.ErrDuplicatedKey) {
		t.Fatalf("expected err: %v got err: %v", gorm.ErrDuplicatedKey, err)
	}
}
