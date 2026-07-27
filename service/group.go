package service

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

const (
	MaxTokenGroupCandidates = 8
	MaxTokenGroupNameLength = 64
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

func ValidateTokenGroup(userGroup, group string) error {
	if group == "" {
		return nil
	}
	if strings.TrimSpace(group) == "" {
		return fmt.Errorf("分组不能为空")
	}
	if utf8.RuneCountInString(group) > MaxTokenGroupNameLength {
		return fmt.Errorf("分组名称长度不能超过 %d 个字符", MaxTokenGroupNameLength)
	}
	if group == "auto" {
		if !GroupInUserUsableGroups(userGroup, group) {
			return fmt.Errorf("无权访问 %s 分组", group)
		}
		return nil
	}
	return validateConcreteTokenGroup(userGroup, group)
}

// ValidateTokenGroupCandidates validates concrete groups independently of the
// virtual "auto" group permission. Custom ordered candidates are stored with
// Group="auto", but they must not require "auto" to be exposed to the user.
func ValidateTokenGroupCandidates(userGroup string, groups []string) error {
	if len(groups) > MaxTokenGroupCandidates {
		return fmt.Errorf("候选分组不能超过 %d 个", MaxTokenGroupCandidates)
	}
	seen := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		if strings.TrimSpace(group) == "" {
			return fmt.Errorf("候选分组不能为空")
		}
		if utf8.RuneCountInString(group) > MaxTokenGroupNameLength {
			return fmt.Errorf("候选分组名称长度不能超过 %d 个字符", MaxTokenGroupNameLength)
		}
		if group == "auto" {
			return fmt.Errorf("候选分组不能包含 auto")
		}
		if _, ok := seen[group]; ok {
			return fmt.Errorf("候选分组不能重复: %s", group)
		}
		seen[group] = struct{}{}
		if err := validateConcreteTokenGroup(userGroup, group); err != nil {
			return err
		}
	}
	return nil
}

func validateConcreteTokenGroup(userGroup, group string) error {
	if !GroupInUserUsableGroups(userGroup, group) {
		return fmt.Errorf("无权访问 %s 分组", group)
	}
	if !ratio_setting.ContainsGroupRatio(group) {
		return fmt.Errorf("分组 %s 已被弃用", group)
	}
	return nil
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
