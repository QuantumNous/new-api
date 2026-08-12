package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// ResolveTaskFailoverChannelIDs returns ordered enabled channel IDs for group+model.
// If TaskModelChannelOrder[model] is non-empty, that order is used (missing/disabled skipped).
// Otherwise Ability channels sorted by Priority desc (from ListSatisfiedChannelIDs).
func ResolveTaskFailoverChannelIDs(group, modelName string) []int {
	override := operation_setting.GetTaskModelChannelOrder(modelName)
	available := model.ListSatisfiedChannelIDs(group, modelName)
	availableSet := make(map[int]bool, len(available))
	for _, id := range available {
		availableSet[id] = true
	}

	if len(override) > 0 {
		out := make([]int, 0, len(override))
		seen := map[int]bool{}
		for _, id := range override {
			if id <= 0 || seen[id] || !availableSet[id] {
				continue
			}
			if !isChannelEnabledForFailover(id) {
				continue
			}
			seen[id] = true
			out = append(out, id)
		}
		return out
	}

	out := make([]int, 0, len(available))
	for _, id := range available {
		if !isChannelEnabledForFailover(id) {
			continue
		}
		out = append(out, id)
	}
	return out
}

func isChannelEnabledForFailover(id int) bool {
	ch, err := model.CacheGetChannel(id)
	if err != nil || ch == nil {
		return false
	}
	return ch.Status == common.ChannelStatusEnabled
}

// FilterTriedChannelIDs returns ordered IDs excluding those in tried.
func FilterTriedChannelIDs(ordered []int, tried []int) []int {
	triedSet := make(map[int]bool, len(tried))
	for _, id := range tried {
		triedSet[id] = true
	}
	out := make([]int, 0, len(ordered))
	for _, id := range ordered {
		if triedSet[id] {
			continue
		}
		out = append(out, id)
	}
	return out
}

// PickNextFailoverChannel returns the next channel after afterChannelID in ordered,
// skipping tried IDs. If afterChannelID is 0, returns the first non-tried.
func PickNextFailoverChannel(ordered []int, tried []int, afterChannelID int) (*model.Channel, bool) {
	triedSet := make(map[int]bool, len(tried))
	for _, id := range tried {
		triedSet[id] = true
	}

	start := 0
	if afterChannelID > 0 {
		for i, id := range ordered {
			if id == afterChannelID {
				start = i + 1
				break
			}
		}
	}

	for i := start; i < len(ordered); i++ {
		id := ordered[i]
		if triedSet[id] {
			continue
		}
		ch, err := model.CacheGetChannel(id)
		if err != nil || ch == nil || ch.Status != common.ChannelStatusEnabled {
			continue
		}
		return ch, true
	}
	return nil, false
}

// ChannelIndexInOrder returns 1-based index of channelID in ordered, or 0 if missing.
func ChannelIndexInOrder(ordered []int, channelID int) int {
	for i, id := range ordered {
		if id == channelID {
			return i + 1
		}
	}
	return 0
}
