package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TopUp struct {
	Id              int     `json:"id"`
	UserId          int     `json:"user_id" gorm:"index"`
	Amount          int64   `json:"amount"`
	Money           float64 `json:"money"`
	TradeNo         string  `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentMethod   string  `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentProvider string  `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	CreateTime      int64   `json:"create_time"`
	CompleteTime    int64   `json:"complete_time"`
	Status          string  `json:"status"`
}

const (
	PaymentMethodStripe       = "stripe"
	PaymentMethodCreem        = "creem"
	PaymentMethodWaffo        = "waffo"
	PaymentMethodWaffoPancake = "waffo_pancake"
)

const (
	PaymentProviderEpay         = "epay"
	PaymentProviderStripe       = "stripe"
	PaymentProviderCreem        = "creem"
	PaymentProviderWaffo        = "waffo"
	PaymentProviderWaffoPancake = "waffo_pancake"
)

var (
	ErrPaymentMethodMismatch = errors.New("payment method mismatch")
	ErrTopUpNotFound         = errors.New("topup not found")
	ErrTopUpStatusInvalid    = errors.New("topup status invalid")
)

func (topUp *TopUp) Insert() error {
	var err error
	err = DB.Create(topUp).Error
	return err
}

func (topUp *TopUp) Update() error {
	var err error
	err = DB.Save(topUp).Error
	return err
}

func GetTopUpById(id int) *TopUp {
	var topUp *TopUp
	var err error
	err = DB.Where("id = ?", id).First(&topUp).Error
	if err != nil {
		return nil
	}
	return topUp
}

func GetTopUpByTradeNo(tradeNo string) *TopUp {
	var topUp *TopUp
	var err error
	err = DB.Where("trade_no = ?", tradeNo).First(&topUp).Error
	if err != nil {
		return nil
	}
	return topUp
}

func normalizeTopUpPaymentMethod(method string) string {
	return strings.ToLower(strings.TrimSpace(method))
}

func NormalizeTopUpValueUSD(topUp *TopUp) float64 {
	if topUp == nil {
		return 0
	}

	switch normalizeTopUpPaymentMethod(topUp.PaymentMethod) {
	case PaymentMethodStripe:
		return topUp.Money
	case PaymentMethodCreem:
		if common.QuotaPerUnit <= 0 {
			return 0
		}
		return float64(topUp.Amount) / common.QuotaPerUnit
	default:
		return float64(topUp.Amount)
	}
}

func buildPaymentAutoSwitchGroupChainSet(paymentSetting *operation_setting.PaymentSetting) map[string]struct{} {
	if paymentSetting == nil {
		paymentSetting = operation_setting.GetPaymentSetting()
	}
	chainGroups := make(map[string]struct{}, len(paymentSetting.AutoSwitchGroupRules)+1)
	chainGroups[operation_setting.NormalizePaymentAutoSwitchGroupBaseGroup(paymentSetting.AutoSwitchGroupBaseGroup)] = struct{}{}
	for _, rule := range paymentSetting.AutoSwitchGroupRules {
		group := strings.TrimSpace(rule.Group)
		if group == "" {
			continue
		}
		chainGroups[group] = struct{}{}
	}
	return chainGroups
}

func getPaymentAutoSwitchGroupChainSet() map[string]struct{} {
	return buildPaymentAutoSwitchGroupChainSet(operation_setting.GetPaymentSetting())
}

func isPaymentAutoSwitchGroupChainMember(group string, chainGroups map[string]struct{}) bool {
	trimmedGroup := strings.TrimSpace(group)
	if trimmedGroup == "" {
		return false
	}
	_, ok := chainGroups[trimmedGroup]
	return ok
}

func getPaymentAutoSwitchGroupTopUpCutoffTime() int64 {
	paymentSetting := operation_setting.GetPaymentSetting()
	if !paymentSetting.AutoSwitchGroupOnlyNewTopups || paymentSetting.AutoSwitchGroupEnabledFrom <= 0 {
		return 0
	}
	return paymentSetting.AutoSwitchGroupEnabledFrom
}

func GetUserSuccessfulTopupTotalUSDTx(tx *gorm.DB, userId int) (float64, error) {
	if tx == nil {
		return 0, errors.New("tx is nil")
	}
	if userId <= 0 {
		return 0, errors.New("invalid user id")
	}

	query := tx.Model(&TopUp{}).
		Select("amount", "money", "payment_method").
		Where(
			"user_id = ? AND status = ? AND ((LOWER(payment_method) = ? AND money > 0) OR (LOWER(payment_method) <> ? AND amount > 0))",
			userId,
			common.TopUpStatusSuccess,
			PaymentMethodStripe,
			PaymentMethodStripe,
		)
	if cutoffTime := getPaymentAutoSwitchGroupTopUpCutoffTime(); cutoffTime > 0 {
		query = query.Where("complete_time >= ?", cutoffTime)
	}

	var topUps []TopUp
	if err := query.Find(&topUps).Error; err != nil {
		return 0, err
	}

	totalUSD := 0.0
	for i := range topUps {
		totalUSD += NormalizeTopUpValueUSD(&topUps[i])
	}
	return totalUSD, nil
}

func matchPaymentAutoSwitchGroupRule(totalTopUpUSD float64, rules []operation_setting.PaymentAutoSwitchGroupRule) string {
	if totalTopUpUSD <= 0 || len(rules) == 0 {
		return ""
	}

	matchedGroup := ""
	matchedThreshold := -1.0
	for _, rule := range rules {
		group := strings.TrimSpace(rule.Group)
		if group == "" || rule.ThresholdUSD > totalTopUpUSD {
			continue
		}
		if rule.ThresholdUSD > matchedThreshold {
			matchedThreshold = rule.ThresholdUSD
			matchedGroup = group
		}
	}
	return matchedGroup
}

func getTopUpAutoSwitchTargetGroupTx(tx *gorm.DB, userId int) (string, error) {
	if tx == nil {
		return "", errors.New("tx is nil")
	}
	if userId <= 0 {
		return "", errors.New("invalid user id")
	}

	paymentSetting := operation_setting.GetPaymentSetting()
	if !paymentSetting.AutoSwitchGroupEnabled {
		return "", nil
	}

	totalTopUpUSD, err := GetUserSuccessfulTopupTotalUSDTx(tx, userId)
	if err != nil {
		return "", err
	}
	return matchPaymentAutoSwitchGroupRule(totalTopUpUSD, paymentSetting.AutoSwitchGroupRules), nil
}

func updateUserGroupTx(tx *gorm.DB, userId int, targetGroup string) error {
	if tx == nil {
		return errors.New("tx is nil")
	}
	if userId <= 0 {
		return errors.New("invalid user id")
	}

	targetGroup = strings.TrimSpace(targetGroup)
	if targetGroup == "" {
		return nil
	}

	return tx.Model(&User{}).Where("id = ?", userId).Update("group", targetGroup).Error
}

func getUserGroupForUpdateTx(tx *gorm.DB, userId int) (string, error) {
	if tx == nil {
		return "", errors.New("tx is nil")
	}
	if userId <= 0 {
		return "", errors.New("invalid user id")
	}

	var group string
	query := tx.Model(&User{}).Where("id = ?", userId).Select(commonGroupCol)
	if !common.UsingSQLite {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	if err := query.Find(&group).Error; err != nil {
		return "", err
	}
	return strings.TrimSpace(group), nil
}

func applyTopUpAutoSwitchGroupTx(tx *gorm.DB, userId int) (string, error) {
	if tx == nil {
		return "", errors.New("tx is nil")
	}
	if userId <= 0 {
		return "", errors.New("invalid user id")
	}

	paymentSetting := operation_setting.GetPaymentSetting()
	if !paymentSetting.AutoSwitchGroupEnabled {
		return "", nil
	}

	currentGroup, err := getUserGroupForUpdateTx(tx, userId)
	if err != nil {
		return "", err
	}

	activeUpgradeGroup, err := getActiveSubscriptionUpgradeGroupTx(tx, userId, GetDBTimestamp(), 0)
	if err != nil {
		return "", err
	}
	if activeUpgradeGroup != "" {
		if currentGroup == activeUpgradeGroup {
			return "", nil
		}
		if err := updateUserGroupTx(tx, userId, activeUpgradeGroup); err != nil {
			return "", err
		}
		return activeUpgradeGroup, nil
	}

	chainGroups := buildPaymentAutoSwitchGroupChainSet(paymentSetting)
	if !isPaymentAutoSwitchGroupChainMember(currentGroup, chainGroups) {
		return "", nil
	}

	targetGroup, err := getTopUpAutoSwitchTargetGroupTx(tx, userId)
	if err != nil {
		return "", err
	}
	if targetGroup == "" || currentGroup == targetGroup {
		return "", nil
	}

	if err := updateUserGroupTx(tx, userId, targetGroup); err != nil {
		return "", err
	}
	return targetGroup, nil
}

func ApplyTopUpAutoSwitchGroup(userId int) (string, error) {
	var switchedGroup string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		switchedGroup, err = applyTopUpAutoSwitchGroupTx(tx, userId)
		return err
	})
	if err != nil {
		return "", err
	}
	if switchedGroup != "" {
		_ = UpdateUserGroupCache(userId, switchedGroup)
	}
	return switchedGroup, nil
}

func UpdatePendingTopUpStatus(tradeNo string, expectedPaymentProvider string, targetStatus string) error {
	if tradeNo == "" {
		return errors.New("未提供支付单号")
	}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		topUp := &TopUp{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return ErrTopUpNotFound
		}
		if expectedPaymentProvider != "" && topUp.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if topUp.Status != common.TopUpStatusPending {
			return ErrTopUpStatusInvalid
		}

		topUp.Status = targetStatus
		return tx.Save(topUp).Error
	})
}

func Recharge(referenceId string, customerId string, callerIp string) (err error) {
	if referenceId == "" {
		return errors.New("未提供支付单号")
	}

	var quota float64
	var switchedGroup string
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", referenceId).First(topUp).Error
		if err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderStripe {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("充值订单状态错误")
		}

		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		err = tx.Save(topUp).Error
		if err != nil {
			return err
		}

		quota = topUp.Money * common.QuotaPerUnit
		err = tx.Model(&User{}).Where("id = ?", topUp.UserId).Updates(map[string]interface{}{"stripe_customer": customerId, "quota": gorm.Expr("quota + ?", quota)}).Error
		if err != nil {
			return err
		}

		switchedGroup, err = applyTopUpAutoSwitchGroupTx(tx, topUp.UserId)
		return err
	})

	if err != nil {
		common.SysError("topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if switchedGroup != "" {
		_ = UpdateUserGroupCache(topUp.UserId, switchedGroup)
	}

	RecordTopupLog(topUp.UserId, fmt.Sprintf("使用在线充值成功，充值金额: %v，支付金额：%d", logger.FormatQuota(int(quota)), topUp.Amount), callerIp, topUp.PaymentMethod, PaymentMethodStripe)

	return nil
}

// topUpQueryWindowSeconds 限制充值记录查询的时间窗口（秒）。
const topUpQueryWindowSeconds int64 = 30 * 24 * 60 * 60

// topUpQueryCutoff 返回允许查询的最早 create_time（秒级 Unix 时间戳）。
func topUpQueryCutoff() int64 {
	return common.GetTimestamp() - topUpQueryWindowSeconds
}

func GetUserTopUps(userId int, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	// Start transaction
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	cutoff := topUpQueryCutoff()

	// Get total count within transaction
	err = tx.Model(&TopUp{}).Where("user_id = ? AND create_time >= ?", userId, cutoff).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated topups within same transaction
	err = tx.Where("user_id = ? AND create_time >= ?", userId, cutoff).Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Commit transaction
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return topups, total, nil
}

// GetAllTopUps 获取全平台的充值记录（管理员使用，不限制时间窗口）
func GetAllTopUps(pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err = tx.Model(&TopUp{}).Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return topups, total, nil
}

// searchTopUpCountHardLimit 搜索充值记录时 COUNT 的安全上限，
// 防止对超大表执行无界 COUNT 触发 DoS。
const searchTopUpCountHardLimit = 10000

// SearchUserTopUps 按订单号搜索某用户的充值记录
func SearchUserTopUps(userId int, keyword string, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&TopUp{}).Where("user_id = ? AND create_time >= ?", userId, topUpQueryCutoff())
	if keyword != "" {
		pattern, perr := sanitizeLikePattern(keyword)
		if perr != nil {
			tx.Rollback()
			return nil, 0, perr
		}
		query = query.Where("trade_no LIKE ? ESCAPE '!'", pattern)
	}

	if err = query.Limit(searchTopUpCountHardLimit).Count(&total).Error; err != nil {
		tx.Rollback()
		common.SysError("failed to count search topups: " + err.Error())
		return nil, 0, errors.New("搜索充值记录失败")
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		tx.Rollback()
		common.SysError("failed to search topups: " + err.Error())
		return nil, 0, errors.New("搜索充值记录失败")
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return topups, total, nil
}

// SearchAllTopUps 按订单号搜索全平台充值记录（管理员使用，不限制时间窗口）
func SearchAllTopUps(keyword string, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&TopUp{})
	if keyword != "" {
		pattern, perr := sanitizeLikePattern(keyword)
		if perr != nil {
			tx.Rollback()
			return nil, 0, perr
		}
		query = query.Where("trade_no LIKE ? ESCAPE '!'", pattern)
	}

	if err = query.Limit(searchTopUpCountHardLimit).Count(&total).Error; err != nil {
		tx.Rollback()
		common.SysError("failed to count search topups: " + err.Error())
		return nil, 0, errors.New("搜索充值记录失败")
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		tx.Rollback()
		common.SysError("failed to search topups: " + err.Error())
		return nil, 0, errors.New("搜索充值记录失败")
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return topups, total, nil
}

// ManualCompleteTopUp 管理员手动完成订单并给用户充值
func ManualCompleteTopUp(tradeNo string, callerIp string) error {
	if tradeNo == "" {
		return errors.New("未提供订单号")
	}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	var userId int
	var quotaToAdd int
	var payMoney float64
	var paymentMethod string
	var switchedGroup string

	err := DB.Transaction(func(tx *gorm.DB) error {
		topUp := &TopUp{}
		// 行级锁，避免并发补单
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return errors.New("充值订单不存在")
		}

		// 幂等处理：已成功直接返回
		if topUp.Status == common.TopUpStatusSuccess {
			return nil
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("订单状态不是待支付，无法补单")
		}

		// 计算应充值额度：
		// - Stripe 订单：Money 代表经分组倍率换算后的美元数量，直接 * QuotaPerUnit
		// - 其他订单（如易支付）：Amount 为美元数量，* QuotaPerUnit
		if topUp.PaymentProvider == PaymentProviderStripe {
			dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
			quotaToAdd = int(decimal.NewFromFloat(topUp.Money).Mul(dQuotaPerUnit).IntPart())
		} else {
			dAmount := decimal.NewFromInt(topUp.Amount)
			dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
			quotaToAdd = int(dAmount.Mul(dQuotaPerUnit).IntPart())
		}
		if quotaToAdd <= 0 {
			return errors.New("无效的充值额度")
		}

		// 标记完成
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}

		// 增加用户额度（立即写库，保持一致性）
		if err := tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
			return err
		}

		userId = topUp.UserId
		payMoney = topUp.Money
		paymentMethod = topUp.PaymentMethod
		var switchErr error
		switchedGroup, switchErr = applyTopUpAutoSwitchGroupTx(tx, topUp.UserId)
		return switchErr
	})

	if err != nil {
		return err
	}
	if switchedGroup != "" {
		_ = UpdateUserGroupCache(userId, switchedGroup)
	}

	// 事务外记录日志，避免阻塞
	RecordTopupLog(userId, fmt.Sprintf("管理员补单成功，充值金额: %v，支付金额：%f", logger.FormatQuota(quotaToAdd), payMoney), callerIp, paymentMethod, "admin")
	return nil
}
func RechargeCreem(referenceId string, customerEmail string, customerName string, callerIp string) (err error) {
	if referenceId == "" {
		return errors.New("未提供支付单号")
	}

	var quota int64
	var switchedGroup string
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", referenceId).First(topUp).Error
		if err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderCreem {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("充值订单状态错误")
		}

		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		err = tx.Save(topUp).Error
		if err != nil {
			return err
		}

		// Creem 直接使用 Amount 作为充值额度（整数）
		quota = topUp.Amount

		// 构建更新字段，优先使用邮箱，如果邮箱为空则使用用户名
		updateFields := map[string]interface{}{
			"quota": gorm.Expr("quota + ?", quota),
		}

		// 如果有客户邮箱，尝试更新用户邮箱（仅当用户邮箱为空时）
		if customerEmail != "" {
			// 先检查用户当前邮箱是否为空
			var user User
			err = tx.Where("id = ?", topUp.UserId).First(&user).Error
			if err != nil {
				return err
			}

			// 如果用户邮箱为空，则更新为支付时使用的邮箱
			if user.Email == "" {
				updateFields["email"] = customerEmail
			}
		}

		err = tx.Model(&User{}).Where("id = ?", topUp.UserId).Updates(updateFields).Error
		if err != nil {
			return err
		}

		switchedGroup, err = applyTopUpAutoSwitchGroupTx(tx, topUp.UserId)
		return err
	})

	if err != nil {
		common.SysError("creem topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if switchedGroup != "" {
		_ = UpdateUserGroupCache(topUp.UserId, switchedGroup)
	}

	RecordTopupLog(topUp.UserId, fmt.Sprintf("使用Creem充值成功，充值额度: %v，支付金额：%.2f", quota, topUp.Money), callerIp, topUp.PaymentMethod, PaymentMethodCreem)

	return nil
}

func RechargeWaffo(tradeNo string, callerIp string) (err error) {
	if tradeNo == "" {
		return errors.New("未提供支付单号")
	}

	var quotaToAdd int
	var switchedGroup string
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(topUp).Error
		if err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderWaffo {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status == common.TopUpStatusSuccess {
			return nil // 幂等：已成功直接返回
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("充值订单状态错误")
		}

		dAmount := decimal.NewFromInt(topUp.Amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quotaToAdd = int(dAmount.Mul(dQuotaPerUnit).IntPart())
		if quotaToAdd <= 0 {
			return errors.New("无效的充值额度")
		}

		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}

		if err := tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
			return err
		}

		switchedGroup, err = applyTopUpAutoSwitchGroupTx(tx, topUp.UserId)
		return err
	})

	if err != nil {
		common.SysError("waffo topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if switchedGroup != "" {
		_ = UpdateUserGroupCache(topUp.UserId, switchedGroup)
	}

	if quotaToAdd > 0 {
		RecordTopupLog(topUp.UserId, fmt.Sprintf("Waffo充值成功，充值额度: %v，支付金额: %.2f", logger.FormatQuota(quotaToAdd), topUp.Money), callerIp, topUp.PaymentMethod, PaymentMethodWaffo)
	}

	return nil
}

func RechargeWaffoPancake(tradeNo string) (err error) {
	if tradeNo == "" {
		return errors.New("未提供支付单号")
	}

	var quotaToAdd int
	var switchedGroup string
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(topUp).Error
		if err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderWaffoPancake {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status == common.TopUpStatusSuccess {
			return nil
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("充值订单状态错误")
		}

		quotaToAdd = int(decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())
		if quotaToAdd <= 0 {
			return errors.New("无效的充值额度")
		}

		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}

		if err := tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
			return err
		}

		switchedGroup, err = applyTopUpAutoSwitchGroupTx(tx, topUp.UserId)
		return err
	})

	if err != nil {
		common.SysError("waffo pancake topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if switchedGroup != "" {
		_ = UpdateUserGroupCache(topUp.UserId, switchedGroup)
	}

	if quotaToAdd > 0 {
		RecordLog(topUp.UserId, LogTypeTopup, fmt.Sprintf("Waffo Pancake充值成功，充值额度: %v，支付金额: %.2f", logger.FormatQuota(quotaToAdd), topUp.Money))
	}

	return nil
}
