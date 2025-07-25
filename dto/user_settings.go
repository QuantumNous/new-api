package dto

type UserSetting struct {
	NotifyType            string  `json:"notify_type,omitempty"`                    // QuotaWarningType 额度预警类型
	QuotaWarningThreshold float64 `json:"quota_warning_threshold,omitempty"`        // QuotaWarningThreshold 额度预警阈值
	WebhookUrl            string  `json:"webhook_url,omitempty"`                    // WebhookUrl webhook地址
	WebhookSecret         string  `json:"webhook_secret,omitempty"`                 // WebhookSecret webhook密钥
	NotificationEmail     string  `json:"notification_email,omitempty"`             // NotificationEmail 通知邮箱地址
	AcceptUnsetRatioModel bool    `json:"accept_unset_model_ratio_model,omitempty"` // AcceptUnsetRatioModel 是否接受未设置价格的模型
	RecordIpLog           bool    `json:"record_ip_log,omitempty"`                  // 是否记录请求和错误日志IP
}

var (
	NotifyTypeEmail   = "email"   // Email 邮件
	NotifyTypeWebhook = "webhook" // Webhook
)
