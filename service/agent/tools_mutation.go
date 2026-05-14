package agent

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func toolCreateToken() *ToolDefinition {
	return &ToolDefinition{
		Name:              "create_token",
		DisplayName:       "Create API key",
		Description:       "Create a new API key for the current user after confirmation.",
		Parameters:        map[string]interface{}{"type": "object", "properties": map[string]interface{}{"name": map[string]interface{}{"type": "string"}, "expired_days": map[string]interface{}{"type": "integer"}, "remain_quota": map[string]interface{}{"type": "integer"}, "group": map[string]interface{}{"type": "string"}}, "required": []string{"name"}},
		NeedsConfirmation: true,
		RiskLevel:         "medium",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			name, _ := args["name"].(string)
			name = strings.TrimSpace(name)
			if name == "" || len(name) > 32 {
				return ToolResult{}, errors.New("token name must be 1-32 characters")
			}
			key, err := common.GenerateKey()
			if err != nil {
				return ToolResult{}, err
			}
			remainQuota := toInt(args["remain_quota"], 0)
			token := &model.Token{
				UserId:         userId,
				Name:           name,
				Key:            key,
				CreatedTime:    common.GetTimestamp(),
				AccessedTime:   common.GetTimestamp(),
				ExpiredTime:    -1,
				RemainQuota:    remainQuota,
				UnlimitedQuota: remainQuota <= 0,
				Group:          safeString(args["group"]),
			}
			if err := token.Insert(); err != nil {
				return ToolResult{}, err
			}
			data := map[string]interface{}{"id": token.Id, "name": token.Name, "key": key, "masked_key": model.MaskTokenKey(key)}
			return ToolResult{OK: true, Data: data, Display: data, UserMessage: "API key created. The full key is shown only in this response."}, nil
		},
	}
}

func toolDeleteToken() *ToolDefinition {
	return &ToolDefinition{
		Name:              "delete_token",
		DisplayName:       "Delete API key",
		Description:       "Delete one API key owned by the current user after confirmation.",
		Parameters:        map[string]interface{}{"type": "object", "properties": map[string]interface{}{"token_id": map[string]interface{}{"type": "integer"}}, "required": []string{"token_id"}},
		NeedsConfirmation: true,
		RiskLevel:         "high",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			tokenID := toInt(args["token_id"], 0)
			if tokenID <= 0 {
				return ToolResult{}, errors.New("token_id is required")
			}
			if err := model.DeleteTokenById(tokenID, userId); err != nil {
				return ToolResult{}, err
			}
			data := map[string]interface{}{"token_id": tokenID, "deleted": true}
			return ToolResult{OK: true, Data: data, Display: data, UserMessage: fmt.Sprintf("API key #%d has been deleted.", tokenID)}, nil
		},
	}
}

func toolTriggerTopup() *ToolDefinition {
	return &ToolDefinition{
		Name:              "trigger_topup",
		DisplayName:       "Prepare top-up",
		Description:       "Prepare a small top-up intent after strict confirmation and amount guard checks.",
		Parameters:        map[string]interface{}{"type": "object", "properties": map[string]interface{}{"amount_cny": map[string]interface{}{"type": "number"}}},
		NeedsConfirmation: true,
		RiskLevel:         "high",
		Executor: func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error) {
			amount := toFloat(args["amount_cny"], 10)
			intent, err := PreparePaymentIntent(ctx, userId, amount)
			if err != nil {
				return ToolResult{}, err
			}
			data := map[string]interface{}{"intent_id": intent.IntentId, "amount_cny": intent.AmountCNY, "url": fmt.Sprintf("/console/topup?amount=%.0f", intent.AmountCNY)}
			return ToolResult{OK: true, Data: data, Display: data, UserMessage: "A guarded top-up intent is ready. Please review it before continuing."}, nil
		},
	}
}

func safeString(v interface{}) string {
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func toFloat(v interface{}, fallback float64) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	default:
		return fallback
	}
}
