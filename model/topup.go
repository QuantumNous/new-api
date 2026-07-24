package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
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
	IncludeTax      bool    `json:"include_tax" gorm:"default:false"`
	TaxRate         float64 `json:"tax_rate" gorm:"default:0"`
	TaxAmount       float64 `json:"tax_amount" gorm:"default:0"`
	PreTaxMoney     float64 `json:"pre_tax_money" gorm:"default:0"`
	InvoiceStatus      string  `json:"invoice_status" gorm:"type:varchar(20);default:'none'"` // none, pending, issued, rejected
	InvoiceAdminRemark string  `json:"invoice_admin_remark" gorm:"type:varchar(500);default:''"`
	Gift               int64   `json:"gift" gorm:"default:0"`
	ExpectedGift       int64   `json:"expected_gift" gorm:"default:0"` // 下单时锁定赠送额度，避免支付时配置变更导致不一致
	Username           string  `json:"username" gorm:"-"`
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

// OnTopUpSuccessHook 充值成功回调，由 service 层注册
// 参数: userId, topUpId, topUpMoney（元）
var OnTopUpSuccessHook func(userId int, topUpId int, topUpMoney float64)

// grantTopupGiftTx 在充值成功事务内发放充值赠送额度（进免费钱包）。
// 读下单时锁定的 ExpectedGift（不实时重算），refId 为 topUp.Id。
// 有赠送则写一条带过期时间的免费明细并累加 user.free_quota；返回实际赠送额度。
// ExpectedGift=0 则不产生明细，不影响本金入账。
// 幂等保护：若 gift 字段已 > 0 说明已发放过，直接返回已发值。
func grantTopupGiftTx(tx *gorm.DB, userId int, refId int) (gift int, err error) {
	// 读下单时锁定的 ExpectedGift，不实时重算——避免支付回调时 gift_rules 配置变更导致 TOCTOU。
	db := DB
	if tx != nil {
		db = tx
	}
	// 幂等保护：检查是否已发放过赠送
	var existingGift int64
	if err := db.Model(&TopUp{}).Where("id = ?", refId).Select("gift").Scan(&existingGift).Error; err != nil {
		return 0, err
	}
	if existingGift > 0 {
		return int(existingGift), nil
	}
	var expectedGift int64
	if err := db.Model(&TopUp{}).Where("id = ?", refId).Select("expected_gift").Scan(&expectedGift).Error; err != nil {
		return 0, err
	}
	gift = int(expectedGift)
	if gift <= 0 {
		return 0, nil
	}
	var expiredTime int64
	if validDays := operation_setting.GetTopupGiftValidDays(); validDays > 0 {
		expiredTime = common.GetTimestamp() + int64(validDays)*86400
	}
	if err := AddFreeQuota(tx, userId, gift, FreeQuotaSourceTopupGift, refId, expiredTime); err != nil {
		return 0, err
	}
	// 回写赠送额度到充值记录
	if tx != nil {
		if err := tx.Model(&TopUp{}).Where("id = ?", refId).Update("gift", gift).Error; err != nil {
			return 0, err
		}
	}
	return gift, nil
}

// GrantTopupGift 非事务版充值赠送发放（供无事务包裹的回调路径调用，如易支付 controller）。
// 直接读下单时锁定的 ExpectedGift，不实时重算。
func GrantTopupGift(userId int, refId int) (gift int, err error) {
	gift, err = grantTopupGiftTx(nil, userId, refId)
	if err != nil || gift <= 0 {
		return gift, err
	}
	// grantTopupGiftTx 用 nil tx 时不会回写 gift，此处用独立连接回写
	if err := DB.Model(&TopUp{}).Where("id = ?", refId).Update("gift", gift).Error; err != nil {
		return 0, err
	}
	return gift, nil
}

var (
	ErrPaymentMethodMismatch = errors.New("payment method mismatch")
	ErrTopUpNotFound         = errors.New("topup not found")
	ErrTopUpStatusInvalid    = errors.New("topup status invalid")
)

func (topUp *TopUp) Insert() error {
	// 下单时锁定预期赠送额度，避免支付回调时配置变更导致不一致（TOCTOU）。
	// Creem 的 Amount 存的是 quota 而非美元，其余 provider 存的是美元数量。
	var principalQuota int
	if topUp.PaymentProvider == PaymentProviderCreem {
		principalQuota = int(topUp.Amount)
	} else {
		dAmount := decimal.NewFromInt(topUp.Amount)
		dQPU := decimal.NewFromFloat(common.QuotaPerUnit)
		principalQuota = int(dAmount.Mul(dQPU).IntPart())
	}
	topUp.ExpectedGift = int64(operation_setting.CalcTopupGift(principalQuota))

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
	var giftQuota int
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
		if err = tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("stripe_customer", customerId).Error; err != nil {
			return err
		}
		if err = AddRechargeQuota(tx, topUp.UserId, int(quota)); err != nil {
			return err
		}

		// 双钱包拆分：充值赠送额度进免费钱包
		g, err := grantTopupGiftTx(tx, topUp.UserId, topUp.Id)
		if err != nil {
			return err
		}
		giftQuota = g

		return nil
	})

	if err != nil {
		common.SysError("topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	logMsg := fmt.Sprintf("使用在线充值成功，充值金额: %v，支付金额：%d", logger.FormatQuota(int(quota)), topUp.Amount)
	if giftQuota > 0 {
		logMsg += fmt.Sprintf("，赠送金额: %v", logger.FormatQuota(giftQuota))
	}
	RecordTopupLog(topUp.UserId, logMsg, callerIp, topUp.PaymentMethod, PaymentMethodStripe)

	if OnTopUpSuccessHook != nil {
		go OnTopUpSuccessHook(topUp.UserId, topUp.Id, topUp.Money)
	}

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

	fillTopUpUsernames(topups)
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
	fillTopUpUsernames(topups)
	return topups, total, nil
}

// fillTopUpUsernames 批量填充 TopUp 的 Username 字段
func fillTopUpUsernames(topups []*TopUp) {
	if len(topups) == 0 {
		return
	}
	userIds := make([]int, 0, len(topups))
	seen := make(map[int]bool)
	for _, t := range topups {
		if !seen[t.UserId] {
			userIds = append(userIds, t.UserId)
			seen[t.UserId] = true
		}
	}
	var users []struct {
		Id       int    `gorm:"column:id"`
		Username string `gorm:"column:username"`
	}
	DB.Table("users").Select("id, username").Where("id IN ?", userIds).Find(&users)
	nameMap := make(map[int]string)
	for _, u := range users {
		nameMap[u.Id] = u.Username
	}
	for _, t := range topups {
		t.Username = nameMap[t.UserId]
	}
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
	var topUpId int
	var quotaToAdd int
	var payMoney float64
	var paymentMethod string
	var giftAmount int

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
		if err := AddRechargeQuota(tx, topUp.UserId, quotaToAdd); err != nil {
			return err
		}

		// 双钱包拆分：充值赠送额度进免费钱包
		g, err := grantTopupGiftTx(tx, topUp.UserId, topUp.Id)
		if err != nil {
			return err
		}
		giftAmount = g

		userId = topUp.UserId
		topUpId = topUp.Id
		payMoney = topUp.Money
		paymentMethod = topUp.PaymentMethod
		return nil
	})

	if err != nil {
		return err
	}

	// 事务外记录日志，避免阻塞
	logMsg := fmt.Sprintf("管理员补单成功，充值金额: %v，支付金额：%f", logger.FormatQuota(quotaToAdd), payMoney)
	if giftAmount > 0 {
		logMsg += fmt.Sprintf("，赠送金额: %v", logger.FormatQuota(giftAmount))
	}
	RecordTopupLog(userId, logMsg, callerIp, paymentMethod, "admin")

	if OnTopUpSuccessHook != nil && topUpId > 0 {
		go OnTopUpSuccessHook(userId, topUpId, payMoney)
	}

	return nil
}
// CompleteEpayTopUp 在单事务内完成易支付订单：更新状态、加充值额度、发赠送。
// 返回字段供 controller 记日志。已成功的订单幂等返回 nil。
func CompleteEpayTopUp(tradeNo string) (userId int, quotaToAdd int, giftAmount int, payMoney float64, paymentMethod string, err error) {
	if tradeNo == "" {
		return 0, 0, 0, 0, "", errors.New("未提供订单号")
	}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		topUp := &TopUp{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return errors.New("充值订单不存在")
		}
		if topUp.Status == common.TopUpStatusSuccess {
			// 幂等：已成功的订单返回已有数据
			userId = topUp.UserId
			payMoney = topUp.Money
			paymentMethod = topUp.PaymentMethod
			giftAmount = int(topUp.Gift)
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return errors.New("订单状态不是待支付")
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

		if err := AddRechargeQuota(tx, topUp.UserId, quotaToAdd); err != nil {
			return err
		}

		g, err := grantTopupGiftTx(tx, topUp.UserId, topUp.Id)
		if err != nil {
			return err
		}
		giftAmount = g

		userId = topUp.UserId
		payMoney = topUp.Money
		paymentMethod = topUp.PaymentMethod
		return nil
	})
	return
}

func RechargeCreem(referenceId string, customerEmail string, customerName string, callerIp string) (err error) {
	if referenceId == "" {
		return errors.New("未提供支付单号")
	}

	var quota int64
	var giftQuota int
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
		updateFields := map[string]interface{}{}

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

		if len(updateFields) > 0 {
			err = tx.Model(&User{}).Where("id = ?", topUp.UserId).Updates(updateFields).Error
			if err != nil {
				return err
			}
		}

		err = AddRechargeQuota(tx, topUp.UserId, int(quota))
		if err != nil {
			return err
		}

		// 双钱包拆分：充值赠送额度进免费钱包
		g, err := grantTopupGiftTx(tx, topUp.UserId, topUp.Id)
		if err != nil {
			return err
		}
		giftQuota = g

		return nil
	})

	if err != nil {
		common.SysError("creem topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	logMsg := fmt.Sprintf("使用Creem充值成功，充值额度: %v，支付金额：%.2f", quota, topUp.Money)
	if giftQuota > 0 {
		logMsg += fmt.Sprintf("，赠送金额: %v", logger.FormatQuota(giftQuota))
	}
	RecordTopupLog(topUp.UserId, logMsg, callerIp, topUp.PaymentMethod, PaymentMethodCreem)

	if OnTopUpSuccessHook != nil {
		go OnTopUpSuccessHook(topUp.UserId, topUp.Id, topUp.Money)
	}

	return nil
}

func RechargeWaffo(tradeNo string, callerIp string) (err error) {
	if tradeNo == "" {
		return errors.New("未提供支付单号")
	}

	var quotaToAdd int
	var giftQuota int
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

		if err := AddRechargeQuota(tx, topUp.UserId, quotaToAdd); err != nil {
			return err
		}

		// 双钱包拆分：充值赠送额度进免费钱包
		g, err := grantTopupGiftTx(tx, topUp.UserId, topUp.Id)
		if err != nil {
			return err
		}
		giftQuota = g

		return nil
	})

	if err != nil {
		common.SysError("waffo topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	if quotaToAdd > 0 {
		logMsg := fmt.Sprintf("Waffo充值成功，充值额度: %v，支付金额: %.2f", logger.FormatQuota(quotaToAdd), topUp.Money)
		if giftQuota > 0 {
			logMsg += fmt.Sprintf("，赠送金额: %v", logger.FormatQuota(giftQuota))
		}
		RecordTopupLog(topUp.UserId, logMsg, callerIp, topUp.PaymentMethod, PaymentMethodWaffo)
	}

	if OnTopUpSuccessHook != nil {
		go OnTopUpSuccessHook(topUp.UserId, topUp.Id, topUp.Money)
	}

	return nil
}

func RechargeWaffoPancake(tradeNo string) (err error) {
	if tradeNo == "" {
		return errors.New("未提供支付单号")
	}

	var quotaToAdd int
	var giftQuota int
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

		if err := AddRechargeQuota(tx, topUp.UserId, quotaToAdd); err != nil {
			return err
		}

		// 双钱包拆分：充值赠送额度进免费钱包
		g, err := grantTopupGiftTx(tx, topUp.UserId, topUp.Id)
		if err != nil {
			return err
		}
		giftQuota = g

		return nil
	})

	if err != nil {
		common.SysError("waffo pancake topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	if quotaToAdd > 0 {
		logMsg := fmt.Sprintf("Waffo Pancake充值成功，充值额度: %v，支付金额: %.2f", logger.FormatQuota(quotaToAdd), topUp.Money)
		if giftQuota > 0 {
			logMsg += fmt.Sprintf("，赠送金额: %v", logger.FormatQuota(giftQuota))
		}
		RecordLog(topUp.UserId, LogTypeTopup, logMsg)
	}

	if OnTopUpSuccessHook != nil {
		go OnTopUpSuccessHook(topUp.UserId, topUp.Id, topUp.Money)
	}

	return nil
}

// GetUserRecentTopUpMoney 获取用户最近N天的成功充值总金额
func GetUserRecentTopUpMoney(userId int, days int) (float64, error) {
	var totalMoney float64
	since := time.Now().AddDate(0, 0, -days).Unix()
	err := DB.Model(&TopUp{}).
		Where("user_id = ? AND status = ? AND create_time >= ?", userId, common.TopUpStatusSuccess, since).
		Select("COALESCE(SUM(money), 0)").
		Scan(&totalMoney).Error
	return totalMoney, err
}
