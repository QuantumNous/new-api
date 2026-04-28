package operation_setting

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
)

type PaymentAutoSwitchGroupRule struct {
	ThresholdUSD float64 `json:"threshold_usd"`
	Group        string  `json:"group"`
}

type PaymentSetting struct {
	AmountOptions                []int                        `json:"amount_options"`
	AmountDiscount               map[int]float64              `json:"amount_discount"`
	AutoSwitchGroupEnabled       bool                         `json:"auto_switch_group_enabled"`
	AutoSwitchGroupOnlyNewTopups bool                         `json:"auto_switch_group_only_new_topups"`
	AutoSwitchGroupEnabledFrom   int64                        `json:"auto_switch_group_enabled_from"`
	AutoSwitchGroupBaseGroup     string                       `json:"auto_switch_group_base_group"`
	AutoSwitchGroupRules         []PaymentAutoSwitchGroupRule `json:"auto_switch_group_rules"`
}

var paymentSetting = PaymentSetting{
	AmountOptions:                []int{10, 20, 50, 100, 200, 500},
	AmountDiscount:               map[int]float64{},
	AutoSwitchGroupEnabled:       false,
	AutoSwitchGroupOnlyNewTopups: false,
	AutoSwitchGroupEnabledFrom:   0,
	AutoSwitchGroupBaseGroup:     "default",
	AutoSwitchGroupRules:         []PaymentAutoSwitchGroupRule{},
}

var paymentSettingRWMutex sync.RWMutex

func init() {
	config.GlobalConfig.Register("payment_setting", paymentSettingConfig{})
}

type paymentSettingConfig struct{}

func (paymentSettingConfig) Snapshot() interface{} {
	return GetPaymentSetting()
}

func (paymentSettingConfig) UpdateConfig(configMap map[string]string) error {
	var updateErr error
	UpdatePaymentSetting(func(setting *PaymentSetting) {
		updateErr = config.UpdateConfigFromMap(setting, configMap)
	})
	return updateErr
}

func GetPaymentSetting() *PaymentSetting {
	paymentSettingRWMutex.RLock()
	defer paymentSettingRWMutex.RUnlock()
	return clonePaymentSettingLocked()
}

func UpdatePaymentSetting(update func(setting *PaymentSetting)) *PaymentSetting {
	paymentSettingRWMutex.Lock()
	defer paymentSettingRWMutex.Unlock()

	if update != nil {
		update(&paymentSetting)
	}
	paymentSetting.AutoSwitchGroupBaseGroup = NormalizePaymentAutoSwitchGroupBaseGroup(paymentSetting.AutoSwitchGroupBaseGroup)
	detachPaymentSettingLocked()
	return clonePaymentSettingLocked()
}

func detachPaymentSettingLocked() {
	paymentSetting.AmountOptions = append([]int(nil), paymentSetting.AmountOptions...)
	if paymentSetting.AmountDiscount != nil {
		amountDiscount := make(map[int]float64, len(paymentSetting.AmountDiscount))
		for amount, discount := range paymentSetting.AmountDiscount {
			amountDiscount[amount] = discount
		}
		paymentSetting.AmountDiscount = amountDiscount
	}
	paymentSetting.AutoSwitchGroupRules = append([]PaymentAutoSwitchGroupRule(nil), paymentSetting.AutoSwitchGroupRules...)
}

func clonePaymentSettingLocked() *PaymentSetting {
	snapshot := paymentSetting
	snapshot.AmountOptions = append([]int(nil), paymentSetting.AmountOptions...)
	if paymentSetting.AmountDiscount != nil {
		snapshot.AmountDiscount = make(map[int]float64, len(paymentSetting.AmountDiscount))
		for amount, discount := range paymentSetting.AmountDiscount {
			snapshot.AmountDiscount[amount] = discount
		}
	}
	snapshot.AutoSwitchGroupRules = append([]PaymentAutoSwitchGroupRule(nil), paymentSetting.AutoSwitchGroupRules...)
	return &snapshot
}

func NormalizePaymentAutoSwitchGroupBaseGroup(group string) string {
	group = strings.TrimSpace(group)
	if group == "" {
		return "default"
	}
	return group
}
