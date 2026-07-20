package model

import "gorm.io/gorm"

// ChannelSelectionOptions carries request-scoped channel exclusions without
// changing the existing selector call sites.
type ChannelSelectionOptions struct {
	ExcludedChannelIds []int
}

func (options ChannelSelectionOptions) HasExcludedChannels() bool {
	return len(options.ExcludedChannelIds) > 0
}

func channelSelectionOptions(options []ChannelSelectionOptions) ChannelSelectionOptions {
	if len(options) == 0 {
		return ChannelSelectionOptions{}
	}
	return options[len(options)-1]
}

func filterChannelIDsBySelectionOptions(channelIDs []int, options ChannelSelectionOptions) []int {
	if len(channelIDs) == 0 || !options.HasExcludedChannels() {
		return channelIDs
	}
	excluded := make(map[int]struct{}, len(options.ExcludedChannelIds))
	for _, channelID := range options.ExcludedChannelIds {
		excluded[channelID] = struct{}{}
	}
	filtered := make([]int, 0, len(channelIDs))
	for _, channelID := range channelIDs {
		if _, ok := excluded[channelID]; !ok {
			filtered = append(filtered, channelID)
		}
	}
	return filtered
}

func applyChannelSelectionOptions(query *gorm.DB, options ChannelSelectionOptions) *gorm.DB {
	if query == nil || !options.HasExcludedChannels() {
		return query
	}
	return query.Where("channel_id NOT IN ?", options.ExcludedChannelIds)
}
