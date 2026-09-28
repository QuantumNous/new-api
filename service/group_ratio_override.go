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
