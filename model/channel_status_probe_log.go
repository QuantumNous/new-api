package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// ChannelStatusProbeLog 状态检测页的轻量探测日志
//
// 用于按分组聚合状态、7 天可用率与近 60 次色条。写入时机为渠道测试
// (controller.testChannel) 每次完成之后，禁止携带任何密钥或敏感信息。
type ChannelStatusProbeLog struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	ChannelId int    `json:"channel_id" gorm:"index:idx_channel_status_probe_channel_time,priority:1;index"`
	Success   bool   `json:"success"`
	Level     string `json:"level" gorm:"type:varchar(16)"` // ok | degraded | fail
	LatencyMs int    `json:"latency_ms"`
	PingMs    int    `json:"ping_ms"`
	Message   string `json:"message" gorm:"type:varchar(255)"`
	CheckedAt int64  `json:"checked_at" gorm:"bigint;index:idx_channel_status_probe_channel_time,priority:2;index"`
}

const (
	ChannelStatusProbeLevelOK       = "ok"
	ChannelStatusProbeLevelDegraded = "degraded"
	ChannelStatusProbeLevelFail     = "fail"

	// ChannelStatusProbeMaxPerChannel 单个渠道保留的最大条数
	ChannelStatusProbeMaxPerChannel = 120
	// ChannelStatusProbeRetentionDays 全部渠道的日志保留天数
	ChannelStatusProbeRetentionDays = 7
	// ChannelStatusProbeMessageMaxLen message 字段最大长度
	ChannelStatusProbeMessageMaxLen = 255
)

func (ChannelStatusProbeLog) TableName() string {
	return "channel_status_probe_logs"
}

// truncateProbeMessage 保留 message 的前 N 个 rune，防止字段超长或潜在敏感信息过长
func truncateProbeMessage(msg string) string {
	if msg == "" {
		return ""
	}
	if len(msg) <= ChannelStatusProbeMessageMaxLen {
		return msg
	}
	runes := []rune(msg)
	if len(runes) <= ChannelStatusProbeMessageMaxLen {
		return msg
	}
	return string(runes[:ChannelStatusProbeMessageMaxLen])
}

// AppendChannelStatusProbeLog 追加一条探测日志，并按 channel 维度裁剪历史
//
// 该操作对渠道测试主流程非关键，任何错误只写日志、不返回。
func AppendChannelStatusProbeLog(channelId int, success bool, level string, latencyMs int, pingMs int, message string) {
	if channelId <= 0 {
		return
	}
	switch level {
	case ChannelStatusProbeLevelOK, ChannelStatusProbeLevelDegraded, ChannelStatusProbeLevelFail:
	default:
		if success {
			level = ChannelStatusProbeLevelOK
		} else {
			level = ChannelStatusProbeLevelFail
		}
	}
	if latencyMs < 0 {
		latencyMs = 0
	}
	if pingMs < 0 {
		pingMs = 0
	}
	entry := ChannelStatusProbeLog{
		ChannelId: channelId,
		Success:   success,
		Level:     level,
		LatencyMs: latencyMs,
		PingMs:    pingMs,
		Message:   truncateProbeMessage(message),
		CheckedAt: time.Now().Unix(),
	}
	if err := DB.Create(&entry).Error; err != nil {
		common.SysError("failed to append channel status probe log: " + err.Error())
		return
	}
	trimChannelStatusProbeLogs(channelId)
}

// trimChannelStatusProbeLogs 保留 channel 的最近 ChannelStatusProbeMaxPerChannel 条
func trimChannelStatusProbeLogs(channelId int) {
	var cutoff ChannelStatusProbeLog
	err := DB.Where("channel_id = ?", channelId).
		Order("checked_at DESC, id DESC").
		Offset(ChannelStatusProbeMaxPerChannel - 1).
		Limit(1).
		Take(&cutoff).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return
		}
		common.SysError("failed to lookup probe log cutoff: " + err.Error())
		return
	}
	if cutoff.Id == 0 {
		return
	}
	if err := DB.Where("channel_id = ? AND id < ?", channelId, cutoff.Id).
		Delete(&ChannelStatusProbeLog{}).Error; err != nil {
		common.SysError("failed to trim probe logs: " + err.Error())
	}
}

// PurgeChannelStatusProbeLogs 清理超过保留期的历史日志，供定期任务调用
func PurgeChannelStatusProbeLogs() error {
	cutoff := time.Now().Add(-time.Duration(ChannelStatusProbeRetentionDays) * 24 * time.Hour).Unix()
	return DB.Where("checked_at < ?", cutoff).Delete(&ChannelStatusProbeLog{}).Error
}

// GetLatestProbeLogByChannel 获取渠道最新一条 log，用于聚合最新延迟
func GetLatestProbeLogByChannel(channelId int) (*ChannelStatusProbeLog, error) {
	var log ChannelStatusProbeLog
	err := DB.Where("channel_id = ?", channelId).
		Order("checked_at DESC, id DESC").
		Take(&log).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &log, nil
}

// GetRecentProbeLogsByChannel 获取渠道最近 N 条 log（按时间倒序），供色条渲染
func GetRecentProbeLogsByChannel(channelId int, limit int) ([]ChannelStatusProbeLog, error) {
	if limit <= 0 {
		limit = 60
	}
	var logs []ChannelStatusProbeLog
	err := DB.Where("channel_id = ?", channelId).
		Order("checked_at DESC, id DESC").
		Limit(limit).
		Find(&logs).Error
	if err != nil {
		return nil, err
	}
	return logs, nil
}

// ChannelStatusAvailabilityWindow 保存一段时间窗口内的成功/总条数聚合结果
type ChannelStatusAvailabilityWindow struct {
	Total   int64
	Success int64
}

// GetChannelStatusAvailabilityByChannels 计算多个 channel 在 sinceSeconds 秒内的可用率数据
func GetChannelStatusAvailabilityByChannels(channelIds []int, sinceSeconds int64) (map[int]ChannelStatusAvailabilityWindow, error) {
	result := make(map[int]ChannelStatusAvailabilityWindow, len(channelIds))
	if len(channelIds) == 0 {
		return result, nil
	}
	cutoff := time.Now().Unix() - sinceSeconds

	type row struct {
		ChannelId int
		Total     int64
		Success   int64
	}
	var rows []row
	err := DB.Model(&ChannelStatusProbeLog{}).
		Select("channel_id, COUNT(*) as total, SUM(CASE WHEN success = "+commonTrueVal+" THEN 1 ELSE 0 END) as success").
		Where("channel_id IN ? AND checked_at >= ?", channelIds, cutoff).
		Group("channel_id").
		Scan(&rows).Error
	if err != nil {
		return result, err
	}
	for _, r := range rows {
		result[r.ChannelId] = ChannelStatusAvailabilityWindow{Total: r.Total, Success: r.Success}
	}
	return result, nil
}
