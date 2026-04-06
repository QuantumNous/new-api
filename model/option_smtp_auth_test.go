package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestUpdateOptionMapSMTPForceAuthLogin(t *testing.T) {
	previousMap := common.OptionMap
	previousValue := common.SMTPForceAuthLogin
	common.OptionMap = make(map[string]string)
	common.SMTPForceAuthLogin = false
	defer func() {
		common.OptionMap = previousMap
		common.SMTPForceAuthLogin = previousValue
	}()

	if err := updateOptionMap("SMTPForceAuthLogin", "true"); err != nil {
		t.Fatalf("updateOptionMap returned error: %v", err)
	}
	if !common.SMTPForceAuthLogin {
		t.Fatal("expected SMTPForceAuthLogin to be true")
	}

	if err := updateOptionMap("SMTPForceAuthLogin", "false"); err != nil {
		t.Fatalf("updateOptionMap returned error: %v", err)
	}
	if common.SMTPForceAuthLogin {
		t.Fatal("expected SMTPForceAuthLogin to be false")
	}
}
