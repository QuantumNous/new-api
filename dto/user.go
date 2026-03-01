package dto

// RegisterRequest is the request body for POST /api/user/register.
type RegisterRequest struct {
	Username         string `json:"username" validate:"max=20"`
	Password         string `json:"password" validate:"min=8,max=20"`
	Email            string `json:"email,omitempty" validate:"max=50"`
	VerificationCode string `json:"verification_code,omitempty"`
	AffCode          string `json:"aff_code,omitempty"`
}

// LoginRequest is the request body for POST /api/user/login.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// TopUpRequest is the request body for POST /api/user/topup.
type TopUpRequest struct {
	Key string `json:"key"`
}

// UpdateUserSettingRequest is the request body for POST /api/user/setting.
type UpdateUserSettingRequest struct {
	QuotaWarningType           string  `json:"notify_type"`
	QuotaWarningThreshold      float64 `json:"quota_warning_threshold"`
	WebhookUrl                 string  `json:"webhook_url,omitempty"`
	WebhookSecret              string  `json:"webhook_secret,omitempty"`
	NotificationEmail          string  `json:"notification_email,omitempty"`
	BarkUrl                    string  `json:"bark_url,omitempty"`
	GotifyUrl                  string  `json:"gotify_url,omitempty"`
	GotifyToken                string  `json:"gotify_token,omitempty"`
	GotifyPriority                   int     `json:"gotify_priority,omitempty"`
	UpstreamModelUpdateNotifyEnabled *bool   `json:"upstream_model_update_notify_enabled,omitempty"`
	AcceptUnsetModelRatioModel       bool    `json:"accept_unset_model_ratio_model"`
	RecordIpLog                bool    `json:"record_ip_log"`
}

// ManageRequest is the request body for POST /api/user/manage.
type ManageRequest struct {
	Id     int    `json:"id"`
	Action string `json:"action"`
}

// ManageUserData is the response data for POST /api/user/manage.
type ManageUserData struct {
	Role   int `json:"role"`
	Status int `json:"status"`
}

// TransferAffQuotaRequest is the request body for POST /api/user/aff_transfer.
type TransferAffQuotaRequest struct {
	Quota int `json:"quota" binding:"required"`
}

// UserSelfData is the response data for GET /api/user/self.
type UserSelfData struct {
	Id              int    `json:"id"`
	Username        string `json:"username"`
	DisplayName     string `json:"display_name"`
	Role            int    `json:"role"`
	Status          int    `json:"status"`
	Email           string `json:"email"`
	GitHubId        string `json:"github_id"`
	DiscordId       string `json:"discord_id"`
	OidcId          string `json:"oidc_id"`
	WeChatId        string `json:"wechat_id"`
	TelegramId      string `json:"telegram_id"`
	Group           string `json:"group"`
	Quota           int    `json:"quota"`
	UsedQuota       int    `json:"used_quota"`
	RequestCount    int    `json:"request_count"`
	AffCode         string `json:"aff_code"`
	AffCount        int    `json:"aff_count"`
	AffQuota        int    `json:"aff_quota"`
	AffHistoryQuota int    `json:"aff_history_quota"`
	InviterId       int    `json:"inviter_id"`
	LinuxDOId       string `json:"linux_do_id"`
	Setting         string `json:"setting"`
	StripeCustomer  string `json:"stripe_customer"`
	SidebarModules  string `json:"sidebar_modules"`
	Permissions     any    `json:"permissions"`
}
