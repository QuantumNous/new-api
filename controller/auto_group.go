package controller

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ============ 规则 CRUD ============

func GetAutoGroupRules(c *gin.Context) {
	rules, err := model.GetAllGroupMappingRules()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rules)
}

type autoGroupRuleRequest struct {
	JobTitle    string `json:"job_title" binding:"required"`
	TargetGroup string `json:"target_group" binding:"required"`
	Enabled     *bool  `json:"enabled"`
	Priority    int    `json:"priority"`
	Remark      string `json:"remark"`
}

func CreateAutoGroupRule(c *gin.Context) {
	var req autoGroupRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.JobTitle = strings.TrimSpace(req.JobTitle)
	req.TargetGroup = strings.TrimSpace(req.TargetGroup)
	if req.JobTitle == "" || req.TargetGroup == "" {
		common.ApiErrorMsg(c, "job_title 和 target_group 不能为空")
		return
	}
	if !isGroupUsable(req.TargetGroup) {
		common.ApiErrorMsg(c, "目标分组不存在或不可用: "+req.TargetGroup)
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	rule := &model.GroupMappingRule{
		JobTitle:    req.JobTitle,
		TargetGroup: req.TargetGroup,
		Enabled:     enabled,
		Priority:    req.Priority,
		Remark:      strings.TrimSpace(req.Remark),
	}
	if err := model.CreateGroupMappingRule(rule); err != nil {
		if isDuplicateKeyErr(err) {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": "该岗位的映射规则已存在"})
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rule)
}

func UpdateAutoGroupRule(c *gin.Context) {
	id, err := parseIdParam(c)
	if err != nil {
		return
	}
	var req autoGroupRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.TargetGroup = strings.TrimSpace(req.TargetGroup)
	if req.TargetGroup == "" {
		common.ApiErrorMsg(c, "target_group 不能为空")
		return
	}
	if !isGroupUsable(req.TargetGroup) {
		common.ApiErrorMsg(c, "目标分组不存在或不可用: "+req.TargetGroup)
		return
	}
	rule, err := getRuleOrError(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	rule.TargetGroup = req.TargetGroup
	if req.JobTitle != "" {
		rule.JobTitle = strings.TrimSpace(req.JobTitle)
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}
	rule.Priority = req.Priority
	rule.Remark = strings.TrimSpace(req.Remark)
	if err := model.UpdateGroupMappingRule(rule); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rule)
}

func DeleteAutoGroupRule(c *gin.Context) {
	id, err := parseIdParam(c)
	if err != nil {
		return
	}
	if err := model.DeleteGroupMappingRule(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ============ 测试匹配 ============

func ResolveAutoGroup(c *gin.Context) {
	jobTitle := strings.TrimSpace(c.Query("job_title"))
	matched := false
	targetGroup := ""
	if jobTitle != "" {
		g, err := service.ResolveGroupByJobTitle(jobTitle)
		if err == nil && g != "" {
			matched = true
			targetGroup = g
		}
	}
	common.ApiSuccess(c, gin.H{
		"matched":      matched,
		"target_group": targetGroup,
	})
}

// ============ 受保护分组配置 ============

func GetAutoGroupConfig(c *gin.Context) {
	common.ApiSuccess(c, gin.H{
		"protected_groups": service.GetProtectedGroups(),
	})
}

type autoGroupConfigRequest struct {
	ProtectedGroups []string `json:"protected_groups"`
}

func UpdateAutoGroupConfig(c *gin.Context) {
	var req autoGroupConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	// 校验分组名都合法
	for _, g := range req.ProtectedGroups {
		g = strings.TrimSpace(g)
		if g != "" && !isGroupUsable(g) {
			common.ApiErrorMsg(c, "受保护分组不存在或不可用: "+g)
			return
		}
	}
	value := strings.Join(trimStrings(req.ProtectedGroups), ",")
	if err := model.UpdateOption("auto_group.protected_groups", value); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"protected_groups": service.GetProtectedGroups(),
	})
}

// ============ 一键初始化 ============

type initPreviewItem struct {
	JobTitle          string         `json:"job_title"`
	SuggestedGroup    string         `json:"suggested_group"`
	UserCount         int            `json:"user_count"`
	GroupDistribution map[string]int `json:"group_distribution"`
	Conflict          bool           `json:"conflict"`
	Exists            bool           `json:"exists"`
}

func InitializeAutoGroupPreview(c *gin.Context) {
	protected := service.GetProtectedGroups()
	stats, err := model.AggregateJobTitleGroupStats(protected)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 按 job_title 聚合
	type agg struct {
		groups     map[string]int
		total      int
		suggested  string
		maxInGroup int
	}
	byJobTitle := make(map[string]*agg)
	for _, s := range stats {
		a, ok := byJobTitle[s.JobTitle]
		if !ok {
			a = &agg{groups: make(map[string]int)}
			byJobTitle[s.JobTitle] = a
		}
		a.groups[s.Group] += s.Count
		a.total += s.Count
		if a.groups[s.Group] > a.maxInGroup {
			a.maxInGroup = a.groups[s.Group]
			a.suggested = s.Group
		}
	}
	// 构造预览项
	items := make([]initPreviewItem, 0, len(byJobTitle))
	jobTitles := make([]string, 0, len(byJobTitle))
	for jt, a := range byJobTitle {
		items = append(items, initPreviewItem{
			JobTitle:          jt,
			SuggestedGroup:    a.suggested,
			UserCount:         a.total,
			GroupDistribution: a.groups,
			Conflict:          len(a.groups) > 1,
		})
		jobTitles = append(jobTitles, jt)
	}
	// 标记已存在
	existMap, err := model.GetExistingJobTitles(jobTitles)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	for i := range items {
		items[i].Exists = existMap[items[i].JobTitle]
	}
	// 冲突行置顶
	sortInitItems(items)
	common.ApiSuccess(c, gin.H{
		"items":            items,
		"protected_groups": protected,
	})
}

type initApplyRequest struct {
	Rules []struct {
		JobTitle    string `json:"job_title" binding:"required"`
		TargetGroup string `json:"target_group" binding:"required"`
		Remark      string `json:"remark"`
	} `json:"rules" binding:"required"`
}

func InitializeAutoGroupApply(c *gin.Context) {
	var req initApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(req.Rules) == 0 {
		common.ApiErrorMsg(c, "规则列表不能为空")
		return
	}
	rules := make([]model.GroupMappingRule, 0, len(req.Rules))
	seen := make(map[string]bool)
	for _, r := range req.Rules {
		jt := strings.TrimSpace(r.JobTitle)
		tg := strings.TrimSpace(r.TargetGroup)
		if jt == "" || tg == "" {
			continue
		}
		if seen[jt] {
			continue
		}
		seen[jt] = true
		if !isGroupUsable(tg) {
			common.ApiErrorMsg(c, "目标分组不存在或不可用: "+tg)
			return
		}
		rules = append(rules, model.GroupMappingRule{
			JobTitle:    jt,
			TargetGroup: tg,
			Enabled:     true,
			Remark:      strings.TrimSpace(r.Remark),
		})
	}
	if len(rules) == 0 {
		common.ApiErrorMsg(c, "没有有效的规则")
		return
	}
	if err := model.UpdateGroupMappingRulesInTx(rules); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"saved": len(rules)})
}

// ============ 辅助函数 ============

var usableGroupsCache struct {
	sync.Mutex
	groups map[string]bool
	dirty  bool
}

func markUsableGroupsDirty() {
	usableGroupsCache.Lock()
	usableGroupsCache.dirty = true
	usableGroupsCache.Unlock()
}

func isGroupUsable(group string) bool {
	if group == "" {
		return false
	}
	usableGroupsCache.Lock()
	defer usableGroupsCache.Unlock()
	if usableGroupsCache.groups == nil || usableGroupsCache.dirty {
		usableGroupsCache.groups = make(map[string]bool)
		for g := range service.GetUserUsableGroups("") {
			usableGroupsCache.groups[g] = true
		}
		usableGroupsCache.dirty = false
	}
	return usableGroupsCache.groups[group]
}

func parseIdParam(c *gin.Context) (int, error) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return 0, err
	}
	return id, nil
}

func getRuleOrError(id int) (*model.GroupMappingRule, error) {
	rules, err := model.GetAllGroupMappingRules()
	if err != nil {
		return nil, err
	}
	for i := range rules {
		if rules[i].Id == id {
			return &rules[i], nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func isDuplicateKeyErr(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "duplicate") ||
		strings.Contains(strings.ToLower(err.Error()), "unique")
}

func trimStrings(in []string) []string {
	out := make([]string, 0, len(in))
	for _, s := range in {
		s = strings.TrimSpace(s)
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

func sortInitItems(items []initPreviewItem) {
	// 冲突优先，其次按 user_count 降序
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].Conflict != items[j].Conflict {
			return items[i].Conflict
		}
		return items[i].UserCount > items[j].UserCount
	})
}
