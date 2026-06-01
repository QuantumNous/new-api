package model

import (
	"time"

	"gorm.io/gorm"
)

type AlipayPendingTask struct {
	Id          int    `json:"id"`
	TradeNo     string `json:"trade_no" gorm:"uniqueIndex;type:varchar(255);index"`
	NextQueryAt int64  `json:"next_query_at" gorm:"index"`
	RetryCount  int    `json:"retry_count"`
	LastQueryAt int64  `json:"last_query_at"`
	LastError   string `json:"last_error" gorm:"type:text"`
	CreateTime  int64  `json:"create_time"`
	UpdateTime  int64  `json:"update_time"`
}

func CreateAlipayTopUpWithPendingTask(topUp *TopUp, nextQueryAt int64) error {
	if topUp == nil {
		return gorm.ErrInvalidData
	}
	now := time.Now().Unix()
	if topUp.CreateTime == 0 {
		topUp.CreateTime = now
	}
	if nextQueryAt <= 0 {
		nextQueryAt = now
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(topUp).Error; err != nil {
			return err
		}
		task := &AlipayPendingTask{
			TradeNo:     topUp.TradeNo,
			NextQueryAt: nextQueryAt,
			CreateTime:  now,
			UpdateTime:  now,
		}
		return tx.Create(task).Error
	})
}

func GetDueAlipayPendingTasks(nextQueryAt int64, limit int) ([]*AlipayPendingTask, error) {
	if limit <= 0 {
		limit = 100
	}
	var tasks []*AlipayPendingTask
	err := DB.Where("next_query_at <= ?", nextQueryAt).
		Order("id asc").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

func DeleteAlipayPendingTask(tradeNo string) error {
	if tradeNo == "" {
		return nil
	}
	return DB.Where("trade_no = ?", tradeNo).Delete(&AlipayPendingTask{}).Error
}

func UpdateAlipayPendingTaskRetry(tradeNo string, nextQueryAt int64, lastError string) error {
	if tradeNo == "" {
		return nil
	}
	now := time.Now().Unix()
	return DB.Model(&AlipayPendingTask{}).
		Where("trade_no = ?", tradeNo).
		Updates(map[string]any{
			"next_query_at": nextQueryAt,
			"last_query_at": now,
			"last_error":    lastError,
			"update_time":   now,
			"retry_count":   gorm.Expr("retry_count + ?", 1),
		}).Error
}
