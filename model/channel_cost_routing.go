package model

import (
	"math/big"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
)

// ChannelSelectionOptions carries request-specific facts that refine the
// existing filter, priority, and weight selection policy.
type ChannelSelectionOptions struct {
	Filters              []dto.ChannelFilter
	VideoDurationSeconds int
	ExcludedChannelIDs   map[int]struct{}
}

func excludePreviouslyTriedChannels(channels []*Channel, excluded map[int]struct{}) []*Channel {
	if len(channels) < 2 || len(excluded) == 0 {
		return channels
	}
	remaining := make([]*Channel, 0, len(channels))
	for _, channel := range channels {
		if channel == nil {
			continue
		}
		if _, tried := excluded[channel.Id]; !tried {
			remaining = append(remaining, channel)
		}
	}
	if len(remaining) == 0 {
		return channels
	}
	return remaining
}

func excludePreviouslyTriedAbilities(abilities []Ability, excluded map[int]struct{}) []Ability {
	if len(abilities) < 2 || len(excluded) == 0 {
		return abilities
	}
	remaining := make([]Ability, 0, len(abilities))
	for _, ability := range abilities {
		if _, tried := excluded[ability.ChannelId]; !tried {
			remaining = append(remaining, ability)
		}
	}
	if len(remaining) == 0 {
		return abilities
	}
	return remaining
}

// lowestVideoCostChannelIDs returns every channel tied for the lowest
// estimated supplier cost. It applies only when every candidate has a valid
// policy in the same currency, so an unknown cost is never treated as zero.
func lowestVideoCostChannelIDs(channels []*Channel, durationSeconds int) (map[int]struct{}, bool) {
	if durationSeconds <= 0 || len(channels) < 2 {
		return nil, false
	}

	currency := ""
	var minimumCost *big.Rat
	lowestIDs := make(map[int]struct{}, len(channels))

	for _, channel := range channels {
		if channel == nil || strings.TrimSpace(channel.OtherSettings) == "" {
			return nil, false
		}
		settings := kitdto.ChannelOtherSettings{}
		if err := common.UnmarshalJsonStr(channel.OtherSettings, &settings); err != nil || settings.VideoSupplierCost == nil {
			return nil, false
		}
		policyCurrency := strings.ToUpper(strings.TrimSpace(settings.VideoSupplierCost.Currency))
		if currency == "" {
			currency = policyCurrency
		} else if policyCurrency != currency {
			return nil, false
		}
		estimated, err := settings.VideoSupplierCost.Estimate(durationSeconds)
		if err != nil {
			return nil, false
		}
		if minimumCost == nil || estimated.Cmp(minimumCost) < 0 {
			minimumCost = estimated
			lowestIDs = map[int]struct{}{channel.Id: {}}
			continue
		}
		if estimated.Cmp(minimumCost) == 0 {
			lowestIDs[channel.Id] = struct{}{}
		}
	}

	return lowestIDs, true
}

func keepLowestVideoCostChannels(channels []*Channel, durationSeconds int) []*Channel {
	lowestIDs, applied := lowestVideoCostChannelIDs(channels, durationSeconds)
	if !applied {
		return channels
	}
	lowest := make([]*Channel, 0, len(lowestIDs))
	for _, channel := range channels {
		if _, ok := lowestIDs[channel.Id]; ok {
			lowest = append(lowest, channel)
		}
	}
	return lowest
}

func keepLowestVideoCostAbilities(abilities []Ability, durationSeconds int) []Ability {
	if durationSeconds <= 0 || len(abilities) < 2 {
		return abilities
	}
	channelIDs := make([]int, 0, len(abilities))
	for _, ability := range abilities {
		channelIDs = append(channelIDs, ability.ChannelId)
	}
	var channels []*Channel
	if err := DB.Where("id IN ?", channelIDs).Find(&channels).Error; err != nil || len(channels) != len(channelIDs) {
		return abilities
	}
	lowestIDs, applied := lowestVideoCostChannelIDs(channels, durationSeconds)
	if !applied {
		return abilities
	}
	lowest := make([]Ability, 0, len(lowestIDs))
	for _, ability := range abilities {
		if _, ok := lowestIDs[ability.ChannelId]; ok {
			lowest = append(lowest, ability)
		}
	}
	return lowest
}
