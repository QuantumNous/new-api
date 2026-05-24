package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type ChannelDynamicAdjustmentSetting struct {
	Enabled                        bool    `json:"enabled"`
	DryRun                         bool    `json:"dry_run"`
	IntervalSeconds                int     `json:"interval_seconds"`
	PlatformProbeEnabled           bool    `json:"platform_probe_enabled"`
	PlatformProbeIntervalSeconds   int     `json:"platform_probe_interval_seconds"`
	DegradedWeightMultiplier       float64 `json:"degraded_weight_multiplier"`
	ProtectedUnhealthyMultiplier   float64 `json:"protected_unhealthy_multiplier"`
	PriorityDowngradeLatencyMS     int     `json:"priority_downgrade_latency_ms"`
	LastAvailableProtectionEnabled bool    `json:"last_available_protection_enabled"`
}

var channelDynamicAdjustmentSetting = ChannelDynamicAdjustmentSetting{
	Enabled:                        true,
	DryRun:                         true,
	IntervalSeconds:                180,
	PlatformProbeEnabled:           false,
	PlatformProbeIntervalSeconds:   600,
	DegradedWeightMultiplier:       0.5,
	ProtectedUnhealthyMultiplier:   0.3,
	PriorityDowngradeLatencyMS:     1500,
	LastAvailableProtectionEnabled: true,
}

func init() {
	config.GlobalConfig.Register("channel_dynamic_adjustment", &channelDynamicAdjustmentSetting)
}

func GetChannelDynamicAdjustmentSetting() *ChannelDynamicAdjustmentSetting {
	return &channelDynamicAdjustmentSetting
}
