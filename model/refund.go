package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type Refund struct {
	Id              int     `json:"id"`
	TopUpId         int     `json:"topup_id" gorm:"index"`
	UserId          int     `json:"user_id" gorm:"index"`
	RefundRequestId string  `json:"refund_request_id" gorm:"unique;type:varchar(255);index"`
	RefundAmount    float64 `json:"refund_amount"`
	QuotaDeduction  int64   `json:"quota_deduction"`
	Reason          string  `json:"reason" gorm:"type:varchar(500)"`
	Status          string  `json:"status" gorm:"type:varchar(50)"`
	OperatorId      int     `json:"operator_id"`
	CreateTime      int64   `json:"create_time"`
	CompleteTime    int64   `json:"complete_time"`
}

func InsertRefund(refund *Refund) error {
	return DB.Create(refund).Error
}

func GetRefundByRequestId(refundRequestId string) *Refund {
	var refund Refund
	err := DB.Where("refund_request_id = ?", refundRequestId).First(&refund).Error
	if err != nil {
		return nil
	}
	return &refund
}

func DeleteRefundByRequestId(refundRequestId string) error {
	return DB.Where("refund_request_id = ?", refundRequestId).Delete(&Refund{}).Error
}

func GetRefundsByTopUpId(topUpId int) ([]*Refund, error) {
	var refunds []*Refund
	err := DB.Where("top_up_id = ?", topUpId).Order("id desc").Find(&refunds).Error
	if err != nil {
		return nil, err
	}
	return refunds, nil
}

func GetTotalRefundedByTopUpId(topUpId int) (float64, error) {
	var total float64
	err := DB.Model(&Refund{}).
		Where("top_up_id = ? AND status = ?", topUpId, common.RefundStatusSuccess).
		Select("COALESCE(SUM(refund_amount), 0)").
		Scan(&total).Error
	if err != nil {
		return 0, err
	}
	return total, nil
}

// GetPendingRefundAmountByTopUpId 返回该订单所有 pending 退款的金额之和（防止重复退款超额）
func GetPendingRefundAmountByTopUpId(topUpId int) (float64, error) {
	var total float64
	err := DB.Model(&Refund{}).
		Where("top_up_id = ? AND status = ?", topUpId, common.RefundStatusPending).
		Select("COALESCE(SUM(refund_amount), 0)").
		Scan(&total).Error
	if err != nil {
		return 0, err
	}
	return total, nil
}

func CompleteRefund(refundRequestId string) error {
	refundRequestIdCol := "`refund_request_id`"
	if common.UsingPostgreSQL {
		refundRequestIdCol = `"refund_request_id"`
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		refund := &Refund{}
		// 行级锁，防止并发
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where(refundRequestIdCol+" = ?", refundRequestId).
			First(refund).Error; err != nil {
			return errors.New("退款记录不存在")
		}

		// 幂等：已终态直接返回
		if refund.Status == common.RefundStatusSuccess || refund.Status == common.RefundStatusFailed {
			return nil
		}

		// 更新退款记录为成功
		if err := tx.Model(refund).Updates(map[string]interface{}{
			"status":        common.RefundStatusSuccess,
			"complete_time": common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}

		// 扣减用户 quota，不产生负数。
		// MySQL/PostgreSQL 使用标准标量函数 GREATEST()；SQLite 使用其特有的多参数 MAX()。
		noNegExpr := "MAX(quota - ?, 0)"
		if common.UsingPostgreSQL || common.UsingMySQL {
			noNegExpr = "GREATEST(quota - ?, 0)"
		}
		if err := tx.Model(&User{}).
			Where("id = ?", refund.UserId).
			Update("quota", gorm.Expr(noNegExpr, refund.QuotaDeduction)).
			Error; err != nil {
			return err
		}

		// 重新计算 TopUp 状态
		topUp := &TopUp{}
		if err := tx.Where("id = ?", refund.TopUpId).First(topUp).Error; err != nil {
			return errors.New("充值订单不存在")
		}

		var totalRefunded float64
		if err := tx.Model(&Refund{}).
			Where("top_up_id = ? AND status = ?", refund.TopUpId, common.RefundStatusSuccess).
			Select("COALESCE(SUM(refund_amount), 0)").
			Scan(&totalRefunded).Error; err != nil {
			return err
		}

		// 如果还有其他 pending 退款，状态保持 refunding，否则按已退总额决定
		var pendingCount int64
		tx.Model(&Refund{}).
			Where("top_up_id = ? AND status = ?", refund.TopUpId, common.RefundStatusPending).
			Count(&pendingCount)

		var newTopUpStatus string
		if pendingCount > 0 {
			newTopUpStatus = common.TopUpStatusRefunding
		} else if totalRefunded >= topUp.Money {
			newTopUpStatus = common.TopUpStatusRefunded
		} else {
			newTopUpStatus = common.TopUpStatusPartialRefunded
		}

		if err := tx.Model(topUp).Update("status", newTopUpStatus).Error; err != nil {
			return err
		}

		return nil
	})
}

func FailRefund(refundRequestId string) error {
	refundRequestIdCol := "`refund_request_id`"
	if common.UsingPostgreSQL {
		refundRequestIdCol = `"refund_request_id"`
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		// Step 1: 先查到 refund 记录（FOR UPDATE 防并发）
		refund := &Refund{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where(refundRequestIdCol+" = ?", refundRequestId).
			First(refund).Error; err != nil {
			return nil // 记录不存在，无需处理
		}

		// 幂等：已终态直接返回
		if refund.Status == common.RefundStatusSuccess || refund.Status == common.RefundStatusFailed {
			return nil
		}

		// Step 2: 更新退款状态为 failed
		if err := tx.Model(refund).Updates(map[string]interface{}{
			"status":        common.RefundStatusFailed,
			"complete_time": common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}

		// Step 3: 找到对应的 TopUp，回滚状态
		topUp := &TopUp{}
		if err := tx.Where("id = ?", refund.TopUpId).First(topUp).Error; err != nil {
			return nil
		}

		// 检查是否还有其他 pending 退款
		var pendingCount int64
		tx.Model(&Refund{}).
			Where("top_up_id = ? AND status = ?", refund.TopUpId, common.RefundStatusPending).
			Count(&pendingCount)

		var newTopUpStatus string
		if pendingCount > 0 {
			newTopUpStatus = common.TopUpStatusRefunding
		} else {
			var totalRefunded float64
			tx.Model(&Refund{}).
				Where("top_up_id = ? AND status = ?", refund.TopUpId, common.RefundStatusSuccess).
				Select("COALESCE(SUM(refund_amount), 0)").
				Scan(&totalRefunded)

			if totalRefunded >= topUp.Money {
				newTopUpStatus = common.TopUpStatusRefunded
			} else if totalRefunded > 0 {
				newTopUpStatus = common.TopUpStatusPartialRefunded
			} else {
				newTopUpStatus = common.TopUpStatusSuccess
			}
		}

		return tx.Model(topUp).Update("status", newTopUpStatus).Error
	})
}
