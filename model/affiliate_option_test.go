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
