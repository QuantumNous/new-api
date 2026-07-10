package service

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

const AutoOptGroup = "AutoOpt"

func IsAutoOptGroup(group string) bool {
	return group == AutoOptGroup
}

func GetUserUsableGroups(userGroup string) map[string]string {
	groupsCopy := setting.GetUserUsableGroupsCopy()
	if userGroup != "" {
		specialSettings, b := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get(userGroup)
		if b {
			// 处理特殊可用分组
			for specialGroup, desc := range specialSettings {
				if strings.HasPrefix(specialGroup, "-:") {
					// 移除分组
					groupToRemove := strings.TrimPrefix(specialGroup, "-:")
					delete(groupsCopy, groupToRemove)
				} else if strings.HasPrefix(specialGroup, "+:") {
					// 添加分组
					groupToAdd := strings.TrimPrefix(specialGroup, "+:")
					groupsCopy[groupToAdd] = desc
				} else {
					// 直接添加分组
					groupsCopy[specialGroup] = desc
				}
			}
		}
		// 如果userGroup不在UserUsableGroups中，返回UserUsableGroups + userGroup
		if _, ok := groupsCopy[userGroup]; !ok {
			groupsCopy[userGroup] = "用户分组"
		}
	}
	return groupsCopy
}

func GroupInUserUsableGroups(userGroup, groupName string) bool {
	_, ok := GetUserUsableGroups(userGroup)[groupName]
	return ok
}

func UserCanUseAutoOptGroup(userGroup string) bool {
	return GroupInUserUsableGroups(userGroup, AutoOptGroup)
}

// GetUserAutoGroup 根据用户分组获取自动分组设置
func GetUserAutoGroup(userGroup string) []string {
	groups := GetUserUsableGroups(userGroup)
	autoGroups := make([]string, 0)
	for _, group := range setting.GetAutoGroups() {
		if _, ok := groups[group]; ok {
			autoGroups = append(autoGroups, group)
		}
	}
	return autoGroups
}

// GetUserGroupRatio 获取用户使用某个分组的倍率
// userGroup 用户分组
// group 需要获取倍率的分组
func GetUserGroupRatio(userGroup, group string) float64 {
	ratio, ok := ratio_setting.GetGroupGroupRatio(userGroup, group)
	if ok {
		return ratio
	}
	return ratio_setting.GetGroupRatio(group)
}

func HasUserGroupRatio(userGroup, group string) bool {
	if _, ok := ratio_setting.GetGroupGroupRatio(userGroup, group); ok {
		return true
	}
	return ratio_setting.ContainsGroupRatio(group)
}

func GetUserPricedUsableGroups(userGroup string) map[string]string {
	pricedGroups := make(map[string]string)
	for group, desc := range GetUserUsableGroups(userGroup) {
		if IsAutoOptGroup(group) || group == "auto" {
			continue
		}
		if HasUserGroupRatio(userGroup, group) {
			pricedGroups[group] = desc
		}
	}
	return pricedGroups
}

func GetUserAutoOptGroups(userGroup string) []string {
	if !UserCanUseAutoOptGroup(userGroup) {
		return nil
	}
	pricedGroups := GetUserPricedUsableGroups(userGroup)
	groups := make([]string, 0, len(pricedGroups))
	for group := range pricedGroups {
		groups = append(groups, group)
	}
	sort.SliceStable(groups, func(i, j int) bool {
		leftRatio := GetUserGroupRatio(userGroup, groups[i])
		rightRatio := GetUserGroupRatio(userGroup, groups[j])
		if leftRatio == rightRatio {
			return groups[i] < groups[j]
		}
		return leftRatio < rightRatio
	})
	return groups
}
