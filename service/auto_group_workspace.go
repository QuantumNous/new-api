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
		FeishuOpenId:         user.FeishuId,
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
	if group, reason := matchFeishuUserGroupAutoGroup(ctx); group != "" {
		if ctx.CurrentGroup == group {
			return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: group, Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceHigh, Reason: "飞书用户组已匹配当前分组", Source: "feishu_user_group"}
		}
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, SuggestedGroup: group, Action: model.AutoGroupActionAutoApply, Confidence: model.AutoGroupConfidenceHigh, Reason: reason, Source: "feishu_user_group"}
	}
	if ctx.JobTitle == "" {
		return AutoGroupDecision{UserId: ctx.UserId, CurrentGroup: ctx.CurrentGroup, Action: model.AutoGroupActionSkip, Confidence: model.AutoGroupConfidenceLow, Reason: "岗位为空且未命中飞书用户组", Source: "no_match"}
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
	catalog, catalogErr := FetchFeishuGroupCatalog()
	for _, user := range users {
		ctx := BuildAutoGroupContext(user)
		if catalogErr == nil && strings.TrimSpace(ctx.FeishuOpenId) != "" {
			groupIds, groupNames, groupErr := FetchFeishuUserGroupMembership(ctx.FeishuOpenId, catalog)
			if groupErr == nil {
				ctx.FeishuGroupIds = groupIds
				ctx.FeishuGroupNames = groupNames
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
		{Name: "飞书用户组映射", TargetGroup: "Base token套餐", Description: "优先按飞书通讯录用户组匹配 Base 表中的 token套餐映射", ManualOnly: false},
		{Name: "保护分组", TargetGroup: "当前分组", Description: "已在受保护分组中的用户不会被自动改到其他分组", ManualOnly: true},
		{Name: "城区SC兜底", TargetGroup: "城区SC", Description: "未命中飞书用户组时，城区三保交付总监、城区解决方案总监、城区总经理、城区市场总监可兜底匹配", ManualOnly: false},
		{Name: "城区级职能部门兜底", TargetGroup: "城区级职能部门", Description: "未命中飞书用户组时，城区财务BP、城区人力行政共享（人力资源中心）、城区保洁专业经理可兜底匹配", ManualOnly: false},
		{Name: "项目BMG兜底", TargetGroup: "项目BMG", Description: "未命中飞书用户组时，物业项目相关岗位可兜底匹配", ManualOnly: false},
	}
}

func matchFeishuUserGroupAutoGroup(ctx AutoGroupContext) (string, string) {
	for _, groupID := range ctx.FeishuGroupIds {
		if target := feishuUserGroupToTokenPackage(strings.TrimSpace(groupID)); target != "" {
			return target, "飞书通讯录用户组命中套餐映射"
		}
	}
	for _, groupName := range ctx.FeishuGroupNames {
		if target := feishuUserGroupToTokenPackage(strings.TrimSpace(groupName)); target != "" {
			return target, "飞书通讯录用户组命中套餐映射: " + strings.TrimSpace(groupName)
		}
	}
	return "", ""
}

func feishuUserGroupToTokenPackage(value string) string {
	switch strings.TrimSpace(value) {
	case "15ee29afg72a666f", "集团高管":
		return "集团高层"
	case "4764bbd5ca6bggg6", "事业部CEO", "gc18gddada4dc7f1", "集团职能部门/支持中心负责人":
		return "一级部门责任人"
	case "5e8ffd4d63764f18", "集团总部职能部门/支持中心的二级部门或职能模块负责人", "85g38g4eeeda4183", "集团总部职能部门/支持中心员工":
		return "集团职能部门"
	case "1a4b8bd73e191469", "区域、产品、客户、楼宇事业部、合资公司 核心经营单元SC成员":
		return "城区SC"
	case "18g7cfdf4dg7ee88", "区域、产品、客户事业部职能部门负责人 （含COO、CMO）":
		return "事业部SC"
	case "1c2c5599f387827e", "区域、产品、客户事业部职能部门员工":
		return "大区职能部门"
	case "a19c5age1g6g25a6", "区域、产品、客户、楼宇科技事业部 核心经营单元专业类员工/操作类员工/ 基本经营单元负责人":
		return "城区级职能部门"
	case "528a7f599b6e4gaa", "区域事业部基本经营单元BMG", "4g9aec2e7egea1f4", "六大区-物业项目经理":
		return "项目BMG"
	default:
		return ""
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
