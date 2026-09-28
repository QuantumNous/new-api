package dto

import relaydto "github.com/QuantumNous/new-api/relaykit/dto"

type UserSetting = relaydto.UserSetting

var (
	NotifyTypeEmail   = "email"   // Email 邮件
	NotifyTypeWebhook = "webhook" // Webhook
	NotifyTypeBark    = "bark"    // Bark 推送
	NotifyTypeGotify  = "gotify"  // Gotify 推送
)
