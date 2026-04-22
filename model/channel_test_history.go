package model

import (
	"time"

	"github.com/bytedance/gopkg/util/gopool"
)

// ChannelTestHistory records per-model test results for availability tracking
type ChannelTestHistory struct {
	Id           int       `json:"id" gorm:"primaryKey;autoIncrement"`
	ChannelId    int       `json:"channel_id" gorm:"index"`
	ChannelName  string    `json:"channel_name"`
	TestModel    string    `json:"test_model"`
	Status       string    `json:"status"`        // operational, failed, timeout, unsupported
	ResponseTime int64     `json:"response_time"` // ms
	ErrorMessage string    `json:"error_message" gorm:"type:text"`
	TestedAt     time.Time `json:"tested_at" gorm:"index"`
}

func RecordChannelTestHistory(channelId int, channelName, testModel, status string, responseTime int64, errMsg string) {
	gopool.Go(func() {
		history := ChannelTestHistory{
			ChannelId:    channelId,
			ChannelName:  channelName,
			TestModel:    testModel,
			Status:       status,
			ResponseTime: responseTime,
			ErrorMessage: errMsg,
			TestedAt:     time.Now(),
		}
		DB.Create(&history)
	})
}

func PruneChannelTestHistory(retentionDays int) int64 {
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	result := DB.Where("tested_at < ?", cutoff).Delete(&ChannelTestHistory{})
	return result.RowsAffected
}
