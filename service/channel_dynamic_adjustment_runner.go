package service

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type ChannelDynamicAdjustmentRunResult struct {
	Scanned int  `json:"scanned"`
	Planned int  `json:"planned"`
	Applied int  `json:"applied"`
	Skipped bool `json:"skipped"`
}

type dynamicAbilityRow struct {
	Group            string
	Model            string
	ChannelID        int
	ChannelName      string
	Tag              *string
	ChannelOtherInfo string
	Enabled          bool
	Priority         *int64
	Weight           uint
	ChannelStatus    int
}

func StartChannelDynamicAdjustmentTask() {
	if err := model.EnsureChannelDynamicAdjustmentTables(); err != nil {
		logger.LogError(context.Background(), fmt.Sprintf("ensure channel dynamic adjustment tables failed: %v", err))
		return
	}
	go channelDynamicAdjustmentLoop()
}

func channelDynamicAdjustmentLoop() {
	runChannelDynamicAdjustmentSafely()
	for {
		setting := operation_setting.GetChannelDynamicAdjustmentSetting()
		interval := setting.IntervalSeconds
		if interval < 60 {
			interval = 60
		}
		timer := time.NewTimer(time.Duration(interval) * time.Second)
		<-timer.C
		runChannelDynamicAdjustmentSafely()
	}
}

func runChannelDynamicAdjustmentSafely() {
	defer func() {
		if r := recover(); r != nil {
			logger.LogError(context.Background(), fmt.Sprintf("channel dynamic adjustment panic: %v", r))
		}
	}()
	if _, err := RunChannelDynamicAdjustmentOnce(context.Background()); err != nil {
		logger.LogError(context.Background(), fmt.Sprintf("channel dynamic adjustment failed: %v", err))
	}
}

func RunChannelDynamicAdjustmentOnce(ctx context.Context) (ChannelDynamicAdjustmentRunResult, error) {
	_ = ctx
	setting := operation_setting.GetChannelDynamicAdjustmentSetting()
	if !setting.Enabled {
		return ChannelDynamicAdjustmentRunResult{Skipped: true}, nil
	}
	if err := model.EnsureChannelDynamicAdjustmentTables(); err != nil {
		return ChannelDynamicAdjustmentRunResult{}, err
	}

	abilities, err := loadDynamicAbilityRows()
	if err != nil {
		return ChannelDynamicAdjustmentRunResult{}, err
	}
	probes, err := loadLatestProbeResults()
	if err != nil {
		return ChannelDynamicAdjustmentRunResult{}, err
	}
	externalStatuses, err := loadLatestExternalStatusSamples()
	if err != nil {
		return ChannelDynamicAdjustmentRunResult{}, err
	}
	channels, err := loadChannelsForDynamicAdjustment()
	if err != nil {
		return ChannelDynamicAdjustmentRunResult{}, err
	}

	enabledCounts := countEnabledAbilitiesByGroupModel(abilities)
	channelStates := make(map[int][]string)
	channelRecovered := make(map[int]bool)
	result := ChannelDynamicAdjustmentRunResult{Scanned: len(abilities)}
	for _, ability := range abilities {
		sample, ok := statusSampleForAbility(ability, probes, externalStatuses)
		if !ok {
			continue
		}
		plan := PlanChannelDynamicAdjustment(DynamicAdjustmentInput{
			Ability: DynamicAbilitySnapshot{
				ChannelID: ability.ChannelID,
				Group:     ability.Group,
				Model:     ability.Model,
				Enabled:   ability.Enabled,
				Priority:  ability.Priority,
				Weight:    ability.Weight,
			},
			Health: DynamicHealthSnapshot{
				State:        sample.State,
				Status:       sample.Status,
				Availability: sample.Availability,
				Latency:      sample.Latency,
				Source:       sample.Source,
				Reason:       sample.Reason,
			},
			ExistingOverride: loadDynamicOverrideSnapshot(ability.ChannelID, ability.Group, ability.Model, sample.Source),
			Settings:         dynamicPolicyFromSetting(setting),
			LastAvailable:    enabledCounts[abilityGroupModelKey(ability.Group, ability.Model)] <= 1,
		})
		if plan.Action == DynamicActionNone {
			continue
		}
		result.Planned++
		if err := persistDynamicPlan(ability, sample, plan, setting.DryRun); err != nil {
			return result, err
		}
		if !setting.DryRun {
			applied, err := applyDynamicPlan(ability, plan)
			if err != nil {
				return result, err
			}
			if applied {
				result.Applied++
			}
		}
		appendDynamicState(channelStates, ability.ChannelID, plan.State)
		if plan.State == DynamicHealthHealthy || plan.State == DynamicHealthDegraded {
			channelRecovered[ability.ChannelID] = true
		}
	}

	for _, channel := range channels {
		states := channelStates[channel.Id]
		if err := applyChannelStatusPlanIfNeeded(channel, setting.DryRun, states, channelRecovered[channel.Id]); err != nil {
			return result, err
		}
	}
	return result, nil
}

func loadChannelsForDynamicAdjustment() ([]*model.Channel, error) {
	var channels []*model.Channel
	err := model.DB.Select("id, status, other_info, name, tag").Find(&channels).Error
	return channels, err
}

func loadDynamicAbilityRows() ([]dynamicAbilityRow, error) {
	var rows []dynamicAbilityRow
	err := model.DB.Table("abilities").
		Select("abilities." + modelCommonGroupColumn() + ", abilities.model, abilities.channel_id, abilities.enabled, abilities.priority, abilities.weight, channels.status as channel_status, channels.name as channel_name, channels.tag, channels.other_info as channel_other_info").
		Joins("left join channels on abilities.channel_id = channels.id").
		Scan(&rows).Error
	return rows, err
}

func loadLatestProbeResults() (map[string]model.ChannelProbeResult, error) {
	var probes []model.ChannelProbeResult
	if err := model.DB.Find(&probes).Error; err != nil {
		return nil, err
	}
	index := make(map[string]model.ChannelProbeResult, len(probes))
	for _, probe := range probes {
		index[dynamicTargetKey(probe.ChannelID, probe.Group, probe.Model)] = probe
	}
	return index, nil
}

func countEnabledAbilitiesByGroupModel(abilities []dynamicAbilityRow) map[string]int {
	counts := make(map[string]int)
	for _, ability := range abilities {
		if ability.Enabled {
			counts[abilityGroupModelKey(ability.Group, ability.Model)]++
		}
	}
	return counts
}

func loadDynamicOverrideSnapshot(channelID int, group string, modelName string, source string) *DynamicOverrideSnapshot {
	var override model.ChannelDynamicOverride
	err := model.DB.
		Where("channel_id = ? AND "+modelCommonGroupColumn()+" = ? AND model = ? AND source = ? AND active = ?", channelID, group, modelName, source, true).
		Order("updated_at desc").
		First(&override).Error
	if err != nil {
		return nil
	}
	return &DynamicOverrideSnapshot{
		Active:       override.Active,
		BaseEnabled:  override.BaseEnabled,
		BasePriority: override.BasePriority,
		BaseWeight:   override.BaseWeight,
	}
}

func persistDynamicPlan(ability dynamicAbilityRow, sample dynamicStatusSample, plan DynamicAdjustmentPlan, dryRun bool) error {
	now := common.GetTimestamp()
	override := model.ChannelDynamicOverride{
		ChannelID:       ability.ChannelID,
		Group:           ability.Group,
		Model:           ability.Model,
		Provider:        sample.Provider,
		MonitorID:       firstNonEmpty(sample.MonitorID, fmt.Sprintf("%d:%s:%s", ability.ChannelID, ability.Group, ability.Model)),
		MonitorName:     firstNonEmpty(sample.MonitorName, ability.Model),
		Source:          sample.Source,
		State:           plan.State,
		BaseEnabled:     ability.Enabled,
		BasePriority:    cloneInt64Ptr(ability.Priority),
		BaseWeight:      ability.Weight,
		AppliedEnabled:  plan.AppliedEnabled,
		AppliedPriority: cloneInt64Ptr(plan.AppliedPriority),
		AppliedWeight:   plan.AppliedWeight,
		DryRun:          dryRun,
		Active:          plan.Action != DynamicActionRestoreBaseline,
		LastReason:      plan.Reason,
		UpdatedAt:       now,
		CreatedAt:       now,
	}
	if err := model.UpsertChannelDynamicOverride(override); err != nil {
		return err
	}

	log := model.ChannelDynamicAdjustmentLog{
		ChannelID:      ability.ChannelID,
		Group:          ability.Group,
		Model:          ability.Model,
		Provider:       sample.Provider,
		Source:         sample.Source,
		State:          plan.State,
		Action:         plan.Action,
		DryRun:         dryRun,
		Protected:      plan.Protected,
		Reason:         firstNonEmpty(plan.Reason, sample.Reason),
		BeforeEnabled:  ability.Enabled,
		BeforePriority: cloneInt64Ptr(ability.Priority),
		BeforeWeight:   ability.Weight,
		AfterEnabled:   plan.AppliedEnabled,
		AfterPriority:  cloneInt64Ptr(plan.AppliedPriority),
		AfterWeight:    plan.AppliedWeight,
		CreatedAt:      now,
	}
	return model.CreateChannelDynamicAdjustmentLog(log)
}

func applyDynamicPlan(ability dynamicAbilityRow, plan DynamicAdjustmentPlan) (bool, error) {
	if plan.Protected {
		return false, nil
	}
	updates := map[string]any{
		"enabled":  plan.AppliedEnabled,
		"priority": plan.AppliedPriority,
		"weight":   plan.AppliedWeight,
	}
	err := model.DB.Model(&model.Ability{}).
		Where("channel_id = ? AND "+modelCommonGroupColumn()+" = ? AND model = ?", ability.ChannelID, ability.Group, ability.Model).
		Updates(updates).Error
	return err == nil, err
}

func channelStatusStateFromAbilities(abilities []dynamicAbilityRow) map[int][]string {
	states := make(map[int][]string)
	for _, ability := range abilities {
		states[ability.ChannelID] = append(states[ability.ChannelID], DynamicHealthUnknown)
	}
	return states
}

func appendDynamicState(states map[int][]string, channelID int, state string) {
	states[channelID] = append(states[channelID], state)
}

func buildChannelStatusAdjustmentPlanFromStates(channel *model.Channel, dryRun bool, states []string, recovered bool) ChannelStatusAdjustmentPlan {
	return buildChannelStatusAdjustmentPlan(channel, dryRun, states, recovered)
}

func dynamicPolicyFromSetting(setting *operation_setting.ChannelDynamicAdjustmentSetting) DynamicAdjustmentPolicy {
	return DynamicAdjustmentPolicy{
		DegradedWeightMultiplier:       setting.DegradedWeightMultiplier,
		ProtectedUnhealthyMultiplier:   setting.ProtectedUnhealthyMultiplier,
		PriorityDowngradeLatencyMS:     setting.PriorityDowngradeLatencyMS,
		MinimumWeight:                  1,
		LastAvailableProtectionEnabled: setting.LastAvailableProtectionEnabled,
	}
}

func dynamicTargetKey(channelID int, group string, modelName string) string {
	return fmt.Sprintf("%d\x00%s\x00%s", channelID, group, modelName)
}

func abilityGroupModelKey(group string, modelName string) string {
	return group + "\x00" + modelName
}

func modelCommonGroupColumn() string {
	if common.UsingPostgreSQL {
		return `"group"`
	}
	return "`group`"
}
