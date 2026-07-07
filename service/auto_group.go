package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ResolveGroupByJobTitle 根据 jobTitle 精确匹配映射规则，返回目标分组。
// 未命中（包括空 jobTitle、规则禁用、无记录）返回空字符串。
func ResolveGroupByJobTitle(jobTitle string) (string, error) {
	rule, err := model.GetGroupMappingRuleByJobTitle(jobTitle)
	if err != nil {
		return "", err
	}
	if rule == nil {
		return "", nil
	}
	return rule.TargetGroup, nil
}

// GetProtectedGroups 读取受保护分组白名单（来自 common.OptionMap）。
func GetProtectedGroups() []string {
	raw := common.OptionMap["auto_group.protected_groups"]
	var result []string
	for _, g := range strings.Split(raw, ",") {
		g = strings.TrimSpace(g)
		if g != "" {
			result = append(result, g)
		}
	}
	return result
}

// IsProtectedGroup 判断分组是否受保护（在白名单中）。
func IsProtectedGroup(group string) bool {
	if strings.TrimSpace(group) == "" {
		return false
	}
	for _, g := range GetProtectedGroups() {
		if g == group {
			return true
		}
	}
	return false
}

// ResolveAndCheckAutoGroup 是自动分组的统一决策入口。
// 根据 jobTitle 算出目标 group，结合白名单检查是否需要变更。
// 返回值：
//   - newGroup: 应当使用的分组（changed=false 时等于 currentGroup）
//   - changed: 是否需要变更
//   - err: 查询错误
func ResolveAndCheckAutoGroup(currentGroup, jobTitle string) (newGroup string, changed bool, err error) {
	decision := ClassifyAutoGroup(AutoGroupContext{CurrentGroup: currentGroup, JobTitle: jobTitle})
	if decision.Action == model.AutoGroupActionAutoApply && decision.SuggestedGroup != "" {
		return decision.SuggestedGroup, currentGroup != decision.SuggestedGroup, nil
	}
	target, err := ResolveGroupByJobTitle(jobTitle)
	if err != nil {
		return currentGroup, false, err
	}
	if target == "" || currentGroup == target || IsProtectedGroup(currentGroup) {
		return currentGroup, false, nil
	}
	return target, true, nil
}

// ApplyAutoGroupChange 执行分组变更，包括更新 group、同步订阅套餐、刷新缓存、写日志。
// oldGroup 为变更前的分组（用于订阅同步的 diff）。
func ApplyAutoGroupChange(userId int, oldGroup, newGroup string) error {
	if userId <= 0 || newGroup == "" {
		return nil
	}
	if err := model.UpdateUserGroup(userId, newGroup); err != nil {
		return err
	}
	// 触发订阅同步（已有函数，幂等：删除旧 group 的 bind_group 订阅、创建新 group 的）
	if err := model.SyncUserBindGroupSubscriptions(userId, oldGroup, newGroup); err != nil {
		common.SysLog(fmt.Sprintf("auto-group: SyncUserBindGroupSubscriptions failed user %d: %s", userId, err.Error()))
	}
	_ = model.InvalidateUserCache(userId)
	model.RecordLog(userId, model.LogTypeSystem,
		fmt.Sprintf("自动分组: %s -> %s", oldGroup, newGroup))
	return nil
}

// TryAutoGroupOnJobTitle 尝试根据 jobTitle 对用户进行自动分组。
// 若命中规则且需要变更（非白名单保护、目标与当前不同），则执行变更。
// 返回最终的 group 和是否发生了变更。
// 安全失败：任何错误只记日志，不向外抛。
func TryAutoGroupOnJobTitle(userId int, currentGroup, jobTitle string) (finalGroup string, changed bool) {
	finalGroup = currentGroup
	defer func() {
		if r := recover(); r != nil {
			common.SysLog(fmt.Sprintf("auto-group: panic for user %d: %v", userId, r))
		}
	}()
	newGroup, shouldChange, err := ResolveAndCheckAutoGroup(currentGroup, jobTitle)
	if err != nil {
		common.SysLog(fmt.Sprintf("auto-group: resolve failed for user %d: %s", userId, err.Error()))
		return currentGroup, false
	}
	if !shouldChange {
		return currentGroup, false
	}
	if err := ApplyAutoGroupChange(userId, currentGroup, newGroup); err != nil {
		common.SysLog(fmt.Sprintf("auto-group: apply failed for user %d: %s", userId, err.Error()))
		return currentGroup, false
	}
	common.SysLog(fmt.Sprintf("auto-group: user %d %q -> %q (JobTitle=%q)", userId, currentGroup, newGroup, jobTitle))
	return newGroup, true
}
