package model

import (
	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// PayloadLog stores the full request and response bodies of a relay call. Rows
// are only ever written when the platform-wide switch common.PayloadLogEnabled
// is ON; with the switch OFF (default) no payload is captured or persisted, so
// the platform keeps only billing/ops metadata (the Log table).
type PayloadLog struct {
	Id           int    `json:"id"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index"`
	UserId       int    `json:"user_id" gorm:"index"`
	Username     string `json:"username" gorm:"index;default:''"`
	TokenName    string `json:"token_name" gorm:"default:''"`
	ModelName    string `json:"model_name" gorm:"index;default:''"`
	ChannelId    int    `json:"channel_id" gorm:"index;default:0"`
	RequestId    string `json:"request_id" gorm:"type:varchar(64);index;default:''"`
	Ip           string `json:"ip" gorm:"default:''"`
	StatusCode   int    `json:"status_code" gorm:"default:0"`
	DurationMs   int64  `json:"duration_ms" gorm:"default:0"`
	RequestBody  string `json:"request_body,omitempty" gorm:"type:text"`
	ResponseBody string `json:"response_body,omitempty" gorm:"type:text"`
}

func (PayloadLog) TableName() string {
	return "payload_logs"
}

// PayloadLogSwitchAudit records every change of the PayloadLogEnabled switch:
// who flipped it, to what state, and when. It is readable by any authenticated
// user so customers can independently verify the platform's logging behaviour.
type PayloadLogSwitchAudit struct {
	Id        int    `json:"id"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index"`
	UserId    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index;default:''"`
	Enabled   bool   `json:"enabled"`
}

func (PayloadLogSwitchAudit) TableName() string {
	return "payload_log_switch_audits"
}

// payloadLogListColumns excludes the two body columns so the list view stays
// light; full bodies are only loaded on demand via GetPayloadLogById.
const payloadLogListColumns = "id, created_at, user_id, username, token_name, model_name, channel_id, request_id, ip, status_code, duration_ms"

// RecordPayloadLog persists a captured payload. Errors are swallowed with a log
// line: payload logging must never affect the live relay request.
func RecordPayloadLog(log *PayloadLog) {
	if log == nil {
		return
	}
	if err := LOG_DB.Create(log).Error; err != nil {
		common.SysLog("failed to record payload log: " + err.Error())
	}
}

// GetPayloadLogs returns a page of payload logs WITHOUT the request/response
// bodies. A non-zero userId scopes the result to that user (self view); pass 0
// for the admin all-users view.
func GetPayloadLogs(userId int, username, modelName, requestId string, startTimestamp, endTimestamp int64, startIdx, pageSize int) (logs []*PayloadLog, total int64, err error) {
	tx := LOG_DB.Model(&PayloadLog{})
	if userId != 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if requestId != "" {
		tx = tx.Where("request_id = ?", requestId)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = tx.Select(payloadLogListColumns).Order("id desc").Limit(pageSize).Offset(startIdx).Find(&logs).Error
	return logs, total, err
}

// GetPayloadLogById returns a single row with full bodies. A non-zero userId
// enforces ownership (self view); pass 0 to allow any row (admin view).
func GetPayloadLogById(id int, userId int) (*PayloadLog, error) {
	if id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	tx := LOG_DB.Where("id = ?", id)
	if userId != 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	var log PayloadLog
	if err := tx.First(&log).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

// RecordPayloadLogSwitchAudit appends an entry to the switch change history.
func RecordPayloadLogSwitchAudit(userId int, username string, enabled bool) {
	audit := &PayloadLogSwitchAudit{
		CreatedAt: common.GetTimestamp(),
		UserId:    userId,
		Username:  username,
		Enabled:   enabled,
	}
	if err := LOG_DB.Create(audit).Error; err != nil {
		common.SysLog("failed to record payload log switch audit: " + err.Error())
	}
}

// GetPayloadLogSwitchAudits returns the paginated switch change history.
func GetPayloadLogSwitchAudits(startIdx, pageSize int) (audits []*PayloadLogSwitchAudit, total int64, err error) {
	tx := LOG_DB.Model(&PayloadLogSwitchAudit{})
	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = tx.Order("id desc").Limit(pageSize).Offset(startIdx).Find(&audits).Error
	return audits, total, err
}
