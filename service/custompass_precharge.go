package service

import (
	"database/sql"
	"errors"
	"fmt"
	"one-api/common"
	"one-api/model"
	"one-api/relay/helper"
	relaycommon "one-api/relay/common"
	"one-api/setting/ratio_setting"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Usage represents token usage information (imported from custompass package)
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
	InputTokens      int `json:"input_tokens,omitempty"`
	OutputTokens     int `json:"output_tokens,omitempty"`
}

// Validate validates the usage information
func (u *Usage) Validate() error {
	if u.PromptTokens < 0 || u.CompletionTokens < 0 || u.TotalTokens < 0 {
		return errors.New("token数量不能为负数")
	}
	if u.TotalTokens != u.PromptTokens+u.CompletionTokens {
		return errors.New("总token数量与输入输出token数量之和不匹配")
	}
	return nil
}

// GetInputTokens returns compatible input token count
func (u *Usage) GetInputTokens() int {
	if u.InputTokens > 0 {
		return u.InputTokens
	}
	return u.PromptTokens
}

// GetOutputTokens returns compatible output token count
func (u *Usage) GetOutputTokens() int {
	if u.OutputTokens > 0 {
		return u.OutputTokens
	}
	return u.CompletionTokens
}

// CustomPassPrechargeService interface defines precharge operations for CustomPass
type CustomPassPrechargeService interface {
	// ExecutePrecharge executes precharge operation with transaction boundary
	ExecutePrecharge(c *gin.Context, user *model.User, modelName string, estimatedUsage *Usage) (*PrechargeResult, *model.BillingInfo, error)

	// CalculatePrechargeAmount calculates precharge amount based on model and usage
	CalculatePrechargeAmount(modelName string, usage *Usage, userGroup string) (int64, error)

	// ValidateUserBalance validates if user has sufficient balance
	ValidateUserBalance(userID int, amount int64) error

	// ProcessRefund processes refund for the difference between precharge and actual amount
	ProcessRefund(userID int, prechargeAmount, actualAmount int64) error

	// ProcessSettlement processes final settlement for completed requests
	ProcessSettlement(userID int, prechargeAmount, actualAmount int64) error
}

// CustomPassPrechargeServiceImpl implements CustomPassPrechargeService
type CustomPassPrechargeServiceImpl struct {
	// Mutex for user-level locking to prevent concurrent precharge operations
	userLocks sync.Map // map[int]*sync.Mutex
}

// PrechargeResult represents the result of a precharge operation
type PrechargeResult struct {
	PrechargeAmount int64  `json:"precharge_amount"`
	TransactionID   string `json:"transaction_id"`
	Success         bool   `json:"success"`
	Error           error  `json:"error,omitempty"`
}

// PrechargeError represents precharge-related errors
type PrechargeError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

func (e *PrechargeError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("%s: %s", e.Message, e.Details)
	}
	return e.Message
}

// Error codes for precharge operations
const (
	ErrCodeInsufficientBalance = "INSUFFICIENT_BALANCE"
	ErrCodeInvalidAmount       = "INVALID_AMOUNT"
	ErrCodeTransactionFailed   = "TRANSACTION_FAILED"
	ErrCodeUserNotFound        = "USER_NOT_FOUND"
	ErrCodeConcurrentOperation = "CONCURRENT_OPERATION"
	ErrCodeDatabaseError       = "DATABASE_ERROR"
	ErrCodeInvalidUsage        = "INVALID_USAGE"
	ErrCodeModelNotFound       = "MODEL_NOT_FOUND"
)

// NewCustomPassPrechargeService creates a new CustomPass precharge service instance
func NewCustomPassPrechargeService() CustomPassPrechargeService {
	return &CustomPassPrechargeServiceImpl{}
}

// ExecutePrecharge executes precharge operation with transaction boundary and concurrency control
func (s *CustomPassPrechargeServiceImpl) ExecutePrecharge(c *gin.Context, user *model.User, modelName string, estimatedUsage *Usage) (*PrechargeResult, *model.BillingInfo, error) {
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 开始执行预扣费 - 用户ID: %d, 用户名: %s, 模型: %s", 
		user.Id, user.Username, modelName))
	
	if user == nil {
		common.SysLog("[CustomPass预扣费执行] 错误: 用户信息为空")
		return nil, nil, &PrechargeError{
			Code:    ErrCodeUserNotFound,
			Message: "用户信息不能为空",
		}
	}

	if estimatedUsage == nil {
		common.SysLog("[CustomPass预扣费执行] 错误: 预估使用量为空")
		return nil, nil, &PrechargeError{
			Code:    ErrCodeInvalidUsage,
			Message: "预估使用量不能为空",
		}
	}

	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 用户信息 - ID: %d, 用户名: %s, 组: %s, 当前配额: %s", 
		user.Id, user.Username, user.Group, common.LogQuota(user.Quota)))

	// Validate usage data
	if err := estimatedUsage.Validate(); err != nil {
		common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 使用量验证失败: %v", err))
		return nil, nil, &PrechargeError{
			Code:    ErrCodeInvalidUsage,
			Message: "预估使用量数据无效",
			Details: err.Error(),
		}
	}

	// Create relayInfo for standard billing calculation
	relayInfo := &relaycommon.RelayInfo{
		UserId:    user.Id,
		UserGroup: user.Group,
		UsingGroup: user.Group, // Default to user's group, may be changed by HandleGroupRatio
		OriginModelName: modelName,
	}


	// Calculate precharge amount using the billing service
	billingService := NewCustomPassBillingService()
	
	// Determine billing mode
	billingMode := billingService.DetermineBillingMode(modelName)
	billingModeStr := getBillingModeString(billingMode)
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 计费模式 - 模式: %s", billingModeStr))
	
	// For free models, create minimal billing info and skip complex calculations
	var billingInfo *model.BillingInfo
	var groupRatioInfo helper.GroupRatioInfo
	var hasGroupRatioInfo bool
	
	if billingMode == BillingModeFree {
		// For free models, create minimal billing info without group ratio calculations
		billingInfo = &model.BillingInfo{
			BillingMode:     "free",
			GroupRatio:      1.0,
			UserGroupRatio:  1.0,
			ModelRatio:      0.0,
			CompletionRatio: 1.0,
			ModelPrice:      0.0,
			HasSpecialRatio: false,
		}
		common.SysLog("[CustomPass预扣费执行] 免费模型，跳过复杂的组倍率和价格计算")
	} else {
		// For paid models, get full billing information
		// Use standard HandleGroupRatio to get correct ratios
		groupRatioInfo = helper.HandleGroupRatio(c, relayInfo)
		hasGroupRatioInfo = true
		
		// Get model ratios and prices
		modelRatio, _, _ := ratio_setting.GetModelRatio(modelName)
		modelPrice, _ := ratio_setting.GetModelPrice(modelName, false)
		completionRatio := ratio_setting.GetCompletionRatio(modelName)
		
		// Create billing info to return
		billingInfo = &model.BillingInfo{
			GroupRatio:      groupRatioInfo.GroupRatio,
			UserGroupRatio:  groupRatioInfo.GroupSpecialRatio,
			ModelRatio:      modelRatio,
			CompletionRatio: completionRatio,
			ModelPrice:      modelPrice,
			HasSpecialRatio: groupRatioInfo.HasSpecialRatio,
		}
		
		// Set billing mode string
		switch billingMode {
		case BillingModeUsage:
			billingInfo.BillingMode = "usage"
		case BillingModeFixed:
			billingInfo.BillingMode = "fixed"
		}
	}
	
	// 打印使用新方法获取到的计费信息
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] ========== 计费信息 =========="))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 用户ID: %d, 模型: %s", user.Id, modelName))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] RelayInfo详情:"))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - 用户组 (UserGroup): %s", relayInfo.UserGroup))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - 使用组 (UsingGroup): %s", relayInfo.UsingGroup))
	
	if hasGroupRatioInfo {
		common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] HandleGroupRatio返回结果:"))
		common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - 组倍率 (GroupRatio): %.6f", groupRatioInfo.GroupRatio))
		common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - 分组特殊倍率 (GroupSpecialRatio): %.6f", groupRatioInfo.GroupSpecialRatio))
		common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - 使用特殊倍率 (HasSpecialRatio): %t", groupRatioInfo.HasSpecialRatio))
	} else {
		common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] GroupRatioInfo: 免费模型，未计算组倍率"))
	}
	
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 最终构建的BillingInfo:"))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - BillingMode: %s", billingInfo.BillingMode))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - GroupRatio: %.6f", billingInfo.GroupRatio))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - UserGroupRatio: %.6f", billingInfo.UserGroupRatio))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - ModelRatio: %.6f", billingInfo.ModelRatio))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - CompletionRatio: %.6f", billingInfo.CompletionRatio))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - ModelPrice: %.6f", billingInfo.ModelPrice))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行]   - HasSpecialRatio: %t", billingInfo.HasSpecialRatio))
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] ======================================="))
	
	
	// Calculate amount based on billing mode
	var amount int64
	var err error
	
	if billingMode == BillingModeFree {
		amount = 0
		common.SysLog("[CustomPass预扣费执行] 免费模型，预扣费金额为0")
	} else {
		// Use effective user ratio (group special ratio if exists, otherwise 1.0)
		effectiveUserRatio := 1.0
		if hasGroupRatioInfo && groupRatioInfo.HasSpecialRatio {
			effectiveUserRatio = groupRatioInfo.GroupSpecialRatio
		}
		
		groupRatio := 1.0
		if hasGroupRatioInfo {
			groupRatio = groupRatioInfo.GroupRatio
		}
		
		amount, err = billingService.CalculatePrechargeAmount(modelName, estimatedUsage, groupRatio, effectiveUserRatio)
		if err != nil {
			common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 预扣费计算失败: %v", err))
			return nil, nil, err
		}
	}

	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 预扣费计算完成 - 金额: %s", common.LogQuota(int(amount))))

	if amount <= 0 {
		common.SysLog("[CustomPass预扣费执行] 预扣费金额为0，跳过扣费操作")
		return &PrechargeResult{
			PrechargeAmount: 0,
			Success:         true,
		}, billingInfo, nil
	}

	// Get user-specific lock to prevent concurrent operations
	userLock := s.getUserLock(user.Id)
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 获取用户锁 - 用户ID: %d", user.Id))
	userLock.Lock()
	defer userLock.Unlock()

	// Execute precharge transaction with retry mechanism
	var result *PrechargeResult
	maxRetries := 3
	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 开始执行预扣费事务 - 最大重试次数: %d", maxRetries))
	
	for i := 0; i < maxRetries; i++ {
		if i > 0 {
			common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 重试第 %d 次", i))
		}
		
		result, err = s.executePrechargeTransaction(user.Id, amount)
		if err == nil {
			common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 预扣费事务执行成功 - 事务ID: %s, 金额: %s", 
				result.TransactionID, common.LogQuota(int(result.PrechargeAmount))))
			break
		}

		common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 预扣费事务执行失败: %v", err))

		// Check if it's a retryable error
		if !s.isRetryableError(err) {
			common.SysLog("[CustomPass预扣费执行] 不可重试的错误，停止重试")
			break
		}

		// Wait before retry
		sleepTime := time.Duration(i+1) * 100 * time.Millisecond
		common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 等待 %v 后重试", sleepTime))
		time.Sleep(sleepTime)
	}

	if err != nil {
		common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 预扣费最终失败 - 用户ID: %d, 错误: %v", user.Id, err))
		return nil, nil, err
	}

	common.SysLog(fmt.Sprintf("[CustomPass预扣费执行] 预扣费执行完成 - 用户ID: %d, 金额: %s, 事务ID: %s", 
		user.Id, common.LogQuota(int(result.PrechargeAmount)), result.TransactionID))
	return result, billingInfo, nil
}

// executePrechargeTransaction executes the precharge transaction with proper locking
func (s *CustomPassPrechargeServiceImpl) executePrechargeTransaction(userID int, amount int64) (*PrechargeResult, error) {
	common.SysLog(fmt.Sprintf("[CustomPass事务] 开始预扣费事务 - 用户ID: %d, 扣费金额: %s", 
		userID, common.LogQuota(int(amount))))
	
	// Start database transaction
	tx := model.DB.Begin()
	if tx.Error != nil {
		common.SysLog(fmt.Sprintf("[CustomPass事务] 开始数据库事务失败: %v", tx.Error))
		return nil, &PrechargeError{
			Code:    ErrCodeDatabaseError,
			Message: "无法开始数据库事务",
			Details: tx.Error.Error(),
		}
	}
	defer tx.Rollback()
	
	common.SysLog(fmt.Sprintf("[CustomPass事务] 数据库事务已开始 - 用户ID: %d", userID))

	// Lock user record for update to prevent concurrent modifications
	var user model.User
	common.SysLog(fmt.Sprintf("[CustomPass事务] 锁定用户记录 - 用户ID: %d", userID))
	err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userID).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.SysLog(fmt.Sprintf("[CustomPass事务] 用户不存在 - 用户ID: %d", userID))
			return nil, &PrechargeError{
				Code:    ErrCodeUserNotFound,
				Message: "用户不存在",
			}
		}
		common.SysLog(fmt.Sprintf("[CustomPass事务] 锁定用户记录失败 - 用户ID: %d, 错误: %v", userID, err))
		return nil, &PrechargeError{
			Code:    ErrCodeDatabaseError,
			Message: "无法锁定用户记录",
			Details: err.Error(),
		}
	}

	common.SysLog(fmt.Sprintf("[CustomPass事务] 用户记录已锁定 - 用户ID: %d, 用户名: %s, 当前配额: %s, 状态: %d", 
		user.Id, user.Username, common.LogQuota(user.Quota), user.Status))

	// Validate user status
	if user.Status != 1 { // 1 means enabled
		common.SysLog(fmt.Sprintf("[CustomPass事务] 用户已被禁用 - 用户ID: %d, 状态: %d", userID, user.Status))
		return nil, &PrechargeError{
			Code:    ErrCodeUserNotFound,
			Message: "用户已被禁用",
		}
	}

	// Check if user has sufficient balance
	if user.Quota < int(amount) {
		common.SysLog(fmt.Sprintf("[CustomPass事务] 用户余额不足 - 用户ID: %d, 当前余额: %s, 需要: %s", 
			userID, common.LogQuota(user.Quota), common.LogQuota(int(amount))))
		return nil, &PrechargeError{
			Code: ErrCodeInsufficientBalance,
			Message: fmt.Sprintf("用户余额不足，当前余额: %s，需要: %s",
				common.LogQuota(user.Quota), common.LogQuota(int(amount))),
		}
	}

	// Deduct quota from user
	common.SysLog(fmt.Sprintf("[CustomPass事务] 扣除用户配额 - 用户ID: %d, 扣除金额: %s, 扣除前余额: %s", 
		userID, common.LogQuota(int(amount)), common.LogQuota(user.Quota)))
	
	err = tx.Model(&user).Update("quota", gorm.Expr("quota - ?", amount)).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("[CustomPass事务] 扣除用户配额失败 - 用户ID: %d, 错误: %v", userID, err))
		return nil, &PrechargeError{
			Code:    ErrCodeDatabaseError,
			Message: "扣除用户配额失败",
			Details: err.Error(),
		}
	}

	// Generate transaction ID for tracking
	transactionID := common.GetUUID()
	common.SysLog(fmt.Sprintf("[CustomPass事务] 生成事务ID - 用户ID: %d, 事务ID: %s", userID, transactionID))

	// Commit transaction
	common.SysLog(fmt.Sprintf("[CustomPass事务] 提交事务 - 用户ID: %d, 事务ID: %s", userID, transactionID))
	if err = tx.Commit().Error; err != nil {
		common.SysLog(fmt.Sprintf("[CustomPass事务] 事务提交失败 - 用户ID: %d, 事务ID: %s, 错误: %v", 
			userID, transactionID, err))
		return nil, &PrechargeError{
			Code:    ErrCodeTransactionFailed,
			Message: "提交预扣费事务失败",
			Details: err.Error(),
		}
	}

	common.SysLog(fmt.Sprintf("[CustomPass事务] 预扣费事务成功 - 用户ID: %d, 事务ID: %s, 扣除金额: %s, 扣除后余额: %s", 
		userID, transactionID, common.LogQuota(int(amount)), common.LogQuota(user.Quota-int(amount))))

	return &PrechargeResult{
		PrechargeAmount: amount,
		TransactionID:   transactionID,
		Success:         true,
	}, nil
}

// CalculatePrechargeAmount calculates precharge amount based on model configuration and usage
func (s *CustomPassPrechargeServiceImpl) CalculatePrechargeAmount(modelName string, usage *Usage, userGroup string) (int64, error) {
	common.SysLog(fmt.Sprintf("[CustomPass预扣费] 开始计算预扣费 - 模型: %s, 用户组: %s", modelName, userGroup))
	
	if modelName == "" {
		common.SysLog("[CustomPass预扣费] 错误: 模型名称为空")
		return 0, &PrechargeError{
			Code:    ErrCodeModelNotFound,
			Message: "模型名称不能为空",
		}
	}

	if usage == nil {
		common.SysLog("[CustomPass预扣费] 错误: 使用量信息为空")
		return 0, &PrechargeError{
			Code:    ErrCodeInvalidUsage,
			Message: "使用量信息不能为空",
		}
	}

	common.SysLog(fmt.Sprintf("[CustomPass预扣费] 输入使用量 - 输入tokens: %d, 输出tokens: %d, 总tokens: %d", 
		usage.GetInputTokens(), usage.GetOutputTokens(), usage.TotalTokens))

	// For CustomPass, we need to check if model exists in ability table
	// Since CustomPass models are configured per channel, we'll use a simplified approach
	// Check if any ability exists for this model (regardless of group)
	var abilityCount int64
	err := model.DB.Model(&model.Ability{}).Where("model = ? AND enabled = ?", modelName, true).Count(&abilityCount).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("[CustomPass预扣费] 数据库查询失败: %v", err))
		return 0, &PrechargeError{
			Code:    ErrCodeDatabaseError,
			Message: "查询模型配置失败",
			Details: err.Error(),
		}
	}

	common.SysLog(fmt.Sprintf("[CustomPass预扣费] 模型能力检查 - 模型: %s, 启用的能力数量: %d", modelName, abilityCount))

	// If model not found in ability table, treat as free model
	if abilityCount == 0 {
		common.SysLog(fmt.Sprintf("[CustomPass预扣费] 模型 %s 未找到对应能力配置，按免费模型处理", modelName))
		return 0, nil
	}

	// Get model configuration from ratio_setting
	modelRatio, hasRatio, _ := ratio_setting.GetModelRatio(modelName)
	if !hasRatio || modelRatio <= 0 {
		// If no ratio configured, use default ratio 1.0
		modelRatio = 1.0
		common.SysLog(fmt.Sprintf("[CustomPass预扣费] 模型 %s 未配置比率，使用默认比率: %.4f", modelName, modelRatio))
	} else {
		common.SysLog(fmt.Sprintf("[CustomPass预扣费] 获取模型比率 - 模型: %s, 比率: %.4f", modelName, modelRatio))
	}

	// Get completion ratio for output tokens
	completionRatio := ratio_setting.GetCompletionRatio(modelName)
	if completionRatio <= 0 {
		completionRatio = 1.0
	}
	common.SysLog(fmt.Sprintf("[CustomPass预扣费] 获取补全比率 - 模型: %s, 补全比率: %.4f", modelName, completionRatio))

	// Calculate quota with actual model configuration
	var quota int64
	quota = s.calculateTokenBasedQuotaWithCompletionRatio(usage, modelRatio, completionRatio, userGroup)
	common.SysLog(fmt.Sprintf("[CustomPass预扣费] Token基础配额计算完成 - 基础配额: %d", quota))

	// Apply group ratio
	groupRatio := ratio_setting.GetGroupRatio(userGroup)
	common.SysLog(fmt.Sprintf("[CustomPass预扣费] 用户组比率 - 组: %s, 比率: %.4f", userGroup, groupRatio))
	
	var finalQuota int64
	if groupRatio > 0 {
		finalQuota = int64(float64(quota) * groupRatio)
		common.SysLog(fmt.Sprintf("[CustomPass预扣费] 应用组比率后 - 原配额: %d, 最终配额: %d", quota, finalQuota))
	} else {
		finalQuota = quota
		common.SysLog(fmt.Sprintf("[CustomPass预扣费] 未应用组比率 - 最终配额: %d", finalQuota))
	}

	// Ensure minimum quota of 1 if model has pricing and ability exists
	if finalQuota <= 0 && abilityCount > 0 {
		finalQuota = 1
		common.SysLog(fmt.Sprintf("[CustomPass预扣费] 应用最小配额保护 - 最终配额: %d", finalQuota))
	}

	common.SysLog(fmt.Sprintf("[CustomPass预扣费] 预扣费计算完成 - 模型: %s, 最终预扣配额: %d", modelName, finalQuota))
	return finalQuota, nil
}

// calculateTokenBasedQuota calculates quota for token-based billing (deprecated, kept for compatibility)
func (s *CustomPassPrechargeServiceImpl) calculateTokenBasedQuota(usage *Usage, modelRatio float64, userGroup string) int64 {
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] 开始计算Token基础配额 - 模型比率: %.4f, 用户组: %s", modelRatio, userGroup))
	
	// Get input and output tokens (with compatibility support)
	inputTokens := usage.GetInputTokens()
	outputTokens := usage.GetOutputTokens()
	
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] Token详情 - 输入tokens: %d, 输出tokens: %d", inputTokens, outputTokens))

	// Calculate base quota
	baseQuota := float64(inputTokens + outputTokens)
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] 基础配额计算 - 总tokens: %.0f", baseQuota))

	// Apply model ratio
	quota := baseQuota * modelRatio
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] 应用模型比率 - 原配额: %.0f, 模型比率: %.4f, 最终配额: %.0f", baseQuota, modelRatio, quota))

	finalQuota := int64(quota)
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] Token配额计算完成 - 最终配额: %d", finalQuota))
	
	return finalQuota
}

// calculateTokenBasedQuotaWithCompletionRatio calculates quota with separate ratios for input and output tokens
func (s *CustomPassPrechargeServiceImpl) calculateTokenBasedQuotaWithCompletionRatio(usage *Usage, modelRatio, completionRatio float64, userGroup string) int64 {
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] 开始计算Token配额 - 模型比率: %.4f, 补全比率: %.4f, 用户组: %s", 
		modelRatio, completionRatio, userGroup))
	
	// Get input and output tokens
	inputTokens := usage.GetInputTokens()
	outputTokens := usage.GetOutputTokens()
	
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] Token详情 - 输入tokens: %d, 输出tokens: %d", inputTokens, outputTokens))

	// Calculate costs separately for input and output tokens
	inputCost := float64(inputTokens) * modelRatio
	outputCost := float64(outputTokens) * modelRatio * completionRatio
	
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] 输入token费用: %d * %.4f = %.2f", inputTokens, modelRatio, inputCost))
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] 输出token费用: %d * %.4f * %.4f = %.2f", outputTokens, modelRatio, completionRatio, outputCost))

	// Total quota
	totalQuota := inputCost + outputCost
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] 总费用: %.2f + %.2f = %.2f", inputCost, outputCost, totalQuota))

	finalQuota := int64(totalQuota)
	common.SysLog(fmt.Sprintf("[CustomPass Token计算] Token配额计算完成 - 最终配额: %d", finalQuota))
	
	return finalQuota
}

// ValidateUserBalance validates if user has sufficient balance for the given amount
func (s *CustomPassPrechargeServiceImpl) ValidateUserBalance(userID int, amount int64) error {
	if amount < 0 {
		return &PrechargeError{
			Code:    ErrCodeInvalidAmount,
			Message: "金额不能为负数",
		}
	}

	if amount == 0 {
		return nil
	}

	// Get user quota from cache or database
	userQuota, err := model.GetUserQuota(userID, false)
	if err != nil {
		return &PrechargeError{
			Code:    ErrCodeDatabaseError,
			Message: "获取用户余额失败",
			Details: err.Error(),
		}
	}

	if userQuota < int(amount) {
		return &PrechargeError{
			Code: ErrCodeInsufficientBalance,
			Message: fmt.Sprintf("用户余额不足，当前余额: %s，需要: %s",
				common.LogQuota(userQuota), common.LogQuota(int(amount))),
		}
	}

	return nil
}

// ProcessRefund processes refund for the difference between precharge and actual amount
func (s *CustomPassPrechargeServiceImpl) ProcessRefund(userID int, prechargeAmount, actualAmount int64) error {
	if prechargeAmount <= actualAmount {
		// No refund needed
		return nil
	}

	refundAmount := prechargeAmount - actualAmount
	if refundAmount <= 0 {
		return nil
	}

	// Get user lock to prevent concurrent operations
	userLock := s.getUserLock(userID)
	userLock.Lock()
	defer userLock.Unlock()

	// Increase user quota (refund)
	err := model.IncreaseUserQuota(userID, int(refundAmount), false)
	if err != nil {
		return &PrechargeError{
			Code:    ErrCodeDatabaseError,
			Message: "退还用户配额失败",
			Details: err.Error(),
		}
	}

	return nil
}

// ProcessSettlement processes final settlement for completed requests
func (s *CustomPassPrechargeServiceImpl) ProcessSettlement(userID int, prechargeAmount, actualAmount int64) error {
	if prechargeAmount == actualAmount {
		// No settlement needed
		return nil
	}

	if prechargeAmount > actualAmount {
		// Refund excess amount
		return s.ProcessRefund(userID, prechargeAmount, actualAmount)
	} else {
		// Charge additional amount
		additionalAmount := actualAmount - prechargeAmount

		// Get user lock to prevent concurrent operations
		userLock := s.getUserLock(userID)
		userLock.Lock()
		defer userLock.Unlock()

		// Validate user has sufficient balance for additional charge
		err := s.ValidateUserBalance(userID, additionalAmount)
		if err != nil {
			return err
		}

		// Decrease user quota (additional charge)
		err = model.DecreaseUserQuota(userID, int(additionalAmount))
		if err != nil {
			return &PrechargeError{
				Code:    ErrCodeDatabaseError,
				Message: "扣除额外费用失败",
				Details: err.Error(),
			}
		}
	}

	return nil
}

// getUserLock gets or creates a mutex for the given user ID
func (s *CustomPassPrechargeServiceImpl) getUserLock(userID int) *sync.Mutex {
	lock, _ := s.userLocks.LoadOrStore(userID, &sync.Mutex{})
	return lock.(*sync.Mutex)
}

// isRetryableError checks if an error is retryable
func (s *CustomPassPrechargeServiceImpl) isRetryableError(err error) bool {
	if err == nil {
		return false
	}

	// Check for database connection errors, deadlocks, etc.
	errStr := err.Error()
	retryableErrors := []string{
		"connection refused",
		"connection reset",
		"timeout",
		"deadlock",
		"lock wait timeout",
		"database is locked",
	}

	for _, retryableErr := range retryableErrors {
		if contains(errStr, retryableErr) {
			return true
		}
	}

	// Check for specific database errors
	if errors.Is(err, sql.ErrConnDone) || errors.Is(err, sql.ErrTxDone) {
		return true
	}

	return false
}

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
			len(s) > len(substr) &&
				(s[:len(substr)] == substr ||
					s[len(s)-len(substr):] == substr ||
					indexOf(s, substr) >= 0))
}

// indexOf returns the index of substr in s, or -1 if not found
func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// IsPrechargeError checks if an error is a CustomPass precharge error
func IsPrechargeError(err error) bool {
	_, ok := err.(*PrechargeError)
	return ok
}

// GetPrechargeErrorCode extracts error code from CustomPass precharge error
func GetPrechargeErrorCode(err error) string {
	if prechargeErr, ok := err.(*PrechargeError); ok {
		return prechargeErr.Code
	}
	return "UNKNOWN_ERROR"
}

// Convenience functions for common operations

// ValidateAndPrecharge validates user and executes precharge in one operation
func ValidateAndPrecharge(c *gin.Context, user *model.User, modelName string, estimatedUsage *Usage) (*PrechargeResult, *model.BillingInfo, error) {
	service := NewCustomPassPrechargeService()
	return service.ExecutePrecharge(c, user, modelName, estimatedUsage)
}

// CalculateQuota calculates quota for given model and usage
func CalculateQuota(modelName string, usage *Usage, userGroup string) (int64, error) {
	service := NewCustomPassPrechargeService()
	return service.CalculatePrechargeAmount(modelName, usage, userGroup)
}

// SettleTransaction settles the final transaction amount
func SettleTransaction(userID int, prechargeAmount, actualAmount int64) error {
	service := NewCustomPassPrechargeService()
	return service.ProcessSettlement(userID, prechargeAmount, actualAmount)
}

// getBillingModeString converts BillingMode enum to string for logging
func getBillingModeString(mode BillingMode) string {
	switch mode {
	case BillingModeFree:
		return "free"
	case BillingModeUsage:
		return "usage"
	case BillingModeFixed:
		return "fixed"
	default:
		return fmt.Sprintf("unknown(%d)", int(mode))
	}
}
