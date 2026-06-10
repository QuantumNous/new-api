package dto

import (
	"time"
)

// ========== Security Group DTOs ==========

type SecurityGroupRequest struct {
	Name        string `json:"name" binding:"required,max=128"`
	Description string `json:"description" binding:"max=255"`
	ParentID    int64  `json:"parent_id"`
	SortOrder   int    `json:"sort_order"`
}

type SecurityGroupResponse struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Status      int       `json:"status"`
	ParentID    int64     `json:"parent_id"`
	Depth       int       `json:"depth"`
	Path        string    `json:"path"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ========== Security Rule DTOs ==========

type SecurityRuleRequest struct {
	GroupID     int64  `json:"group_id" binding:"required"`
	Name        string `json:"name" binding:"required,max=128"`
	Type        int    `json:"type" binding:"required,oneof=1 2 3 4"`
	Content     string `json:"content" binding:"required"`
	ExtraConfig string `json:"extra_config"`
	Action      int    `json:"action" binding:"required,oneof=1 2 3 4 5"`
	Priority    int    `json:"priority"`
	RiskScore   int    `json:"risk_score" binding:"min=0,max=100"`
}

type SecurityRuleResponse struct {
	ID          int64     `json:"id"`
	GroupID     int64     `json:"group_id"`
	GroupName   string    `json:"group_name,omitempty"`
	Name        string    `json:"name"`
	Type        int       `json:"type"`
	Content     string    `json:"content"`
	ExtraConfig string    `json:"extra_config"`
	Action      int       `json:"action"`
	Priority    int       `json:"priority"`
	RiskScore   int       `json:"risk_score"`
	Status      int       `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ========== Security Policy DTOs ==========

type SecurityPolicyRequest struct {
	UserID         int64  `json:"user_id" binding:"required"`
	GroupID        int64  `json:"group_id" binding:"required"`
	Scope          int    `json:"scope" binding:"oneof=1 2 3"`
	DefaultAction  int    `json:"default_action" binding:"oneof=1 2 3 4 5"`
	CustomResponse string `json:"custom_response"`
	WhitelistIPs   string `json:"whitelist_ips"`
}

type SecurityPolicyResponse struct {
	ID             int64     `json:"id"`
	UserID         int       `json:"user_id"`
	UserName       string    `json:"user_name,omitempty"`
	GroupID        int64     `json:"group_id"`
	GroupName      string    `json:"group_name,omitempty"`
	Scope          int       `json:"scope"`
	DefaultAction  int       `json:"default_action"`
	CustomResponse string    `json:"custom_response"`
	WhitelistIPs   string    `json:"whitelist_ips"`
	Status         int       `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// ========== Security Hit Log DTOs ==========

type SecurityHitLogQuery struct {
	Page       int    `form:"page"`
	PageSize   int    `form:"page_size"`
	UserID     int    `form:"user_id"`
	ModelName  string `form:"model_name"`
	StartTime  int64  `form:"start_time"`
	EndTime    int64  `form:"end_time"`
	GroupID    int64  `form:"group_id"`
	Action     int    `form:"action"`
	RiskLevel  int    `form:"risk_level"`
	ContentType int   `form:"content_type"`
}

type SecurityHitLogResponse struct {
	ID                  int64     `json:"id"`
	RequestID           string    `json:"request_id"`
	UserID              int       `json:"user_id"`
	UserName            string    `json:"user_name,omitempty"`
	ChannelID           int       `json:"channel_id"`
	ModelName           string    `json:"model_name"`
	TokenID             int       `json:"token_id"`
	RuleID              int64     `json:"rule_id"`
	RuleName            string    `json:"rule_name,omitempty"`
	GroupID             int64     `json:"group_id"`
	GroupName           string    `json:"group_name,omitempty"`
	ContentType         int       `json:"content_type"`
	Action              int       `json:"action"`
	RiskLevel           int       `json:"risk_level"`
	RiskScore           int       `json:"risk_score"`
	OriginalContentHash string    `json:"original_content_hash"`
	ProcessedContent    string    `json:"processed_content,omitempty"`
	MatchDetail         string    `json:"match_detail,omitempty"`
	IP                  string    `json:"ip"`
	CreatedAt           time.Time `json:"created_at"`
}

// ========== Security Dashboard DTOs ==========

type SecurityDashboardRequest struct {
	StartTime int64 `form:"start_time"`
	EndTime   int64 `form:"end_time"`
}

type SecurityDashboardResponse struct {
	Summary struct {
		TotalDetections    int `json:"total_detections"`
		TotalInterceptions int `json:"total_interceptions"`
		TotalAlerts        int `json:"total_alerts"`
		TodayDetections    int `json:"today_detections"`
	} `json:"summary"`
	TopCategories []struct {
		Category string `json:"category"`
		Count    int    `json:"count"`
	} `json:"top_categories"`
	TopUsers []struct {
		UserID   int    `json:"user_id"`
		UserName string `json:"user_name"`
		Count    int    `json:"count"`
	} `json:"top_users"`
	TopModels []struct {
		ModelName string `json:"model_name"`
		Count     int    `json:"count"`
	} `json:"top_models"`
	RiskDistribution struct {
		Low      int `json:"low"`
		Medium   int `json:"medium"`
		High     int `json:"high"`
		Critical int `json:"critical"`
	} `json:"risk_distribution"`
}

// ========== Security Check DTOs ==========

type SecurityCheckRequest struct {
	UserID    int    `json:"user_id" binding:"required"`
	Content   string `json:"content" binding:"required"`
	ModelName string `json:"model_name"`
}

type SecurityCheckResponse struct {
	Detected        bool                   `json:"detected"`
	Action          int                    `json:"action"`
	ActionName      string                 `json:"action_name"`
	RiskScore       int                    `json:"risk_score"`
	RiskLevel       int                    `json:"risk_level"`
	ProcessedContent string                `json:"processed_content,omitempty"`
	Matches         []SecurityMatchResult  `json:"matches,omitempty"`
}

type SecurityMatchResult struct {
	RuleID      int64  `json:"rule_id"`
	GroupID     int64  `json:"group_id"`
	Type        int    `json:"type"`
	MatchedText string `json:"matched_text"`
	Position    [2]int `json:"position"`
}

// ========== Common Response ==========

type SecurityStatusResponse struct {
	Enabled      bool  `json:"enabled"`
	RuleCount    int64 `json:"rule_count"`
	GroupCount   int64 `json:"group_count"`
	PolicyCount  int64 `json:"policy_count"`
	CacheEnabled bool  `json:"cache_enabled"`
}
