package model

import (
	"github.com/jinzhu/copier"
)

// SecurityGroup 敏感词分组表
// 支持嵌套层级，使用 materialized path 模式
type SecurityGroup struct {
	ID          int64  `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	Name        string `json:"name" gorm:"column:name;size:128;not null;uniqueIndex:idx_security_group_name"`
	Description string `json:"description" gorm:"column:description;size:255;default:''"`
	Status      int    `json:"status" gorm:"column:status;type:int;default:1;index:idx_security_group_status"`
	ParentID    int64  `json:"parent_id" gorm:"column:parent_id;type:bigint;default:0;index:idx_security_group_parent"`
	Depth       int    `json:"depth" gorm:"column:depth;type:int;default:0"`
	Path        string `json:"path" gorm:"column:path;size:500;default:'';index:idx_security_group_path"`
	SortOrder   int    `json:"sort_order" gorm:"column:sort_order;type:int;default:0"`
	CreatedAt   int64  `json:"created_at" gorm:"column:created_at;type:bigint;default:0"`
	UpdatedAt   int64  `json:"updated_at" gorm:"column:updated_at;type:bigint;default:0"`
}

// SecurityRule 敏感词规则表
type SecurityRule struct {
	ID          int64  `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	GroupID     int64  `json:"group_id" gorm:"column:group_id;type:bigint;not null;index:idx_security_rule_group"`
	Name        string `json:"name" gorm:"column:name;size:128;not null"`
	Type        int    `json:"type" gorm:"column:type;type:int;not null;index:idx_security_rule_type"`
	Content     string `json:"content" gorm:"column:content;type:text;not null"`
	ExtraConfig string `json:"extra_config" gorm:"column:extra_config;type:text;default:null"`
	Action      int    `json:"action" gorm:"column:action;type:int;default:1"`
	Priority    int    `json:"priority" gorm:"column:priority;type:int;default:0"`
	RiskScore   int    `json:"risk_score" gorm:"column:risk_score;type:int;default:50"`
	Status      int    `json:"status" gorm:"column:status;type:int;default:1;index:idx_security_rule_status"`
	CreatedAt   int64  `json:"created_at" gorm:"column:created_at;type:bigint;default:0"`
	UpdatedAt   int64  `json:"updated_at" gorm:"column:updated_at;type:bigint;default:0"`
}

// SecurityUserPolicy 用户策略表
type SecurityUserPolicy struct {
	ID             int64  `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	UserID         int    `json:"user_id" gorm:"column:user_id;type:int;not null;index:idx_security_policy_user"`
	GroupID        int64  `json:"group_id" gorm:"column:group_id;type:bigint;not null;index:idx_security_policy_group"`
	Scope          int    `json:"scope" gorm:"column:scope;type:int;default:3"`
	DefaultAction  int    `json:"default_action" gorm:"column:default_action;type:int;default:3"`
	CustomResponse string `json:"custom_response" gorm:"column:custom_response;type:text;default:null"`
	WhitelistIPs   string `json:"whitelist_ips" gorm:"column:whitelist_ips;type:text;default:null"`
	Status         int    `json:"status" gorm:"column:status;type:int;default:1;index:idx_security_policy_status"`
	CreatedAt      int64  `json:"created_at" gorm:"column:created_at;type:bigint;default:0"`
	UpdatedAt      int64  `json:"updated_at" gorm:"column:updated_at;type:bigint;default:0"`
}

// SecurityHitLog 命中日志表
type SecurityHitLog struct {
	ID                  int64  `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	RequestID           string `json:"request_id" gorm:"column:request_id;size:64;not null;index:idx_security_hit_request"`
	UserID              int    `json:"user_id" gorm:"column:user_id;type:int;not null;index:idx_security_hit_user"`
	ChannelID           int    `json:"channel_id" gorm:"column:channel_id;type:int;not null"`
	ModelName           string `json:"model_name" gorm:"column:model_name;size:128;default:'';index:idx_security_hit_model"`
	TokenID             int    `json:"token_id" gorm:"column:token_id;type:int;default:0"`
	RuleID              int64  `json:"rule_id" gorm:"column:rule_id;type:bigint;default:null;index:idx_security_hit_rule"`
	GroupID             int64  `json:"group_id" gorm:"column:group_id;type:bigint;default:null;index:idx_security_hit_group"`
	ContentType         int    `json:"content_type" gorm:"column:content_type;type:int;default:1"`
	Action              int    `json:"action" gorm:"column:action;type:int;not null;index:idx_security_hit_action"`
	RiskLevel           int    `json:"risk_level" gorm:"column:risk_level;type:int;not null;index:idx_security_hit_risk_level"`
	RiskScore           int    `json:"risk_score" gorm:"column:risk_score;type:int;default:0"`
	OriginalContentHash string `json:"original_content_hash" gorm:"column:original_content_hash;size:64;default:''"`
	ProcessedContent    string `json:"processed_content" gorm:"column:processed_content;type:text;default:null"`
	MatchDetail         string `json:"match_detail" gorm:"column:match_detail;type:text;default:null"`
	IP                  string `json:"ip" gorm:"column:ip;size:64;default:''"`
	CreatedAt           int64  `json:"created_at" gorm:"column:created_at;type:bigint;default:0;index:idx_security_hit_created"`
}

// SecurityAuditLog 操作日志表
type SecurityAuditLog struct {
	ID          int64  `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	UserID      int    `json:"user_id" gorm:"column:user_id;type:int;not null;index:idx_security_audit_user"`
	ActionType  string `json:"action_type" gorm:"column:action_type;size:32;not null;index:idx_security_audit_action"`
	TargetType  string `json:"target_type" gorm:"column:target_type;size:32;not null"`
	TargetID    int64  `json:"target_id" gorm:"column:target_id;type:bigint;not null"`
	OldValue    string `json:"old_value" gorm:"column:old_value;type:text;default:null"`
	NewValue    string `json:"new_value" gorm:"column:new_value;type:text;default:null"`
	OperatorID  int    `json:"operator_id" gorm:"column:operator_id;type:int;not null"`
	CreatedAt   int64  `json:"created_at" gorm:"column:created_at;type:bigint;default:0;index:idx_security_audit_created"`
}

// TableName 自定义表名
func (SecurityGroup) TableName() string        { return "security_groups" }
func (SecurityRule) TableName() string         { return "security_rules" }
func (SecurityUserPolicy) TableName() string   { return "security_user_policies" }
func (SecurityHitLog) TableName() string       { return "security_hit_logs" }
func (SecurityAuditLog) TableName() string     { return "security_audit_logs" }

// Copy 辅助方法
func (sg *SecurityGroup) CopyFrom(other *SecurityGroup) error {
	return copier.Copy(sg, other)
}

func (sr *SecurityRule) CopyFrom(other *SecurityRule) error {
	return copier.Copy(sr, other)
}

// SecurityRuleWithGroup 带分组信息的规则
type SecurityRuleWithGroup struct {
	SecurityRule
	GroupName string `json:"group_name" gorm:"column:group_name"`
}

// SecurityPolicyWithGroup 带分组信息的策略
type SecurityPolicyWithGroup struct {
	SecurityUserPolicy
	UserName  string `json:"user_name" gorm:"column:user_name"`
	GroupName string `json:"group_name" gorm:"column:group_name"`
}

// SecurityHitLogWithDetails 带详细信息的命中日志
type SecurityHitLogWithDetails struct {
	SecurityHitLog
	UserName  string `json:"user_name" gorm:"column:user_name"`
	RuleName  string `json:"rule_name" gorm:"column:rule_name"`
	GroupName string `json:"group_name" gorm:"column:group_name"`
}
