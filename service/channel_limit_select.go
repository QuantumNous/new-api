package service

import (
	"errors"
	"fmt"
	"math"
	"math/rand"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func leastLoadedChannels(channels []*model.Channel) []*model.Channel {
	minimumUsed := math.MaxInt
	leastLoaded := make([]*model.Channel, 0, len(channels))
	for _, channel := range channels {
		lim := GetChannelLimits(channel)
		used, _ := GetConcurrencyStatus(channelGateKey(channel.Id, -1))
		if lim.Enabled && lim.MaxConcurrency > 0 && used >= lim.MaxConcurrency {
			continue
		}
		if used < minimumUsed {
			minimumUsed = used
			leastLoaded = leastLoaded[:0]
		}
		if used == minimumUsed {
			leastLoaded = append(leastLoaded, channel)
		}
	}
	return leastLoaded
}

// GateHandle tracks the semaphore slots acquired for one request so they can be
// released together when the request completes (success or failure).
type GateHandle struct {
	GateKeys []string
}

// Release frees every acquired semaphore slot.
func (h *GateHandle) Release() {
	if h == nil {
		return
	}
	for _, key := range h.GateKeys {
		ReleaseConcurrency(key)
	}
	h.GateKeys = nil
}

func (h *GateHandle) acquire(key string, max int) bool {
	if !TryAcquireConcurrency(key, max) {
		return false
	}
	h.GateKeys = append(h.GateKeys, key)
	return true
}

// channelGateKey builds the semaphore key. keyIdx<0 means per-channel.
func channelGateKey(channelID, keyIdx int) string {
	if keyIdx < 0 {
		return fmt.Sprintf("channel:%d", channelID)
	}
	return fmt.Sprintf("channel:%d:key:%d", channelID, keyIdx)
}

// evaluateChannelForLimits atomically acquires the requested channel slot.
// It returns true when the gate is full and adds the channel to excluded.
func evaluateChannelForLimits(channelID, keyIdx int, lim ChannelLimits, excluded map[int]bool) bool {
	if !lim.Enabled || lim.MaxConcurrency <= 0 {
		return false
	}
	if !TryAcquireConcurrency(channelGateKey(channelID, keyIdx), lim.MaxConcurrency) {
		excluded[channelID] = true
		return true
	}
	return false
}

func selectHealthyKey(channel *model.Channel, lim ChannelLimits) (int, bool) {
	keys := channel.GetKeys()
	excluded := map[int]bool{}
	for attempt := 0; attempt < len(keys); attempt++ {
		_, idx, err := channel.GetNextEnabledKey(excluded)
		if err != nil {
			return 0, false
		}
		if lim.MaxConcurrency > 0 && !TryAcquireConcurrency(channelGateKey(channel.Id, idx), lim.MaxConcurrency) {
			excluded[idx] = true
			continue
		}
		ReleaseConcurrency(channelGateKey(channel.Id, idx))
		return idx, true
	}
	return 0, false
}

// SelectChannelWithLimits chooses the least-loaded eligible channel in the
// selected priority tier and atomically acquires its concurrency slots. When a
// whole tier is full it falls through to the next lower priority.
func SelectChannelWithLimits(param *RetryParam) (*model.Channel, string, *GateHandle, error) {
	excluded := make(map[int]bool, len(param.ExcludeIDs))
	for _, id := range param.ExcludeIDs {
		excluded[id] = true
	}
	handle := &GateHandle{}

	groups := []string{param.TokenGroup}
	if param.TokenGroup == "auto" {
		userGroup := common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup)
		groups = GetUserAutoGroup(userGroup)
		if len(groups) == 0 {
			return nil, param.TokenGroup, handle, errors.New("auto groups is not enabled")
		}
	}

	for _, selectGroup := range groups {
		param.ExcludeIDs = mapKeys(excluded)
		candidates, err := model.GetSatisfiedChannels(selectGroup, param.ModelName, param.RequestPath, param.ExcludeIDs)
		if err != nil {
			return nil, selectGroup, handle, err
		}
		if len(candidates) == 0 {
			continue
		}

		priorityTiers := make([][]*model.Channel, 0)
		for _, candidate := range candidates {
			if len(priorityTiers) == 0 || priorityTiers[len(priorityTiers)-1][0].GetPriority() != candidate.GetPriority() {
				priorityTiers = append(priorityTiers, []*model.Channel{candidate})
				continue
			}
			priorityTiers[len(priorityTiers)-1] = append(priorityTiers[len(priorityTiers)-1], candidate)
		}

		startPriority := param.GetRetry()
		if startPriority >= len(priorityTiers) {
			startPriority = len(priorityTiers) - 1
		}
		for priorityIndex := startPriority; priorityIndex < len(priorityTiers); priorityIndex++ {
			tier := priorityTiers[priorityIndex]
			for len(tier) > 0 {
				leastLoaded := leastLoadedChannels(tier)
				if len(leastLoaded) == 0 {
					break
				}

				channel := leastLoaded[rand.Intn(len(leastLoaded))]
				lim := GetChannelLimits(channel)
				if evaluateChannelForLimits(channel.Id, -1, lim, excluded) {
					tier = excludeChannels(tier, channel.Id)
					continue
				}

				if channel.ChannelInfo.IsMultiKey && lim.Enabled {
					keyIdx, ok := selectHealthyKey(channel, lim)
					if !ok {
						if lim.MaxConcurrency > 0 {
							ReleaseConcurrency(channelGateKey(channel.Id, -1))
						}
						excluded[channel.Id] = true
						tier = excludeChannels(tier, channel.Id)
						continue
					}
					common.SetContextKey(param.Ctx, constant.ContextKeyChannelPreSelectedKeyIdx, keyIdx)
					if lim.MaxConcurrency > 0 {
						keyGate := channelGateKey(channel.Id, keyIdx)
						if !handle.acquire(keyGate, lim.MaxConcurrency) {
							ReleaseConcurrency(channelGateKey(channel.Id, -1))
							excluded[channel.Id] = true
							tier = excludeChannels(tier, channel.Id)
							common.SetContextKey(param.Ctx, constant.ContextKeyChannelPreSelectedKeyIdx, nil)
							continue
						}
					}
				}
				if lim.Enabled && lim.MaxConcurrency > 0 {
					handle.GateKeys = append(handle.GateKeys, channelGateKey(channel.Id, -1))
				}
				if param.TokenGroup == "auto" {
					common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, selectGroup)
				}
				param.ExcludeIDs = mapKeys(excluded)
				return channel, selectGroup, handle, nil
			}
		}
	}
	return nil, param.TokenGroup, handle, nil
}

func excludeChannels(channels []*model.Channel, channelID int) []*model.Channel {
	filtered := make([]*model.Channel, 0, len(channels)-1)
	for _, channel := range channels {
		if channel.Id != channelID {
			filtered = append(filtered, channel)
		}
	}
	return filtered
}

func mapKeys(m map[int]bool) []int {
	out := make([]int, 0, len(m))
	for key := range m {
		out = append(out, key)
	}
	return out
}
