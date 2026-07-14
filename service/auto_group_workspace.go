package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type AutoGroupContext struct {
	UserId               int      `json:"user_id"`
	FeishuOpenId         string   `json:"feishu_open_id"`
	CurrentGroup         string   `json:"current_group"`
	JobTitle             string   `json:"job_title"`
	OrgLevel1Name        string   `json:"org_level1_name"`
	OrgLevel2Name        string   `json:"org_level2_name"`
	DepartmentName       string   `json:"department_name"`
	ParentDepartmentName string   `json:"parent_department_name"`
	OrgPath              string   `json:"org_path"`
	FeishuGroupIds       []string `json:"feishu_group_ids"`
	FeishuGroupNames     []string `json:"feishu_group_names"`
	ManualGroupLocked    bool     `json:"manual_group_locked"`
}

type AutoGroupDecision struct {
	UserId         int    `json:"user_id"`
	CurrentGroup   string `json:"current_group"`
	SuggestedGroup string `json:"suggested_group"`
	Confidence     string `json:"confidence"`
	Action         string `json:"action"`
	Reason         string `json:"reason"`
	Source         string `json:"source"`
}

type AutoGroupDashboard struct {
	TotalUsers           int   `json:"total_users"`
	AutoApplyCount       int64 `json:"auto_apply_count"`
	ConfirmRequiredCount int64 `json:"confirm_required_count"`
	SkipCount            int64 `json:"skip_count"`
	ProtectedCount       int64 `json:"protected_count"`
}

type AutoGroupIdentityRule struct {
	Name        string `json:"name"`
	TargetGroup string `json:"target_group"`
	Description string `json:"description"`
	ManualOnly  bool   `json:"manual_only"`
}

type AutoGroupReplayResult struct {
	TotalUsers           int `json:"total_users"`
	AutoApplyCount       int `json:"auto_apply_count"`
	ConfirmRequiredCount int `json:"confirm_required_count"`
	SkipCount            int `json:"skip_count"`
}

type AutoGroupApplyMappingsResult struct {
	TotalUsers int `json:"total_users"`
	Applied    int `json:"applied"`
	Skipped    int `json:"skipped"`
}

func BuildAutoGroupContext(user model.User) AutoGroupContext {
	return AutoGroupContext{
		UserId:               user.Id,
		FeishuOpenId:         user.FeishuId,
		CurrentGroup:         user.Group,
		ManualGroupLocked:    user.ManualGroupLocked,
		JobTitle:             strings.TrimSpace(user.JobTitle),
		OrgLevel1Name:        strings.TrimSpace(user.OrgLevel1Name),
		OrgLevel2Name:        strings.TrimSpace(user.OrgLevel2Name),
		DepartmentName:       strings.TrimSpace(user.FeishuDepartmentName),
		ParentDepartmentName: strings.TrimSpace(user.FeishuParentDepartmentName),
		OrgPath:              strings.TrimSpace(user.OrgPath),
	}
}

func ClassifyAutoGroup(ctx AutoGroupContext) AutoGroupDecision {
	ctx.JobTitle = strings.TrimSpace(ctx.JobTitle)
	ctx.CurrentGroup = strings.TrimSpace(ctx.CurrentGroup)
	if ctx.ManualGroupLocked {
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceHigh, Reason: "管理员手动维护分组", Source: "manual_group_locked"}
	}
	if IsProtectedGroup(ctx.CurrentGroup) {
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceHigh, Reason: "当前分组受保护", Source: "protected"}
	}
	// 岗位映射由管理员维护，优先于飞书通讯录用户组映射；人工锁定和
	// 受保护分组仍保持更高优先级，避免覆盖管理员的明确分配。
	if targetGroup, err := ResolveGroupByJobTitle(ctx.JobTitle); err == nil && targetGroup != "" {
		if ctx.CurrentGroup == targetGroup {
			return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: targetGroup, Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceHigh, Reason: "飞书岗位已匹配当前套餐分组", Source: "feishu_job_title"}
		}
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: targetGroup, Action: model.AutoGroupActionAutoApply, Confidence: model.AutoGroupConfidenceHigh, Reason: "飞书岗位命中套餐映射: " + ctx.JobTitle, Source: "feishu_job_title"}
	}
	if mapping, err := model.FindFeishuGroupPackageMapping(ctx.FeishuGroupIds, ctx.FeishuGroupNames); err == nil && mapping != nil {
		if ctx.CurrentGroup == mapping.TargetGroup {
			return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: mapping.TargetGroup, Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceHigh, Reason: "飞书用户组已匹配当前套餐分组", Source: "feishu_user_group"}
		}
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: mapping.TargetGroup, Action: model.AutoGroupActionAutoApply, Confidence: model.AutoGroupConfidenceHigh, Reason: "飞书用户组命中套餐映射: " + mapping.FeishuGroupName, Source: "feishu_user_group"}
	}
	if ctx.CurrentGroup == "pending" {
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: "pending", Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceHigh, Reason: "未命中飞书用户组套餐映射，已在 pending 分组", Source: "pending_fallback"}
	}
	return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: "pending", Action: model.AutoGroupActionAutoApply, Confidence: model.AutoGroupConfidenceHigh, Reason: "未命中飞书用户组套餐映射，归入 pending 分组", Source: "pending_fallback"}
}

func ReplayAutoGroupSuggestions() (*AutoGroupReplayResult, error) {
	users, err := model.ListUsersForAutoGroupReplay()
	if err != nil {
		return nil, err
	}
	suggestions := make([]model.AutoGroupSuggestion, 0, len(users))
	result := &AutoGroupReplayResult{TotalUsers: len(users)}
	catalog, catalogErr := FetchFeishuGroupCatalog()
	for _, user := range users {
		if strings.TrimSpace(user.FeishuId) == "" {
			result.SkipCount++
			continue
		}
		ctx := BuildAutoGroupContext(user)
		if catalogErr == nil && strings.TrimSpace(ctx.FeishuOpenId) != "" {
			membership, groupErr := FetchFeishuUserGroupMembershipDetail(ctx.FeishuOpenId, catalog)
			if groupErr == nil {
				ctx.FeishuGroupIds = membership.Ids
				ctx.FeishuGroupNames = membership.Names
				if err := UpdateUserFeishuGroupMembership(user.Id, membership); err != nil {
					common.SysLog("auto-group: update feishu user groups failed for user " + user.Username + ": " + err.Error())
				}
			} else if groupErr != feishuNotConfiguredErr {
				common.SysLog("auto-group: fetch feishu user groups failed for user " + user.Username + ": " + groupErr.Error())
			}
		}
		decision := ClassifyAutoGroup(ctx)
		snapshot, _ := common.Marshal(ctx)
		suggestions = append(suggestions, model.AutoGroupSuggestion{
			UserId:         user.Id,
			Username:       user.Username,
			DisplayName:    user.DisplayName,
			Email:          user.Email,
			CurrentGroup:   user.Group,
			SuggestedGroup: decision.SuggestedGroup,
			Confidence:     decision.Confidence,
			Action:         decision.Action,
			Reason:         decision.Reason,
			Source:         decision.Source,
			Status:         model.AutoGroupSuggestionPending,
			JobTitle:       user.JobTitle,
			OrgLevel1Name:  user.OrgLevel1Name,
			OrgLevel2Name:  user.OrgLevel2Name,
			DepartmentName: user.FeishuDepartmentName,
			ParentDeptName: user.FeishuParentDepartmentName,
			OrgPath:        user.OrgPath,
			SnapshotJson:   string(snapshot),
		})
		switch decision.Action {
		case model.AutoGroupActionAutoApply:
			result.AutoApplyCount++
		case model.AutoGroupActionConfirmRequired:
			result.ConfirmRequiredCount++
		case model.AutoGroupActionSkip:
			result.SkipCount++
		}
	}
	if err := model.ReplaceAutoGroupPendingSuggestions(suggestions); err != nil {
		return nil, err
	}
	return result, nil
}

func GetAutoGroupDashboard() (*AutoGroupDashboard, error) {
	users, err := model.ListUsersForAutoGroupReplay()
	if err != nil {
		return nil, err
	}
	counts, err := model.CountAutoGroupSuggestionsByStatus(model.AutoGroupSuggestionPending)
	if err != nil {
		return nil, err
	}
	var protectedCount int64
	for _, user := range users {
		if IsProtectedGroup(user.Group) {
			protectedCount++
		}
	}
	return &AutoGroupDashboard{
		TotalUsers:           len(users),
		AutoApplyCount:       counts[model.AutoGroupActionAutoApply],
		ConfirmRequiredCount: counts[model.AutoGroupActionConfirmRequired],
		SkipCount:            counts[model.AutoGroupActionSkip],
		ProtectedCount:       protectedCount,
	}, nil
}

func ApplyAutoGroupMappingsNow() (*AutoGroupApplyMappingsResult, error) {
	users, err := model.ListUsersForAutoGroupReplay()
	if err != nil {
		return nil, err
	}
	result := &AutoGroupApplyMappingsResult{TotalUsers: len(users)}
	catalog, catalogErr := FetchFeishuGroupCatalog()
	for _, user := range users {
		if strings.TrimSpace(user.FeishuId) == "" {
			result.Skipped++
			continue
		}
		ctx := BuildAutoGroupContext(user)
		if catalogErr == nil {
			membership, groupErr := FetchFeishuUserGroupMembershipDetail(ctx.FeishuOpenId, catalog)
			if groupErr == nil {
				ctx.FeishuGroupIds = membership.Ids
				ctx.FeishuGroupNames = membership.Names
				if err := UpdateUserFeishuGroupMembership(user.Id, membership); err != nil {
					common.SysLog("auto-group: update feishu user groups failed for user " + user.Username + ": " + err.Error())
				}
			} else if groupErr != feishuNotConfiguredErr {
				common.SysLog("auto-group: fetch feishu user groups failed for user " + user.Username + ": " + groupErr.Error())
			}
		} else if catalogErr != feishuNotConfiguredErr {
			common.SysLog("auto-group: fetch feishu group catalog failed: " + catalogErr.Error())
		}
		decision := ClassifyAutoGroup(ctx)
		if decision.Action != model.AutoGroupActionAutoApply || decision.SuggestedGroup == "" {
			result.Skipped++
			continue
		}
		if err := ApplyAutoGroupChange(user.Id, user.Group, decision.SuggestedGroup); err != nil {
			return result, err
		}
		result.Applied++
	}
	return result, nil
}

func ApplyHighConfidenceAutoGroupSuggestions() (int, error) {
	suggestions, err := model.ListAutoGroupSuggestions(model.AutoGroupSuggestionPending)
	if err != nil {
		return 0, err
	}
	applied := 0
	for _, suggestion := range suggestions {
		if suggestion.Action != model.AutoGroupActionAutoApply || suggestion.Confidence != model.AutoGroupConfidenceHigh || suggestion.SuggestedGroup == "" {
			continue
		}
		var user model.User
		if err := model.DB.Select("manual_group_locked").Where("id = ?", suggestion.UserId).First(&user).Error; err == nil && user.ManualGroupLocked {
			continue
		}
		if IsProtectedGroup(suggestion.CurrentGroup) {
			continue
		}
		if err := ApplyAutoGroupChange(suggestion.UserId, suggestion.CurrentGroup, suggestion.SuggestedGroup); err != nil {
			return applied, err
		}
		if err := model.UpdateAutoGroupSuggestionStatus(suggestion.Id, model.AutoGroupSuggestionApplied); err != nil {
			return applied, err
		}
		applied++
	}
	return applied, nil
}

func ConfirmAutoGroupSuggestion(suggestionId, operatorId int, targetGroup string) error {
	suggestion, err := model.GetAutoGroupSuggestionById(suggestionId)
	if err != nil {
		return err
	}
	targetGroup = strings.TrimSpace(targetGroup)
	if targetGroup == "" {
		targetGroup = suggestion.SuggestedGroup
	}
	if targetGroup == "" {
		return nil
	}
	if err := ApplyAutoGroupChange(suggestion.UserId, suggestion.CurrentGroup, targetGroup); err != nil {
		return err
	}
	if err := model.CreateAutoGroupConfirmation(&model.AutoGroupConfirmation{
		UserId:               suggestion.UserId,
		JobTitle:             suggestion.JobTitle,
		OrgLevel1Name:        suggestion.OrgLevel1Name,
		OrgLevel2Name:        suggestion.OrgLevel2Name,
		ParentDepartmentName: suggestion.ParentDeptName,
		DepartmentName:       suggestion.DepartmentName,
		OrgPath:              suggestion.OrgPath,
		FromGroup:            suggestion.CurrentGroup,
		ConfirmedGroup:       targetGroup,
		OperatorId:           operatorId,
	}); err != nil {
		return err
	}
	return model.UpdateAutoGroupSuggestionStatus(suggestion.Id, model.AutoGroupSuggestionApplied)
}

func ListAutoGroupIdentityRules() []AutoGroupIdentityRule {
	return []AutoGroupIdentityRule{
		{Name: "飞书用户组映射", TargetGroup: "套餐分组", Description: "按管理员配置的飞书通讯录用户组到套餐分组映射自动分组", ManualOnly: false},
		{Name: "保护分组", TargetGroup: "当前分组", Description: "已在受保护分组中的用户不会被自动改到其他分组", ManualOnly: true},
	}
}
