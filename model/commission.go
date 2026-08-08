package model

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

// Commission constants
const (
	CommissionStatusPending  = "pending"
	CommissionStatusSettled  = "settled"
	CommissionStatusAdjusted = "adjusted"

	WithdrawalStatusPending  = "pending"
	WithdrawalStatusApproved = "approved"
	WithdrawalStatusRejected = "rejected"
)

// CommissionTier represents a commission rate tier configuration
type CommissionTier struct {
	MinUsers int     `json:"min_users"`
	Rate     float64 `json:"rate"`
}

// CommissionRecord stores each commission earning
type CommissionRecord struct {
	Id         int     `json:"id"`
	UserId     int     `json:"user_id" gorm:"index;not null"`
	FromUserId int     `json:"from_user_id" gorm:"index;not null"`
	TopUpId    int     `json:"topup_id"`
	Amount     float64 `json:"amount"`
	Money      float64 `json:"money"`      // the recharge amount that generated this commission
	Rate       float64 `json:"rate"`       // commission rate applied
	Status     string  `json:"status" gorm:"type:varchar(20);default:'pending'"`
	Remark     string  `json:"remark" gorm:"type:varchar(255)"`
	CreatedAt  int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  int64   `json:"updated_at" gorm:"autoUpdateTime"`
}

// CommissionErrorLog records failed commission processing attempts for retry/investigation
type CommissionErrorLog struct {
	Id        int     `json:"id"`
	TopUpId   int     `json:"topup_id" gorm:"index"`
	UserId    int     `json:"user_id" gorm:"index"`
	Money     float64 `json:"money"`
	Error     string  `json:"error" gorm:"type:text"`
	CreatedAt int64   `json:"created_at" gorm:"autoCreateTime"`
}

// CommissionWallet stores user's commission balance
type CommissionWallet struct {
	Id             int     `json:"id"`
	UserId         int     `json:"user_id" gorm:"uniqueIndex;not null"`
	Balance        float64 `json:"balance" gorm:"default:0"`
	TotalEarned    float64 `json:"total_earned" gorm:"default:0"`
	TotalWithdrawn float64 `json:"total_withdrawn" gorm:"default:0"`
	CreatedAt      int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      int64   `json:"updated_at" gorm:"autoUpdateTime"`
}

// WithdrawalRequest stores user's withdrawal requests
type WithdrawalRequest struct {
	Id          int     `json:"id"`
	UserId      int     `json:"user_id" gorm:"index;not null"`
	Amount      float64 `json:"amount"`
	PayInfo     string  `json:"pay_info" gorm:"type:text"`
	Status      string  `json:"status" gorm:"type:varchar(20);default:'pending'"`
	ReviewedBy  *int    `json:"reviewed_by"`
	ReviewNote  string  `json:"review_note" gorm:"type:varchar(255)"`
	CreatedAt   int64   `json:"created_at" gorm:"autoCreateTime"`
	ReviewedAt  *int64  `json:"reviewed_at"`
}

// ============================================================================
// Commission Tier configuration (stored as JSON via Options system)
// ============================================================================

const CommissionConfigKey = "commission_config"
const DefaultCommissionRate = 0.05

type CommissionConfig struct {
	DefaultRate       float64          `json:"default_rate"`
	Tiers             []CommissionTier `json:"tiers"`
	MinConsumption    float64          `json:"min_consumption"`    // minimum total topup money to count as active affiliate
	MinWithdrawAmount float64          `json:"min_withdraw_amount"` // minimum amount for withdrawal (0 = no limit)
}

func GetDefaultCommissionConfig() *CommissionConfig {
	return &CommissionConfig{
		DefaultRate: DefaultCommissionRate,
		Tiers: []CommissionTier{
			{MinUsers: 0, Rate: 0.05},
			{MinUsers: 5, Rate: 0.08},
			{MinUsers: 20, Rate: 0.12},
			{MinUsers: 50, Rate: 0.15},
			{MinUsers: 100, Rate: 0.20},
		},
		MinConsumption:    10,
		MinWithdrawAmount: 0,
	}
}

// GetUserActiveAffCount returns the number of active referrals who have recharged at least minConsumption in total.
func GetUserActiveAffCount(userId int, minConsumption float64) (int, error) {
	// Try Redis cache first
	if common.RedisEnabled {
		cacheKey := fmt.Sprintf("commission:active_aff:%d", userId)
		if cached, err := common.RDB.Get(context.Background(), cacheKey).Result(); err == nil {
			if count, err := strconv.Atoi(cached); err == nil {
				return count, nil
			}
		}
	}

	var count int64
	subQuery := DB.Table("top_ups").
		Select("top_ups.user_id").
		Joins("JOIN users ON users.id = top_ups.user_id AND users.inviter_id = ?", userId).
		Where("top_ups.status = ?", common.TopUpStatusSuccess).
		Group("top_ups.user_id").
		Having("SUM(top_ups.money) >= ?", minConsumption)

	err := DB.Table("(?) AS active_users", subQuery).Count(&count).Error
	if err != nil {
		return 0, err
	}

	result := int(count)

	// Cache for 5 minutes
	if common.RedisEnabled {
		common.RDB.Set(context.Background(), fmt.Sprintf("commission:active_aff:%d", userId), result, 5*time.Minute)
	}

	return result, nil
}

// InvalidateActiveAffCache removes cached active_aff_count for a user.
func InvalidateActiveAffCache(userId int) {
	if common.RedisEnabled && userId > 0 {
		common.RDB.Del(context.Background(), fmt.Sprintf("commission:active_aff:%d", userId))
	}
}

// loadCommissionConfig returns the effective commission config.
func loadCommissionConfig() *CommissionConfig {
	config := GetDefaultCommissionConfig()
	if v, ok := common.OptionMap[CommissionConfigKey]; ok && v != "" {
		parsed := &CommissionConfig{}
		if err := common.UnmarshalJsonStr(v, parsed); err == nil {
			config = parsed
		}
	}
	return config
}

// GetCommissionRate determines the commission rate for a user based on active referrals
func GetUserCommissionRate(userId int) (float64, int, error) {
	config := loadCommissionConfig()
	activeCount, err := GetUserActiveAffCount(userId, config.MinConsumption)
	if err != nil {
		return config.DefaultRate, 0, err
	}

	bestRate := config.DefaultRate
	for _, tier := range config.Tiers {
		if activeCount >= tier.MinUsers {
			bestRate = tier.Rate
		}
	}
	return bestRate, activeCount, nil
}

// GetNextTierInfo finds the next tier threshold
func GetNextTierInfo(userId int) (currentRate float64, activeCount int, nextMinUsers int, nextRate float64, err error) {
	config := loadCommissionConfig()
	activeCount, err = GetUserActiveAffCount(userId, config.MinConsumption)
	if err != nil {
		return 0, 0, 0, 0, err
	}

	bestRate := config.DefaultRate
	nextMin := 0
	nextRt := 0.0
	for _, tier := range config.Tiers {
		if activeCount >= tier.MinUsers {
			bestRate = tier.Rate
		}
		if activeCount < tier.MinUsers && (nextMin == 0 || tier.MinUsers < nextMin) {
			nextMin = tier.MinUsers
			nextRt = tier.Rate
		}
	}

	return bestRate, activeCount, nextMin, nextRt, nil
}

// ============================================================================
// Commission Wallet
// ============================================================================

func GetCommissionWallet(userId int) (*CommissionWallet, error) {
	var wallet CommissionWallet
	err := DB.Where("user_id = ?", userId).First(&wallet).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			wallet = CommissionWallet{
				UserId:  userId,
				Balance: 0,
			}
			if err := DB.Create(&wallet).Error; err != nil {
				return nil, err
			}
			return &wallet, nil
		}
		return nil, err
	}
	return &wallet, nil
}

func EnsureCommissionWallet(userId int) error {
	_, err := GetCommissionWallet(userId)
	return err
}

// ============================================================================
// Commission Records
// ============================================================================

func CreateCommissionRecord(record *CommissionRecord) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		// Lock and update wallet to prevent lost updates under concurrent commissions
		var wallet CommissionWallet
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where("user_id = ?", record.UserId).First(&wallet).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				wallet = CommissionWallet{
					UserId:      record.UserId,
					Balance:     record.Amount,
					TotalEarned: record.Amount,
				}
				return tx.Create(&wallet).Error
			}
			return err
		}
		return tx.Model(&wallet).Updates(map[string]interface{}{
			"balance":      gorm.Expr("balance + ?", record.Amount),
			"total_earned": gorm.Expr("total_earned + ?", record.Amount),
		}).Error
	})
}

func GetUserCommissionRecords(userId int, page, pageSize int, status string) ([]CommissionRecord, int64, error) {
	var records []CommissionRecord
	var total int64
	query := DB.Model(&CommissionRecord{}).Where("user_id = ?", userId)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

func GetAllCommissionRecords(page, pageSize int, userId int, status string) ([]CommissionRecord, int64, error) {
	var records []CommissionRecord
	var total int64
	query := DB.Model(&CommissionRecord{})
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

// GetUserCommissionStats returns monthly and total commission stats
func GetUserCommissionStats(userId int) (monthlyEarned float64, totalEarned float64, err error) {
	wallet, err := GetCommissionWallet(userId)
	if err != nil {
		return 0, 0, err
	}

	// Monthly earned
	monthStart := time.Now().Unix() - int64(time.Now().Day())*86400
	err = DB.Model(&CommissionRecord{}).
		Where("user_id = ? AND created_at >= ?", userId, monthStart).
		Select("COALESCE(SUM(amount), 0)").Scan(&monthlyEarned).Error
	if err != nil {
		return 0, 0, err
	}

	return monthlyEarned, wallet.TotalEarned, nil
}

// ============================================================================
// Commission on Recharge
// ============================================================================

// ProcessCommissionForTopUp creates commission records when a recharge completes
func ProcessCommissionForTopUp(topUpUserId int, topUpId int, money float64) error {
	// Prevent duplicate commission for the same topup
	if topUpId > 0 {
		var exists int64
		if err := DB.Model(&CommissionRecord{}).Where("topup_id = ?", topUpId).Count(&exists).Error; err == nil && exists > 0 {
			return nil
		}
	}

	// Convert Epay1 (CNY) to USD for unified commission base
	if topUpId > 0 {
		var topUp TopUp
		if err := DB.Select("payment_provider, payment_method").First(&topUp, topUpId).Error; err == nil {
			if topUp.PaymentProvider == PaymentProviderEpay && !strings.HasPrefix(topUp.PaymentMethod, "g2:") {
				exchangeRate := 7.3
				if rateStr, ok := common.OptionMap["CommissionUSDExchangeRate"]; ok && rateStr != "" {
					if rate, err := strconv.ParseFloat(rateStr, 64); err == nil && rate > 0 {
						exchangeRate = rate
					}
				}
				money = money / exchangeRate
			}
		}
	}

	// Find the user
	var user User
	if err := DB.First(&user, topUpUserId).Error; err != nil {
		logCommissionError(topUpId, topUpUserId, money, "user not found: "+err.Error())
		return nil
	}

	// If user has no inviter, no commission
	if user.InviterId == 0 {
		return nil
	}

	inviterId := user.InviterId

	// Get inviter's commission rate
	rate, _, err := GetUserCommissionRate(inviterId)
	if err != nil {
		logCommissionError(topUpId, topUpUserId, money, "failed to get commission rate: "+err.Error())
		return nil
	}

	if rate <= 0 {
		return nil
	}

	// Calculate commission
	commissionAmount := money * rate
	// Round to 2 decimal places
	commissionAmount = math.Round(commissionAmount*100) / 100

	if commissionAmount <= 0 {
		return nil
	}

	record := &CommissionRecord{
		UserId:     inviterId,
		FromUserId: topUpUserId,
		TopUpId:    topUpId,
		Amount:     commissionAmount,
		Money:      money,
		Rate:       rate,
		Status:     CommissionStatusSettled,
	}

	if err := CreateCommissionRecord(record); err != nil {
		logCommissionError(topUpId, topUpUserId, money, "create record failed: "+err.Error())
		return err
	}

	// Invalidate cached active_aff_count for the inviter
	InvalidateActiveAffCache(inviterId)

	return nil
}

func logCommissionError(topUpId int, userId int, money float64, errMsg string) {
	common.SysError(fmt.Sprintf("commission failed: topup_id=%d user_id=%d money=%.2f error=%s", topUpId, userId, money, errMsg))
	entry := &CommissionErrorLog{
		TopUpId: topUpId,
		UserId:  userId,
		Money:   money,
		Error:   errMsg,
	}
	if err := DB.Create(entry).Error; err != nil {
		common.SysError("failed to persist commission error log: " + err.Error())
	}
}

// ============================================================================
// Withdrawal Requests
// ============================================================================

func CreateWithdrawalRequest(userId int, amount float64, payInfo string) error {
	if amount <= 0 {
		return errors.New("提现金额必须大于0")
	}

	// Check minimum withdrawal amount
	config := loadCommissionConfig()
	if config.MinWithdrawAmount > 0 && amount < config.MinWithdrawAmount {
		return fmt.Errorf("提现金额不能低于 %.2f", config.MinWithdrawAmount)
	}

	// Check wallet balance
	wallet, err := GetCommissionWallet(userId)
	if err != nil {
		return errors.New("获取佣金钱包失败")
	}
	if wallet.Balance < amount {
		return errors.New("佣金钱包余额不足")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		// Lock and check balance
		var lockedWallet CommissionWallet
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("user_id = ?", userId).First(&lockedWallet).Error; err != nil {
			return errors.New("获取佣金钱包失败")
		}
		if lockedWallet.Balance < amount {
			return errors.New("佣金钱包余额不足")
		}

		// Deduct balance
		result := tx.Model(&lockedWallet).Update("balance", gorm.Expr("balance - ?", amount))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("提现失败：余额更新未生效")
		}

		// Create withdrawal request
		req := &WithdrawalRequest{
			UserId: userId,
			Amount: amount,
			PayInfo: payInfo,
			Status: WithdrawalStatusPending,
		}
		return tx.Create(req).Error
	})
}

func GetUserWithdrawals(userId int, page, pageSize int) ([]WithdrawalRequest, int64, error) {
	var withdrawals []WithdrawalRequest
	var total int64
	query := DB.Model(&WithdrawalRequest{}).Where("user_id = ?", userId)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&withdrawals).Error; err != nil {
		return nil, 0, err
	}
	return withdrawals, total, nil
}

func GetAllWithdrawals(page, pageSize int, status string) ([]WithdrawalRequest, int64, error) {
	var withdrawals []WithdrawalRequest
	var total int64
	query := DB.Model(&WithdrawalRequest{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&withdrawals).Error; err != nil {
		return nil, 0, err
	}
	return withdrawals, total, nil
}

func ApproveWithdrawal(id int, adminId int) error {
	now := time.Now().Unix()
	return DB.Transaction(func(tx *gorm.DB) error {
		var req WithdrawalRequest
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&req, id).Error; err != nil {
			return errors.New("提现申请不存在")
		}
		if req.Status != WithdrawalStatusPending {
			return errors.New("提现申请已处理")
		}

		if err := tx.Model(&req).Updates(map[string]interface{}{
			"status":      WithdrawalStatusApproved,
			"reviewed_by": adminId,
			"reviewed_at": now,
		}).Error; err != nil {
			return err
		}

		// Update wallet total_withdrawn
		return tx.Model(&CommissionWallet{}).
			Where("user_id = ?", req.UserId).
			Update("total_withdrawn", gorm.Expr("total_withdrawn + ?", req.Amount)).Error
	})
}

func RejectWithdrawal(id int, adminId int, note string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var req WithdrawalRequest
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&req, id).Error; err != nil {
			return errors.New("提现申请不存在")
		}
		if req.Status != WithdrawalStatusPending {
			return errors.New("提现申请已处理")
		}

		now := time.Now().Unix()
		if err := tx.Model(&req).Updates(map[string]interface{}{
			"status":      WithdrawalStatusRejected,
			"reviewed_by": adminId,
			"review_note": note,
			"reviewed_at": now,
		}).Error; err != nil {
			return err
		}

		// Refund the balance
		if err := tx.Model(&CommissionWallet{}).
			Where("user_id = ?", req.UserId).
			Update("balance", gorm.Expr("balance + ?", req.Amount)).Error; err != nil {
			return err
		}

		// Create a refund record for audit trail
		refundRecord := &CommissionRecord{
			UserId:  req.UserId,
			Amount:  req.Amount,
			Status:  CommissionStatusAdjusted,
			Remark:  fmt.Sprintf("提现拒绝退款 (withdrawal_id=%d review_note=%s)", id, note),
		}
		return tx.Create(refundRecord).Error
	})
}

// ============================================================================
// Admin: Transfer commission balance to main balance
// ============================================================================

func TransferCommissionToBalance(userId int, amount float64) error {
	if amount <= 0 {
		return errors.New("划转金额必须大于0")
	}

	wallet, err := GetCommissionWallet(userId)
	if err != nil {
		return errors.New("获取佣金钱包失败")
	}
	if wallet.Balance < amount {
		return errors.New("佣金钱包余额不足")
	}

	// Convert money to quota
	quota := int(math.Round(amount * common.QuotaPerUnit))
	if quota <= 0 {
		return errors.New("划转金额过低")
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		// Lock wallet
		var lockedWallet CommissionWallet
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("user_id = ?", userId).First(&lockedWallet).Error; err != nil {
			return errors.New("获取佣金钱包失败")
		}
		if lockedWallet.Balance < amount {
			return errors.New("佣金钱包余额不足")
		}

		// Deduct from commission wallet
		result := tx.Model(&lockedWallet).Update("balance", gorm.Expr("balance - ?", amount))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("划转失败：佣金余额更新未生效")
		}

		// Add to main quota
		result = tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", quota))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("划转失败：用户余额更新未生效")
		}

		return nil
	})
	if err != nil {
		return err
	}

	// Record usage log (outside transaction, consistent with topup pattern)
	RecordLog(userId, LogTypeSystem, fmt.Sprintf("佣金划转：%.2f 元 → 余额 %s", amount, logger.LogQuota(quota)))

	return nil
}

// ============================================================================
// Admin: Manual adjustment
// ============================================================================

func AdjustCommission(userId int, amount float64, remark string) error {
	if amount == 0 {
		return errors.New("调整金额不能为0")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var wallet CommissionWallet
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where("user_id = ?", userId).First(&wallet).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				wallet = CommissionWallet{UserId: userId}
				if err := tx.Create(&wallet).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		}

		updates := map[string]interface{}{
			"balance": gorm.Expr("balance + ?", amount),
		}
		if amount > 0 {
			updates["total_earned"] = gorm.Expr("total_earned + ?", amount)
		}
		if err := tx.Model(&wallet).Updates(updates).Error; err != nil {
			return err
		}

		record := &CommissionRecord{
			UserId: userId,
			Amount: amount,
			Status: CommissionStatusAdjusted,
			Remark: remark,
		}
		return tx.Create(record).Error
	})
}

// ============================================================================
// Admin: Get promoter list
// ============================================================================

type PromoterItem struct {
	Id             int     `json:"id"`
	Username       string  `json:"username"`
	Email          string  `json:"email"`
	WalletBalance  float64 `json:"wallet_balance"`
	TotalEarned    float64 `json:"total_earned"`
	TotalWithdrawn float64 `json:"total_withdrawn"`
	ActiveAffCount int     `json:"active_aff_count"`
	CommissionRate float64 `json:"commission_rate"`
	CreatedAt      int64   `json:"created_at"`
}

func GetPromoterList(page, pageSize int, keyword string) ([]PromoterItem, int64, error) {
	var items []PromoterItem
	var total int64

	config := loadCommissionConfig()

	query := DB.Table("commission_wallets").
		Select(`commission_wallets.user_id as id, users.username, users.email,
				commission_wallets.balance as wallet_balance,
				commission_wallets.total_earned,
				commission_wallets.total_withdrawn,
				COALESCE(active_counts.cnt, 0) as active_aff_count,
				users.created_at`).
		Joins("LEFT JOIN users ON users.id = commission_wallets.user_id").
		Joins(`LEFT JOIN (
			SELECT users.inviter_id, COUNT(DISTINCT top_ups.user_id) as cnt
			FROM users
			JOIN top_ups ON top_ups.user_id = users.id AND top_ups.status = ?
			WHERE users.inviter_id > 0
			GROUP BY users.inviter_id
			HAVING SUM(top_ups.money) >= ?
		) active_counts ON active_counts.inviter_id = commission_wallets.user_id`, common.TopUpStatusSuccess, config.MinConsumption)

	if keyword != "" {
		query = query.Where("users.username LIKE ? OR users.email LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("commission_wallets.total_earned DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Scan(&items).Error; err != nil {
		return nil, 0, err
	}

	for i := range items {
		rate := config.DefaultRate
		for _, tier := range config.Tiers {
			if items[i].ActiveAffCount >= tier.MinUsers {
				rate = tier.Rate
			}
		}
		items[i].CommissionRate = rate
	}

	return items, total, nil
}

// ============================================================================
// Admin: Dashboard stats
// ============================================================================

type CommissionDashboardStats struct {
	TotalCommission         float64  `json:"total_commission"`
	TotalCommissionPaid     float64  `json:"total_commission_paid"`
	ActivePromoters         int64    `json:"active_promoters"`
	TotalPromoters          int64    `json:"total_promoters"`
	PendingWithdrawals      int64    `json:"pending_withdrawals"`
	PendingWithdrawalAmount float64  `json:"pending_withdrawal_amount"`
}

type TierDistItem struct {
	Tier string `json:"tier"`
	Rate float64 `json:"rate"`
	Count int64 `json:"count"`
}

type TopPromoterItem struct {
	UserId       int     `json:"user_id"`
	Username     string  `json:"username"`
	TotalEarned  float64 `json:"total_earned"`
	ActiveCount  int     `json:"active_count"`
}

func GetCommissionDashboardStats() (*CommissionDashboardStats, error) {
	stats := &CommissionDashboardStats{}

	// Total commission earned (sum of all earned commissions)
	DB.Model(&CommissionWallet{}).Select("COALESCE(SUM(total_earned), 0)").Scan(&stats.TotalCommission)

	// Total commission paid out (sum of all withdrawn amounts)
	DB.Model(&CommissionWallet{}).Select("COALESCE(SUM(total_withdrawn), 0)").Scan(&stats.TotalCommissionPaid)

	// Count wallets with total_earned > 0 as active
	DB.Model(&CommissionWallet{}).Where("total_earned > 0").Count(&stats.ActivePromoters)

	// Count wallets with total_earned > 0 OR balance > 0 as total
	DB.Model(&CommissionWallet{}).Where("total_earned > 0 OR balance > 0").Count(&stats.TotalPromoters)

	// Pending withdrawal requests count
	DB.Model(&WithdrawalRequest{}).Where("status = ?", WithdrawalStatusPending).Count(&stats.PendingWithdrawals)

	// Pending withdrawal requests total amount
	DB.Model(&WithdrawalRequest{}).Select("COALESCE(SUM(amount), 0)").Where("status = ?", WithdrawalStatusPending).Scan(&stats.PendingWithdrawalAmount)

	return stats, nil
}

// GetDownlineUsers returns the referral list for a user
type DownlineUser struct {
	Id          int     `json:"id"`
	Username    string  `json:"username"`
	TotalTopUp  float64 `json:"total_topup"`
	CreatedAt   int64   `json:"created_at"`
	LastTopUpAt int64   `json:"last_topup_at"`
}

func GetUserDownline(userId int, page, pageSize int) ([]DownlineUser, int64, error) {
	var downlines []DownlineUser
	var total int64

	// Count
	if err := DB.Model(&User{}).Where("inviter_id = ?", userId).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get dynamic commission exchange rate
	commissionRate := 7.3
	if rateStr, ok := common.OptionMap["CommissionUSDExchangeRate"]; ok && rateStr != "" {
		if rate, err := strconv.ParseFloat(rateStr, 64); err == nil && rate > 0 {
			commissionRate = rate
		}
	}

	// Query with pagination
	selectExpr := fmt.Sprintf(`users.id, users.username, users.created_at,
				COALESCE(SUM(CASE WHEN top_ups.payment_provider = 'epay' AND top_ups.payment_method NOT LIKE 'g2:%%' THEN top_ups.money / %f ELSE top_ups.money END), 0) as total_topup,
				COALESCE(MAX(top_ups.complete_time), 0) as last_topup_at`, commissionRate)
	rows, err := DB.Table("users").
		Select(selectExpr).
		Joins("LEFT JOIN top_ups ON top_ups.user_id = users.id AND top_ups.status = ?", common.TopUpStatusSuccess).
		Where("users.inviter_id = ?", userId).
		Group("users.id").
		Order("users.id DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Rows()
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var d DownlineUser
		if err := rows.Scan(&d.Id, &d.Username, &d.CreatedAt, &d.TotalTopUp, &d.LastTopUpAt); err != nil {
			return nil, 0, err
		}
		downlines = append(downlines, d)
	}

	return downlines, total, nil
}
