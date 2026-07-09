package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
)

func TestShouldMarkTaskPerCallBillingSkipsVideoSeconds(t *testing.T) {
	saved := map[string]string{}
	if err := config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}); err != nil {
		t.Fatalf("save config failed: %v", err)
	}
	t.Cleanup(func() {
		if err := config.GlobalConfig.LoadFromDB(saved); err != nil {
			t.Fatalf("restore config failed: %v", err)
		}
	})

	if err := config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"happyhorse-1.1-t2v":"video_seconds"}`,
	}); err != nil {
		t.Fatalf("load config failed: %v", err)
	}

	relayInfo := &common.RelayInfo{
		OriginModelName: "happyhorse-1.1-t2v",
	}
	relayInfo.PriceData.UsePrice = true

	if shouldMarkTaskPerCallBilling(relayInfo) {
		t.Fatalf("video_seconds billing should not be treated as per-call")
	}
	if billing_setting.GetBillingMode(relayInfo.OriginModelName) != billing_setting.BillingModeVideoSeconds {
		t.Fatalf("expected billing mode video_seconds")
	}
}
