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

// 对公转账充值（docs/enterprise-features-design.md §二）。
// 金额一律以「分」存整数（D1）；回执图片独立表 + AES-256-GCM 加密（D2）；
// 审批入账复用 ManualCompleteTopUp 的行锁 + 幂等模式，并在同一事务内写 topups 流水。

const (
	BankTransferStatusPending  = 1
	BankTransferStatusApproved = 2
	BankTransferStatusRejected = 3

	// BankTransferMaxAmountFen 单笔金额业务上限（分）= ¥100 亿，与前端 10 位整数限制
	// 对齐。该上限下折算 quota 最大约 6.9e14，距 int64 上限仍有 4 个数量级，
	// 杜绝直连 API 提交天文数字导致 decimal.IntPart() 溢出产生垃圾额度。
	BankTransferMaxAmountFen = int64(1_000_000_000_000)
)

var (
	ErrBankTransferNotFound       = errors.New("转账订单不存在")
	ErrBankTransferNotPending     = errors.New("订单已处理，请刷新后查看")
	ErrBankTransferHasPending     = errors.New("已有待审核的转账订单，请等待审核完成")
	ErrBankTransferInvalidAmount  = errors.New("无效的到账金额")
	ErrBankTransferAmountTooLarge = errors.New("金额超出允许范围")
)

type BankTransferOrder struct {
	Id           int            `json:"id"            gorm:"primaryKey;autoIncrement"`
	UserId       int            `json:"user_id"       gorm:"index;not null"`
	AmountFen    int64          `json:"amount_fen"    gorm:"not null"`  // 用户申报转账金额（分）
	CreditedFen  int64          `json:"credited_fen"  gorm:"default:0"` // 管理员确认的实际到账金额（分）
	QuotaGranted int64          `json:"quota_granted" gorm:"default:0"` // 实际入账 quota，审批时按固定汇率折算回填
	Remark       string         `json:"remark"        gorm:"type:varchar(255)"`
	Status       int            `json:"status"        gorm:"type:int;not null;default:1;index"`
	ReviewRemark string         `json:"review_remark,omitempty" gorm:"type:varchar(255)"` // 管理员入账备注（如 BD/合同/折扣约定）
	RejectReason string         `json:"reject_reason,omitempty" gorm:"type:varchar(255)"`
	ReviewedBy   int            `json:"reviewed_by,omitempty"   gorm:"type:int"`
	TradeNo      string         `json:"trade_no"      gorm:"type:varchar(64);uniqueIndex"`
	SubmittedAt  *time.Time     `json:"submitted_at"`
	ReviewedAt   *time.Time     `json:"reviewed_at,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
}

// BankTransferReceipt 转账回执图片，1:1 挂在订单上。独立表使列表查询永不触碰
// 大字段；图片列省略 type 标签走方言默认映射（MySQL longtext），同企业认证图片表。
type BankTransferReceipt struct {
	Id         int    `gorm:"primaryKey;autoIncrement"`
	OrderId    int    `gorm:"uniqueIndex;not null"`
	UserId     int    `gorm:"index;not null"`
	ReceiptEnc string `gorm:"not null"` // 回执图片（AES-256-GCM 加密 base64）
	CreatedAt  time.Time
	UpdatedAt  time.Time
	DeletedAt  gorm.DeletedAt `gorm:"index"`
}

// CreateBankTransferOrderWithReceipt 创建订单 + 回执（事务）。
// 同一用户最多 1 笔待审核订单，防刷单。
func CreateBankTransferOrderWithReceipt(userId int, amountFen int64, remark string, receiptEnc string) (*BankTransferOrder, error) {
	if amountFen <= 0 || amountFen > BankTransferMaxAmountFen {
		return nil, ErrBankTransferAmountTooLarge
	}
	now := time.Now()
	order := &BankTransferOrder{
		UserId:      userId,
		AmountFen:   amountFen,
		Remark:      remark,
		Status:      BankTransferStatusPending,
		TradeNo:     fmt.Sprintf("BT%s%d", common.GetRandomString(6), now.Unix()),
		SubmittedAt: &now,
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var pendingCount int64
		if err := tx.Model(&BankTransferOrder{}).
			Where("user_id = ? AND status = ?", userId, BankTransferStatusPending).
			Count(&pendingCount).Error; err != nil {
			return err
		}
		if pendingCount > 0 {
			return ErrBankTransferHasPending
		}
		if err := tx.Create(order).Error; err != nil {
			return err
		}
		return tx.Create(&BankTransferReceipt{
			OrderId:    order.Id,
			UserId:     userId,
			ReceiptEnc: receiptEnc,
		}).Error
	})
	if err != nil {
		return nil, err
	}
	return order, nil
}

func GetBankTransferOrderById(id int) (*BankTransferOrder, error) {
	var order BankTransferOrder
	if err := DB.First(&order, id).Error; err != nil {
		return nil, err
	}
	return &order, nil
}

func GetUserBankTransferOrders(userId int, pageInfo *common.PageInfo) (orders []*BankTransferOrder, total int64, err error) {
	query := DB.Model(&BankTransferOrder{}).Where("user_id = ?", userId)
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&orders).Error
	if err != nil {
		return nil, 0, err
	}
	return orders, total, nil
}

// CancelBankTransferOrder 用户撤销自己的待审核订单：软删订单、硬删回执。
// 软删带 status=pending 条件做抢占（同审批路径），避免"管理员已入账、
// 用户并发撤销把订单删掉"的不一致：审批先赢则这里 RowsAffected=0 直接报错。
func CancelBankTransferOrder(userId int, id int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var order BankTransferOrder
		if err := tx.Where("id = ? AND user_id = ?", id, userId).First(&order).Error; err != nil {
			return ErrBankTransferNotFound
		}
		res := tx.Where("id = ? AND user_id = ? AND status = ?", id, userId, BankTransferStatusPending).
			Delete(&BankTransferOrder{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrBankTransferNotPending
		}
		return tx.Unscoped().Where("order_id = ?", id).Delete(&BankTransferReceipt{}).Error
	})
}

func GetBankTransferReceipt(orderId int) (*BankTransferReceipt, error) {
	var receipt BankTransferReceipt
	if err := DB.Where("order_id = ?", orderId).First(&receipt).Error; err != nil {
		return nil, err
	}
	return &receipt, nil
}

// BankTransferQuotaForFen 按固定汇率参数把到账金额（分）折算为 quota（D3）。
// 全程 decimal 整数运算，仅最终结果取整。
func BankTransferQuotaForFen(creditedFen int64) (int, error) {
	rate := operation_setting.USDExchangeRate
	if rate <= 0 {
		return 0, errors.New("系统汇率参数无效")
	}
	quota := decimal.NewFromInt(creditedFen).
		Div(decimal.NewFromInt(100)).
		Div(decimal.NewFromFloat(rate)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		IntPart()
	if quota <= 0 {
		return 0, ErrBankTransferInvalidAmount
	}
	return int(quota), nil
}

// ApproveBankTransferOrder 审批通过：条件更新抢占订单 → 写 topups 成功流水 →
// 给用户加 quota，全部在同一事务内。
// creditedFen 为管理员确认的实际到账金额（分），controller 缺省时传申报金额。
//
// 并发安全说明：不使用 FOR UPDATE（GORM v2 已忽略 v1 的 gorm:query_option 机制，
// 且裸 FOR UPDATE 不兼容 SQLite）。改用条件更新抢占：
// UPDATE ... WHERE id=? AND status=pending，数据库保证同一行的并发 UPDATE 串行执行，
// 只有一个事务能命中 WHERE（RowsAffected=1）并继续入账，其余返回"已处理"——
// 原子、幂等、三库兼容（CLAUDE.md Rule 2）。
func ApproveBankTransferOrder(id int, reviewerId int, creditedFen int64, reviewRemark string, callerIp string) error {
	if creditedFen <= 0 {
		return ErrBankTransferInvalidAmount
	}
	if creditedFen > BankTransferMaxAmountFen {
		return ErrBankTransferAmountTooLarge
	}
	quotaToAdd, err := BankTransferQuotaForFen(creditedFen)
	if err != nil {
		return err
	}

	var userId int
	var amountFen int64
	err = DB.Transaction(func(tx *gorm.DB) error {
		order := &BankTransferOrder{}
		// 仅读取不可变字段（UserId/TradeNo）与存在性；状态判定交给下面的条件更新
		if err := tx.Where("id = ?", id).First(order).Error; err != nil {
			return ErrBankTransferNotFound
		}

		now := time.Now()
		res := tx.Model(&BankTransferOrder{}).
			Where("id = ? AND status = ?", id, BankTransferStatusPending).
			Updates(map[string]interface{}{
				"status":        BankTransferStatusApproved,
				"credited_fen":  creditedFen,
				"review_remark": reviewRemark,
				"quota_granted": int64(quotaToAdd),
				"reviewed_by":   reviewerId,
				"reviewed_at":   now,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			// 已被并发的审批/拒绝/撤销处理
			return ErrBankTransferNotPending
		}

		// 写统一充值流水，使对公转账出现在充值历史里
		timestamp := common.GetTimestamp()
		// Amount 存 quota 单位（与支付宝/微信直连流水一致，账单弹窗 renderQuota 直接渲染）；
		// Money 存用户原始转账金额（支付金额），到账修正额体现在 Amount/quota_granted。
		topUp := &TopUp{
			UserId:          order.UserId,
			Amount:          int64(quotaToAdd),
			Money:           common.FenToYuan(order.AmountFen),
			TradeNo:         order.TradeNo,
			PaymentMethod:   PaymentMethodBankTransfer,
			PaymentProvider: PaymentProviderBankTransfer,
			CreateTime:      timestamp,
			CompleteTime:    timestamp,
			Status:          common.TopUpStatusSuccess,
		}
		if err := tx.Create(topUp).Error; err != nil {
			return err
		}

		if err := tx.Model(&User{}).Where("id = ?", order.UserId).
			Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
			return err
		}

		userId = order.UserId
		amountFen = order.AmountFen
		return nil
	})
	if err != nil {
		return err
	}

	// 事务外记录日志与缓存失效
	// 格式对齐支付宝/微信直连：FormatQuotaShort 按额度展示类型 2 位小数（无浮点噪音）；支付金额=用户原始转账金额
	RecordTopupLog(userId, fmt.Sprintf("对公转账充值成功，充值额度: %v，支付金额: %.2f（审核人 ID: %d）",
		logger.FormatQuotaShort(quotaToAdd), common.FenToYuan(amountFen), reviewerId), callerIp, PaymentMethodBankTransfer, PaymentProviderBankTransfer)
	_ = InvalidateUserCache(userId)
	return nil
}

// RejectBankTransferOrder 审批拒绝，原因必填（controller 校验）。
// 并发安全同 ApproveBankTransferOrder：条件更新抢占，不依赖行锁。
func RejectBankTransferOrder(id int, reviewerId int, reason string) error {
	var exists int64
	if err := DB.Model(&BankTransferOrder{}).Where("id = ?", id).Count(&exists).Error; err != nil {
		return err
	}
	if exists == 0 {
		return ErrBankTransferNotFound
	}
	now := time.Now()
	res := DB.Model(&BankTransferOrder{}).
		Where("id = ? AND status = ?", id, BankTransferStatusPending).
		Updates(map[string]interface{}{
			"status":        BankTransferStatusRejected,
			"reject_reason": reason,
			"reviewed_by":   reviewerId,
			"reviewed_at":   now,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrBankTransferNotPending
	}
	return nil
}

// BankTransferAdminRow 管理员列表 JOIN 结果：订单 + 用户名 + 审核人用户名。
type BankTransferAdminRow struct {
	BankTransferOrder
	Username     string `gorm:"column:username"`
	ReviewerName string `gorm:"column:reviewer_name"`
}

// GetBankTransferList 管理员分页列表。status=0 表示全部；keyword 按用户名/单号模糊。
// JOIN 仅用全小写非保留字标识符，无需方言引号（CLAUDE.md Rule 2）。
func GetBankTransferList(status int, keyword string, page, pageSize int) ([]*BankTransferAdminRow, int64, error) {
	var rows []*BankTransferAdminRow
	var total int64

	buildQuery := func() *gorm.DB {
		q := DB.Model(&BankTransferOrder{}).
			Joins("LEFT JOIN users u1 ON u1.id = bank_transfer_orders.user_id")
		if status != 0 {
			q = q.Where("bank_transfer_orders.status = ?", status)
		}
		if keyword != "" {
			like := "%" + keyword + "%"
			q = q.Where("u1.username LIKE ? OR bank_transfer_orders.trade_no LIKE ?", like, like)
		}
		return q
	}

	if err := buildQuery().Count(&total).Error; err != nil {
		return nil, 0, err
	}

	query := buildQuery().
		Select("bank_transfer_orders.*, u1.username AS username, u2.username AS reviewer_name").
		Joins("LEFT JOIN users u2 ON u2.id = bank_transfer_orders.reviewed_by")

	offset := (page - 1) * pageSize
	if err := query.Order("bank_transfer_orders.id DESC").Offset(offset).Limit(pageSize).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// SumUserApprovedBankTransferFen 某用户已审批通过的对公转账「转账金额」总额（分）。
// 发票可开票额度的数据来源（D5）。注意按 amount_fen（用户实付）而非 credited_fen（入账额度）累加：
// 折扣/合同场景入账额度可能高于实付，但增值税发票只能按实付金额开具。
func SumUserApprovedBankTransferFen(userId int) (int64, error) {
	var total int64
	err := DB.Model(&BankTransferOrder{}).
		Where("user_id = ? AND status = ?", userId, BankTransferStatusApproved).
		Select("COALESCE(SUM(amount_fen), 0)").Scan(&total).Error
	return total, err
}

// CountPendingBankTransfer 待审核对公转账订单数（status=待审核）。
func CountPendingBankTransfer() (int64, error) {
	var n int64
	err := DB.Model(&BankTransferOrder{}).
		Where("status = ?", BankTransferStatusPending).Count(&n).Error
	return n, err
}
