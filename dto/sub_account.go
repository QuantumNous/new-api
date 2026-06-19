package dto

// 企业子账户相关 DTO（docs/enterprise-features-design.md 功能C）。

// CreateSubAccountRequest 创建子账户请求。用户名/密码格式规则与主站注册一致。
type CreateSubAccountRequest struct {
	Username    string `json:"username" validate:"required,max=20"`
	Password    string `json:"password" validate:"required,min=8,max=20"`
	DisplayName string `json:"display_name" validate:"max=20"`
}

// ResetSubAccountPasswordRequest 重置子账户密码请求。
type ResetSubAccountPasswordRequest struct {
	Password string `json:"password" validate:"required,min=8,max=20"`
}

// SetSubAccountStatusRequest 启用/禁用子账户请求（status：1=启用 2=禁用，复用 users.status）。
type SetSubAccountStatusRequest struct {
	Status int `json:"status"`
}

// SubAccountTokenRequest 绑定/解绑令牌请求（子账户 id 走路径参数）。
type SubAccountTokenRequest struct {
	TokenId int `json:"token_id"`
}

// SubAccountResponse 子账户列表项。
type SubAccountResponse struct {
	Id           int    `json:"id"`
	Username     string `json:"username"`
	DisplayName  string `json:"display_name"`
	Status       int    `json:"status"`
	BindingCount int    `json:"binding_count"`
	CreatedAt    int64  `json:"created_at"`
	LastUsedTime int64  `json:"last_used_time"` // 绑定令牌中最近一次使用时间（秒）；无绑定/从未使用为 0
}

// SubAccountBindingResponse 某子账户的绑定令牌项（含令牌名与明文 key，D11）。
type SubAccountBindingResponse struct {
	Id                 int    `json:"id"`
	TokenId            int    `json:"token_id"`
	TokenName          string `json:"token_name"`
	TokenKey           string `json:"token_key"`
	RemainQuota        int    `json:"remain_quota"`
	UsedQuota          int    `json:"used_quota"`
	UnlimitedQuota     bool   `json:"unlimited_quota"`
	Status             int    `json:"status"`
	Group              string `json:"group"`
	ExpiredTime        int64  `json:"expired_time"`
	ModelLimitsEnabled bool   `json:"model_limits_enabled"`
	ModelLimits        string `json:"model_limits"`
	CreatedAt          int64  `json:"created_at"`
}
