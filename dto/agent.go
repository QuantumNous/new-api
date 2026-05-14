package dto

type AgentChatRequest struct {
	SessionId int                    `json:"session_id"`
	Message   string                 `json:"message" binding:"required"`
	Options   map[string]interface{} `json:"options"`
}

type AgentConfirmRequest struct {
	SessionId    int    `json:"session_id" binding:"required"`
	ConfirmToken string `json:"confirm_token" binding:"required"`
	Accept       bool   `json:"accept"`
}

type AgentConfigResponse struct {
	Enabled      bool     `json:"enabled"`
	DisplayName  string   `json:"display_name"`
	QuickActions []string `json:"quick_actions"`
}

type AgentSessionResponse struct {
	Id          int    `json:"id"`
	Title       string `json:"title"`
	LastMessage string `json:"last_message"`
	Status      string `json:"status"`
	TokenCost   int64  `json:"token_cost"`
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
}

type AgentEvent struct {
	Type         string      `json:"type"`
	SessionId    int         `json:"session_id,omitempty"`
	Delta        string      `json:"delta,omitempty"`
	Message      string      `json:"message,omitempty"`
	ToolName     string      `json:"tool_name,omitempty"`
	CallId       string      `json:"call_id,omitempty"`
	Data         interface{} `json:"data,omitempty"`
	ConfirmToken string      `json:"confirm_token,omitempty"`
	RiskLevel    string      `json:"risk_level,omitempty"`
	Done         bool        `json:"done,omitempty"`
}
