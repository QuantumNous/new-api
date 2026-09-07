package service

import (
	"math"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
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

func IsUserSelectableGroup(userGroup, groupName string) bool {
	if groupName == "" || groupName == "auto" {
		return false
	}
	return GroupInUserUsableGroups(userGroup, groupName) && ratio_setting.ContainsGroupRatio(groupName)
}

// GetUserAutoGroup 根据用户分组获取自动分组设置
func GetUserAutoGroup(userGroup string) []string {
	autoGroups := make([]string, 0)
	seen := make(map[string]struct{})
	for _, group := range setting.GetAutoGroups() {
		if !IsUserSelectableGroup(userGroup, group) {
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
	maxCount := setting.GetMaxTokenAutoGroups()
	filtered := make([]string, 0, min(len(groups), maxCount))
	seen := make(map[string]struct{})
	for _, group := range groups {
		if !IsUserSelectableGroup(userGroup, group) {
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
	value, ok := common.GetContextKey(c, constant.ContextKeyTokenAutoGroups)
	if !ok {
		return GetUserAutoGroup(userGroup)
	}
	groups, ok := value.([]string)
	if !ok {
		return []string{}
	}
	return FilterUserTokenAutoGroups(userGroup, groups)
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

// GetSmartRoutingGroups 计算智能路由（Token.RoutingPriority）下应使用的有序分组列表。
// 仅包含用户可用分组（含特殊可用分组）中该模型存在可用渠道的分组。
//
// 排序策略：
//   - price：按用户实际使用倍率升序（成本低优先），同倍率按响应速度升序；
//   - speed：按候选渠道最短响应时间升序（无记录排后），同速度按优先级降序；
//   - success_rate：按候选渠道实测成功率降序（无请求记录的分组排最后），同成功率按优先级、再按速度升序；
//   - auto：综合排序，先成功率（优先级）降序，再价格升序，最后速度升序。
//
// 注：Channel 模型维护请求/成功计数（Distribute 记录，dirty-map+flusher 落库），
// success_rate 用实测成功率排序；auto 仍用「优先级 + 响应时间」作为稳定性代理。
func GetSmartRoutingGroups(userGroup, modelName, requestPath, routingPriority string) []string {
	usable := GetUserUsableGroups(userGroup)
	groups := make([]string, 0, len(usable))
	for group := range usable {
		if group == "" || group == "auto" {
			continue
		}
		groups = append(groups, group)
	}

	stats := model.GetGroupChannelStats(groups, modelName, requestPath)

	type rankedGroup struct {
		group string
		ratio float64
		stat  *model.GroupChannelStat
	}
	ranked := make([]rankedGroup, 0, len(groups))
	for _, group := range groups {
		st, ok := stats[group]
		if !ok || !st.HasChannel {
			continue
		}
		ranked = append(ranked, rankedGroup{group: group, ratio: GetUserGroupRatio(userGroup, group), stat: st})
	}

	// rt 将「无响应记录(0)」归一化为最大整数，使其总是排到最后。
	rt := func(ms int) int {
		if ms == 0 {
			return math.MaxInt32
		}
		return ms
	}

	sort.SliceStable(ranked, func(i, j int) bool {
		a, b := ranked[i], ranked[j]
		switch routingPriority {
		case constant.RoutingPriorityPrice:
			if a.ratio != b.ratio {
				return a.ratio < b.ratio
			}
			return rt(a.stat.MinResponseTime) < rt(b.stat.MinResponseTime)
		case constant.RoutingPrioritySpeed:
			if rt(a.stat.MinResponseTime) != rt(b.stat.MinResponseTime) {
				return rt(a.stat.MinResponseTime) < rt(b.stat.MinResponseTime)
			}
			return a.stat.MaxPriority > b.stat.MaxPriority
		case constant.RoutingPrioritySuccessRate:
			// 成功率优先：无请求记录的分组排最后，其余按实测成功率降序。
			as, bs := a.stat.SuccessRate, b.stat.SuccessRate
			if a.stat.TotalRequest == 0 {
				as = -1
			}
			if b.stat.TotalRequest == 0 {
				bs = -1
			}
			if as != bs {
				return as > bs
			}
			if a.stat.MaxPriority != b.stat.MaxPriority {
				return a.stat.MaxPriority > b.stat.MaxPriority
			}
			return rt(a.stat.MinResponseTime) < rt(b.stat.MinResponseTime)
		default: // auto：综合
			if a.stat.MaxPriority != b.stat.MaxPriority {
				return a.stat.MaxPriority > b.stat.MaxPriority
			}
			if a.ratio != b.ratio {
				return a.ratio < b.ratio
			}
			return rt(a.stat.MinResponseTime) < rt(b.stat.MinResponseTime)
		}
	})

	result := make([]string, 0, len(ranked))
	for _, r := range ranked {
		result = append(result, r.group)
	}
	return result
}
