package service

import (
	"maps"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func GetUserUsableGroups(userGroup string) map[string]string {
	return GetUserUsableGroupsWithSetting(userGroup, dto.UserSetting{})
}

func GetUserUsableGroupsWithSetting(userGroup string, userSetting dto.UserSetting) map[string]string {
	globalGroups := setting.GetUserUsableGroupsCopy()
	groupsCopy := make(map[string]string, len(globalGroups))
	maps.Copy(groupsCopy, globalGroups)
	if userGroup != "" {
		if specialSettings, ok := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get(userGroup); ok {
			for specialGroup, desc := range specialSettings {
				if after, ok := strings.CutPrefix(specialGroup, "-:"); ok {
					delete(groupsCopy, after)
				} else if after, ok := strings.CutPrefix(specialGroup, "+:"); ok {
					groupsCopy[after] = desc
				} else {
					groupsCopy[specialGroup] = desc
				}
			}
		}
		if _, ok := groupsCopy[userGroup]; !ok {
			groupsCopy[userGroup] = "用户分组"
		}
	}
	allowed := NormalizeAllowedModelGroups(userSetting.AllowedModelGroups)
	if len(allowed) == 0 {
		return filterValidUserGroups(groupsCopy, ratio_setting.GetGroupRatioCopy())
	}

	validGroups := ratio_setting.GetGroupRatioCopy()
	result := make(map[string]string, len(globalGroups)+len(allowed))
	for group, desc := range globalGroups {
		if _, ok := validGroups[group]; ok {
			result[group] = desc
		}
	}
	for _, group := range allowed {
		if _, ok := validGroups[group]; ok {
			result[group] = setting.GetUsableGroupDescription(group)
		}
	}
	if _, ok := groupsCopy["auto"]; ok && autoGroupAllowed(result) {
		result["auto"] = groupsCopy["auto"]
	}
	return result
}

func filterValidUserGroups(groups map[string]string, validGroups map[string]float64) map[string]string {
	result := make(map[string]string, len(groups))
	for group, desc := range groups {
		if group == "auto" {
			result[group] = desc
			continue
		}
		if _, ok := validGroups[group]; ok {
			result[group] = desc
		}
	}
	return result
}

func autoGroupAllowed(groups map[string]string) bool {
	for _, autoGroup := range setting.GetAutoGroups() {
		if _, ok := groups[autoGroup]; ok {
			return true
		}
	}
	return false
}

func NormalizeAllowedModelGroups(groups []string) []string {
	if len(groups) == 0 {
		return nil
	}
	result := make([]string, 0, len(groups))
	seen := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		group = strings.TrimSpace(group)
		if group == "" {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		result = append(result, group)
	}
	return result
}

func GetUserAssignedModelGroupsWithSetting(userSetting dto.UserSetting) map[string]string {
	result := make(map[string]string)
	validGroups := ratio_setting.GetGroupRatioCopy()
	for _, group := range NormalizeAllowedModelGroups(userSetting.AllowedModelGroups) {
		if _, ok := validGroups[group]; ok {
			result[group] = setting.GetUsableGroupDescription(group)
		}
	}
	return result
}

func GroupInUserUsableGroups(userGroup, groupName string) bool {
	_, ok := GetUserUsableGroups(userGroup)[groupName]
	return ok
}

func GroupInUserUsableGroupsWithSetting(userGroup, groupName string, userSetting dto.UserSetting) bool {
	_, ok := GetUserUsableGroupsWithSetting(userGroup, userSetting)[groupName]
	return ok
}

func IsUserSelectableGroup(userGroup, groupName string) bool {
	if groupName == "" || groupName == "auto" {
		return false
	}
	return GroupInUserUsableGroups(userGroup, groupName) && ratio_setting.ContainsGroupRatio(groupName)
}

// GetUserAutoGroup 根据用户分组获取自动分组设置
func GetUserAutoGroup(userGroup string) []string {
	return GetUserAutoGroupWithSetting(userGroup, dto.UserSetting{})
}

func GetUserAutoGroupWithSetting(userGroup string, userSetting dto.UserSetting) []string {
	groups := GetUserUsableGroupsWithSetting(userGroup, userSetting)
	autoGroups := make([]string, 0)
	seen := make(map[string]struct{})
	for _, group := range setting.GetAutoGroups() {
		if _, ok := groups[group]; !ok {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		autoGroups = append(autoGroups, group)
	}
	return autoGroups
}

// FilterUserTokenAutoGroups applies current permissions before the current
// per-token limit. It intentionally does not fall back to the global Auto list.
func FilterUserTokenAutoGroups(userGroup string, groups []string) []string {
	return FilterUserTokenAutoGroupsWithSetting(userGroup, dto.UserSetting{}, groups)
}

func FilterUserTokenAutoGroupsWithSetting(userGroup string, userSetting dto.UserSetting, groups []string) []string {
	maxCount := setting.GetMaxTokenAutoGroups()
	filtered := make([]string, 0, min(len(groups), maxCount))
	seen := make(map[string]struct{})
	for _, group := range groups {
		if group == "" || group == "auto" || !ratio_setting.ContainsGroupRatio(group) {
			continue
		}
		if _, ok := GetUserUsableGroupsWithSetting(userGroup, userSetting)[group]; !ok {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		filtered = append(filtered, group)
		if len(filtered) == maxCount {
			break
		}
	}
	return filtered
}

// GetRequestAutoGroups resolves the ordered Auto groups for the current token.
// The absence of the context value means that the token inherits the complete
// global Auto list; a present (even empty) value is an explicit token snapshot.
func GetRequestAutoGroups(c *gin.Context, userGroup string) []string {
	userSetting, _ := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting)
	value, ok := common.GetContextKey(c, constant.ContextKeyTokenAutoGroups)
	if !ok {
		return GetUserAutoGroupWithSetting(userGroup, userSetting)
	}
	groups, ok := value.([]string)
	if !ok {
		return []string{}
	}
	return FilterUserTokenAutoGroupsWithSetting(userGroup, userSetting, groups)
}

// GetGroupsEnabledModels 按 groups 顺序获取各分组启用的模型并去重
func GetGroupsEnabledModels(groups []string) []string {
	seen := make(map[string]struct{})
	models := make([]string, 0)
	for _, group := range groups {
		for _, modelName := range model.GetGroupEnabledModels(group) {
			if _, ok := seen[modelName]; !ok {
				seen[modelName] = struct{}{}
				models = append(models, modelName)
			}
		}
	}
	return models
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

func GetUserGroupRatioWithSetting(userGroup, group string, userSetting dto.UserSetting) float64 {
	if overrideRatio, ok := UserGroupRatioOverride(userSetting, group); ok {
		return overrideRatio
	}
	return GetUserGroupRatio(userGroup, group)
}
