package operation_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
)

func TestGetPaymentSettingReturnsDeepCopy(t *testing.T) {
	original := GetPaymentSetting()
	t.Cleanup(func() {
		UpdatePaymentSetting(func(setting *PaymentSetting) {
			*setting = *original
			setting.AmountOptions = append([]int(nil), original.AmountOptions...)
			if original.AmountDiscount != nil {
				setting.AmountDiscount = make(map[int]float64, len(original.AmountDiscount))
				for amount, discount := range original.AmountDiscount {
					setting.AmountDiscount[amount] = discount
				}
			}
			setting.AutoSwitchGroupRules = append([]PaymentAutoSwitchGroupRule(nil), original.AutoSwitchGroupRules...)
		})
	})

	UpdatePaymentSetting(func(setting *PaymentSetting) {
		setting.AmountOptions = []int{10}
		setting.AmountDiscount = map[int]float64{10: 0.9}
		setting.AutoSwitchGroupRules = []PaymentAutoSwitchGroupRule{
			{ThresholdUSD: 10, Group: "vip"},
		}
	})

	snapshot := GetPaymentSetting()
	snapshot.AmountOptions[0] = 99
	snapshot.AmountDiscount[10] = 0.1
	snapshot.AutoSwitchGroupRules[0].Group = "mutated"

	fresh := GetPaymentSetting()
	if fresh.AmountOptions[0] != 10 {
		t.Fatalf("AmountOptions shared mutable state: got %d", fresh.AmountOptions[0])
	}
	if fresh.AmountDiscount[10] != 0.9 {
		t.Fatalf("AmountDiscount shared mutable state: got %f", fresh.AmountDiscount[10])
	}
	if fresh.AutoSwitchGroupRules[0].Group != "vip" {
		t.Fatalf("AutoSwitchGroupRules shared mutable state: got %s", fresh.AutoSwitchGroupRules[0].Group)
	}
}

func TestPaymentSettingConfigProviderUsesSnapshotAndLockedUpdate(t *testing.T) {
	original := GetPaymentSetting()
	t.Cleanup(func() {
		UpdatePaymentSetting(func(setting *PaymentSetting) {
			*setting = *original
			setting.AmountOptions = append([]int(nil), original.AmountOptions...)
			if original.AmountDiscount != nil {
				setting.AmountDiscount = make(map[int]float64, len(original.AmountDiscount))
				for amount, discount := range original.AmountDiscount {
					setting.AmountDiscount[amount] = discount
				}
			}
			setting.AutoSwitchGroupRules = append([]PaymentAutoSwitchGroupRule(nil), original.AutoSwitchGroupRules...)
		})
	})

	if err := config.GlobalConfig.LoadFromDB(map[string]string{
		"payment_setting.auto_switch_group_base_group": "   ",
	}); err != nil {
		t.Fatalf("LoadFromDB failed: %v", err)
	}

	paymentSetting := GetPaymentSetting()
	if paymentSetting.AutoSwitchGroupBaseGroup != "default" {
		t.Fatalf("base group = %q, want default", paymentSetting.AutoSwitchGroupBaseGroup)
	}

	cfgMap, err := config.ConfigToMap(config.GlobalConfig.Get("payment_setting"))
	if err != nil {
		t.Fatalf("ConfigToMap failed: %v", err)
	}
	if cfgMap["auto_switch_group_base_group"] != "default" {
		t.Fatalf("config snapshot base group = %q, want default", cfgMap["auto_switch_group_base_group"])
	}
}
