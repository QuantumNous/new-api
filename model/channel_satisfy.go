package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// IsChannelEnabledForGroupModel reports whether a channel is enabled for a group/model pair.
func IsChannelEnabledForGroupModel(group string, modelName string, channelID int) bool {
	if group == "" || modelName == "" || channelID <= 0 {
		return false
	}
	if !common.MemoryCacheEnabled {
		return isChannelEnabledForGroupModelDB(group, modelName, channelID)
	}

	channelSyncLock.RLock()
	if group2model2channels == nil {
		channelSyncLock.RUnlock()
		return isChannelEnabledForGroupModelDB(group, modelName, channelID)
	}

	if isChannelIDInList(group2model2channels[group][modelName], channelID) {
		channelSyncLock.RUnlock()
		return true
	}
	normalized := ratio_setting.FormatMatchingModelName(modelName)
	if normalized != "" && normalized != modelName {
		if isChannelIDInList(group2model2channels[group][normalized], channelID) {
			channelSyncLock.RUnlock()
			return true
		}
	}
	channelSyncLock.RUnlock()
	return isChannelEnabledForGroupModelDB(group, modelName, channelID)
}

// IsChannelEnabledForAnyGroupModel reports whether a channel is enabled for any group/model pair.
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

func isChannelEnabledForGroupModelDB(group string, modelName string, channelID int) bool {
	var count int64
	groupColumn := "abilities." + commonGroupCol
	err := DB.Model(&Ability{}).
		Joins("JOIN channels ON channels.id = abilities.channel_id").
		Where(groupColumn+" = ? and abilities.model = ? and abilities.channel_id = ? and abilities.enabled = ? and channels.status = ?", group, modelName, channelID, true, common.ChannelStatusEnabled).
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
		Joins("JOIN channels ON channels.id = abilities.channel_id").
		Where(groupColumn+" = ? and abilities.model = ? and abilities.channel_id = ? and abilities.enabled = ? and channels.status = ?", group, normalized, channelID, true, common.ChannelStatusEnabled).
		Count(&count).Error
	return err == nil && count > 0
}

func isChannelIDInList(list []int, channelID int) bool {
	for _, id := range list {
		if id == channelID {
			return true
		}
	}
	return false
}
