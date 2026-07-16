package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"

	"github.com/bytedance/gopkg/util/gopool"
)

// AuditLog 管理操作审计（登录/建删令牌/改配置/提交审批/审批等）。
// 异步 goroutine 写入，失败重试+告警，不阻塞业务（RT3，详见研发任务卡 T6）。
// 注意：仅记元数据，不存请求/响应正文（LOG_CONTENT_ENABLED=false）。
//
// 与 New API 原生 model.RecordOperationAuditLog（中间件兜底审计）并行存在：
// 本表聚焦治理域审计（quota_apply/quota_approve 等），由业务 handler 在关键节点手动埋点，
// 避免依赖中间件兜底导致治理动作漏记。
type AuditLog struct {
	Id         int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	ActorId    int    `json:"actor_id" gorm:"index"`
	ActorName  string `json:"actor_name" gorm:"type:varchar(64)"`
	Action     string `json:"action" gorm:"type:varchar(64);index"`    // login/token_create/quota_apply/quota_approve/...
	TargetType string `json:"target_type" gorm:"type:varchar(32)"`
	TargetId   string `json:"target_id" gorm:"type:varchar(64);index"`
	Detail     string `json:"detail" gorm:"type:text"`
	Ip         string `json:"ip" gorm:"type:varchar(64)"`
	Ts         int64  `json:"ts" gorm:"autoCreateTime;column:ts;index"`
}

func (AuditLog) TableName() string { return "audit_log" }

// auditWriteMaxRetry 审计异步写入最大重试次数（RT3：失败重试 + 告警）。
const auditWriteMaxRetry = 3

// WriteAuditLog 异步写入一条审计记录（治理域手动埋点用）。
// 通过 gopool 异步落库并对瞬时故障重试，保证审计写入永不阻塞业务主流程（RT3，详见研发任务卡 T6）。
// 最终失败仅记告警日志、不返回错误，不影响调用方/操作的结果返回。
func WriteAuditLog(actorId int, actorName, action, targetType, targetId, detail, ip string) {
	rec := AuditLog{
		ActorId:    actorId,
		ActorName:  actorName,
		Action:     action,
		TargetType: targetType,
		TargetId:   targetId,
		Detail:     detail,
		Ip:         ip,
	}
	gopool.Go(func() {
		var lastErr error
		for attempt := 0; attempt < auditWriteMaxRetry; attempt++ {
			if err := DB.Create(&rec).Error; err != nil {
				lastErr = err
				common.SysLog(fmt.Sprintf("WriteAuditLog retry %d/%d failed: %v", attempt+1, auditWriteMaxRetry, err))
				continue
			}
			return
		}
		// 重试耗尽：触发告警，但绝不回抛影响业务。
		common.SysLog("WriteAuditLog ALERT: final failure after retry, audit lost: " + lastErr.Error())
	})
}

// AuditLogQuery 审计检索条件（对应 T8 检索页 GET /api/audit）。
type AuditLogQuery struct {
	ActorId    int
	ActorName  string
	Action     string
	TargetType string
	From       int64 // 起始时间戳（含）
	To         int64 // 结束时间戳（含）
	Keyword    string // 模糊匹配 detail
	StartIdx   int
	PageSize   int
}

// SearchAuditLogs 按条件分页检索审计日志（audit_log 表）。
// from/to 为 unix 秒；keyword 模糊匹配 detail。返回本页数据与总数。
func SearchAuditLogs(q AuditLogQuery) (logs []*AuditLog, total int64, err error) {
	tx := DB.Model(&AuditLog{})
	if q.ActorId > 0 {
		tx = tx.Where("actor_id = ?", q.ActorId)
	}
	if q.ActorName != "" {
		tx = tx.Where("actor_name LIKE ?", "%"+q.ActorName+"%")
	}
	if q.Action != "" {
		tx = tx.Where("action = ?", q.Action)
	}
	if q.TargetType != "" {
		tx = tx.Where("target_type = ?", q.TargetType)
	}
	if q.From > 0 {
		tx = tx.Where("ts >= ?", q.From)
	}
	if q.To > 0 {
		tx = tx.Where("ts <= ?", q.To)
	}
	if q.Keyword != "" {
		tx = tx.Where("detail LIKE ?", "%"+q.Keyword+"%")
	}
	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err = tx.Order("ts DESC").Offset(q.StartIdx).Limit(q.PageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}
