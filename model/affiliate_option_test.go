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

func TestAffiliateLevelQuotaOptionMap(t *testing.T) {
	originalMap := common.OptionMap
	originalLevelOneInvitee := common.AffiliateLevelOneQuotaForInvitee
	originalLevelTwoInvitee := common.AffiliateLevelTwoQuotaForInvitee
	originalLevelOneInviter := common.AffiliateLevelOneQuotaForInviter
	originalLevelTwoInviter := common.AffiliateLevelTwoQuotaForInviter
	defer func() {
		common.OptionMap = originalMap
		common.AffiliateLevelOneQuotaForInvitee = originalLevelOneInvitee
		common.AffiliateLevelTwoQuotaForInvitee = originalLevelTwoInvitee
		common.AffiliateLevelOneQuotaForInviter = originalLevelOneInviter
		common.AffiliateLevelTwoQuotaForInviter = originalLevelTwoInviter
	}()

	common.OptionMap = map[string]string{}
	common.AffiliateLevelOneQuotaForInvitee = -1
	common.AffiliateLevelTwoQuotaForInvitee = -1
	common.AffiliateLevelOneQuotaForInviter = -1
	common.AffiliateLevelTwoQuotaForInviter = -1

	InitOptionMap()
	cases := []struct {
		key      string
		value    string
		expected int
		readBack func() int
	}{
		{"AffiliateLevelOneQuotaForInvitee", "111", 111, func() int { return common.AffiliateLevelOneQuotaForInvitee }},
		{"AffiliateLevelTwoQuotaForInvitee", "222", 222, func() int { return common.AffiliateLevelTwoQuotaForInvitee }},
		{"AffiliateLevelOneQuotaForInviter", "333", 333, func() int { return common.AffiliateLevelOneQuotaForInviter }},
		{"AffiliateLevelTwoQuotaForInviter", "444", 444, func() int { return common.AffiliateLevelTwoQuotaForInviter }},
	}
	for _, tt := range cases {
		if common.OptionMap[tt.key] != "-1" {
			t.Fatalf("expected %s default -1, got %q", tt.key, common.OptionMap[tt.key])
		}
		if err := updateOptionMap(tt.key, tt.value); err != nil {
			t.Fatalf("updateOptionMap(%s) returned error: %v", tt.key, err)
		}
		if got := tt.readBack(); got != tt.expected {
			t.Fatalf("%s should be %s after update, got %d", tt.key, tt.value, got)
		}
	}
}
