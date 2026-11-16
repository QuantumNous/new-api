package dto

type UserSetting struct {
	NotifyType                       string  `json:"notify_type,omitempty"`                          // QuotaWarningType Quota warning type
	QuotaWarningThreshold            float64 `json:"quota_warning_threshold,omitempty"`              // QuotaWarningThreshold Quota warning threshold
	QuotaWarningEnabled              *bool   `json:"quota_warning_enabled,omitempty"`                // Whether to receive low balance reminders or not. Receive if not set.
	WebhookUrl                       string  `json:"webhook_url,omitempty"`                          // WebhookUrl webhook address
	WebhookSecret                    string  `json:"webhook_secret,omitempty"`                       // WebhookSecret webhook secret
	NotificationEmail                string  `json:"notification_email,omitempty"`                   // NotificationEmail notification email address
	BarkUrl                          string  `json:"bark_url,omitempty"`                             // BarkUrl Bark push URL
	GotifyUrl                        string  `json:"gotify_url,omitempty"`                           // GotifyUrl Gotify server address
	GotifyToken                      string  `json:"gotify_token,omitempty"`                         // GotifyToken Gotify App Token
	GotifyPriority                   int     `json:"gotify_priority"`                                // GotifyPriority Gotify message priority
	UpstreamModelUpdateNotifyEnabled bool    `json:"upstream_model_update_notify_enabled,omitempty"` // Whether to receive scheduled detection notifications of upstream model updates (administrators only)
	ChannelNotifyEnabled             *bool   `json:"channel_notify_enabled,omitempty"`               // Whether to receive channel notifications (administrators only), if not set, root will receive it, other administrators will not receive it.
	AcceptUnsetRatioModel            bool    `json:"accept_unset_model_ratio_model,omitempty"`       // AcceptUnsetRatioModel Whether to accept models without set price
	RecordIpLog                      bool    `json:"record_ip_log,omitempty"`                        // Whether to record request and error log IP
	SidebarModules                   string  `json:"sidebar_modules,omitempty"`                      // SidebarModules left sidebar module configuration
	BillingPreference                string  `json:"billing_preference,omitempty"`                   // BillingPreference charging strategy (subscription/wallet)
	Language                         string  `json:"language,omitempty"`                             // Language User language preference (zh, en)
}

var (
	NotifyTypeEmail   = "email"   // Email mail
	NotifyTypeWebhook = "webhook" // Webhook
	NotifyTypeBark    = "bark"    // Bark push
	NotifyTypeGotify  = "gotify"  // Gotify push
)
