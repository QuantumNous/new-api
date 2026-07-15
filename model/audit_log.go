package model

import (
	"github.com/QuantumNous/new-api/common"
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

// WriteAuditLog 写入一条审计记录（治理域手动埋点用）。
// 失败仅记日志、不返回错误，保证审计写入永不阻塞业务主流程（RT3，详见研发任务卡 T6）。
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
	if err := DB.Create(&rec).Error; err != nil {
		common.SysLog("WriteAuditLog failed: " + err.Error())
	}
}
