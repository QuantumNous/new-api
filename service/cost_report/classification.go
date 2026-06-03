package cost_report

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

type ClassificationInput struct {
	Log      *model.Log
	Channel  *model.Channel
	User     *model.User
	LogOther map[string]interface{}
}

type ClassificationResult struct {
	RuleKey string `json:"rule_key"`
	Class   string `json:"class"`
}

func Classify(config CostReportTemplateConfig, input ClassificationInput) ClassificationResult {
	rules := append([]ClassificationRuleConfig(nil), config.ClassificationRules...)
	sort.SliceStable(rules, func(i, j int) bool {
		return rules[i].Priority < rules[j].Priority
	})

	fallback := ClassificationResult{Class: "Other"}
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		if rule.Fallback {
			fallback = ClassificationResult{RuleKey: rule.Key, Class: rule.OutputClass}
			continue
		}
		if classificationRuleMatches(rule, input) {
			return ClassificationResult{RuleKey: rule.Key, Class: rule.OutputClass}
		}
	}
	return fallback
}

func classificationRuleMatches(rule ClassificationRuleConfig, input ClassificationInput) bool {
	parts := make([]bool, 0, len(rule.Conditions)+len(rule.ConditionGroups))
	for _, condition := range rule.Conditions {
		parts = append(parts, classificationConditionMatches(condition, input))
	}
	for _, group := range rule.ConditionGroups {
		parts = append(parts, classificationGroupMatches(group, input))
	}
	return matchBools(rule.Match, parts)
}

func classificationGroupMatches(group ClassificationConditionGroup, input ClassificationInput) bool {
	parts := make([]bool, 0, len(group.Conditions))
	for _, condition := range group.Conditions {
		parts = append(parts, classificationConditionMatches(condition, input))
	}
	return matchBools(group.Match, parts)
}

func matchBools(match string, values []bool) bool {
	if len(values) == 0 {
		return false
	}
	if match == "any" {
		for _, value := range values {
			if value {
				return true
			}
		}
		return false
	}
	for _, value := range values {
		if !value {
			return false
		}
	}
	return true
}

func classificationConditionMatches(condition ClassificationCondition, input ClassificationInput) bool {
	actual, exists := classificationSourceValue(condition.Source, input)
	if condition.Operator == "exists" {
		return exists && strings.TrimSpace(actual) != ""
	}
	if !exists {
		return false
	}

	actualCmp := actual
	want := condition.Value
	values := condition.Values
	if condition.CaseInsensitive {
		actualCmp = strings.ToLower(actualCmp)
		want = strings.ToLower(want)
		values = make([]string, len(condition.Values))
		for i, value := range condition.Values {
			values[i] = strings.ToLower(value)
		}
	}

	switch condition.Operator {
	case "equals":
		return actualCmp == want
	case "contains":
		return strings.Contains(actualCmp, want)
	case "in":
		for _, value := range values {
			if actualCmp == value {
				return true
			}
		}
		return false
	case "regex":
		pattern := condition.Value
		if condition.CaseInsensitive {
			pattern = "(?i)" + pattern
		}
		re, err := regexp.Compile(pattern)
		if err != nil {
			return false
		}
		return re.MatchString(actual)
	default:
		return false
	}
}

func classificationSourceValue(source string, input ClassificationInput) (string, bool) {
	switch source {
	case "channel.type":
		if input.Channel == nil {
			return "", false
		}
		return fmt.Sprintf("%d", input.Channel.Type), true
	case "channel.name":
		if input.Channel == nil {
			return "", false
		}
		return input.Channel.Name, true
	case "channel.id":
		if input.Log == nil || input.Log.ChannelId == 0 {
			return "", false
		}
		return fmt.Sprintf("%d", input.Log.ChannelId), true
	case "model_name":
		if input.Log == nil {
			return "", false
		}
		return input.Log.ModelName, true
	case "group":
		if input.Log == nil {
			return "", false
		}
		return input.Log.Group, true
	case "is_claude_related":
		return fmt.Sprintf("%t", isClaudeRelated(input)), true
	default:
		if strings.HasPrefix(source, "log_other.") {
			value, ok := nestedMapValue(input.LogOther, strings.TrimPrefix(source, "log_other."))
			if !ok || value == nil {
				return "", false
			}
			return fmt.Sprint(value), true
		}
		return "", false
	}
}

func isClaudeRelated(input ClassificationInput) bool {
	needles := []string{}
	if input.Log != nil {
		needles = append(needles, input.Log.ModelName, input.Log.Content)
	}
	if input.Channel != nil {
		if input.Channel.Type == constant.ChannelTypeAnthropic || input.Channel.Type == constant.ChannelTypeAws {
			return true
		}
		needles = append(needles, input.Channel.Name, input.Channel.Models)
	}
	for _, value := range needles {
		if strings.Contains(strings.ToLower(value), "claude") {
			return true
		}
	}
	return false
}

func nestedMapValue(root map[string]interface{}, dotted string) (interface{}, bool) {
	if root == nil || dotted == "" {
		return nil, false
	}
	parts := strings.Split(dotted, ".")
	var current interface{} = root
	for _, part := range parts {
		m, ok := current.(map[string]interface{})
		if !ok {
			return nil, false
		}
		current, ok = m[part]
		if !ok {
			return nil, false
		}
	}
	return current, true
}
