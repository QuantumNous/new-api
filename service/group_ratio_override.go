package service

import (
	"math"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func NormalizeGroupRatioOverrides(overrides map[string]float64) map[string]float64 {
	if len(overrides) == 0 {
		return nil
	}
	normalized := make(map[string]float64, len(overrides))
	for group, ratio := range overrides {
		group = strings.TrimSpace(group)
		if group == "" || ratio < 0 || math.IsNaN(ratio) || math.IsInf(ratio, 0) {
			continue
		}
		normalized[group] = ratio
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

func ValidateGroupRatioOverrides(overrides map[string]float64) bool {
	for group, ratio := range overrides {
		group = strings.TrimSpace(group)
		if group == "" || !ratio_setting.ContainsGroupRatio(group) || ratio < 0 || math.IsNaN(ratio) || math.IsInf(ratio, 0) {
			return false
		}
	}
	return true
}

func UserGroupRatioOverride(userSetting dto.UserSetting, group string) (float64, bool) {
	if len(userSetting.GroupRatioOverrides) == 0 {
		return 0, false
	}
	ratio, ok := userSetting.GroupRatioOverrides[strings.TrimSpace(group)]
	if !ok || ratio < 0 || math.IsNaN(ratio) || math.IsInf(ratio, 0) {
		return 0, false
	}
	return ratio, true
}

// ResolveGroupRatioForBilling 是计费链路的唯一倍率解析入口。
// 优先级：用户专属倍率 > 全局组间倍率 > 全局分组倍率。
//
// 计费（service/quota.go 后扣费、relay/helper/price.go 预扣费、
// service/task_billing.go 异步任务结算）必须全部经过这里，
// 否则用户专属倍率只会体现在界面显示上，实际扣费仍按全局倍率执行。
//
// userSetting 允许为空值（零值 dto.UserSetting），此时等价于没有专属倍率。
func ResolveGroupRatioForBilling(userGroup, usingGroup string, userSetting dto.UserSetting) (float64, bool) {
	if override, ok := UserGroupRatioOverride(userSetting, usingGroup); ok {
		return override, true
	}
	if userGroupRatio, ok := ratio_setting.GetGroupGroupRatio(userGroup, usingGroup); ok {
		return userGroupRatio, true
	}
	return ratio_setting.GetGroupRatio(usingGroup), false
}
