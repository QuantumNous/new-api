package agent

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/agent_setting"
)

func EnsureAgentQuota(ctx context.Context, userId int) error {
	var quota model.AgentUserQuota
	err := model.DB.WithContext(ctx).Where("user_id = ?", userId).First(&quota).Error
	if err == nil {
		return nil
	}
	quota = model.AgentUserQuota{
		UserId:        userId,
		FreeRemaining: agent_setting.GetAgentSetting().IcebreakerQuotaPerUser,
		LastResetAt:   time.Now(),
	}
	return model.DB.WithContext(ctx).Create(&quota).Error
}

func ConsumeAgentStep(ctx context.Context, userId int) {
	var quota model.AgentUserQuota
	if err := model.DB.WithContext(ctx).Where("user_id = ?", userId).First(&quota).Error; err != nil {
		return
	}
	updates := map[string]interface{}{"total_used": quota.TotalUsed + 1}
	if quota.FreeRemaining > 0 {
		updates["free_remaining"] = quota.FreeRemaining - 1
	}
	_ = model.DB.WithContext(ctx).Model(&model.AgentUserQuota{}).Where("user_id = ?", userId).Updates(updates).Error
}
