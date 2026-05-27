package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type AirwallexAccount struct {
	Enabled       bool   `json:"enabled"`
	BaseURL       string `json:"base_url"`
	ClientID      string `json:"client_id"`
	APIKey        string `json:"api_key"`
	LoginAs       string `json:"login_as"`
	WebhookSecret string `json:"webhook_secret"`
}

type AirwallexSetting struct {
	Enabled bool `json:"enabled"`

	// Accounts is keyed by business line, for example "b2c".
	Accounts map[string]AirwallexAccount `json:"accounts"`

	AlertWeComRobotWebhook string `json:"alert_wecom_robot_webhook"`
	AlertThrottleSeconds   int    `json:"alert_throttle_seconds"`

	OpsEnabled                    bool     `json:"ops_enabled"`
	OpsTickIntervalSeconds        int      `json:"ops_tick_interval_seconds"`
	OpsCancelPendingAfterSeconds  int      `json:"ops_cancel_pending_after_seconds"`
	OpsReconcileLookbackSeconds   int      `json:"ops_reconcile_lookback_seconds"`
	OpsBatchSize                  int      `json:"ops_batch_size"`
	OpsTimeoutSeconds             int      `json:"ops_timeout_seconds"`
	TokenCacheTTLSeconds          int      `json:"token_cache_ttl_seconds"`
	TokenEarlyRefreshSeconds      int      `json:"token_early_refresh_seconds"`
	HTTPTimeoutSeconds            int      `json:"http_timeout_seconds"`
	AllowedPaymentMethods         []string `json:"allowed_payment_methods"`
	PaymentMethodsCacheTTLSeconds int      `json:"payment_methods_cache_ttl_seconds"`

	WebhookTimestampToleranceSeconds int `json:"webhook_timestamp_tolerance_seconds"`
}

var airwallexSetting = AirwallexSetting{
	Enabled:                          false,
	Accounts:                         map[string]AirwallexAccount{},
	AlertWeComRobotWebhook:           "",
	AlertThrottleSeconds:             300,
	OpsEnabled:                       false,
	OpsTickIntervalSeconds:           120,
	OpsCancelPendingAfterSeconds:     1800,
	OpsReconcileLookbackSeconds:      86400,
	OpsBatchSize:                     200,
	OpsTimeoutSeconds:                15,
	TokenCacheTTLSeconds:             3600,
	TokenEarlyRefreshSeconds:         60,
	HTTPTimeoutSeconds:               15,
	AllowedPaymentMethods:            []string{},
	PaymentMethodsCacheTTLSeconds:    600,
	WebhookTimestampToleranceSeconds: 300,
}

func init() {
	config.GlobalConfig.Register("airwallex_setting", &airwallexSetting)
}

func GetAirwallexSetting() *AirwallexSetting {
	return &airwallexSetting
}
