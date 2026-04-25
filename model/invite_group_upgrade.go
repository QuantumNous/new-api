package model

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

type InviteGroupUpgradeResult struct {
	UserId        int    `json:"user_id"`
	AffCount      int    `json:"aff_count"`
	PreviousGroup string `json:"previous_group"`
	TargetGroup   string `json:"target_group"`
	Changed       bool   `json:"changed"`
	Reason        string `json:"reason"`
}

type InviteGroupUpgradeSummary struct {
	Scanned  int                        `json:"scanned"`
	Eligible int                        `json:"eligible"`
	Upgraded int                        `json:"upgraded"`
	Skipped  int                        `json:"skipped"`
	Results  []InviteGroupUpgradeResult `json:"results,omitempty"`
}

func matchInviteGroupUpgradeRule(affCount int) (operation_setting.InviteGroupUpgradeRule, bool) {
	var matched operation_setting.InviteGroupUpgradeRule
	found := false
	for _, rule := range operation_setting.GetEnabledInviteGroupUpgradeRules() {
		if affCount >= rule.InviteCount {
			matched = rule
			found = true
		}
	}
	return matched, found
}

func getInviteGroupUpgradeRankMap() map[string]int {
	rankMap := make(map[string]int)
	for _, rule := range operation_setting.GetEnabledInviteGroupUpgradeRules() {
		rankMap[rule.TargetGroup] = rule.InviteCount
	}
	return rankMap
}

func normalizeUserGroup(group string) string {
	group = strings.TrimSpace(group)
	if group == "" {
		return "default"
	}
	return group
}

func canUpgradeByInviteRule(currentGroup, targetGroup string, rankMap map[string]int) (bool, string) {
	currentGroup = normalizeUserGroup(currentGroup)
	targetGroup = normalizeUserGroup(targetGroup)

	if targetGroup == "" {
		return false, "empty_target_group"
	}
	if currentGroup == targetGroup {
		return false, "already_in_target_group"
	}

	targetRank, targetRankExists := rankMap[targetGroup]
	if !targetRankExists {
		return false, "target_group_not_in_rules"
	}

	if currentRank, currentRankExists := rankMap[currentGroup]; currentRankExists {
		if currentRank >= targetRank {
			return false, "current_group_rank_not_lower"
		}
		return true, ""
	}

	if currentGroup == "default" {
		return true, ""
	}

	return false, "current_group_not_managed_by_invite_rules"
}

func applyInviteGroupUpgradeForUser(user *User, requireEnabled bool) (*InviteGroupUpgradeResult, error) {
	result := &InviteGroupUpgradeResult{}
	if user == nil || user.Id == 0 {
		result.Reason = "invalid_user"
		return result, nil
	}

	result.UserId = user.Id
	result.AffCount = user.AffCount
	result.PreviousGroup = normalizeUserGroup(user.Group)

	setting := operation_setting.GetInviteGroupUpgradeSetting()
	if requireEnabled && !setting.Enabled {
		result.Reason = "feature_disabled"
		return result, nil
	}

	targetRule, matched := matchInviteGroupUpgradeRule(user.AffCount)
	if !matched {
		result.Reason = "invite_count_not_reached"
		return result, nil
	}
	if _, ok := ratio_setting.GetGroupRatioCopy()[targetRule.TargetGroup]; !ok {
		result.Reason = "target_group_not_exists"
		return result, nil
	}
	result.TargetGroup = targetRule.TargetGroup

	canUpgrade, reason := canUpgradeByInviteRule(result.PreviousGroup, targetRule.TargetGroup, getInviteGroupUpgradeRankMap())
	if !canUpgrade {
		result.Reason = reason
		return result, nil
	}

	if err := DB.Model(&User{}).Where("id = ?", user.Id).Update("group", targetRule.TargetGroup).Error; err != nil {
		return nil, err
	}

	user.Group = targetRule.TargetGroup
	freshUser, err := GetUserById(user.Id, false)
	if err == nil && freshUser != nil {
		_ = updateUserCache(*freshUser)
	} else {
		_ = updateUserGroupCache(user.Id, targetRule.TargetGroup)
	}

	result.Changed = true
	result.Reason = "upgraded"

	RecordLog(user.Id, LogTypeSystem, fmt.Sprintf("邀请达标，用户分组已自动升级为 %s", targetRule.TargetGroup))
	common.SysLog(fmt.Sprintf("invite group upgrade applied: user_id=%d aff_count=%d %s->%s", user.Id, user.AffCount, result.PreviousGroup, targetRule.TargetGroup))
	return result, nil
}

func ApplyInviteGroupUpgradeByUserID(userId int, requireEnabled bool) (*InviteGroupUpgradeResult, error) {
	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	return applyInviteGroupUpgradeForUser(user, requireEnabled)
}

func ApplyInviteGroupUpgradeForAllUsers(requireEnabled bool) (*InviteGroupUpgradeSummary, error) {
	summary := &InviteGroupUpgradeSummary{}
	var users []User
	if err := DB.Select("id", commonGroupCol, "aff_count").Where("aff_count > 0").Find(&users).Error; err != nil {
		return nil, err
	}

	summary.Scanned = len(users)
	for i := range users {
		result, err := applyInviteGroupUpgradeForUser(&users[i], requireEnabled)
		if err != nil {
			return nil, err
		}
		if result == nil {
			continue
		}
		if result.TargetGroup != "" {
			summary.Eligible++
		}
		if result.Changed {
			summary.Upgraded++
		} else {
			summary.Skipped++
		}
		summary.Results = append(summary.Results, *result)
	}
	return summary, nil
}
