package controller

import (
	"context"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

const channelMonitorRatioEpsilon = 1e-9

type channelMonitorPolicyPlan struct {
	GroupRatioUpdates map[string]float64
	DisableChannelIds []int
	SkippedGroupCount int
}

type channelMonitorPolicyInput struct {
	UpstreamRatio          float64
	SingleChannelAction    string
	MultipleChannelsAction string
}

type channelMonitorPolicyMember struct {
	ChannelId              int
	Target                 float64
	SingleChannelAction    string
	MultipleChannelsAction string
}

type channelMonitorPolicyGroup struct {
	Name         string
	CurrentRatio float64
	Coefficient  float64
	ChannelIds   []int
}

func collectChannelMonitorPolicyMembers(
	group channelMonitorPolicyGroup,
	policyInputs map[int]channelMonitorPolicyInput,
	disabledChannelIds map[int]struct{},
) ([]channelMonitorPolicyMember, bool) {
	members := make([]channelMonitorPolicyMember, 0, len(group.ChannelIds))
	for _, channelId := range group.ChannelIds {
		if _, disabled := disabledChannelIds[channelId]; disabled {
			continue
		}
		input, exists := policyInputs[channelId]
		if !exists {
			return nil, false
		}
		target := input.UpstreamRatio * group.Coefficient
		if !validateChannelMonitorRatio(&target) {
			return nil, false
		}
		members = append(members, channelMonitorPolicyMember{
			ChannelId:              channelId,
			Target:                 target,
			SingleChannelAction:    normalizeChannelMonitorPolicyAction(input.SingleChannelAction),
			MultipleChannelsAction: normalizeChannelMonitorPolicyAction(input.MultipleChannelsAction),
		})
	}
	return members, true
}

func planChannelMonitorPolicyActions(
	channels []*model.Channel,
	policyInputs map[int]channelMonitorPolicyInput,
	groupRatios map[string]float64,
	coefficients map[string]float64,
) channelMonitorPolicyPlan {
	plan := channelMonitorPolicyPlan{GroupRatioUpdates: make(map[string]float64)}
	hasPolicy := false
	for _, input := range policyInputs {
		if normalizeChannelMonitorPolicyAction(input.SingleChannelAction) != channelMonitorPolicyActionNone ||
			normalizeChannelMonitorPolicyAction(input.MultipleChannelsAction) != channelMonitorPolicyActionNone {
			hasPolicy = true
			break
		}
	}
	if !hasPolicy {
		return plan
	}

	channelIdsByGroup := make(map[string][]int)
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		for _, group := range channel.GetGroups() {
			if group != "" {
				channelIdsByGroup[group] = append(channelIdsByGroup[group], channel.Id)
			}
		}
	}
	groupNames := make([]string, 0, len(channelIdsByGroup))
	for group := range channelIdsByGroup {
		groupNames = append(groupNames, group)
	}
	sort.Strings(groupNames)

	groups := make([]channelMonitorPolicyGroup, 0, len(groupNames))
	for _, group := range groupNames {
		currentRatio, exists := groupRatios[group]
		if !exists {
			currentRatio = 1
		}
		if !validateChannelMonitorRatio(&currentRatio) {
			plan.SkippedGroupCount++
			continue
		}
		groups = append(groups, channelMonitorPolicyGroup{
			Name:         group,
			CurrentRatio: currentRatio,
			Coefficient:  getChannelMonitorGroupCoefficient(coefficients, group),
			ChannelIds:   channelIdsByGroup[group],
		})
	}

	disableChannelIds := make(map[int]struct{})
	for {
		nextDisableChannelIds := make(map[int]struct{})
		for _, group := range groups {
			members, complete := collectChannelMonitorPolicyMembers(group, policyInputs, disableChannelIds)
			if !complete || len(members) == 0 {
				continue
			}
			if len(members) == 1 {
				member := members[0]
				if member.Target-group.CurrentRatio > channelMonitorRatioEpsilon &&
					member.SingleChannelAction == channelMonitorPolicyActionDisableChannel {
					nextDisableChannelIds[member.ChannelId] = struct{}{}
				}
				continue
			}
			for _, member := range members {
				if member.Target-group.CurrentRatio > channelMonitorRatioEpsilon &&
					member.MultipleChannelsAction == channelMonitorPolicyActionDisableChannel {
					nextDisableChannelIds[member.ChannelId] = struct{}{}
				}
			}
		}
		if len(nextDisableChannelIds) == 0 {
			break
		}
		for channelId := range nextDisableChannelIds {
			disableChannelIds[channelId] = struct{}{}
		}
	}

	for _, group := range groups {
		members, complete := collectChannelMonitorPolicyMembers(group, policyInputs, disableChannelIds)
		if !complete {
			plan.SkippedGroupCount++
			continue
		}
		switch len(members) {
		case 0:
		case 1:
			member := members[0]
			if member.Target-group.CurrentRatio > channelMonitorRatioEpsilon &&
				member.SingleChannelAction == channelMonitorPolicyActionUpdateGroupRatio {
				plan.GroupRatioUpdates[group.Name] = member.Target
			}
		default:
			for _, member := range members {
				if member.Target-group.CurrentRatio <= channelMonitorRatioEpsilon ||
					member.MultipleChannelsAction != channelMonitorPolicyActionUpdateGroupRatio {
					continue
				}
				if currentTarget, exists := plan.GroupRatioUpdates[group.Name]; !exists || member.Target > currentTarget {
					plan.GroupRatioUpdates[group.Name] = member.Target
				}
			}
		}
	}

	plan.DisableChannelIds = make([]int, 0, len(disableChannelIds))
	for channelId := range disableChannelIds {
		plan.DisableChannelIds = append(plan.DisableChannelIds, channelId)
	}
	sort.Ints(plan.DisableChannelIds)
	return plan
}

func applyChannelMonitorPolicyPlan(ctx context.Context, plan channelMonitorPolicyPlan) (groupsUpdated int, channelsDisabled int, groupUpdateFailed bool, err error) {
	if len(plan.GroupRatioUpdates) > 0 {
		groupRatios := ratio_setting.GetGroupRatioCopy()
		for group, targetRatio := range plan.GroupRatioUpdates {
			currentRatio, exists := groupRatios[group]
			if !exists {
				currentRatio = 1
			}
			if targetRatio-currentRatio <= channelMonitorRatioEpsilon {
				continue
			}
			groupRatios[group] = targetRatio
			groupsUpdated++
		}
		if groupsUpdated > 0 {
			groupRatioBytes, marshalErr := common.Marshal(groupRatios)
			if marshalErr != nil {
				return 0, 0, true, marshalErr
			}
			if updateErr := model.UpdateOptionsBulk(map[string]string{"GroupRatio": string(groupRatioBytes)}); updateErr != nil {
				return 0, 0, true, updateErr
			}
		}
	}

	for _, channelId := range plan.DisableChannelIds {
		if ctx != nil && ctx.Err() != nil {
			return groupsUpdated, channelsDisabled, false, ctx.Err()
		}
		if model.UpdateChannelStatus(channelId, "", common.ChannelStatusAutoDisabled, "渠道监控：上游倍率高于分组倍率") {
			channelsDisabled++
		}
	}
	if channelsDisabled > 0 {
		model.InitChannelCache()
		service.ResetProxyClientCache()
	}
	return groupsUpdated, channelsDisabled, false, nil
}
