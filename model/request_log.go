package model

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var (
	requestLogQueue chan *RequestLog
	requestLogOnce  sync.Once
)

func initRequestLogWorker() {
	requestLogQueue = make(chan *RequestLog, 2000)
	for i := 0; i < 2; i++ {
		go func() {
			for entry := range requestLogQueue {
				if LOG_DB == nil {
					continue
				}
				if err := LOG_DB.Create(entry).Error; err != nil {
					common.SysError("failed to record request log: " + err.Error())
				}
			}
		}()
	}
}

type RequestLog struct {
	Id              int    `json:"id" gorm:"primaryKey;autoIncrement"`
	RequestId       string `json:"request_id" gorm:"type:varchar(64);index;default:''"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint;index"`
	UserId          int    `json:"user_id" gorm:"index;default:0"`
	Username        string `json:"username" gorm:"type:varchar(64);default:''"`
	TokenId         int    `json:"token_id" gorm:"index;default:0"`
	TokenName       string `json:"token_name" gorm:"type:varchar(64);default:''"`
	Group           string `json:"group" gorm:"type:varchar(64);index;default:''"`
	ModelName       string `json:"model_name" gorm:"type:varchar(128);index;default:''"`
	ChannelId       int    `json:"channel_id" gorm:"index;default:0"`
	ChannelName     string `json:"channel_name" gorm:"type:varchar(64);default:''"`
	ChannelType     int    `json:"channel_type" gorm:"default:0"`
	Endpoint        string `json:"endpoint" gorm:"type:varchar(128);default:''"`
	Method          string `json:"method" gorm:"type:varchar(8);default:''"`
	StatusCode      int    `json:"status_code" gorm:"default:0"`
	DurationMs      int64  `json:"duration_ms" gorm:"default:0"`
	IsStream        bool   `json:"is_stream" gorm:"default:false"`
	RequestBody     string `json:"request_body" gorm:"type:text"`     // full prompt/messages (capped)
	ResponseSummary string `json:"response_summary" gorm:"type:text"` // capped head: media URLs / truncated text
}

func RecordRequestLog(log *RequestLog) {
	if log.CreatedAt == 0 {
		log.CreatedAt = common.GetTimestamp()
	}
	requestLogOnce.Do(initRequestLogWorker)
	select {
	case requestLogQueue <- log:
	default:
		common.SysError("request log queue full, dropping entry") // backpressure: drop, never block the request
	}
}
