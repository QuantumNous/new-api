package service

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

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

// GetUserAutoGroup 根据用户分组获取自动分组设置
func GetUserAutoGroup(userGroup string) []string {
	groups := GetUserUsableGroups(userGroup)
	return getAutoGroupsFromUsableGroups(groups)
}

// GetUserAutoGroupForUser applies the current runtime visibility policy before
// returning auto-group candidates. A policy read error is returned so callers
// can fail closed instead of routing through an unverified group.
func GetUserAutoGroupForUser(userId int, userGroup string) ([]string, error) {
	groups := GetUserUsableGroups(userGroup)
	if userId > 0 {
		var err error
		groups, err = GetUserSelectableTokenGroups(userId)
		if err != nil {
			return nil, err
		}
	}
	return getAutoGroupsFromUsableGroups(groups), nil
}

func getAutoGroupsFromUsableGroups(groups map[string]string) []string {
	autoGroups := make([]string, 0)
	for _, group := range setting.GetAutoGroups() {
		if _, ok := groups[group]; ok {
			autoGroups = append(autoGroups, group)
		}
	}
	return autoGroups
}

// FilterModelsByUserGroups removes models that are available only through a
// group currently hidden from the user. Models not associated with any
// configured group remain eligible for the existing token-model-limit and
// custom-model semantics.
func FilterModelsByUserGroups(userId int, modelNames []string) ([]string, error) {
	if userId <= 0 {
		return modelNames, nil
	}
	user, err := model.GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	allGroups := GetUserUsableGroups(user.Group)
	authorizedGroups, err := GetUserSelectableTokenGroups(userId)
	if err != nil {
		return nil, err
	}
	managedModels := make(map[string]struct{})
	authorizedModels := make(map[string]struct{})
	for group := range allGroups {
		for _, modelName := range model.GetGroupEnabledModels(group) {
			managedModels[modelName] = struct{}{}
		}
	}
	for group := range authorizedGroups {
		for _, modelName := range model.GetGroupEnabledModels(group) {
			authorizedModels[modelName] = struct{}{}
		}
	}
	filtered := make([]string, 0, len(modelNames))
	for _, modelName := range modelNames {
		if _, managed := managedModels[modelName]; managed {
			if _, authorized := authorizedModels[modelName]; !authorized {
				continue
			}
		}
		filtered = append(filtered, modelName)
	}
	return filtered, nil
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
