package model

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type TopUp struct {
	Id              int     `json:"id"`
	UserId          int     `json:"user_id" gorm:"index"`
	Amount          int64   `json:"amount"`
	CreditedAmount  float64 `json:"credited_amount" gorm:"type:decimal(18,6);default:0"`
	Money           float64 `json:"money"`
	TradeNo         string  `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentMethod   string  `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentProvider string  `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	CreateTime      int64   `json:"create_time"`
	CompleteTime    int64   `json:"complete_time"`
	Status          string  `json:"status"`
	// Country at order creation (from client IP); not updated when user.country changes.
	Country string `json:"country,omitempty" gorm:"type:varchar(10);default:''"`
	// Admin-only computed fields — not stored in DB
	Username string `json:"username,omitempty" gorm:"-"`
	Email    string `json:"email,omitempty" gorm:"-"`
	Language string `json:"language,omitempty" gorm:"-"`
}

const (
	PaymentMethodStripe       = "stripe"
	PaymentMethodPayPal       = "paypal"
	PaymentMethodCreem        = "creem"
	PaymentMethodWaffo        = "waffo"
	PaymentMethodWaffoPancake = "waffo_pancake"
	PaymentMethodPlatega      = "platega"
	PaymentMethodClink        = "clink"
)

const (
	PaymentProviderEpay         = "epay"
	PaymentProviderStripe       = "stripe"
	PaymentProviderPayPal       = "paypal"
	PaymentProviderCreem        = "creem"
	PaymentProviderWaffo        = "waffo"
	PaymentProviderWaffoPancake = "waffo_pancake"
	PaymentProviderPlatega      = "platega"
	PaymentProviderClink        = "clink"
)

var (
	ErrPaymentMethodMismatch = errors.New("payment method mismatch")
	ErrTopUpNotFound         = errors.New("topup not found")
	ErrTopUpStatusInvalid    = errors.New("topup status invalid")
)

// FormatPaymentMethodLabel returns a human-readable payment method name for ops notifications.
func FormatPaymentMethodLabel(method string) string {
	switch method {
	case PaymentMethodPayPal:
		return "PayPal"
	case PaymentMethodStripe:
		return "Stripe"
	case "alipay":
		return "支付宝"
	case "wxpay":
		return "微信支付"
	case PaymentMethodCreem:
		return "Creem"
	case PaymentMethodWaffo:
		return "Waffo"
	case PaymentMethodWaffoPancake:
		return "Waffo Pancake"
	case PaymentMethodPlatega:
		return "Russian SBP QR"
	case PaymentMethodClink:
		return "Clink"
	case "crypto":
		return "加密货币"
	case "epay":
		return "易支付"
	case "admin":
		return "管理员补单"
	default:
		if method == "" {
			return "未知"
		}
		return method
	}
}

func (topUp *TopUp) Insert() error {
	var err error
	err = DB.Create(topUp).Error
	return err
}

// FillCountryFromIP snapshots geo on the order row at creation time.
// profileCountry is only used when IP lookup fails (frozen at insert, never read again from users).
func (topUp *TopUp) FillCountryFromIP(clientIP string, profileCountry ...string) *TopUp {
	if topUp == nil || topUp.Country != "" {
		return topUp
	}
	topUp.Country = common.LookupCountryByIP(clientIP)
	if topUp.Country == "" && len(profileCountry) > 0 {
		topUp.Country = strings.ToUpper(strings.TrimSpace(profileCountry[0]))
	}
	return topUp
}

// topUpCreditQuota converts a successful order to internal quota units.
// CreditedAmount = precise USD credited when available.
// Amount = legacy integer USD tier to credit; Money = actual payment.
func topUpCreditQuota(topUp *TopUp) float64 {
	if topUp == nil {
		return 0
	}
	dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	if topUp.CreditedAmount > 0 {
		return decimal.NewFromFloat(topUp.CreditedAmount).Mul(dQuotaPerUnit).InexactFloat64()
	}
	switch topUp.PaymentProvider {
	case PaymentProviderStripe:
		// Stripe Money already reflects unit price × group ratio (USD charged).
		return decimal.NewFromFloat(topUp.Money).Mul(dQuotaPerUnit).InexactFloat64()
	default:
		// PayPal / Clink / epay / Waffo: credit the selected USD tier (Amount), not discounted Money.
		return decimal.NewFromInt(topUp.Amount).Mul(dQuotaPerUnit).InexactFloat64()
	}
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

type TopupDailyStat struct {
	Day         int64   `json:"day"`          // Unix timestamp of day start (UTC)
	Count       int     `json:"count"`        // number of successful top-ups
	TotalAmount float64 `json:"total_amount"` // sum of credited USD amount
}

func GetTopupDailyStats(start, end int64) ([]TopupDailyStat, error) {
	var rows []TopupDailyStat
	err := DB.Table("top_ups").
		Select("(create_time / 86400 * 86400) as day, count(*) as count, sum(CASE WHEN credited_amount > 0 THEN credited_amount ELSE amount END) as total_amount").
		Where("create_time >= ? AND create_time <= ? AND status = ?", start, end, "success").
		Group("(create_time / 86400 * 86400)").
		Order("day asc").
		Scan(&rows).Error
	return rows, err
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

		quota = topUpCreditQuota(topUp)
		err = tx.Model(&User{}).Where("id = ?", topUp.UserId).Updates(map[string]interface{}{"stripe_customer": customerId, "quota": gorm.Expr("quota + ?", quota)}).Error
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		common.SysError("topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	RecordTopupLog(topUp.UserId, fmt.Sprintf("使用在线充值成功，充值金额: %v，支付金额：%d", logger.FormatQuota(int(quota)), topUp.Amount), callerIp, topUp.PaymentMethod, PaymentMethodStripe)
	OnTopupSucceeded(topUp.UserId, int(quota), PaymentMethodStripe, topUp.TradeNo)

	return nil
}

func RechargePayPal(referenceId string, callerIp string) (err error) {
	if referenceId == "" {
		return errors.New("未提供支付单号")
	}

	var quota float64
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

		if topUp.PaymentProvider != PaymentProviderPayPal {
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

		quota = topUpCreditQuota(topUp)
		err = tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quota)).Error
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		common.SysError("paypal topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	RecordTopupLog(topUp.UserId, fmt.Sprintf("使用 PayPal 充值成功，充值金额: %v，支付金额：%.2f", logger.FormatQuota(int(quota)), topUp.Money), callerIp, topUp.PaymentMethod, PaymentMethodPayPal)
	OnTopupSucceeded(topUp.UserId, int(quota), PaymentMethodPayPal, topUp.TradeNo)

	return nil
}

func RechargeClink(referenceId string, callerIp string) (err error) {
	if referenceId == "" {
		return errors.New("未提供支付单号")
	}

	var quota float64
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

		if topUp.PaymentProvider != PaymentProviderClink {
			return ErrPaymentMethodMismatch
		}
		if topUp.Status == common.TopUpStatusSuccess {
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return errors.New("充值订单状态错误")
		}

		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}

		quota = topUpCreditQuota(topUp)
		return tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quota)).Error
	})

	if err != nil {
		common.SysError("clink topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	if quota > 0 {
		RecordTopupLog(topUp.UserId, fmt.Sprintf("Clink 充值成功，充值金额: %v，支付金额：%.2f", logger.FormatQuota(int(quota)), topUp.Money), callerIp, topUp.PaymentMethod, PaymentMethodClink)
		OnTopupSucceeded(topUp.UserId, int(quota), PaymentMethodClink, topUp.TradeNo)
	}

	return nil
}

func containsAt(s string) bool {
	for _, c := range s {
		if c == '@' {
			return true
		}
	}
	return false
}

func isDigitOnly(s string) bool {
	if len(s) == 0 {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// topUpQueryWindowSeconds 限制充值记录查询的时间窗口（秒）。
const topUpQueryWindowSeconds int64 = 30 * 24 * 60 * 60

// topUpQueryCutoff 返回允许查询的最早 create_time（秒级 Unix 时间戳）。
func topUpQueryCutoff() int64 {
	return common.GetTimestamp() - topUpQueryWindowSeconds
}

func GetUserTopUps(userId int, status string, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
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

	query := tx.Model(&TopUp{}).Where("user_id = ? AND create_time >= ?", userId, cutoff)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return topups, total, nil
}

// GetAllTopUps 获取全平台的充值记录（管理员使用，不限制时间窗口）
// status 为空字符串时不过滤状态
func GetAllTopUps(status string, paymentMethod string, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
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
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if paymentMethod != "" {
		query = query.Where("payment_method = ?", paymentMethod)
	}

	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
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

// SearchAllTopUps 按订单号 / 邮箱 / UID 搜索全平台充值记录（管理员使用，不限制时间窗口）
// keyword 可以是订单号前缀、用户邮箱（含 @）、或纯数字 UID
func SearchAllTopUps(keyword string, status string, paymentMethod string, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
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
		// Search by email: join users table when keyword contains '@'
		if len(keyword) > 1 && keyword[0] != '@' && (containsAt(keyword) || isDigitOnly(keyword)) {
			if isDigitOnly(keyword) {
				// UID search
				query = query.Where("user_id = ?", keyword)
			} else {
				// Email search via subquery
				query = query.Where("user_id IN (SELECT id FROM users WHERE email LIKE ? ESCAPE '!')", pattern)
			}
		} else {
			query = query.Where("trade_no LIKE ? ESCAPE '!'", pattern)
		}
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if paymentMethod != "" {
		query = query.Where("payment_method = ?", paymentMethod)
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

// ExportAllTopUps returns all admin-visible topups matching the same filters as
// the paginated transaction history.
func ExportAllTopUps(keyword string, status string, paymentMethod string) (topups []*TopUp, err error) {
	query := DB.Model(&TopUp{})
	if keyword != "" {
		pattern, perr := sanitizeLikePattern(keyword)
		if perr != nil {
			return nil, perr
		}
		if len(keyword) > 1 && keyword[0] != '@' && (containsAt(keyword) || isDigitOnly(keyword)) {
			if isDigitOnly(keyword) {
				query = query.Where("user_id = ?", keyword)
			} else {
				query = query.Where("user_id IN (SELECT id FROM users WHERE email LIKE ? ESCAPE '!')", pattern)
			}
		} else {
			query = query.Where("trade_no LIKE ? ESCAPE '!'", pattern)
		}
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if paymentMethod != "" {
		query = query.Where("payment_method = ?", paymentMethod)
	}
	err = query.Order("id desc").Find(&topups).Error
	return topups, err
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

		// - Stripe：Money 为实收美元；PayPal/Clink 等：Amount 为到账美元档位（促销时 Money 为折扣价）
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
		return nil
	})

	if err != nil {
		return err
	}

	// 事务外记录日志，避免阻塞
	RecordTopupLog(userId, fmt.Sprintf("管理员补单成功，充值金额: %v，支付金额：%f", logger.FormatQuota(quotaToAdd), payMoney), callerIp, paymentMethod, "admin")
	// 管理员补单代表一笔真实到账，必须走和其它支付方式一样的成功钩子
	// （返佣 + 飞书通知 + GA4 purchase），否则这笔充值在推广渠道转化漏斗和
	// GA 里都不存在。
	OnTopupSucceeded(userId, quotaToAdd, paymentMethod, tradeNo)
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
	OnTopupSucceeded(topUp.UserId, int(quota), PaymentMethodCreem, topUp.TradeNo)

	return nil
}

func RechargeWaffo(tradeNo string, callerIp string) (err error) {
	if tradeNo == "" {
		return errors.New("未提供支付单号")
	}

	var quotaToAdd int
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

		return nil
	})

	if err != nil {
		common.SysError("waffo topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	if quotaToAdd > 0 {
		RecordTopupLog(topUp.UserId, fmt.Sprintf("Waffo充值成功，充值额度: %v，支付金额: %.2f", logger.FormatQuota(quotaToAdd), topUp.Money), callerIp, topUp.PaymentMethod, PaymentMethodWaffo)
		OnTopupSucceeded(topUp.UserId, quotaToAdd, PaymentMethodWaffo, topUp.TradeNo)
	}

	return nil
}

func RechargeWaffoPancake(tradeNo string, callerIp string) (err error) {
	if tradeNo == "" {
		return errors.New("未提供支付单号")
	}

	var quotaToAdd int
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

		return nil
	})

	if err != nil {
		common.SysError("waffo pancake topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	if quotaToAdd > 0 {
		RecordTopupLog(topUp.UserId, fmt.Sprintf("Waffo Pancake充值成功，充值额度: %v，支付金额: %.2f", logger.FormatQuota(quotaToAdd), topUp.Money), callerIp, topUp.PaymentMethod, PaymentMethodWaffoPancake)
		OnTopupSucceeded(topUp.UserId, quotaToAdd, PaymentMethodWaffoPancake, topUp.TradeNo)
	}

	return nil
}

// OnTopupSucceeded is the single hook called after every successful topup.
// Centralises affiliate commission + Feishu notification so new payment methods
// only need one call here instead of wiring each individually.
func OnTopupSucceeded(userId int, quotaAdded int, paymentMethod string, tradeNo string) {
	ProcessAffCommission(userId, quotaAdded)
	NotifyPaymentSuccess(userId, quotaAdded, paymentMethod)
	SendGAPurchase(userId, quotaAdded, tradeNo)
}

// HasSuccessfulTopUp 该用户是否有过成功充值（用于「首次充值」判定）。
func HasSuccessfulTopUp(userId int) bool {
	var count int64
	DB.Model(&TopUp{}).Where("user_id = ? AND status = ?", userId, common.TopUpStatusSuccess).Limit(1).Count(&count)
	return count > 0
}

// IsFirstTopupPromoEligible 新用户首充优惠资格：开关开 + 折扣合法 + 注册在窗口内 + 还没成功充值过。
// 返回 (是否符合, 优惠窗口到期时间戳秒)。注意：crypto 路径须在本次 TopUp 写入 success 之前调用。
func IsFirstTopupPromoEligible(userId int) (bool, int64) {
	if !common.FirstTopupPromoEnabled {
		return false, 0
	}
	if common.FirstTopupPromoDiscount <= 0 || common.FirstTopupPromoDiscount >= 1 {
		return false, 0
	}
	user, err := GetUserById(userId, false)
	if err != nil || user == nil {
		return false, 0
	}
	expiresAt := user.CreatedAt + int64(common.FirstTopupPromoWindowDays)*86400
	if common.GetTimestamp() > expiresAt {
		return false, expiresAt
	}
	if HasSuccessfulTopUp(userId) {
		return false, expiresAt
	}
	return true, expiresAt
}

// NotifyPaymentSuccess sends a Feishu card to the ops group on successful payment.
// quotaAdded is the quota units credited; USD amount is derived via QuotaPerUnit.
// Runs in a goroutine so it never blocks the caller.
func NotifyPaymentSuccess(userId int, quotaAdded int, paymentMethod string) {
	chatID := common.FeishuOpsChatID()
	if chatID == "" {
		return
	}
	go func() {
		var user User
		if err := DB.Select("email, country, created_at").Where("id = ?", userId).First(&user).Error; err != nil {
			user.Email = fmt.Sprintf("user#%d", userId)
		}
		email := user.Email
		if email == "" {
			email = fmt.Sprintf("user#%d", userId)
		}
		country := user.Country
		if country == "" {
			country = "—"
		}
		registeredAt := "—"
		if user.CreatedAt > 0 {
			loc, err := time.LoadLocation("Asia/Shanghai")
			if err != nil {
				loc = time.FixedZone("CST", 8*3600)
			}
			registeredAt = time.Unix(user.CreatedAt, 0).In(loc).Format("2006-01-02 15:04")
		}
		usdAmount := float64(quotaAdded) / common.QuotaPerUnit
		methodLabel := FormatPaymentMethodLabel(paymentMethod)
		lines := []string{
			fmt.Sprintf("用户：%s", email),
			fmt.Sprintf("金额：$%.2f", usdAmount),
			fmt.Sprintf("国家：%s", country),
			fmt.Sprintf("方式：%s", methodLabel),
			fmt.Sprintf("注册于：%s", registeredAt),
		}
		_ = common.SendFeishuCard(chatID, "💰 付款成功", lines)
	}()
}

// SendGAPurchase reports a GA4 `purchase` conversion via Measurement Protocol so
// the ad → register → topup funnel is complete in GA. The GA client id is read
// from the user's own row (synced at registration time, see naCreateUser);
// for accounts created before that sync existed, it falls back to a live
// lookup against the apimaster user (registration_utm.ga_client_id), keyed by
// the derived username. No-ops if unconfigured or the user has no client id.
// Runs in a goroutine so it never blocks the topup flow. Idempotent per
// tradeNo via ClaimGAPurchase, so the daily backfill script (for cases where
// this live attempt fails, e.g. apimaster PG being briefly unreachable) never
// double-reports a transaction that already made it to GA.
func SendGAPurchase(userId int, quotaAdded int, tradeNo string) {
	apiSecret := os.Getenv("GA_MP_API_SECRET")
	if apiSecret == "" {
		return
	}
	measurementID := os.Getenv("GA_MP_MEASUREMENT_ID")
	if measurementID == "" {
		measurementID = "G-C518KE3E9Y"
	}
	// Use the real order number so GA4 dedups retried webhooks by transaction_id.
	transactionID := tradeNo
	if transactionID == "" {
		transactionID = fmt.Sprintf("u%d-%d", userId, common.GetTimestamp())
	}
	go func() {
		user, err := GetUserById(userId, false)
		if err != nil || user == nil {
			return
		}
		clientID := user.GAClientID
		if clientID == "" {
			if APIMASTER_PG_DB == nil || user.Username == "" {
				common.SysLog(fmt.Sprintf("SendGAPurchase: no ga_client_id for user %d (trade %s)", userId, tradeNo))
				return
			}
			if err := APIMASTER_PG_DB.Raw(
				`SELECT registration_utm->>'ga_client_id' FROM users WHERE LEFT(REPLACE(id::text, '-', ''), 20) = ? LIMIT 1`,
				user.Username,
			).Scan(&clientID).Error; err != nil || clientID == "" {
				common.SysLog(fmt.Sprintf("SendGAPurchase: no ga_client_id for user %d (trade %s): %v", userId, tradeNo, err))
				return
			}
		}
		// Claim right before sending (not earlier): a transient failure above
		// (user lookup, apimaster PG hiccup) must NOT permanently lock this
		// trade out of the daily backfill script's retry.
		if tradeNo != "" && !ClaimGAPurchase(tradeNo) {
			return // already sent (or being sent by the backfill script)
		}
		// If the send itself doesn't demonstrably succeed, undo the claim —
		// otherwise a transient GA/network failure here would permanently
		// hide this trade from the backfill script's retry query too.
		sent := false
		defer func() {
			if !sent && tradeNo != "" {
				ReleaseGAPurchaseClaim(tradeNo)
			}
		}()
		payload := map[string]interface{}{
			"client_id": clientID,
			"events": []map[string]interface{}{{
				"name": "purchase",
				"params": map[string]interface{}{
					"currency":       "USD",
					"value":          float64(quotaAdded) / common.QuotaPerUnit,
					"transaction_id": transactionID,
				},
			}},
		}
		body, err := common.Marshal(payload)
		if err != nil {
			return
		}
		url := fmt.Sprintf("https://www.google-analytics.com/mp/collect?measurement_id=%s&api_secret=%s", measurementID, apiSecret)
		resp, err := http.Post(url, "application/json", bytes.NewReader(body))
		if err != nil {
			common.SysLog("SendGAPurchase: " + err.Error())
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			common.SysLog(fmt.Sprintf("SendGAPurchase: GA MP returned %d for trade %s", resp.StatusCode, tradeNo))
			return
		}
		sent = true
	}()
}

// EnrichTopupsWithUserInfo batch-fills Username and Country on each TopUp
// by joining the users table. One extra query for the whole page — not per row.
func EnrichTopupsWithUserInfo(topups []*TopUp) {
	if len(topups) == 0 {
		return
	}
	ids := make([]int, len(topups))
	for i, t := range topups {
		ids[i] = t.UserId
	}
	type row struct {
		Id       int
		Username string
		Email    string
		Country  string
		Language string
	}
	var rows []row
	if err := DB.Model(&User{}).Select("id, username, email, country, language").Where("id IN ?", ids).Find(&rows).Error; err != nil {
		return
	}
	m := make(map[int]row, len(rows))
	for _, r := range rows {
		m[r.Id] = r
	}
	for _, t := range topups {
		if u, ok := m[t.UserId]; ok {
			t.Username = u.Username
			t.Email = u.Email
			t.Language = u.Language
			// Country comes only from top_ups.country — never users.country (it changes over time).
		}
	}
}
