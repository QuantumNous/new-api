package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func IsChannelEnabledForGroupModel(group string, modelName string, channelID int) bool {
	if group == "" || modelName == "" || channelID <= 0 {
		return false
	}
	if !common.MemoryCacheEnabled {
		return isChannelEnabledForGroupModelDB(group, modelName, channelID)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	if group2model2channels == nil {
		return false
	}

	if isChannelIDInList(group2model2channels[group][modelName], channelID) {
		return true
	}
	normalized := ratio_setting.FormatMatchingModelName(modelName)
	if normalized != "" && normalized != modelName {
		return isChannelIDInList(group2model2channels[group][normalized], channelID)
	}
	return false
}

func IsChannelEnabledForAnyGroupModel(groups []string, modelName string, channelID int) bool {
	if len(groups) == 0 {
		return false
	}
	for _, g := range groups {
		if IsChannelEnabledForGroupModel(g, modelName, channelID) {
			return true
		}
	}
	return false
}

func HasResponsesBootstrapRecoveryEnabledChannel(groups []string, modelName string) bool {
	if len(groups) == 0 || modelName == "" {
		return false
	}
	normalized := ratio_setting.FormatMatchingModelName(modelName)
	if !common.MemoryCacheEnabled {
		return hasResponsesBootstrapRecoveryEnabledChannelDB(groups, modelName, normalized)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	for _, channel := range channelsIDM {
		if !channel.GetOtherSettings().ResponsesStreamBootstrapRecoveryEnabled {
			continue
		}
		if !channelMatchesAnyGroup(channel, groups) {
			continue
		}
		if channelSupportsModel(channel, modelName, normalized) {
			return true
		}
	}
	return false
}

func isChannelEnabledForGroupModelDB(group string, modelName string, channelID int) bool {
	var count int64
	err := DB.Model(&Ability{}).
		Where(commonGroupCol+" = ? and model = ? and channel_id = ? and enabled = ?", group, modelName, channelID, true).
		Count(&count).Error
	if err == nil && count > 0 {
		return true
	}
	normalized := ratio_setting.FormatMatchingModelName(modelName)
	if normalized == "" || normalized == modelName {
		return false
	}
	count = 0
	err = DB.Model(&Ability{}).
		Where(commonGroupCol+" = ? and model = ? and channel_id = ? and enabled = ?", group, normalized, channelID, true).
		Count(&count).Error
	return err == nil && count > 0
}

func hasResponsesBootstrapRecoveryEnabledChannelDB(groups []string, modelName string, normalized string) bool {
	var channels []*Channel
	if err := DB.Find(&channels).Error; err != nil {
		return false
	}
	for _, channel := range channels {
		if !channel.GetOtherSettings().ResponsesStreamBootstrapRecoveryEnabled {
			continue
		}
		if !channelMatchesAnyGroup(channel, groups) {
			continue
		}
		if channelSupportsModel(channel, modelName, normalized) {
			return true
		}
	}
	return false
}

func channelMatchesAnyGroup(channel *Channel, groups []string) bool {
	for _, group := range channel.GetGroups() {
		for _, candidate := range groups {
			if strings.TrimSpace(group) == strings.TrimSpace(candidate) {
				return true
			}
		}
	}
	return false
}

func channelSupportsModel(channel *Channel, modelName string, normalized string) bool {
	for _, model := range channel.GetModels() {
		trimmed := strings.TrimSpace(model)
		if trimmed == modelName {
			return true
		}
		if normalized != "" && normalized != modelName && trimmed == normalized {
			return true
		}
	}
	return false
}

func isChannelIDInList(list []int, channelID int) bool {
	for _, id := range list {
		if id == channelID {
			return true
		}
	}
	return false
}
