package model

import (
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

type ChannelCandidateFilter func(channel *Channel, abilityModels map[string]bool) bool

func GetRandomSatisfiedChannelForModels(
	group string,
	modelNames []string,
	retry int,
	requestPath string,
	requestModel string,
	filter ChannelCandidateFilter,
) (*Channel, error) {
	if !common.MemoryCacheEnabled {
		return getChannelForModels(group, modelNames, retry, requestPath, requestModel, filter)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	matchedModels := make(map[int]map[string]bool)
	for _, modelName := range normalizedCandidateModels(modelNames) {
		for _, channelID := range group2model2channels[group][modelName] {
			models := matchedModels[channelID]
			if models == nil {
				models = make(map[string]bool)
				matchedModels[channelID] = models
			}
			models[modelName] = true
		}
	}

	candidates := make([]*Channel, 0, len(matchedModels))
	for channelID, abilityModels := range matchedModels {
		channel, ok := channelsIDM[channelID]
		if !ok {
			return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channelID)
		}
		if !candidateSupportsRequest(channel, requestPath, requestModel) {
			continue
		}
		if filter != nil && !filter(channel, abilityModels) {
			continue
		}
		candidates = append(candidates, channel)
	}
	return chooseChannelCandidate(candidates, retry)
}

func getChannelForModels(
	group string,
	modelNames []string,
	retry int,
	requestPath string,
	requestModel string,
	filter ChannelCandidateFilter,
) (*Channel, error) {
	names := normalizedCandidateModels(modelNames)
	if len(names) == 0 {
		return nil, nil
	}

	var abilities []Ability
	if err := DB.Where(commonGroupCol+" = ? and model IN ? and enabled = ?", group, names, true).Find(&abilities).Error; err != nil {
		return nil, err
	}
	if len(abilities) == 0 {
		return nil, nil
	}

	matchedModels := make(map[int]map[string]bool)
	channelIDs := make([]int, 0, len(abilities))
	for _, ability := range abilities {
		models := matchedModels[ability.ChannelId]
		if models == nil {
			models = make(map[string]bool)
			matchedModels[ability.ChannelId] = models
			channelIDs = append(channelIDs, ability.ChannelId)
		}
		models[ability.Model] = true
	}

	var channels []*Channel
	if err := DB.Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
		return nil, err
	}
	candidates := make([]*Channel, 0, len(channels))
	for _, channel := range channels {
		if !candidateSupportsRequest(channel, requestPath, requestModel) {
			continue
		}
		if filter != nil && !filter(channel, matchedModels[channel.Id]) {
			continue
		}
		candidates = append(candidates, channel)
	}
	return chooseChannelCandidate(candidates, retry)
}

func normalizedCandidateModels(modelNames []string) []string {
	seen := make(map[string]struct{}, len(modelNames)*2)
	names := make([]string, 0, len(modelNames)*2)
	for _, modelName := range modelNames {
		if modelName == "" {
			continue
		}
		if _, ok := seen[modelName]; !ok {
			seen[modelName] = struct{}{}
			names = append(names, modelName)
		}
		normalized := ratio_setting.FormatMatchingModelName(modelName)
		if normalized != "" {
			if _, ok := seen[normalized]; !ok {
				seen[normalized] = struct{}{}
				names = append(names, normalized)
			}
		}
	}
	return names
}

func candidateSupportsRequest(channel *Channel, requestPath string, requestModel string) bool {
	if channel == nil {
		return false
	}
	if requestPath == "" || channel.Type != constant.ChannelTypeAdvancedCustom {
		return true
	}
	config := channel.GetOtherSettings().AdvancedCustom
	return config != nil && config.SupportsPathForModel(requestPath, requestModel)
}

func chooseChannelCandidate(candidates []*Channel, retry int) (*Channel, error) {
	if len(candidates) == 0 {
		return nil, nil
	}
	if len(candidates) == 1 {
		return candidates[0], nil
	}

	prioritySet := make(map[int64]struct{})
	for _, channel := range candidates {
		prioritySet[channel.GetPriority()] = struct{}{}
	}
	priorities := make([]int64, 0, len(prioritySet))
	for priority := range prioritySet {
		priorities = append(priorities, priority)
	}
	sort.Slice(priorities, func(i, j int) bool { return priorities[i] > priorities[j] })
	if retry >= len(priorities) {
		retry = len(priorities) - 1
	}
	if retry < 0 {
		retry = 0
	}
	targetPriority := priorities[retry]

	weighted := make([]*Channel, 0, len(candidates))
	sumWeight := 0
	for _, channel := range candidates {
		if channel.GetPriority() != targetPriority {
			continue
		}
		weighted = append(weighted, channel)
		sumWeight += channel.GetWeight()
	}
	if len(weighted) == 0 {
		return nil, fmt.Errorf("no channel found at priority %d", targetPriority)
	}

	smoothingFactor := 1
	smoothingAdjustment := 0
	if sumWeight == 0 {
		sumWeight = len(weighted) * 100
		smoothingAdjustment = 100
	} else if sumWeight/len(weighted) < 10 {
		smoothingFactor = 100
	}
	totalWeight := sumWeight * smoothingFactor
	weight := common.GetRandomInt(totalWeight)
	for _, channel := range weighted {
		weight -= channel.GetWeight()*smoothingFactor + smoothingAdjustment
		if weight < 0 {
			return channel, nil
		}
	}
	return weighted[len(weighted)-1], nil
}
