package model

import (
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// GetSatisfiedChannels returns every enabled channel bound to a group/model.
// Unlike the normal selector it does not apply channel priority or weight: a
// caller that needs capability-based routing must see the complete candidate
// set before it makes its own deterministic decision.
func GetSatisfiedChannels(group string, modelName string) ([]*Channel, error) {
	if common.MemoryCacheEnabled {
		channelSyncLock.RLock()
		defer channelSyncLock.RUnlock()
		ids := group2model2channels[group][modelName]
		if len(ids) == 0 {
			ids = group2model2channels[group][ratio_setting.FormatMatchingModelName(modelName)]
		}
		channels := make([]*Channel, 0, len(ids))
		for _, id := range ids {
			channel, ok := channelsIDM[id]
			if !ok {
				return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", id)
			}
			channels = append(channels, channel)
		}
		return channels, nil
	}

	var abilities []Ability
	if err := DB.Where(commonGroupCol+" = ? and model = ? and enabled = ?", group, modelName, true).
		Order("priority DESC").Order("weight DESC").Find(&abilities).Error; err != nil {
		return nil, err
	}
	channels := make([]*Channel, 0, len(abilities))
	seen := make(map[int]struct{}, len(abilities))
	for _, ability := range abilities {
		if _, exists := seen[ability.ChannelId]; exists {
			continue
		}
		var channel Channel
		if err := DB.Where("id = ? and status = ?", ability.ChannelId, common.ChannelStatusEnabled).First(&channel).Error; err != nil {
			continue
		}
		seen[channel.Id] = struct{}{}
		channels = append(channels, &channel)
	}
	// Keep a stable fallback order for callers that do not use every field.
	sort.SliceStable(channels, func(i, j int) bool { return channels[i].Id < channels[j].Id })
	return channels, nil
}
