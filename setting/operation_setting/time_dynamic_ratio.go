package operation_setting

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// TimeDynamicRatioRule 单条时间动态倍率规则
type TimeDynamicRatioRule struct {
	ID         string   `json:"id"`         // 规则唯一标识（UUID）
	Name       string   `json:"name"`       // 规则名称（运营可读）
	Enabled    bool     `json:"enabled"`    // 规则独立开关
	Priority   int      `json:"priority"`   // 优先级，越小越优先
	StartTime  string   `json:"start_time"` // 开始时间 HH:MM
	EndTime    string   `json:"end_time"`   // 结束时间 HH:MM（支持跨午夜）
	Weekdays   []int    `json:"weekdays"`   // 生效星期 [1=周一..7=周日]，空=每天
	Groups     []string `json:"groups"`     // 匹配分组，空=全部分组
	Models     []string `json:"models"`     // 匹配模型（支持前缀通配符 gpt-4*），空=全部
	Multiplier float64  `json:"multiplier"` // 倍率乘数，必须 > 0
}

// TimeDynamicRatioSetting 时间动态倍率全局设置
type TimeDynamicRatioSetting struct {
	Enabled bool                   `json:"enabled"` // 全局开关
	Rules   []TimeDynamicRatioRule `json:"rules"`   // 规则列表（按 Priority 升序）
}

var timeDynamicRatioSetting TimeDynamicRatioSetting

func init() {
	timeDynamicRatioSetting = TimeDynamicRatioSetting{
		Enabled: false,
		Rules:   []TimeDynamicRatioRule{},
	}
	config.GlobalConfig.Register("time_dynamic_ratio_setting", &timeDynamicRatioSetting)
}

// GetTimeDynamicRatioSetting 获取当前配置（供管理 API 使用）
func GetTimeDynamicRatioSetting() *TimeDynamicRatioSetting {
	return &timeDynamicRatioSetting
}

// ResolveTimeDynamicMultiplier 根据模型名、用户分组和当前时间，匹配规则并返回倍率。
// 未命中任何规则或功能未启用时返回 1.0。
func ResolveTimeDynamicMultiplier(modelName, userGroup string, now time.Time) float64 {
	if !timeDynamicRatioSetting.Enabled {
		return 1.0
	}

	rules := timeDynamicRatioSetting.Rules
	if len(rules) == 0 {
		return 1.0
	}

	// 按优先级排序（Priority 越小越优先）
	sorted := make([]TimeDynamicRatioRule, len(rules))
	copy(sorted, rules)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Priority < sorted[j].Priority
	})

	weekday := isoWeekday(now)
	currentMinutes := now.Hour()*60 + now.Minute()

	for _, rule := range sorted {
		if !rule.Enabled {
			continue
		}
		if !matchWeekday(rule.Weekdays, weekday) {
			continue
		}
		if !matchTimeRange(rule.StartTime, rule.EndTime, currentMinutes) {
			continue
		}
		if !matchGroup(rule.Groups, userGroup) {
			continue
		}
		if !matchModel(rule.Models, modelName) {
			continue
		}

		// 命中！返回倍率（兜底防护：不允许 <= 0）
		if rule.Multiplier <= 0 {
			return 1.0
		}
		common.SysLog(fmt.Sprintf("[TimeDynamic] rule=%s matched, model=%s group=%s multiplier=%.4f",
			rule.Name, modelName, userGroup, rule.Multiplier))
		return rule.Multiplier
	}

	return 1.0
}

// isoWeekday 返回 ISO 星期编号：周一=1, 周日=7
func isoWeekday(t time.Time) int {
	wd := int(t.Weekday())
	if wd == 0 {
		return 7 // 周日
	}
	return wd
}

// matchWeekday 检查当前星期是否在规则指定的星期列表中。空列表=每天匹配。
func matchWeekday(weekdays []int, current int) bool {
	if len(weekdays) == 0 {
		return true
	}
	for _, wd := range weekdays {
		if wd == current {
			return true
		}
	}
	return false
}

// matchTimeRange 检查当前时间（分钟数）是否在 [start, end) 范围内。
// 支持跨午夜，如 22:00→06:00。
func matchTimeRange(startStr, endStr string, currentMinutes int) bool {
	startMinutes := parseTimeToMinutes(startStr)
	endMinutes := parseTimeToMinutes(endStr)

	if startMinutes < 0 || endMinutes < 0 {
		return false // 时间格式无效，不匹配
	}

	if startMinutes <= endMinutes {
		// 不跨午夜：如 09:00→18:00
		return currentMinutes >= startMinutes && currentMinutes < endMinutes
	}
	// 跨午夜：如 22:00→06:00，等价于 [22:00, 24:00) ∪ [00:00, 06:00)
	return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

// parseTimeToMinutes 将 "HH:MM" 解析为当日分钟数。失败返回 -1。
func parseTimeToMinutes(timeStr string) int {
	if len(timeStr) < 4 || len(timeStr) > 5 {
		return -1
	}
	parts := strings.Split(timeStr, ":")
	if len(parts) != 2 {
		return -1
	}
	hour := 0
	minute := 0
	for _, c := range parts[0] {
		if c < '0' || c > '9' {
			return -1
		}
		hour = hour*10 + int(c-'0')
	}
	for _, c := range parts[1] {
		if c < '0' || c > '9' {
			return -1
		}
		minute = minute*10 + int(c-'0')
	}
	if hour < 0 || hour > 23 || minute < 0 || minute > 59 {
		return -1
	}
	return hour*60 + minute
}

// matchGroup 检查用户分组是否在规则的分组列表中。空列表=全部分组。
func matchGroup(groups []string, userGroup string) bool {
	if len(groups) == 0 {
		return true
	}
	for _, g := range groups {
		if g == userGroup {
			return true
		}
	}
	return false
}

// matchModel 检查模型名是否在规则的模型列表中。空列表=全部模型。
// 支持前缀通配符：如 "gpt-4*" 匹配 "gpt-4o-mini"。
func matchModel(models []string, modelName string) bool {
	if len(models) == 0 {
		return true
	}
	for _, pattern := range models {
		if pattern == modelName {
			return true
		}
		// 前缀通配符匹配
		if strings.HasSuffix(pattern, "*") {
			prefix := strings.TrimSuffix(pattern, "*")
			if strings.HasPrefix(modelName, prefix) {
				return true
			}
		}
	}
	return false
}

// ValidateTimeDynamicRatioRules 校验规则列表合法性
func ValidateTimeDynamicRatioRules(rules []TimeDynamicRatioRule) string {
	for _, rule := range rules {
		if rule.Name == "" {
			return "规则名称不能为空"
		}
		if rule.Multiplier <= 0 {
			return "规则「" + rule.Name + "」的倍率必须大于 0"
		}
		if parseTimeToMinutes(rule.StartTime) < 0 {
			return "规则「" + rule.Name + "」的开始时间格式无效，应为 HH:MM"
		}
		if parseTimeToMinutes(rule.EndTime) < 0 {
			return "规则「" + rule.Name + "」的结束时间格式无效，应为 HH:MM"
		}
		for _, wd := range rule.Weekdays {
			if wd < 1 || wd > 7 {
				return "规则「" + rule.Name + "」的星期值无效，应为 1-7"
			}
		}
	}
	return ""
}
