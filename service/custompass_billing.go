package service

import (
	"errors"
	"fmt"
	"math"
	"one-api/common"
	"one-api/model"
	"one-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// CustomPassBillingService handles billing for CustomPass channel
type CustomPassBillingService interface {
	// DetermineBillingMode determines the billing mode for a model
	DetermineBillingMode(modelName string) BillingMode

	// CalculatePrechargeAmount calculates precharge amount with ratios
	CalculatePrechargeAmount(modelName string, usage *Usage, groupRatio, userRatio float64) (int64, error)

	// CalculateFinalAmount calculates final billing amount with ratios
	CalculateFinalAmount(modelName string, usage *Usage, groupRatio, userRatio float64) (int64, error)

	// ProcessSettlement processes billing settlement with refund if necessary
	ProcessSettlement(c *gin.Context, userID int, modelName string, prechargeAmount int64, actualUsage *Usage, channelID int, tokenID int, tokenName string, group string, groupRatio, userRatio float64) error

	// RecordConsumptionLog records consumption log for billing
	RecordConsumptionLog(c *gin.Context, userID int, params *BillingLogParams) error

	// ValidateUsageForBilling validates usage information for billing purposes
	ValidateUsageForBilling(modelName string, usage *Usage) error

	// EstimateUsageForPrecharge provides a default usage estimation for precharge
	EstimateUsageForPrecharge(modelName string) *Usage

	// IsFreeMode checks if a model is in free billing mode
	IsFreeMode(modelName string) bool

	// CalculateGroupRatio calculates group-specific billing ratio
	CalculateGroupRatio(group string) float64

	// CalculateUserRatio calculates user-specific billing ratio
	CalculateUserRatio(userID int) float64
}

// BillingMode represents different billing strategies
type BillingMode int

const (
	BillingModeFree  BillingMode = iota // Free mode - no billing
	BillingModeUsage                    // Usage-based billing - based on token consumption
	BillingModeFixed                    // Fixed price billing - per request
)

// BillingLogParams represents parameters for billing log
type BillingLogParams struct {
	ChannelID        int                    `json:"channel_id"`
	ModelName        string                 `json:"model_name"`
	TokenName        string                 `json:"token_name"`
	TokenID          int                    `json:"token_id"`
	Group            string                 `json:"group"`
	Quota            int64                  `json:"quota"`
	PromptTokens     int                    `json:"prompt_tokens"`
	CompletionTokens int                    `json:"completion_tokens"`
	Content          string                 `json:"content"`
	UseTimeSeconds   int                    `json:"use_time_seconds"`
	IsStream         bool                   `json:"is_stream"`
	Other            map[string]interface{} `json:"other"`
}

// CustomPassBillingServiceImpl implements CustomPassBillingService
type CustomPassBillingServiceImpl struct{}

// NewCustomPassBillingService creates a new billing service instance
func NewCustomPassBillingService() CustomPassBillingService {
	return &CustomPassBillingServiceImpl{}
}

// DetermineBillingMode determines billing mode based on model configuration
func (s *CustomPassBillingServiceImpl) DetermineBillingMode(modelName string) BillingMode {
	common.SysLog(fmt.Sprintf("[CustomPass计费模式] 开始判断计费模式 - 模型: %s", modelName))
	
	// Check if model has fixed price configuration
	price, hasPrice := ratio_setting.GetModelPrice(modelName, false)
	common.SysLog(fmt.Sprintf("[CustomPass计费模式] 固定价格检查 - 模型: %s, 价格: %.6f, 有价格: %v", 
		modelName, price, hasPrice))
	
	if hasPrice && price > 0 {
		common.SysLog(fmt.Sprintf("[CustomPass计费模式] 确定为固定价格模式 - 模型: %s, 价格: %.6f", modelName, price))
		return BillingModeFixed
	}

	// Check if model has ratio configuration (usage-based billing)
	ratio, hasRatio, _ := ratio_setting.GetModelRatio(modelName)
	common.SysLog(fmt.Sprintf("[CustomPass计费模式] 使用量比率检查 - 模型: %s, 比率: %.6f, 有比率: %v", 
		modelName, ratio, hasRatio))
	
	if hasRatio && ratio > 0 {
		common.SysLog(fmt.Sprintf("[CustomPass计费模式] 确定为使用量计费模式 - 模型: %s, 比率: %.6f", modelName, ratio))
		return BillingModeUsage
	}

	// Default to free mode if no pricing configuration found
	common.SysLog(fmt.Sprintf("[CustomPass计费模式] 确定为免费模式 - 模型: %s (无价格配置)", modelName))
	return BillingModeFree
}

// CalculatePrechargeAmount calculates precharge amount for estimated usage
func (s *CustomPassBillingServiceImpl) CalculatePrechargeAmount(modelName string, usage *Usage, groupRatio, userRatio float64) (int64, error) {
	common.SysLog(fmt.Sprintf("[CustomPass计费] 开始计算预扣费 - 模型: %s", modelName))
	
	if usage == nil {
		common.SysLog("[CustomPass计费] 错误: usage信息为空")
		return 0, errors.New("usage信息不能为空")
	}

	common.SysLog(fmt.Sprintf("[CustomPass计费] 输入使用量 - 输入tokens: %d, 输出tokens: %d, 总tokens: %d", 
		usage.GetInputTokens(), usage.GetOutputTokens(), usage.TotalTokens))

	billingMode := s.DetermineBillingMode(modelName)
	common.SysLog(fmt.Sprintf("[CustomPass计费] 计费模式 - 模型: %s, 模式: %v", modelName, billingMode))

	var result int64
	var err error

	switch billingMode {
	case BillingModeFree:
		result = 0
		common.SysLog(fmt.Sprintf("[CustomPass计费] 免费模式 - 预扣费: %d", result))
		return result, nil

	case BillingModeFixed:
		// Fixed price billing - charge per request
		price, exists := ratio_setting.GetModelPrice(modelName, false)
		common.SysLog(fmt.Sprintf("[CustomPass计费] 固定计费模式 - 模型价格: %.6f, 价格存在: %v", price, exists))
		// Apply group ratio and user ratio for consistency with other per-call billing channels
		result = int64(math.Round(price * common.QuotaPerUnit * groupRatio * userRatio))
		common.SysLog(fmt.Sprintf("[CustomPass计费] 固定计费计算 - 原价格: %.6f, 组比率: %.6f, 用户比率: %.6f, 配额: %d", 
			price, groupRatio, userRatio, result))
		return result, nil

	case BillingModeUsage:
		// Usage-based billing - calculate based on tokens
		common.SysLog("[CustomPass计费] 使用量计费模式 - 开始验证usage")
		if err := usage.Validate(); err != nil {
			common.SysLog(fmt.Sprintf("[CustomPass计费] usage验证失败: %v", err))
			return 0, fmt.Errorf("usage验证失败: %w", err)
		}

		common.SysLog("[CustomPass计费] usage验证通过，开始计算使用量费用")
		result, err = s.calculateUsageBasedAmount(modelName, usage, groupRatio, userRatio)
		if err != nil {
			common.SysLog(fmt.Sprintf("[CustomPass计费] 使用量费用计算失败: %v", err))
			return 0, err
		}
		common.SysLog(fmt.Sprintf("[CustomPass计费] 使用量计费计算完成 - 配额: %d", result))
		return result, nil

	default:
		common.SysLog(fmt.Sprintf("[CustomPass计费] 未知计费模式: %v", billingMode))
		return 0, errors.New("未知的计费模式")
	}
}

// CalculateFinalAmount calculates final billing amount based on actual usage
func (s *CustomPassBillingServiceImpl) CalculateFinalAmount(modelName string, usage *Usage, groupRatio, userRatio float64) (int64, error) {
	// For final amount calculation, we use the same logic as precharge
	// The difference is handled in settlement process
	return s.CalculatePrechargeAmount(modelName, usage, groupRatio, userRatio)
}

// calculateUsageBasedAmount calculates amount based on token usage
func (s *CustomPassBillingServiceImpl) calculateUsageBasedAmount(modelName string, usage *Usage, groupRatio, userRatio float64) (int64, error) {
	common.SysLog(fmt.Sprintf("[CustomPass-Billing-Debug] 开始使用量计费计算 - 模型: %s, 输入tokens: %d, 输出tokens: %d", 
		modelName, usage.GetInputTokens(), usage.GetOutputTokens()))

	// Get base model ratio
	modelRatio, _, _ := ratio_setting.GetModelRatio(modelName)
	common.SysLog(fmt.Sprintf("[CustomPass-Billing-Debug] 获取模型比率 - 模型: %s, 比率: %.6f", modelName, modelRatio))

	// Calculate prompt tokens cost
	promptCost := float64(usage.GetInputTokens()) * modelRatio
	common.SysLog(fmt.Sprintf("[CustomPass-Billing-Debug] 输入token费用计算 - tokens: %d, 比率: %.6f, 费用: %.6f", 
		usage.GetInputTokens(), modelRatio, promptCost))

	// Calculate completion tokens cost with completion ratio
	completionRatio := ratio_setting.GetCompletionRatio(modelName)
	completionCost := float64(usage.GetOutputTokens()) * modelRatio * completionRatio
	common.SysLog(fmt.Sprintf("[CustomPass-Billing-Debug] 输出token费用计算 - tokens: %d, 模型比率: %.6f, 补全比率: %.6f, 费用: %.6f", 
		usage.GetOutputTokens(), modelRatio, completionRatio, completionCost))

	// Total cost in base units
	totalCost := promptCost + completionCost
	common.SysLog(fmt.Sprintf("[CustomPass-Billing-Debug] 基础费用合计 - 输入费用: %.6f, 输出费用: %.6f, 总费用: %.6f", 
		promptCost, completionCost, totalCost))

	// Apply group ratio from parameters
	common.SysLog(fmt.Sprintf("[CustomPass-Billing-Debug] 应用组比率 - 组比率: %.6f", groupRatio))

	// Apply user ratio from parameters  
	common.SysLog(fmt.Sprintf("[CustomPass-Billing-Debug] 应用用户比率 - 用户比率: %.6f", userRatio))

	// Final calculation: base price → model ratio → group ratio → user ratio
	finalAmount := totalCost * groupRatio * userRatio
	finalQuota := int64(math.Round(finalAmount))

	common.SysLog(fmt.Sprintf("[CustomPass-Billing-Debug] 最终计费结果 - 总费用: %.6f, 组比率: %.6f, 用户比率: %.6f, 最终金额: %.6f, 配额: %d", 
		totalCost, groupRatio, userRatio, finalAmount, finalQuota))

	// Round to nearest integer quota
	return finalQuota, nil
}

// ProcessSettlement processes billing settlement with multi-refund logic
func (s *CustomPassBillingServiceImpl) ProcessSettlement(c *gin.Context, userID int, modelName string, prechargeAmount int64, actualUsage *Usage, channelID int, tokenID int, tokenName string, group string, groupRatio, userRatio float64) error {
	common.SysLog(fmt.Sprintf("[CustomPass-Billing] ========== 开始结算流程 =========="))
	common.SysLog(fmt.Sprintf("[CustomPass-Billing] 结算参数 - 用户ID: %d, 模型: %s, 预扣费用: %d", userID, modelName, prechargeAmount))
	common.SysLog(fmt.Sprintf("[CustomPass-Billing] 实际使用量 - 输入tokens: %d, 输出tokens: %d, 总tokens: %d", 
		actualUsage.GetInputTokens(), actualUsage.GetOutputTokens(), actualUsage.GetInputTokens()+actualUsage.GetOutputTokens()))
	common.SysLog(fmt.Sprintf("[CustomPass-Billing] 比率信息 - 组比率: %.6f, 用户比率: %.6f", groupRatio, userRatio))

	billingMode := s.DetermineBillingMode(modelName)
	common.SysLog(fmt.Sprintf("[CustomPass-Billing] 计费模式确定 - 模型: %s, 模式: %v", modelName, billingMode))

	// For free mode, no settlement needed
	if billingMode == BillingModeFree {
		common.SysLog(fmt.Sprintf("[CustomPass-Settlement-Debug] 免费模式，无需结算"))
		return nil
	}

	// For fixed price billing, no settlement needed since precharge amount already includes all ratios
	if billingMode == BillingModeFixed {
		common.SysLog(fmt.Sprintf("[CustomPass-Settlement-Debug] 按次计费模式，预扣费已包含所有比率，无需结算"))
		return nil
	}

	// Calculate actual amount with provided ratios (only for usage-based billing)
	actualAmount, err := s.CalculateFinalAmount(modelName, actualUsage, groupRatio, userRatio)
	if err != nil {
		common.SysLog(fmt.Sprintf("[CustomPass-Settlement-Debug] 计算实际费用失败: %v", err))
		return fmt.Errorf("计算实际费用失败: %w", err)
	}
	common.SysLog(fmt.Sprintf("[CustomPass-Billing] 实际费用计算完成 - 基于tokens计算的实际金额: %d", actualAmount))

	// Calculate refund amount (multi-refund logic)
	refundAmount := prechargeAmount - actualAmount
	common.SysLog(fmt.Sprintf("[CustomPass-Settlement-Debug] 差额计算 - 预收费: %d, 实际金额: %d, 差额: %d", 
		prechargeAmount, actualAmount, refundAmount))

	// Process refund if necessary
	if refundAmount > 0 {
		common.SysLog(fmt.Sprintf("[CustomPass-Settlement-Debug] 处理退款 - 退款金额: %d", refundAmount))
		err = model.IncreaseUserQuota(userID, int(refundAmount), false)
		if err != nil {
			common.LogError(c, fmt.Sprintf("退还用户余额失败: userID=%d, refundAmount=%d, error=%s", userID, refundAmount, err.Error()))
			return fmt.Errorf("退还用户余额失败: %w", err)
		}
		common.LogInfo(c, fmt.Sprintf("CustomPass退还用户余额: userID=%d, precharge=%d, actual=%d, refund=%d", userID, prechargeAmount, actualAmount, refundAmount))
		common.SysLog(fmt.Sprintf("[CustomPass-Settlement-Debug] 退款处理完成 - 用户: %d, 退款: %d", userID, refundAmount))
	} else if refundAmount < 0 {
		// If actual amount is higher than precharge, deduct additional amount
		additionalAmount := -refundAmount
		common.SysLog(fmt.Sprintf("[CustomPass-Settlement-Debug] 处理额外扣费 - 额外金额: %d", additionalAmount))
		err = model.DecreaseUserQuota(userID, int(additionalAmount))
		if err != nil {
			common.LogError(c, fmt.Sprintf("扣除用户额外费用失败: userID=%d, additionalAmount=%d, error=%s", userID, additionalAmount, err.Error()))
			return fmt.Errorf("扣除用户额外费用失败: %w", err)
		}
		common.LogInfo(c, fmt.Sprintf("CustomPass扣除用户额外费用: userID=%d, precharge=%d, actual=%d, additional=%d", userID, prechargeAmount, actualAmount, additionalAmount))
		common.SysLog(fmt.Sprintf("[CustomPass-Settlement-Debug] 额外扣费处理完成 - 用户: %d, 额外扣费: %d", userID, additionalAmount))
	} else {
		common.SysLog(fmt.Sprintf("[CustomPass-Settlement-Debug] 预收费与实际费用相等，无需调整"))
	}

	// Note: Consumption logging is now handled by the handler to avoid duplicate records
	// The handler logs more detailed information including full request content and metadata
	
	common.SysLog(fmt.Sprintf("[CustomPass-Billing] ========== 结算流程完成 =========="))
	return nil
}

// RecordConsumptionLog records detailed consumption log
func (s *CustomPassBillingServiceImpl) RecordConsumptionLog(c *gin.Context, userID int, params *BillingLogParams) error {
	// Convert BillingLogParams to model.RecordConsumeLogParams
	modelParams := model.RecordConsumeLogParams{
		ChannelId:        params.ChannelID,
		PromptTokens:     params.PromptTokens,
		CompletionTokens: params.CompletionTokens,
		ModelName:        params.ModelName,
		TokenName:        params.TokenName,
		Quota:            int(params.Quota),
		Content:          params.Content,
		TokenId:          params.TokenID,
		UseTimeSeconds:   params.UseTimeSeconds,
		IsStream:         params.IsStream,
		Group:            params.Group,
		Other:            params.Other,
	}

	// Record the consumption log
	model.RecordConsumeLog(c, userID, modelParams)
	common.SysLog(fmt.Sprintf("[CustomPass-Billing] 消费日志已记录 - 用户: %d, 模型: %s, 配额: %d, 输入tokens: %d, 输出tokens: %d", 
		userID, params.ModelName, params.Quota, params.PromptTokens, params.CompletionTokens))

	common.SysLog(fmt.Sprintf("[CustomPass-Billing] ========== 结算流程完成 =========="))
	return nil
}

// getBillingModeString returns string representation of billing mode
func (s *CustomPassBillingServiceImpl) getBillingModeString(mode BillingMode) string {
	switch mode {
	case BillingModeFree:
		return "free"
	case BillingModeUsage:
		return "usage"
	case BillingModeFixed:
		return "fixed"
	default:
		return "unknown"
	}
}

// ValidateUsageForBilling validates usage information for billing purposes
func (s *CustomPassBillingServiceImpl) ValidateUsageForBilling(modelName string, usage *Usage) error {
	billingMode := s.DetermineBillingMode(modelName)

	// For usage-based billing, usage information is required
	if billingMode == BillingModeUsage {
		if usage == nil {
			return errors.New("按量计费模型必须提供usage信息")
		}

		if err := usage.Validate(); err != nil {
			return fmt.Errorf("usage信息验证失败: %w", err)
		}

		// Check if token counts are reasonable
		if usage.GetInputTokens() == 0 && usage.GetOutputTokens() == 0 {
			return errors.New("按量计费模型的usage信息不能为空")
		}
	}

	return nil
}

// EstimateUsageForPrecharge provides a default usage estimation for precharge
func (s *CustomPassBillingServiceImpl) EstimateUsageForPrecharge(modelName string) *Usage {
	// Provide conservative estimates for precharge
	// These values should be configurable in a real implementation
	return &Usage{
		PromptTokens:     1000, // Conservative estimate
		CompletionTokens: 1000, // Conservative estimate
		TotalTokens:      2000,
	}
}

// CalculateGroupRatio calculates group-specific billing ratio
func (s *CustomPassBillingServiceImpl) CalculateGroupRatio(group string) float64 {
	// This would integrate with the existing group ratio system
	// For now, return default ratio
	groupRatio := ratio_setting.GetGroupRatio(group)
	if groupRatio <= 0 {
		return 1.0
	}
	return groupRatio
}

// CalculateUserRatio calculates user-specific billing ratio
func (s *CustomPassBillingServiceImpl) CalculateUserRatio(userID int) float64 {
	// This would integrate with the existing user ratio system
	// For now, return default ratio of 1.0
	// In a real implementation, this would check user-specific billing multipliers
	// from user settings or a separate user ratio configuration
	return 1.0
}

// IsFreeMode checks if a model is in free billing mode
func (s *CustomPassBillingServiceImpl) IsFreeMode(modelName string) bool {
	return s.DetermineBillingMode(modelName) == BillingModeFree
}

// GetBillingModeString returns human-readable billing mode description
func GetBillingModeString(mode BillingMode) string {
	switch mode {
	case BillingModeFree:
		return "免费模式"
	case BillingModeUsage:
		return "按量计费"
	case BillingModeFixed:
		return "按次计费"
	default:
		return "未知模式"
	}
}
