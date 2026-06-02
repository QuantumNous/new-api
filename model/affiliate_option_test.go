package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestAffiliateEnabledOptionMap(t *testing.T) {
	originalMap := common.OptionMap
	originalEnabled := common.AffiliateEnabled
	defer func() {
		common.OptionMap = originalMap
		common.AffiliateEnabled = originalEnabled
	}()

	common.OptionMap = map[string]string{}
	common.AffiliateEnabled = false

	if err := updateOptionMap("AffiliateEnabled", "true"); err != nil {
		t.Fatalf("updateOptionMap returned error: %v", err)
	}
	if !common.AffiliateEnabled {
		t.Fatal("AffiliateEnabled should be true after true option update")
	}

	if err := updateOptionMap("AffiliateEnabled", "false"); err != nil {
		t.Fatalf("updateOptionMap returned error: %v", err)
	}
	if common.AffiliateEnabled {
		t.Fatal("AffiliateEnabled should be false after false option update")
	}
}

func TestAffiliateQuotaForInviteeOptionMap(t *testing.T) {
	originalMap := common.OptionMap
	originalQuota := common.AffiliateQuotaForInvitee
	defer func() {
		common.OptionMap = originalMap
		common.AffiliateQuotaForInvitee = originalQuota
	}()

	common.OptionMap = map[string]string{}
	common.AffiliateQuotaForInvitee = -1

	InitOptionMap()
	if common.OptionMap["AffiliateQuotaForInvitee"] != "-1" {
		t.Fatalf("expected default affiliate invitee quota option -1, got %q", common.OptionMap["AffiliateQuotaForInvitee"])
	}

	if err := updateOptionMap("AffiliateQuotaForInvitee", "333"); err != nil {
		t.Fatalf("updateOptionMap returned error: %v", err)
	}
	if common.AffiliateQuotaForInvitee != 333 {
		t.Fatalf("AffiliateQuotaForInvitee should be 333 after update, got %d", common.AffiliateQuotaForInvitee)
	}
}
