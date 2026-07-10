package operation_setting

import (
	"sync"

	"github.com/QuantumNous/new-api/setting/config"
)

// BillingGroupSetting 控制分组与资金来源的绑定关系。
// 配置在 personal_funding_groups 中的分组，使用时会排除 source=bind_group
// 的公司自动分配订阅，只允许扣减个人自购套餐或钱包余额。
type BillingGroupSetting struct {
	// PersonalFundingGroups 是需要个人付费的分组名称列表。
	// 当请求的 UsingGroup 命中此列表时，排除公司套餐（source=bind_group）。
	PersonalFundingGroups []string `json:"personal_funding_groups"`
}

var (
	billingGroupSetting     = BillingGroupSetting{}
	billingGroupSettingMu   sync.RWMutex
	billingGroupGroupSet    = map[string]struct{}{} // 用于 O(1) 查找
	billingGroupGroupSetMu  sync.RWMutex
)

func init() {
	config.GlobalConfig.Register("billing_group_setting", &billingGroupSetting)
}

// GetBillingGroupSetting 返回当前配置的指针（供管理端读取）。
func GetBillingGroupSetting() *BillingGroupSetting {
	billingGroupSettingMu.RLock()
	defer billingGroupSettingMu.RUnlock()
	return &billingGroupSetting
}

// IsPersonalFundingGroup 判断指定分组是否需要个人付费（即排除公司套餐）。
// 该函数构建并缓存一个 set 以实现 O(1) 查找。
func IsPersonalFundingGroup(groupName string) bool {
	if groupName == "" {
		return false
	}

	// 检查缓存是否需要刷新
	billingGroupGroupSetMu.RLock()
	if billingGroupSettingChanged() {
		billingGroupGroupSetMu.RUnlock()
		refreshBillingGroupGroupSet()
		billingGroupGroupSetMu.RLock()
	}
	defer billingGroupGroupSetMu.RUnlock()

	_, ok := billingGroupGroupSet[groupName]
	return ok
}

// billingGroupSettingChanged 检查配置是否与缓存一致（调用方需持有读锁）。
func billingGroupSettingChanged() bool {
	billingGroupSettingMu.RLock()
	defer billingGroupSettingMu.RUnlock()
	if len(billingGroupSetting.PersonalFundingGroups) != len(billingGroupGroupSet) {
		return true
	}
	for _, g := range billingGroupSetting.PersonalFundingGroups {
		if _, ok := billingGroupGroupSet[g]; !ok {
			return true
		}
	}
	return false
}

// refreshBillingGroupGroupSet 重建查找缓存。
func refreshBillingGroupGroupSet() {
	billingGroupSettingMu.RLock()
	newSet := make(map[string]struct{}, len(billingGroupSetting.PersonalFundingGroups))
	for _, g := range billingGroupSetting.PersonalFundingGroups {
		newSet[g] = struct{}{}
	}
	billingGroupSettingMu.RUnlock()

	billingGroupGroupSetMu.Lock()
	billingGroupGroupSet = newSet
	billingGroupGroupSetMu.Unlock()
}
