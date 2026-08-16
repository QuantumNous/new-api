package model

import (
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

var group2model2channels map[string]map[string][]int // enabled channel
var channelsIDM map[int]*Channel                     // all channels include disabled
// channel2advancedCustomConfig caches parsed Advanced Custom (type 58) configs so
// path-aware selection avoids re-parsing JSON per request. Refreshed on full sync.
var channel2advancedCustomConfig map[int]*dto.AdvancedCustomConfig
var channelSyncLock sync.RWMutex

// channelCacheGeneration prevents a full database snapshot from replacing a
// newer incremental cache publication that completed while the snapshot loaded.
var channelCacheGeneration uint64

func InitChannelCache() {
	if !common.MemoryCacheEnabled {
		InvalidatePricingCache()
		return
	}
	for {
		channelSyncLock.RLock()
		snapshotGeneration := channelCacheGeneration
		channelSyncLock.RUnlock()

		newChannelId2channel := make(map[int]*Channel)
		newChannel2advancedCustomConfig := make(map[int]*dto.AdvancedCustomConfig)
		var channels []*Channel
		if err := DB.Find(&channels).Error; err != nil {
			common.SysError(fmt.Sprintf("failed to load channels for cache sync: %v", err))
			return
		}
		for _, channel := range channels {
			newChannelId2channel[channel.Id] = channel
			if channel.Type == constant.ChannelTypeAdvancedCustom {
				if config := channel.GetOtherSettings().AdvancedCustom; config != nil {
					newChannel2advancedCustomConfig[channel.Id] = config
				}
			}
		}
		newGroup2model2channels := make(map[string]map[string][]int)
		for _, channel := range channels {
			if !channelIsRoutable(channel) {
				continue // skip disabled channels and multi-key channels without a usable key
			}
			groups := strings.Split(channel.Group, ",")
			for _, group := range groups {
				if _, ok := newGroup2model2channels[group]; !ok {
					newGroup2model2channels[group] = make(map[string][]int)
				}
				models := strings.Split(channel.Models, ",")
				for _, model := range models {
					if _, ok := newGroup2model2channels[group][model]; !ok {
						newGroup2model2channels[group][model] = make([]int, 0)
					}
					newGroup2model2channels[group][model] = append(newGroup2model2channels[group][model], channel.Id)
				}
			}
		}

		// sort by priority
		for group, model2channels := range newGroup2model2channels {
			for model, channels := range model2channels {
				sort.Slice(channels, func(i, j int) bool {
					return newChannelId2channel[channels[i]].GetPriority() > newChannelId2channel[channels[j]].GetPriority()
				})
				newGroup2model2channels[group][model] = channels
			}
		}

		channelSyncLock.Lock()
		if channelCacheGeneration != snapshotGeneration {
			channelSyncLock.Unlock()
			continue
		}
		group2model2channels = newGroup2model2channels
		//channelsIDM = newChannelId2channel
		for i, channel := range newChannelId2channel {
			if channel.ChannelInfo.IsMultiKey {
				channel.Keys = channel.GetKeys()
				if channel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling {
					if oldChannel, ok := channelsIDM[i]; ok {
						// 存在旧的渠道，如果是多key且轮询，保留轮询索引信息
						if oldChannel.ChannelInfo.IsMultiKey && oldChannel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling {
							channel.ChannelInfo.MultiKeyPollingIndex = oldChannel.ChannelInfo.MultiKeyPollingIndex
						}
					}
				}
			}
		}
		channelsIDM = newChannelId2channel
		channel2advancedCustomConfig = newChannel2advancedCustomConfig
		channelCacheGeneration++
		channelSyncLock.Unlock()
		break
	}
	// Lock ordering: InvalidatePricingCache acquires updatePricingLock, and
	// GetPricing (holding updatePricingLock) nests channelSyncLock.RLock via
	// loadPricingAdvancedCustomConfigs. channelSyncLock MUST be released before
	// invalidating the pricing cache, otherwise the reversed order deadlocks.
	InvalidatePricingCache()
	common.SysLog("channels synced from database")
}

func SyncChannelCache(frequency int) {
	for {
		time.Sleep(time.Duration(frequency) * time.Second)
		common.SysLog("syncing channels from database")
		InitChannelCache()
	}
}

func GetRandomSatisfiedChannel(group string, model string, retry int, requestPath string) (*Channel, error) {
	// if memory cache is disabled, get channel directly from database
	if !common.MemoryCacheEnabled {
		return GetChannel(group, model, retry, requestPath)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	// First, try to find channels with the exact model name.
	channels := filterChannelsByRequestPathAndModel(group2model2channels[group][model], requestPath, model)

	// If no channels found, try to find channels with the normalized model name.
	if len(channels) == 0 {
		normalizedModel := ratio_setting.FormatMatchingModelName(model)
		channels = filterChannelsByRequestPathAndModel(group2model2channels[group][normalizedModel], requestPath, model)
	}

	if len(channels) == 0 {
		return nil, nil
	}

	if len(channels) == 1 {
		if channel, ok := channelsIDM[channels[0]]; ok {
			return channel, nil
		}
		return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channels[0])
	}

	uniquePriorities := make(map[int]bool)
	for _, channelId := range channels {
		if channel, ok := channelsIDM[channelId]; ok {
			uniquePriorities[int(channel.GetPriority())] = true
		} else {
			return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channelId)
		}
	}
	var sortedUniquePriorities []int
	for priority := range uniquePriorities {
		sortedUniquePriorities = append(sortedUniquePriorities, priority)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(sortedUniquePriorities)))

	if retry >= len(uniquePriorities) {
		retry = len(uniquePriorities) - 1
	}
	targetPriority := int64(sortedUniquePriorities[retry])

	// get the priority for the given retry number
	var sumWeight = 0
	var targetChannels []*Channel
	for _, channelId := range channels {
		if channel, ok := channelsIDM[channelId]; ok {
			if channel.GetPriority() == targetPriority {
				sumWeight += channel.GetWeight()
				targetChannels = append(targetChannels, channel)
			}
		} else {
			return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channelId)
		}
	}

	if len(targetChannels) == 0 {
		return nil, errors.New(fmt.Sprintf("no channel found, group: %s, model: %s, priority: %d", group, model, targetPriority))
	}

	// smoothing factor and adjustment
	smoothingFactor := 1
	smoothingAdjustment := 0

	if sumWeight == 0 {
		// when all channels have weight 0, set sumWeight to the number of channels and set smoothing adjustment to 100
		// each channel's effective weight = 100
		sumWeight = len(targetChannels) * 100
		smoothingAdjustment = 100
	} else if sumWeight/len(targetChannels) < 10 {
		// when the average weight is less than 10, set smoothing factor to 100
		smoothingFactor = 100
	}

	// Calculate the total weight of all channels up to endIdx
	totalWeight := sumWeight * smoothingFactor

	// Generate a random value in the range [0, totalWeight)
	randomWeight := rand.Intn(totalWeight)

	// Find a channel based on its weight
	for _, channel := range targetChannels {
		randomWeight -= channel.GetWeight()*smoothingFactor + smoothingAdjustment
		if randomWeight < 0 {
			return channel, nil
		}
	}
	// return null if no channel is not found
	return nil, errors.New("channel not found")
}

// filterChannelsByRequestPathAndModel restricts candidates by request path and
// model. Only Advanced Custom (type 58) channels are path-checked: they are kept
// only when one of their configured routes matches requestPath and model. All
// other channel types always pass. When requestPath is empty, filtering is skipped.
// Caller must hold channelSyncLock (read lock). The cached slice is never mutated.
func filterChannelsByRequestPathAndModel(channels []int, requestPath string, model string) []int {
	if requestPath == "" || len(channels) == 0 {
		return channels
	}
	filtered := make([]int, 0, len(channels))
	for _, channelId := range channels {
		channel, ok := channelsIDM[channelId]
		if !ok {
			// keep it so the downstream consistency error is raised as before
			filtered = append(filtered, channelId)
			continue
		}
		if channel.Type != constant.ChannelTypeAdvancedCustom {
			filtered = append(filtered, channelId)
			continue
		}
		if config := channel2advancedCustomConfig[channelId]; config != nil && config.SupportsPathForModel(requestPath, model) {
			filtered = append(filtered, channelId)
		}
	}
	return filtered
}

func CacheGetChannel(id int) (*Channel, error) {
	if !common.MemoryCacheEnabled {
		return GetChannelById(id, true)
	}
	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	c, ok := channelsIDM[id]
	if !ok {
		return nil, fmt.Errorf("渠道# %d，已不存在", id)
	}
	return c, nil
}

func CacheGetChannelInfo(id int) (*ChannelInfo, error) {
	if !common.MemoryCacheEnabled {
		channel, err := GetChannelById(id, true)
		if err != nil {
			return nil, err
		}
		return &channel.ChannelInfo, nil
	}
	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	c, ok := channelsIDM[id]
	if !ok {
		return nil, fmt.Errorf("渠道# %d，已不存在", id)
	}
	return &c.ChannelInfo, nil
}

func CacheUpdateChannelStatus(id int, status int) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	if channel, ok := channelsIDM[id]; ok {
		channel.Status = status
		refreshChannelRoutingCacheLocked(channel)
	}
	channelCacheGeneration++
	channelSyncLock.Unlock()
	InvalidatePricingCache()
}

// CacheUpdateChannelState atomically publishes the status-owned channel fields
// and keeps the enabled routing index consistent with them.
func CacheUpdateChannelState(channel *Channel) {
	if !common.MemoryCacheEnabled || channel == nil {
		return
	}

	channelSyncLock.Lock()
	channelCacheGeneration++
	cached, ok := channelsIDM[channel.Id]
	if !ok {
		channelSyncLock.Unlock()
		InvalidatePricingCache()
		return
	}
	if channel.ChannelInfo.IsMultiKey && cached.ChannelInfo.IsMultiKey &&
		channel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling &&
		cached.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling {
		channel.ChannelInfo.MultiKeyPollingIndex = cached.ChannelInfo.MultiKeyPollingIndex
	}
	if channel.ChannelInfo.IsMultiKey {
		channel.Keys = channel.GetKeys()
	}
	channelsIDM[channel.Id] = channel
	refreshChannelRoutingCacheLocked(channel)
	channelSyncLock.Unlock()
	InvalidatePricingCache()
}

func channelIsRoutable(channel *Channel) bool {
	if channel == nil || channel.Status != common.ChannelStatusEnabled {
		return false
	}
	return !channel.ChannelInfo.IsMultiKey || channel.HasEnabledMultiKey()
}

func refreshChannelRoutingCacheLocked(channel *Channel) {
	if group2model2channels == nil {
		group2model2channels = make(map[string]map[string][]int)
	}
	for group, model2channels := range group2model2channels {
		for model, channelIDs := range model2channels {
			filtered := channelIDs[:0]
			for _, channelID := range channelIDs {
				if channelID != channel.Id {
					filtered = append(filtered, channelID)
				}
			}
			group2model2channels[group][model] = filtered
		}
	}
	if !channelIsRoutable(channel) {
		return
	}

	for _, group := range strings.Split(channel.Group, ",") {
		if group2model2channels[group] == nil {
			group2model2channels[group] = make(map[string][]int)
		}
		for _, modelName := range strings.Split(channel.Models, ",") {
			channelIDs := group2model2channels[group][modelName]
			channelIDs = append(channelIDs, channel.Id)
			sort.Slice(channelIDs, func(i, j int) bool {
				left := channelsIDM[channelIDs[i]]
				right := channelsIDM[channelIDs[j]]
				if left == nil {
					return false
				}
				if right == nil {
					return true
				}
				return left.GetPriority() > right.GetPriority()
			})
			group2model2channels[group][modelName] = channelIDs
		}
	}
}

func CacheUpdateChannel(channel *Channel) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	if channel == nil {
		channelSyncLock.Unlock()
		return
	}
	channelCacheGeneration++

	if channelsIDM == nil {
		channelsIDM = make(map[int]*Channel)
	}
	if oldChannel, ok := channelsIDM[channel.Id]; ok {
		logger.LogDebug(nil, "CacheUpdateChannel before: id=%d, name=%s, status=%d, polling_index=%d", channel.Id, channel.Name, channel.Status, oldChannel.ChannelInfo.MultiKeyPollingIndex)
	}
	channelsIDM[channel.Id] = channel
	if channel2advancedCustomConfig == nil {
		channel2advancedCustomConfig = make(map[int]*dto.AdvancedCustomConfig)
	}
	delete(channel2advancedCustomConfig, channel.Id)
	if channel.Type == constant.ChannelTypeAdvancedCustom {
		if config := channel.GetOtherSettings().AdvancedCustom; config != nil {
			channel2advancedCustomConfig[channel.Id] = config
		}
	}
	logger.LogDebug(nil, "CacheUpdateChannel after: id=%d, name=%s, status=%d, polling_index=%d", channel.Id, channel.Name, channel.Status, channel.ChannelInfo.MultiKeyPollingIndex)
	// Lock ordering: do NOT hold channelSyncLock while calling
	// InvalidatePricingCache. GetPricing acquires updatePricingLock first and then
	// channelSyncLock.RLock (via loadPricingAdvancedCustomConfigs); acquiring
	// updatePricingLock while holding channelSyncLock would be an AB-BA deadlock.
	channelSyncLock.Unlock()
	InvalidatePricingCache()
}
