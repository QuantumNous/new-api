package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type TopUp struct {
	Id                 int     `json:"id"`
	UserId             int     `json:"user_id" gorm:"index"`
	Amount             int64   `json:"amount"`
	BonusAmount        int64   `json:"bonus_amount" gorm:"default:0"`
	BonusTier          int     `json:"bonus_tier" gorm:"default:0"` // 原始充值档位金额，回调侧反查 AmountBonusLimit
	Money              float64 `json:"money"`
	PaymentCurrency    string  `json:"payment_currency" gorm:"type:varchar(10);default:''"`
	PaymentPriceId     string  `json:"payment_price_id" gorm:"type:varchar(255);default:''"`
	PaymentAmountMinor int64   `json:"payment_amount_minor" gorm:"default:0"`
	TradeNo            string  `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	GatewayTradeNo     string  `json:"gateway_trade_no" gorm:"type:varchar(255);index"`
	PaymentMethod      string  `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentProvider    string  `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	GAClientID         string  `json:"ga_client_id,omitempty" gorm:"type:varchar(128);default:''"`
	GASessionID        string  `json:"ga_session_id,omitempty" gorm:"type:varchar(128);default:''"`
	CreateTime         int64   `json:"create_time"`
	CompleteTime       int64   `json:"complete_time"`
	Status             string  `json:"status"`
	// SaveCard records that this top-up's Checkout was created with setup_future_usage
	// (onboarding promo flow), so the webhook should mark the user card-bound on fulfillment.
	// This is persisted because Stripe payment-mode sessions don't expose setup_intent on the
	// checkout.session.completed event, so the event alone can't tell us a card was saved.
	SaveCard bool            `json:"save_card" gorm:"default:false"`
	Invoice  *PaymentInvoice `json:"invoice,omitempty" gorm:"foreignKey:TradeNo;references:TradeNo"`
}

const (
	PaymentMethodStripe       = "stripe"
	PaymentMethodCreem        = "creem"
	PaymentMethodWaffo        = "waffo"
	PaymentMethodWaffoPancake = "waffo_pancake"
	PaymentMethodPaddle       = "paddle"
	PaymentMethodBalance      = "balance"
)

const (
	PaymentProviderEpay         = "epay"
	PaymentProviderStripe       = "stripe"
	PaymentProviderCreem        = "creem"
	PaymentProviderWaffo        = "waffo"
	PaymentProviderWaffoPancake = "waffo_pancake"
	PaymentProviderPaddle       = "paddle"
	PaymentProviderBalance      = "balance"
)

var (
	ErrPaymentMethodMismatch = errors.New("payment method mismatch")
	ErrTopUpNotFound         = errors.New("topup not found")
	ErrTopUpStatusInvalid    = errors.New("topup status invalid")
)

type PaymentSnapshot struct {
	Money    float64
	Currency string
}

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

func GetUserPaddleTopUpByIdentifiers(userId int, tradeNo string, gatewayTradeNo string) (*TopUp, error) {
	tradeNo = strings.TrimSpace(tradeNo)
	gatewayTradeNo = strings.TrimSpace(gatewayTradeNo)
	if tradeNo == "" && gatewayTradeNo == "" {
		return nil, ErrTopUpNotFound
	}

	query := DB.Where("user_id = ? AND payment_provider = ?", userId, PaymentProviderPaddle)
	if tradeNo != "" && gatewayTradeNo != "" {
		query = query.Where("trade_no = ? AND gateway_trade_no = ?", tradeNo, gatewayTradeNo)
	} else if tradeNo != "" {
		query = query.Where("trade_no = ?", tradeNo)
	} else {
		query = query.Where("gateway_trade_no = ?", gatewayTradeNo)
	}

	topUp := &TopUp{}
	if err := query.First(topUp).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTopUpNotFound
		}
		return nil, err
	}
	return topUp, nil
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

func AttachPaddleGatewayTradeNo(tradeNo string, userId int, gatewayTradeNo string) error {
	tradeNo = strings.TrimSpace(tradeNo)
	gatewayTradeNo = strings.TrimSpace(gatewayTradeNo)
	if tradeNo == "" || gatewayTradeNo == "" {
		return errors.New("未提供支付单号")
	}

	result := DB.Model(&TopUp{}).
		Where("trade_no = ? AND user_id = ? AND payment_provider = ? AND status = ?", tradeNo, userId, PaymentProviderPaddle, common.TopUpStatusPending).
		Where("(gateway_trade_no = ? OR gateway_trade_no = ?)", gatewayTradeNo, "").
		Update("gateway_trade_no", gatewayTradeNo)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected > 0 {
		return nil
	}

	topUp := GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		return ErrTopUpNotFound
	}
	if topUp.PaymentProvider != PaymentProviderPaddle {
		return ErrPaymentMethodMismatch
	}
	if topUp.UserId != userId {
		return errors.New("充值订单用户不匹配")
	}
	if strings.TrimSpace(topUp.GatewayTradeNo) == gatewayTradeNo {
		return nil
	}
	return ErrTopUpStatusInvalid
}

func Recharge(referenceId string, customerId string, callerIp string) (bool, error) {
	return RechargeWithPaymentSnapshot(referenceId, customerId, callerIp, PaymentSnapshot{})
}

func RechargeWithPaymentSnapshot(referenceId string, customerId string, callerIp string, snapshot PaymentSnapshot) (bool, error) {
	if referenceId == "" {
		return false, errors.New("未提供支付单号")
	}

	var quotaToAdd int
	var credited bool
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", referenceId).First(topUp).Error
		if err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderStripe {
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

		bonusQuota, bonusErr := applyTopUpBonusInTx(tx, topUp, topUpBonusLimitFor(topUp.BonusTier))
		if bonusErr != nil {
			return bonusErr
		}
		quotaToAdd += int(bonusQuota)

		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if snapshot.Money > 0 || strings.TrimSpace(snapshot.Currency) != "" {
			topUp.Money = snapshot.Money
		}
		if strings.TrimSpace(snapshot.Currency) != "" {
			topUp.PaymentCurrency = strings.ToUpper(strings.TrimSpace(snapshot.Currency))
		}
		err = tx.Save(topUp).Error
		if err != nil {
			return err
		}

		updateFields := map[string]interface{}{"quota": gorm.Expr("quota + ?", quotaToAdd)}
		if strings.TrimSpace(customerId) != "" {
			updateFields["stripe_customer"] = strings.TrimSpace(customerId)
		}
		// Bind the card atomically with the credit when this was a save-card (onboarding promo)
		// top-up: setting stripe_card_bound here — inside the same status-gated transaction that
		// credits quota — makes binding exactly as idempotent as the credit. It runs only on the
		// pending→success transition (redelivery hits the Status==Success early return above), so
		// a webhook replay cannot re-bind a card the user has since removed, and a binding can
		// never be "lost" relative to a successful credit. Requires a customer to charge later;
		// without one we skip binding rather than record an unchargeable card_bound=true. The
		// fingerprint is fetched best-effort outside this tx (Stripe API call) by the caller.
		if topUp.SaveCard && strings.TrimSpace(customerId) != "" {
			updateFields["stripe_card_bound"] = true
		}
		err = tx.Model(&User{}).Where("id = ?", topUp.UserId).Updates(updateFields).Error
		if err != nil {
			return err
		}

		credited = true
		return nil
	})

	if err != nil {
		common.SysError("topup failed: " + err.Error())
		return false, errors.New("充值失败，请稍后重试")
	}

	if credited {
		if err := cacheIncrUserQuota(topUp.UserId, int64(quotaToAdd)); err != nil {
			common.SysLog("failed to increase user quota cache after stripe topup: " + err.Error())
		}
		logMsg := fmt.Sprintf("使用在线充值成功，充值金额: %v，支付金额：%.2f", logger.FormatQuota(quotaToAdd), topUp.Money)
		RecordTopupLog(topUp.UserId, logMsg, callerIp, topUp.PaymentMethod, PaymentMethodStripe)
	}

	return credited, nil
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
	err = tx.Preload("Invoice").Where("user_id = ? AND create_time >= ?", userId, cutoff).Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error
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

	if err = tx.Preload("Invoice").Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
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

	if err = query.Preload("Invoice").Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
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

	if err = query.Preload("Invoice").Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
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

		// Amount 只存本金；赠送在回调/补单时按档位限次另行裁决。BonusAmount 记录实际发放的赠送，供审计/展示。
		dAmount := decimal.NewFromInt(topUp.Amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quotaToAdd = int(dAmount.Mul(dQuotaPerUnit).IntPart())
		if quotaToAdd <= 0 {
			return errors.New("无效的充值额度")
		}

		bonusQuota, bonusErr := applyTopUpBonusInTx(tx, topUp, topUpBonusLimitFor(topUp.BonusTier))
		if bonusErr != nil {
			return bonusErr
		}
		quotaToAdd += int(bonusQuota)

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
		return nil
	})

	if err != nil {
		return err
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

		return nil
	})

	if err != nil {
		common.SysError("creem topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	RecordTopupLog(topUp.UserId, fmt.Sprintf("使用Creem充值成功，充值额度: %v，支付金额：%.2f", quota, topUp.Money), callerIp, topUp.PaymentMethod, PaymentMethodCreem)

	return nil
}

func RechargeWaffo(tradeNo string, callerIp string) (bool, error) {
	if tradeNo == "" {
		return false, errors.New("未提供支付单号")
	}

	var quotaToAdd int
	var credited bool
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
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

		bonusQuota, bonusErr := applyTopUpBonusInTx(tx, topUp, topUpBonusLimitFor(topUp.BonusTier))
		if bonusErr != nil {
			return bonusErr
		}
		quotaToAdd += int(bonusQuota)

		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}

		if err := tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
			return err
		}

		credited = true
		return nil
	})

	if err != nil {
		common.SysError("waffo topup failed: " + err.Error())
		return false, errors.New("充值失败，请稍后重试")
	}

	if quotaToAdd > 0 {
		RecordTopupLog(topUp.UserId, fmt.Sprintf("Waffo充值成功，充值额度: %v，支付金额: %.2f", logger.FormatQuota(quotaToAdd), topUp.Money), callerIp, topUp.PaymentMethod, PaymentMethodWaffo)
	}

	return credited, nil
}

func RechargeWaffoPancake(tradeNo string) (bool, error) {
	if tradeNo == "" {
		return false, errors.New("未提供支付单号")
	}

	var quotaToAdd int
	var credited bool
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
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

		bonusQuota, bonusErr := applyTopUpBonusInTx(tx, topUp, topUpBonusLimitFor(topUp.BonusTier))
		if bonusErr != nil {
			return bonusErr
		}
		quotaToAdd += int(bonusQuota)

		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}

		if err := tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
			return err
		}

		credited = true
		return nil
	})

	if err != nil {
		common.SysError("waffo pancake topup failed: " + err.Error())
		return false, errors.New("充值失败，请稍后重试")
	}

	if quotaToAdd > 0 {
		RecordLog(topUp.UserId, LogTypeTopup, fmt.Sprintf("Waffo Pancake充值成功，充值额度: %v，支付金额: %.2f", logger.FormatQuota(quotaToAdd), topUp.Money))
	}

	return credited, nil
}

func RechargePaddle(tradeNo string, expectedUserId int, expectedGatewayTradeNo string, callerIp string) (bool, error) {
	if tradeNo == "" {
		return false, errors.New("未提供支付单号")
	}
	expectedGatewayTradeNo = strings.TrimSpace(expectedGatewayTradeNo)

	var quotaToAdd int
	var credited bool
	topUp := &TopUp{}
	completeTime := common.GetTimestamp()

	err := DB.Transaction(func(tx *gorm.DB) error {
		refCol := "`trade_no`"
		if common.UsingPostgreSQL {
			refCol = `"trade_no"`
		}

		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderPaddle {
			return ErrPaymentMethodMismatch
		}

		if expectedUserId > 0 && topUp.UserId != expectedUserId {
			return errors.New("充值订单用户不匹配")
		}

		storedGatewayTradeNo := strings.TrimSpace(topUp.GatewayTradeNo)
		if expectedGatewayTradeNo != "" && storedGatewayTradeNo != "" && storedGatewayTradeNo != expectedGatewayTradeNo {
			return errors.New("充值订单交易号不匹配")
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

		updateQuery := tx.Model(&TopUp{}).
			Where("trade_no = ? AND payment_provider = ? AND status = ?", tradeNo, PaymentProviderPaddle, common.TopUpStatusPending)
		if expectedUserId > 0 {
			updateQuery = updateQuery.Where("user_id = ?", expectedUserId)
		}
		updates := map[string]interface{}{
			"complete_time": completeTime,
			"status":        common.TopUpStatusSuccess,
		}
		if expectedGatewayTradeNo != "" {
			if storedGatewayTradeNo != "" {
				updateQuery = updateQuery.Where("gateway_trade_no = ?", expectedGatewayTradeNo)
			} else {
				updates["gateway_trade_no"] = expectedGatewayTradeNo
			}
		}
		result := updateQuery.Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			if err := tx.Where("trade_no = ?", tradeNo).First(topUp).Error; err != nil {
				return errors.New("充值订单不存在")
			}
			if expectedGatewayTradeNo != "" {
				storedGatewayTradeNo = strings.TrimSpace(topUp.GatewayTradeNo)
				if storedGatewayTradeNo != "" && storedGatewayTradeNo != expectedGatewayTradeNo {
					return errors.New("充值订单交易号不匹配")
				}
			}
			if topUp.Status == common.TopUpStatusSuccess {
				quotaToAdd = 0
				return nil
			}
			return errors.New("充值订单状态错误")
		}

		bonusQuota, bonusErr := applyTopUpBonusInTx(tx, topUp, topUpBonusLimitFor(topUp.BonusTier))
		if bonusErr != nil {
			return bonusErr
		}
		quotaToAdd += int(bonusQuota)

		if err := tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
			return err
		}

		credited = true
		topUp.CompleteTime = completeTime
		topUp.Status = common.TopUpStatusSuccess
		if expectedGatewayTradeNo != "" && storedGatewayTradeNo == "" {
			topUp.GatewayTradeNo = expectedGatewayTradeNo
		}

		return nil
	})

	if err != nil {
		if isCompletedPaddleTopUp(tradeNo, expectedUserId, expectedGatewayTradeNo) {
			return false, nil
		}
		common.SysError("paddle topup failed: " + err.Error())
		return false, errors.New("充值失败，请稍后重试")
	}

	if quotaToAdd > 0 {
		RecordTopupLog(topUp.UserId, fmt.Sprintf("Paddle充值成功，充值额度: %v，支付金额: %.2f", logger.FormatQuota(quotaToAdd), topUp.Money), callerIp, topUp.PaymentMethod, PaymentMethodPaddle)
	}

	return credited, nil
}

func isCompletedPaddleTopUp(tradeNo string, expectedUserId int, expectedGatewayTradeNo string) bool {
	topUp := GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		return false
	}
	if topUp.PaymentProvider != PaymentProviderPaddle {
		return false
	}
	if expectedUserId > 0 && topUp.UserId != expectedUserId {
		return false
	}
	if strings.TrimSpace(expectedGatewayTradeNo) != "" && strings.TrimSpace(topUp.GatewayTradeNo) != strings.TrimSpace(expectedGatewayTradeNo) {
		return false
	}
	return topUp.Status == common.TopUpStatusSuccess
}
