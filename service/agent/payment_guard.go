package agent

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/agent_setting"
	"github.com/google/uuid"
)

func PreparePaymentIntent(ctx context.Context, userId int, amount float64) (*model.AgentPaymentIntent, error) {
	setting := agent_setting.GetAgentSetting()
	amount = math.Round(amount*100) / 100
	if amount <= 0 || amount > setting.PaymentPerCallMaxCNY {
		return nil, fmt.Errorf("amount must be between 0 and %.2f CNY", setting.PaymentPerCallMaxCNY)
	}
	if !isAllowedTopupAmount(amount) {
		return nil, errors.New("amount is not in the allowed top-up list")
	}
	start := time.Now().Truncate(24 * time.Hour)
	var intents []model.AgentPaymentIntent
	if err := model.DB.WithContext(ctx).Where("user_id = ? AND created_at >= ? AND status <> ?", userId, start, "cancelled").Find(&intents).Error; err != nil {
		return nil, err
	}
	total := amount
	for _, item := range intents {
		total += item.AmountCNY
	}
	if total > setting.PaymentPerDayMaxCNY {
		return nil, fmt.Errorf("daily top-up intent limit exceeded: %.2f CNY", setting.PaymentPerDayMaxCNY)
	}
	intent := &model.AgentPaymentIntent{
		UserId:    userId,
		AmountCNY: amount,
		IntentId:  uuid.NewString(),
		Status:    "pending",
	}
	if err := model.DB.WithContext(ctx).Create(intent).Error; err != nil {
		return nil, err
	}
	return intent, nil
}

func isAllowedTopupAmount(amount float64) bool {
	for _, allowed := range []float64{1, 5, 10, 20, 50} {
		if math.Abs(amount-allowed) < 0.001 {
			return true
		}
	}
	return false
}

func formatAmount(amount float64) string {
	if math.Abs(amount-math.Round(amount)) < 0.001 {
		return fmt.Sprintf("%.0f", amount)
	}
	return fmt.Sprintf("%.2f", amount)
}
