package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// forUpdate 在非 SQLite 数据库上添加 FOR UPDATE 行锁
func forUpdate(tx *gorm.DB) *gorm.DB {
	if common.UsingSQLite {
		return tx
	}
	return tx.Set("gorm:query_option", "FOR UPDATE")
}

// Commission 返佣记录
type Commission struct {
	Id               int     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId           int     `json:"user_id" gorm:"type:int;index;not null"`           // 被邀请人（用户A）
	InviterId        int     `json:"inviter_id" gorm:"type:int;index;not null"`         // 邀请人（用户B）
	TopUpId          int     `json:"top_up_id" gorm:"type:int;default:0"`               // 关联充值记录ID，手动发放时为0
	Type             int     `json:"type" gorm:"type:int;not null"`                     // 类型
	Sequence         int     `json:"sequence" gorm:"type:int;default:0"`                // 第几次充值返佣（1/2/3），非充值返佣为0
	Ratio            float64 `json:"ratio" gorm:"type:decimal(10,4);default:0"`         // 返佣比例（百分比）
	TopUpMoney       float64 `json:"top_up_money" gorm:"type:decimal(10,2);default:0"`  // 充值金额（元）
	CommissionAmount int     `json:"commission_amount" gorm:"type:int;not null"`         // 佣金金额（分）
	Remark           string  `json:"remark" gorm:"type:varchar(255);default:''"`        // 备注（手动发放时可填写）
	CreatedAt        int64   `json:"created_at" gorm:"bigint;autoCreateTime"`

	// 非数据库字段，用于展示
	FromUsername string `json:"from_username" gorm:"-"`
}

// 返佣类型
const (
	CommissionTypeTopUp     = 1 // 充值返佣
	CommissionTypeHighValue = 2 // 高价值用户返佣
	CommissionTypeManual    = 3 // 管理员手动发放
)

// CommissionWithdrawal 佣金提现申请
type CommissionWithdrawal struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId      int    `json:"user_id" gorm:"type:int;index;not null"`          // 申请人（用户B）
	Amount      int    `json:"amount" gorm:"type:int;not null"`                 // 提现金额（分）
	Method      string `json:"method" gorm:"type:varchar(32);not null;default:'balance'"` // 提现方式: balance=网站余额, cash=货币
	Account     string `json:"account" gorm:"type:varchar(255);default:''"`     // 提现账号（货币提现时填写）
	Status      string `json:"status" gorm:"type:varchar(32);default:'pending'"` // 状态: pending/approved/rejected
	AdminRemark string `json:"admin_remark" gorm:"type:varchar(255);default:''"` // 管理员备注
	CreatedAt   int64  `json:"created_at" gorm:"bigint;autoCreateTime"`
	ProcessedAt int64  `json:"processed_at" gorm:"type:bigint;default:0"` // 处理时间

	// 非数据库字段，用于展示
	Username    string `json:"username" gorm:"-"`
	DisplayName string `json:"display_name" gorm:"-"`
}

const (
	WithdrawalStatusPending  = "pending"
	WithdrawalStatusApproved = "approved"
	WithdrawalStatusRejected = "rejected"

	WithdrawalMethodBalance = "balance"
	WithdrawalMethodCash    = "cash"
)

// --- Commission CRUD ---

// CreateCommissionWithBalance 在同一事务中创建佣金记录并更新邀请人余额
func CreateCommissionWithBalance(commission *Commission) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(commission).Error; err != nil {
			return err
		}
		return tx.Model(&User{}).Where("id = ?", commission.InviterId).Updates(map[string]interface{}{
			"commission_balance": gorm.Expr("commission_balance + ?", commission.CommissionAmount),
			"commission_total":   gorm.Expr("commission_total + ?", commission.CommissionAmount),
		}).Error
	})
}

// CreateTopUpCommissionIfNotExists 原子地检查并创建充值返佣（防止并发重复发放）
// 返回: created bool, error
func CreateTopUpCommissionIfNotExists(commission *Commission) (bool, error) {
	var created bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		// 在事务中统计已有的充值返佣次数
		var count int64
		if err := tx.Model(&Commission{}).
			Where("user_id = ? AND inviter_id = ? AND type = ?", commission.UserId, commission.InviterId, CommissionTypeTopUp).
			Count(&count).Error; err != nil {
			return err
		}
		if count >= 3 || int(count)+1 != commission.Sequence {
			// 已达上限或序号不匹配（被并发抢占）
			return nil
		}

		if err := tx.Create(commission).Error; err != nil {
			return err
		}
		created = true
		return tx.Model(&User{}).Where("id = ?", commission.InviterId).Updates(map[string]interface{}{
			"commission_balance": gorm.Expr("commission_balance + ?", commission.CommissionAmount),
			"commission_total":   gorm.Expr("commission_total + ?", commission.CommissionAmount),
		}).Error
	})
	return created, err
}

// CreateHighValueCommissionIfNotExists 原子地检查并创建高价值返佣（防止重复发放）
func CreateHighValueCommissionIfNotExists(commission *Commission) (bool, error) {
	var created bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&Commission{}).
			Where("user_id = ? AND inviter_id = ? AND type = ?", commission.UserId, commission.InviterId, CommissionTypeHighValue).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return nil
		}

		if err := tx.Create(commission).Error; err != nil {
			return err
		}
		created = true
		return tx.Model(&User{}).Where("id = ?", commission.InviterId).Updates(map[string]interface{}{
			"commission_balance": gorm.Expr("commission_balance + ?", commission.CommissionAmount),
			"commission_total":   gorm.Expr("commission_total + ?", commission.CommissionAmount),
		}).Error
	})
	return created, err
}

// GetUserCommissions 获取邀请人（用户B）的返佣明细
func GetUserCommissions(inviterId int, page, pageSize int) (commissions []*Commission, total int64, err error) {
	tx := DB.Model(&Commission{}).Where("inviter_id = ?", inviterId)
	err = tx.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&commissions).Error
	if err != nil {
		return nil, 0, err
	}

	// 填充来源用户（被邀请人）的用户名
	if len(commissions) > 0 {
		userIds := make([]int, 0, len(commissions))
		seen := make(map[int]bool)
		for _, c := range commissions {
			if !seen[c.UserId] {
				userIds = append(userIds, c.UserId)
				seen[c.UserId] = true
			}
		}
		var users []User
		DB.Select("id, username").Where("id IN ?", userIds).Find(&users)
		nameMap := make(map[int]string)
		for _, u := range users {
			nameMap[u.Id] = u.Username
		}
		for _, c := range commissions {
			c.FromUsername = nameMap[c.UserId]
		}
	}

	return commissions, total, nil
}

// GetUserCommissionSummary 获取邀请人的返佣概览
type CommissionSummary struct {
	InviteCount         int `json:"invite_count"`          // 邀请人数
	CommissionBalance   int `json:"commission_balance"`    // 可提现佣金余额（分）
	CommissionWithdrawn int `json:"commission_withdrawn"`  // 已提现佣金（分）
	CommissionTotal     int `json:"commission_total"`      // 佣金总额（分）
}

func GetUserCommissionSummary(userId int) (*CommissionSummary, error) {
	var user User
	err := DB.Select("commission_balance, commission_withdrawn, commission_total").Where("id = ?", userId).First(&user).Error
	if err != nil {
		return nil, err
	}

	// 统计邀请人数
	var inviteCount int64
	err = DB.Model(&User{}).Where("inviter_id = ?", userId).Count(&inviteCount).Error
	if err != nil {
		return nil, err
	}

	return &CommissionSummary{
		InviteCount:         int(inviteCount),
		CommissionBalance:   user.CommissionBalance,
		CommissionWithdrawn: user.CommissionWithdrawn,
		CommissionTotal:     user.CommissionTotal,
	}, nil
}

// CountUserCommissionsByType 统计某个被邀请用户的某类返佣已发放次数
func CountUserCommissionsByType(userId int, inviterId int, commissionType int) (int64, error) {
	var count int64
	err := DB.Model(&Commission{}).
		Where("user_id = ? AND inviter_id = ? AND type = ?", userId, inviterId, commissionType).
		Count(&count).Error
	return count, err
}

// HasHighValueCommission 检查是否已发放过高价值返佣
func HasHighValueCommission(userId int, inviterId int) (bool, error) {
	var count int64
	err := DB.Model(&Commission{}).
		Where("user_id = ? AND inviter_id = ? AND type = ?", userId, inviterId, CommissionTypeHighValue).
		Count(&count).Error
	return count > 0, err
}

// --- CommissionWithdrawal CRUD ---

// GetUserWithdrawals 获取用户的提现记录
func GetUserWithdrawals(userId int, page, pageSize int) (withdrawals []*CommissionWithdrawal, total int64, err error) {
	tx := DB.Model(&CommissionWithdrawal{}).Where("user_id = ?", userId)
	err = tx.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&withdrawals).Error
	return withdrawals, total, err
}

// GetAllWithdrawals 管理员获取所有提现申请
func GetAllWithdrawals(status string, page, pageSize int) (withdrawals []*CommissionWithdrawal, total int64, err error) {
	tx := DB.Model(&CommissionWithdrawal{})
	if status != "" {
		tx = tx.Where("status = ?", status)
	}
	err = tx.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&withdrawals).Error
	if err != nil {
		return nil, 0, err
	}

	// 填充用户信息
	if len(withdrawals) > 0 {
		userIds := make([]int, 0, len(withdrawals))
		seen := make(map[int]bool)
		for _, w := range withdrawals {
			if !seen[w.UserId] {
				userIds = append(userIds, w.UserId)
				seen[w.UserId] = true
			}
		}
		var users []User
		DB.Select("id, username, display_name").Where("id IN ?", userIds).Find(&users)
		nameMap := make(map[int]User)
		for _, u := range users {
			nameMap[u.Id] = u
		}
		for _, w := range withdrawals {
			if u, ok := nameMap[w.UserId]; ok {
				w.Username = u.Username
				w.DisplayName = u.DisplayName
			}
		}
	}

	return withdrawals, total, nil
}

// ApproveWithdrawal 审批通过提现申请
func ApproveWithdrawal(withdrawalId int, adminRemark string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var withdrawal CommissionWithdrawal
		if err := forUpdate(tx).First(&withdrawal, withdrawalId).Error; err != nil {
			return errors.New("提现记录不存在")
		}
		if withdrawal.Status != WithdrawalStatusPending {
			return errors.New("提现申请状态不是待审核")
		}

		// 更新提现状态
		withdrawal.Status = WithdrawalStatusApproved
		withdrawal.AdminRemark = adminRemark
		withdrawal.ProcessedAt = time.Now().Unix()
		if err := tx.Save(&withdrawal).Error; err != nil {
			return err
		}

		// 如果提现到余额，增加用户额度
		if withdrawal.Method == WithdrawalMethodBalance {
			// 将佣金（分）转换为系统额度
			// 佣金以分存储，1元=100分
			// 系统额度：QuotaPerUnit 对应 $1
			// 这里直接用元数 * QuotaPerUnit
			moneyInYuan := float64(withdrawal.Amount) / 100.0
			quotaToAdd := int(moneyInYuan * common.QuotaPerUnit)
			if err := tx.Model(&User{}).Where("id = ?", withdrawal.UserId).
				Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
				return err
			}
			quotaInUSD := float64(quotaToAdd) / common.QuotaPerUnit
			RecordLog(withdrawal.UserId, LogTypeSystem, fmt.Sprintf("佣金提现到余额，提现金额: %.2f 元，增加额度: $%.2f", moneyInYuan, quotaInUSD))
		}

		// 更新用户已提现金额
		if err := tx.Model(&User{}).Where("id = ?", withdrawal.UserId).
			Update("commission_withdrawn", gorm.Expr("commission_withdrawn + ?", withdrawal.Amount)).Error; err != nil {
			return err
		}

		return nil
	})
}

// RejectWithdrawal 拒绝提现申请
func RejectWithdrawal(withdrawalId int, adminRemark string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var withdrawal CommissionWithdrawal
		if err := forUpdate(tx).First(&withdrawal, withdrawalId).Error; err != nil {
			return errors.New("提现记录不存在")
		}
		if withdrawal.Status != WithdrawalStatusPending {
			return errors.New("提现申请状态不是待审核")
		}

		// 退还佣金余额
		if err := tx.Model(&User{}).Where("id = ?", withdrawal.UserId).
			Update("commission_balance", gorm.Expr("commission_balance + ?", withdrawal.Amount)).Error; err != nil {
			return err
		}

		// 更新提现状态
		withdrawal.Status = WithdrawalStatusRejected
		withdrawal.AdminRemark = adminRemark
		withdrawal.ProcessedAt = time.Now().Unix()
		if err := tx.Save(&withdrawal).Error; err != nil {
			return err
		}

		moneyInYuan := float64(withdrawal.Amount) / 100.0
		RecordLog(withdrawal.UserId, LogTypeSystem, fmt.Sprintf("佣金提现被拒绝，退还 %.2f 元至佣金余额，管理员备注: %s", moneyInYuan, adminRemark))
		return nil
	})
}

// RequestWithdrawal 用户申请提现
func RequestWithdrawal(userId int, amount int, method string, account string) error {
	if amount < common.CommissionMinWithdraw*100 {
		return fmt.Errorf("最低提现金额为 %d 元", common.CommissionMinWithdraw)
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		// 加锁查询用户佣金余额
		var user User
		if err := forUpdate(tx).Select("id, commission_balance").First(&user, userId).Error; err != nil {
			return errors.New("用户不存在")
		}

		if user.CommissionBalance < amount {
			return errors.New("佣金余额不足")
		}

		// 扣减佣金余额
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("commission_balance", gorm.Expr("commission_balance - ?", amount)).Error; err != nil {
			return err
		}

		// 创建提现申请
		withdrawal := &CommissionWithdrawal{
			UserId:  userId,
			Amount:  amount,
			Method:  method,
			Account: account,
			Status:  WithdrawalStatusPending,
		}
		return tx.Create(withdrawal).Error
	})
}
