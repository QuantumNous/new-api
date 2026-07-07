package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type AutoGroupContext struct {
	UserId               int    `json:"user_id"`
	CurrentGroup         string `json:"current_group"`
	JobTitle             string `json:"job_title"`
	OrgLevel1Name        string `json:"org_level1_name"`
	OrgLevel2Name        string `json:"org_level2_name"`
	DepartmentName       string `json:"department_name"`
	ParentDepartmentName string `json:"parent_department_name"`
	OrgPath              string `json:"org_path"`
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

func BuildAutoGroupContext(user model.User) AutoGroupContext {
	return AutoGroupContext{
		UserId:               user.Id,
		CurrentGroup:         user.Group,
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
	if IsProtectedGroup(ctx.CurrentGroup) {
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceHigh, Reason: "当前分组受保护", Source: "protected"}
	}
	if ctx.JobTitle == "" {
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceLow, Reason: "岗位为空", Source: "no_match"}
	}
	if isManualOnlyGroupJob(ctx.JobTitle) {
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, Action: model.AutoGroupActionConfirmRequired, Confidence: model.AutoGroupConfidenceMedium, Reason: "疑似管理员手动维护分组", Source: "manual_only"}
	}
	if group, reason := matchBuiltInAutoGroup(ctx); group != "" {
		if ctx.CurrentGroup == group {
			return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: group, Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceHigh, Reason: "已在目标分组", Source: "builtin_rule"}
		}
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: group, Action: model.AutoGroupActionAutoApply, Confidence: model.AutoGroupConfidenceHigh, Reason: reason, Source: "builtin_rule"}
	}
	if group, err := ResolveGroupByJobTitle(ctx.JobTitle); err == nil && strings.TrimSpace(group) != "" {
		if ctx.CurrentGroup == group {
			return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: group, Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceMedium, Reason: "旧岗位规则命中且已在目标分组", Source: "legacy_rule"}
		}
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: group, Action: model.AutoGroupActionConfirmRequired, Confidence: model.AutoGroupConfidenceMedium, Reason: "旧岗位规则命中，需确认后应用", Source: "legacy_rule"}
	}
	return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, Action: model.AutoGroupActionConfirmRequired, Confidence: model.AutoGroupConfidenceLow, Reason: "未命中高置信度身份规则", Source: "no_match"}
}

func ReplayAutoGroupSuggestions() (*AutoGroupReplayResult, error) {
	users, err := model.ListUsersForAutoGroupReplay()
	if err != nil {
		return nil, err
	}
	suggestions := make([]model.AutoGroupSuggestion, 0, len(users))
	result := &AutoGroupReplayResult{TotalUsers: len(users)}
	for _, user := range users {
		ctx := BuildAutoGroupContext(user)
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
		{Name: "城区SC", TargetGroup: "城区SC", Description: "城区三保交付总监、城区解决方案总监、城区总经理、城区市场总监", ManualOnly: false},
		{Name: "城区级职能部门", TargetGroup: "城区级职能部门", Description: "城区财务BP、城区人力行政共享（人力资源中心）、城区保洁专业经理", ManualOnly: false},
		{Name: "项目BMG", TargetGroup: "项目BMG", Description: "物业项目相关岗位、项目经理（合资职位）", ManualOnly: false},
		{Name: "事业部SC", TargetGroup: "事业部SC", Description: "CEO、COO、CMO、大区CEO、大区COO、大区CMO", ManualOnly: false},
		{Name: "集团高层", TargetGroup: "集团高层", Description: "管理员手动维护，自动分组不改入", ManualOnly: true},
		{Name: "itbp", TargetGroup: "itbp", Description: "管理员手动维护，自动分组不改入", ManualOnly: true},
	}
}

func matchBuiltInAutoGroup(ctx AutoGroupContext) (string, string) {
	job := ctx.JobTitle
	if equalsAny(job, "城区三保交付总监", "城区解决方案总监", "城区总经理", "城区市场总监") {
		return "城区SC", "岗位属于城区SC身份"
	}
	if strings.Contains(job, "城区财务BP") {
		return "城区级职能部门", "岗位包含城区财务BP"
	}
	if strings.Contains(job, "城区人力行政共享") && ctx.OrgLevel1Name == "人力资源中心" {
		return "城区级职能部门", "岗位包含城区人力行政共享且一级组织为人力资源中心"
	}
	if job == "城区保洁专业经理" {
		return "城区级职能部门", "岗位为城区保洁专业经理"
	}
	if strings.Contains(job, "物业项目") || job == "项目经理（合资职位）" {
		return "项目BMG", "岗位属于项目BMG身份"
	}
	if equalsAny(job, "CEO", "COO", "CMO", "大区CEO", "大区COO", "大区CMO") {
		return "事业部SC", "岗位属于事业部SC身份"
	}
	return "", ""
}

func isManualOnlyGroupJob(jobTitle string) bool {
	return equalsAny(jobTitle, "董事长", "联席总裁", "首席财务官") || strings.Contains(strings.ToLower(jobTitle), "itbp") || strings.Contains(jobTitle, "AIBP")
}

func equalsAny(value string, candidates ...string) bool {
	for _, candidate := range candidates {
		if value == candidate {
			return true
		}
	}
	return false
}
