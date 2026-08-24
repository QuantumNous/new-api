package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// This file wires the "temporary channel" supply-chain guardrail: every completed
// request that was served by a channel flagged temporary contributes to that model's
// cumulative spend, and once a single model crosses the configured USD threshold an
// alert fires to the management backend. The intent is to prove real demand on a
// stopgap relay supplier, then push the supply-chain side to source a cheaper direct
// resource. Crossing the threshold does NOT disable the channel — service continues.

func init() {
	// Registered from the service layer so model/ never imports service/ (no cycle).
	model.TemporaryChannelSpendHook = trackTemporaryChannelSpend
}

// trackTemporaryChannelSpend is the settlement-path hook. It stays cheap for the 99%
// of traffic on non-temporary channels (one in-memory cache lookup, then return) and
// pushes the DB accumulation off the hot path for temporary channels.
func trackTemporaryChannelSpend(channelId int, modelName string, quota int) {
	if quota <= 0 || modelName == "" {
		return
	}
	if !isTemporaryChannel(channelId) {
		return
	}
	go accumulateTemporaryChannelSpend(modelName, int64(quota))
}

// isTemporaryChannel reports whether a channel is flagged temporary. Reads the
// in-memory channel cache; a cache miss fails safe as non-temporary.
func isTemporaryChannel(channelId int) bool {
	channel, err := model.CacheGetChannel(channelId)
	if err != nil || channel == nil {
		return false
	}
	return channel.GetSetting().Temporary
}

func accumulateTemporaryChannelSpend(modelName string, quota int64) {
	threshold := operation_setting.GetMonitorSetting().TemporaryChannelSpendThresholdUSD
	if threshold <= 0 {
		return
	}
	now := time.Now()
	total, err := model.AddTemporaryChannelModelSpend(modelName, quota, now.Unix())
	if err != nil {
		common.SysError("failed to accumulate temporary channel spend for " + modelName + ": " + err.Error())
		return
	}
	thresholdQuota := int64(threshold * common.QuotaPerUnit)
	if total < thresholdQuota {
		return
	}
	// Over threshold — claim the fire-once-per-cooldown slot (multi-node safe) and alert.
	cooldownMinutes := operation_setting.GetMonitorSetting().DingTalkAlertCooldownMinutes
	if cooldownMinutes <= 0 {
		cooldownMinutes = 60
	}
	claimed, err := model.TryClaimTemporaryChannelSpendAlert(modelName, int64(cooldownMinutes*60), now.Unix())
	if err != nil {
		common.SysError("failed to claim temporary channel spend alert for " + modelName + ": " + err.Error())
		return
	}
	if !claimed {
		return
	}
	notifyTemporaryChannelSpend(modelName, float64(total)/common.QuotaPerUnit)
}

func notifyTemporaryChannelSpend(modelName string, spentUSD float64) {
	setting := operation_setting.GetMonitorSetting()
	if setting == nil || !setting.DingTalkAlertEnabled {
		return
	}
	if setting.DingTalkAlertWebhookURL == "" {
		return
	}
	content := fmt.Sprintf(
		"【flatkey 供应链预警】临时渠道单模型消耗告警\n模型: %s\n临时渠道累计消耗: $%.2f（已超阈值 $%.0f）\n含义: 该模型在中转/临时渠道上已跑出真实需求。\n动作: 请在供应链侧寻找更便宜的直连资源替换该临时渠道，以拉低成本。",
		modelName, spentUSD, setting.TemporaryChannelSpendThresholdUSD,
	)
	if err := SendDingTalkText(setting.DingTalkAlertWebhookURL, setting.DingTalkAlertSecret, content); err != nil {
		common.SysError("failed to send temporary channel spend alert for " + modelName + ": " + err.Error())
	}
}
