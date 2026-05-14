package agent

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func emptySchema() map[string]interface{} {
	return map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "required": []string{}}
}

func toolGetBalance() *ToolDefinition {
	return &ToolDefinition{
		Name:        "get_balance",
		DisplayName: "Check balance",
		Description: "Get the current user's balance, used quota, and group.",
		Parameters:  emptySchema(),
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			user, err := model.GetUserCache(userId)
			if err != nil {
				return ToolResult{}, err
			}
			usedQuota, err := model.GetUserUsedQuota(userId)
			if err != nil {
				return ToolResult{}, err
			}
			data := map[string]interface{}{"quota": user.Quota, "used_quota": usedQuota, "group": user.Group}
			return ToolResult{OK: true, Data: data, Display: data, UserMessage: fmt.Sprintf("Your remaining quota is %d and used quota is %d.", user.Quota, usedQuota)}, nil
		},
	}
}

func toolListMyModels() *ToolDefinition {
	return &ToolDefinition{
		Name:        "list_my_models",
		DisplayName: "List available models",
		Description: "List models available to the current user.",
		Parameters:  map[string]interface{}{"type": "object", "properties": map[string]interface{}{"filter": map[string]interface{}{"type": "string"}}},
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			user, err := model.GetUserCache(userId)
			if err != nil {
				return ToolResult{}, err
			}
			filter, _ := args["filter"].(string)
			groups := service.GetUserUsableGroups(user.Group)
			set := map[string]bool{}
			for group := range groups {
				for _, name := range model.GetGroupEnabledModels(group) {
					if filter == "" || strings.Contains(strings.ToLower(name), strings.ToLower(filter)) {
						set[name] = true
					}
				}
			}
			models := make([]string, 0, len(set))
			for name := range set {
				models = append(models, name)
			}
			sort.Strings(models)
			return ToolResult{OK: true, Data: map[string]interface{}{"models": models}, Display: models, UserMessage: fmt.Sprintf("I found %d available models for your account.", len(models))}, nil
		},
	}
}

func toolQueryPricing() *ToolDefinition {
	return &ToolDefinition{
		Name:        "query_pricing",
		DisplayName: "Query pricing",
		Description: "Query model ratio and group ratio pricing data.",
		Parameters:  map[string]interface{}{"type": "object", "properties": map[string]interface{}{"models": map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}}}},
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			names := toStringSlice(args["models"])
			if len(names) == 0 {
				for name := range ratio_setting.GetModelRatioCopy() {
					names = append(names, name)
					if len(names) >= 10 {
						break
					}
				}
			}
			rows := make([]map[string]interface{}, 0, len(names))
			for _, name := range names {
				ratio, ok, _ := ratio_setting.GetModelRatio(name)
				rows = append(rows, map[string]interface{}{"model": name, "model_ratio": ratio, "configured": ok})
			}
			return ToolResult{OK: true, Data: rows, Display: rows, UserMessage: "Here is the pricing ratio information I found."}, nil
		},
	}
}

func toolRecommendModel() *ToolDefinition {
	return &ToolDefinition{
		Name:        "recommend_model",
		DisplayName: "Recommend model",
		Description: "Recommend suitable models from simple rule-based scenarios.",
		Parameters:  map[string]interface{}{"type": "object", "properties": map[string]interface{}{"task_type": map[string]interface{}{"type": "string"}, "budget_priority": map[string]interface{}{"type": "string"}}},
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			taskType, _ := args["task_type"].(string)
			recs := RecommendModels(taskType)
			return ToolResult{OK: true, Data: recs, Display: recs, UserMessage: "I picked a few practical model choices for this scenario."}, nil
		},
	}
}

func toolListMyTokens() *ToolDefinition {
	return &ToolDefinition{
		Name:        "list_my_tokens",
		DisplayName: "List API keys",
		Description: "List current user's API keys with masked key values.",
		Parameters:  emptySchema(),
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			tokens, err := model.GetAllUserTokens(userId, 0, 100)
			if err != nil {
				return ToolResult{}, err
			}
			rows := make([]map[string]interface{}, 0, len(tokens))
			for _, token := range tokens {
				rows = append(rows, map[string]interface{}{"id": token.Id, "name": token.Name, "key": token.GetMaskedKey(), "status": token.Status, "used_quota": token.UsedQuota, "remain_quota": token.RemainQuota})
			}
			return ToolResult{OK: true, Data: rows, Display: rows, UserMessage: fmt.Sprintf("You have %d API keys.", len(rows))}, nil
		},
	}
}

func toolQueryMyLogs() *ToolDefinition {
	return &ToolDefinition{
		Name:        "query_my_logs",
		DisplayName: "Query my logs",
		Description: "Query the current user's recent API logs.",
		Parameters:  map[string]interface{}{"type": "object", "properties": map[string]interface{}{"hours": map[string]interface{}{"type": "integer"}, "limit": map[string]interface{}{"type": "integer"}, "only_failed": map[string]interface{}{"type": "boolean"}}},
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			hours := toInt(args["hours"], 24)
			limit := toInt(args["limit"], 20)
			if limit <= 0 || limit > 100 {
				limit = 20
			}
			start := time.Now().Add(-time.Duration(hours) * time.Hour).Unix()
			var logs []model.Log
			tx := model.LOG_DB.WithContext(ctx).Where("user_id = ? AND created_at >= ?", userId, start).Order("id desc").Limit(limit)
			if only, _ := args["only_failed"].(bool); only {
				tx = tx.Where("is_stream = ? OR quota = ?", false, 0)
			}
			if err := tx.Find(&logs).Error; err != nil {
				return ToolResult{}, err
			}
			rows := make([]map[string]interface{}, 0, len(logs))
			for _, log := range logs {
				rows = append(rows, map[string]interface{}{"id": log.Id, "model": log.ModelName, "quota": log.Quota, "created_at": log.CreatedAt, "type": log.Type})
			}
			return ToolResult{OK: true, Data: rows, Display: rows, UserMessage: fmt.Sprintf("I found %d recent log entries.", len(rows))}, nil
		},
	}
}

func toolExplainError() *ToolDefinition {
	return &ToolDefinition{
		Name:        "explain_error",
		DisplayName: "Explain error",
		Description: "Explain an API error in plain language.",
		Parameters:  map[string]interface{}{"type": "object", "properties": map[string]interface{}{"status_code": map[string]interface{}{"type": "integer"}, "error_text": map[string]interface{}{"type": "string"}, "model_name": map[string]interface{}{"type": "string"}}},
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			statusCode := toInt(args["status_code"], 0)
			errorText, _ := args["error_text"].(string)
			msg := ExplainError(statusCode, errorText)
			return ToolResult{OK: true, Data: map[string]interface{}{"explanation": msg}, Display: msg, UserMessage: msg}, nil
		},
	}
}

func toolSearchKnowledge() *ToolDefinition {
	return &ToolDefinition{
		Name:        "search_knowledge",
		DisplayName: "Search knowledge base",
		Description: "Search platform knowledge base chunks.",
		Parameters:  map[string]interface{}{"type": "object", "properties": map[string]interface{}{"query": map[string]interface{}{"type": "string"}}},
		RiskLevel:   "low",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			query, _ := args["query"].(string)
			results, err := SearchKnowledge(ctx, query)
			if err != nil {
				return ToolResult{}, err
			}
			if len(results) == 0 {
				return ToolResult{OK: true, Data: results, Display: results, UserMessage: "I did not find a matching knowledge base entry yet."}, nil
			}
			return ToolResult{OK: true, Data: results, Display: results, UserMessage: "I found these related knowledge base entries."}, nil
		},
	}
}

func toStringSlice(v interface{}) []string {
	switch val := v.(type) {
	case []string:
		return val
	case []interface{}:
		out := make([]string, 0, len(val))
		for _, item := range val {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

func toInt(v interface{}, fallback int) int {
	switch val := v.(type) {
	case int:
		return val
	case int64:
		return int(val)
	case float64:
		return int(val)
	case float32:
		return int(val)
	default:
		return fallback
	}
}

func jsonString(v interface{}) string {
	b, _ := common.Marshal(v)
	return string(b)
}
