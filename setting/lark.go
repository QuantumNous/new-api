package setting

import "github.com/QuantumNous/new-api/common"

// Lark (Feishu) custom-bot notification settings. Values are DB-backed options
// (see model/option.go) and can be overridden at startup via environment so ops
// can inject the webhook secret from a secret manager.
var (
	LarkNotifyEnabled    bool
	LarkNotifyWebhookURL string
	LarkNotifySecret     string
)

func init() {
	LarkNotifyEnabled = common.GetEnvOrDefaultBool("LARK_NOTIFY_ENABLED", false)
	LarkNotifyWebhookURL = common.GetEnvOrDefaultString("LARK_NOTIFY_WEBHOOK_URL", "")
	LarkNotifySecret = common.GetEnvOrDefaultString("LARK_NOTIFY_SECRET", "")
}
