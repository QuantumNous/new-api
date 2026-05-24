package service

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type ChannelStatusMonitorSetting struct {
	Enabled      bool   `json:"enabled"`
	Provider     string `json:"provider"`
	ProviderSlug string `json:"provider_slug"`
	RequestModel string `json:"request_model"`
	MonitorID    string `json:"monitor_id"`
	MonitorName  string `json:"monitor_name"`
}

type ChannelStatusAction string

const (
	ChannelStatusActionNone    ChannelStatusAction = "none"
	ChannelStatusActionDisable ChannelStatusAction = "disable"
	ChannelStatusActionEnable  ChannelStatusAction = "enable"
)

type ChannelStatusAdjustmentInput struct {
	ChannelID         int
	CurrentStatus     int
	HasAutoDisabled   bool
	HasKnownSamples   bool
	AllKnownUnhealthy bool
	HasRecovered      bool
	DryRun            bool
}

type ChannelStatusAdjustmentPlan struct {
	Action       ChannelStatusAction
	TargetStatus int
	Reason       string
}

func ParseChannelStatusMonitorSetting(otherInfo string) *ChannelStatusMonitorSetting {
	if strings.TrimSpace(otherInfo) == "" {
		return nil
	}
	var raw map[string]any
	if err := json.Unmarshal([]byte(otherInfo), &raw); err != nil {
		return nil
	}
	node, ok := raw["status_monitor"].(map[string]any)
	if !ok {
		return nil
	}
	setting := &ChannelStatusMonitorSetting{
		Enabled:      getBoolFromAny(node["enabled"]),
		Provider:     getStringFromAny(node["provider"]),
		ProviderSlug: getStringFromAny(node["provider_slug"]),
		RequestModel: getStringFromAny(node["request_model"]),
		MonitorID:    getStringFromAny(node["monitor_id"]),
		MonitorName:  getStringFromAny(node["monitor_name"]),
	}
	if !setting.Enabled {
		return nil
	}
	if setting.ProviderSlug == "" {
		setting.ProviderSlug = normalizeStatusSlug(setting.Provider)
	}
	return setting
}

func ShouldUsePlatformProbe(channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	return ParseChannelStatusMonitorSetting(channel.OtherInfo) == nil
}

func PlanChannelStatusAdjustment(input ChannelStatusAdjustmentInput) ChannelStatusAdjustmentPlan {
	plan := ChannelStatusAdjustmentPlan{
		Action:       ChannelStatusActionNone,
		TargetStatus: input.CurrentStatus,
		Reason:       "no channel status change",
	}

	if input.CurrentStatus == common.ChannelStatusManuallyDisabled {
		plan.Reason = "channel manually disabled"
		return plan
	}
	if !input.HasKnownSamples {
		plan.Reason = "no known samples"
		return plan
	}

	if input.CurrentStatus == common.ChannelStatusAutoDisabled {
		if input.HasAutoDisabled && input.HasRecovered {
			plan.Action = ChannelStatusActionEnable
			plan.TargetStatus = common.ChannelStatusEnabled
			plan.Reason = "recovered from dynamic auto-disable"
		}
		return plan
	}

	if input.AllKnownUnhealthy {
		plan.Action = ChannelStatusActionDisable
		plan.TargetStatus = common.ChannelStatusAutoDisabled
		plan.Reason = "all monitored abilities unhealthy"
	}
	return plan
}

func shouldAutoDisableChannel(channel *model.Channel, states []string) bool {
	if channel == nil || channel.Status == common.ChannelStatusManuallyDisabled {
		return false
	}
	if len(states) == 0 {
		return false
	}
	for _, state := range states {
		if state != DynamicHealthUnhealthy {
			return false
		}
	}
	return true
}

func getStringFromAny(value any) string {
	return strings.TrimSpace(common.Interface2String(value))
}

func getBoolFromAny(value any) bool {
	switch v := value.(type) {
	case bool:
		return v
	case string:
		parsed, _ := strconv.ParseBool(strings.TrimSpace(v))
		return parsed
	default:
		return false
	}
}

func recordChannelStatusAdjustmentLog(channelID int, action ChannelStatusAction, reason string, dryRun bool, beforeStatus int, afterStatus int) error {
	return model.CreateChannelDynamicAdjustmentLog(model.ChannelDynamicAdjustmentLog{
		ChannelID:     channelID,
		Group:         "",
		Model:         "",
		Provider:      "channel_status",
		Source:        "channel_status",
		State:         string(action),
		Action:        string(action),
		DryRun:        dryRun,
		Protected:     false,
		Reason:        reason,
		BeforeEnabled: beforeStatus == common.ChannelStatusEnabled,
		AfterEnabled:  afterStatus == common.ChannelStatusEnabled,
		CreatedAt:     common.GetTimestamp(),
	})
}

func applyChannelStatusPlan(channel *model.Channel, plan ChannelStatusAdjustmentPlan, dryRun bool) error {
	if channel == nil || plan.Action == ChannelStatusActionNone {
		return nil
	}

	beforeStatus := channel.Status
	if dryRun {
		return recordChannelStatusAdjustmentLog(channel.Id, plan.Action, plan.Reason, true, beforeStatus, plan.TargetStatus)
	}

	otherInfo := channel.GetOtherInfo()
	switch plan.Action {
	case ChannelStatusActionDisable:
		otherInfo["dynamic_adjustment_auto_disabled"] = true
		otherInfo["dynamic_adjustment_auto_disabled_reason"] = plan.Reason
		otherInfo["dynamic_adjustment_auto_disabled_at"] = common.GetTimestamp()
	case ChannelStatusActionEnable:
		otherInfo["dynamic_adjustment_auto_disabled"] = false
		delete(otherInfo, "dynamic_adjustment_auto_disabled_reason")
		delete(otherInfo, "dynamic_adjustment_auto_disabled_at")
	}
	channel.SetOtherInfo(otherInfo)
	channel.Status = plan.TargetStatus
	if err := channel.SaveWithoutKey(); err != nil {
		return err
	}
	model.CacheUpdateChannel(channel)
	return recordChannelStatusAdjustmentLog(channel.Id, plan.Action, plan.Reason, false, beforeStatus, plan.TargetStatus)
}

func getChannelStatusAdjustmentState(channel *model.Channel) (bool, string) {
	if channel == nil {
		return false, ""
	}
	otherInfo := channel.GetOtherInfo()
	if auto, ok := otherInfo["dynamic_adjustment_auto_disabled"]; ok {
		if getBoolFromAny(auto) {
			return true, getStringFromAny(otherInfo["dynamic_adjustment_auto_disabled_reason"])
		}
	}
	return false, ""
}

func buildChannelStatusAdjustmentPlan(channel *model.Channel, dryRun bool, states []string, recovered bool) ChannelStatusAdjustmentPlan {
	input := ChannelStatusAdjustmentInput{
		ChannelID:         channel.Id,
		CurrentStatus:     channel.Status,
		HasAutoDisabled:   getChannelStatusAdjustmentStateRaw(channel),
		HasKnownSamples:   len(states) > 0,
		AllKnownUnhealthy: shouldAutoDisableChannel(channel, states),
		HasRecovered:      recovered,
		DryRun:            dryRun,
	}
	return PlanChannelStatusAdjustment(input)
}

func getChannelStatusAdjustmentStateRaw(channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	auto, _ := getChannelStatusAdjustmentState(channel)
	return auto
}

func applyChannelStatusPlanIfNeeded(channel *model.Channel, dryRun bool, states []string, recovered bool) error {
	if channel == nil {
		return nil
	}
	plan := buildChannelStatusAdjustmentPlan(channel, dryRun, states, recovered)
	if plan.Action == ChannelStatusActionNone {
		return nil
	}
	return applyChannelStatusPlan(channel, plan, dryRun)
}

func markChannelAutoDisabled(channel *model.Channel, reason string, dryRun bool) error {
	if channel == nil {
		return nil
	}
	if dryRun {
		return recordChannelStatusAdjustmentLog(channel.Id, ChannelStatusActionDisable, reason, true, channel.Status, common.ChannelStatusAutoDisabled)
	}
	if ok := model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusAutoDisabled, reason); !ok {
		return nil
	}
	updated, err := model.GetChannelById(channel.Id, true)
	if err != nil {
		return err
	}
	otherInfo := updated.GetOtherInfo()
	otherInfo["dynamic_adjustment_auto_disabled"] = true
	otherInfo["dynamic_adjustment_auto_disabled_reason"] = reason
	otherInfo["dynamic_adjustment_auto_disabled_at"] = common.GetTimestamp()
	updated.SetOtherInfo(otherInfo)
	return updated.SaveWithoutKey()
}

func markChannelAutoEnabled(channel *model.Channel, reason string, dryRun bool) error {
	if channel == nil {
		return nil
	}
	if dryRun {
		return recordChannelStatusAdjustmentLog(channel.Id, ChannelStatusActionEnable, reason, true, channel.Status, common.ChannelStatusEnabled)
	}
	if ok := model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, reason); !ok {
		return nil
	}
	updated, err := model.GetChannelById(channel.Id, true)
	if err != nil {
		return err
	}
	otherInfo := updated.GetOtherInfo()
	otherInfo["dynamic_adjustment_auto_disabled"] = false
	delete(otherInfo, "dynamic_adjustment_auto_disabled_reason")
	delete(otherInfo, "dynamic_adjustment_auto_disabled_at")
	updated.SetOtherInfo(otherInfo)
	return updated.SaveWithoutKey()
}
