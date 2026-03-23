package model

import (
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

var group2model2channels map[string]map[string][]int // enabled channel
var channelsIDM map[int]*Channel                     // all channels include disabled
var channelSyncLock sync.RWMutex
var channelCacheRefreshInFlight atomic.Bool
var channelCacheRefreshPending atomic.Bool

// InitChannelCache rebuilds the in-memory channel cache from database state.
func InitChannelCache() {
	if !common.MemoryCacheEnabled {
		return
	}
	channelCacheRefreshPending.Store(true)
	if channelCacheRefreshInFlight.CompareAndSwap(false, true) {
		runChannelCacheRefreshLoop()
		return
	}
	for channelCacheRefreshInFlight.Load() {
		time.Sleep(10 * time.Millisecond)
	}
}

func buildChannelCacheSnapshot() error {
	newChannelId2channel := make(map[int]*Channel)
	var channels []*Channel
	if err := DB.Find(&channels).Error; err != nil {
		return fmt.Errorf("failed to sync channels from database: %w", err)
	}
	for _, channel := range channels {
		newChannelId2channel[channel.Id] = channel
	}
	var abilities []*Ability
	if err := DB.Find(&abilities).Error; err != nil {
		return fmt.Errorf("failed to sync abilities from database: %w", err)
	}
	newGroup2model2channels := make(map[string]map[string][]int)
	for _, ability := range abilities {
		if !ability.Enabled {
			continue
		}
		channel, ok := newChannelId2channel[ability.ChannelId]
		if !ok || channel.Status != common.ChannelStatusEnabled {
			continue
		}
		if _, ok := newGroup2model2channels[ability.Group]; !ok {
			newGroup2model2channels[ability.Group] = make(map[string][]int)
		}
		newGroup2model2channels[ability.Group][ability.Model] = append(
			newGroup2model2channels[ability.Group][ability.Model],
			ability.ChannelId,
		)
	}

	// dedupe and sort by priority
	for group, model2channels := range newGroup2model2channels {
		for model, channels := range model2channels {
			seen := make(map[int]struct{}, len(channels))
			deduped := make([]int, 0, len(channels))
			for _, channelId := range channels {
				if _, ok := seen[channelId]; ok {
					continue
				}
				seen[channelId] = struct{}{}
				deduped = append(deduped, channelId)
			}
			sort.Slice(deduped, func(i, j int) bool {
				return newChannelId2channel[deduped[i]].GetPriority() > newChannelId2channel[deduped[j]].GetPriority()
			})
			newGroup2model2channels[group][model] = deduped
		}
	}

	channelSyncLock.Lock()
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
	channelSyncLock.Unlock()
	common.SysLog("channels synced from database")
	return nil
}

func runChannelCacheRefreshLoop() {
	defer channelCacheRefreshInFlight.Store(false)
	for {
		channelCacheRefreshPending.Store(false)
		if err := buildChannelCacheSnapshot(); err != nil {
			common.SysError(err.Error())
		}
		if !channelCacheRefreshPending.Load() {
			return
		}
	}
}

// SyncChannelCache periodically refreshes the in-memory channel cache.
func SyncChannelCache(frequency int) {
	for {
		time.Sleep(time.Duration(frequency) * time.Second)
		common.SysLog("syncing channels from database")
		InitChannelCache()
	}
}

func requestChannelCacheRefreshAsync() {
	if !common.MemoryCacheEnabled {
		return
	}
	channelCacheRefreshPending.Store(true)
	if !channelCacheRefreshInFlight.CompareAndSwap(false, true) {
		return
	}
	go func() {
		defer func() {
			if r := recover(); r != nil {
				common.SysLog(fmt.Sprintf("InitChannelCache panic: %v", r))
			}
		}()
		runChannelCacheRefreshLoop()
	}()
}

func getRandomSatisfiedChannelFromCache(group string, model string, retry int) (*Channel, error, bool) {
	// First, try to find channels with the exact model name.
	channels := group2model2channels[group][model]

	// If no channels found, try to find channels with the normalized model name.
	if len(channels) == 0 {
		normalizedModel := ratio_setting.FormatMatchingModelName(model)
		channels = group2model2channels[group][normalizedModel]
	}

	if len(channels) == 0 {
		return nil, nil, false
	}

	if len(channels) == 1 {
		if channel, ok := channelsIDM[channels[0]]; ok {
			return channel, nil, true
		}
		return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channels[0]), true
	}

	uniquePriorities := make(map[int]bool)
	for _, channelId := range channels {
		if channel, ok := channelsIDM[channelId]; ok {
			uniquePriorities[int(channel.GetPriority())] = true
		} else {
			return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channelId), true
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
			return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channelId), true
		}
	}

	if len(targetChannels) == 0 {
		return nil, fmt.Errorf("no channel found, group: %s, model: %s, priority: %d", group, model, targetPriority), true
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
			return channel, nil, true
		}
	}
	return nil, errors.New("channel not found"), true
}

// GetRandomSatisfiedChannel returns a channel for the requested group/model pair.
func GetRandomSatisfiedChannel(group string, model string, retry int) (*Channel, error) {
	// if memory cache is disabled, get channel directly from database
	if !common.MemoryCacheEnabled {
		return GetChannel(group, model, retry)
	}

	channelSyncLock.RLock()
	channel, cacheErr, cacheHit := getRandomSatisfiedChannelFromCache(group, model, retry)
	channelSyncLock.RUnlock()
	if channel != nil || (cacheHit && cacheErr == nil) {
		return channel, cacheErr
	}

	fallbackChannel, fallbackErr := GetChannel(group, model, retry)
	if fallbackErr != nil {
		if cacheErr != nil {
			return nil, cacheErr
		}
		return nil, fallbackErr
	}
	if fallbackChannel != nil && fallbackChannel.Status == common.ChannelStatusEnabled {
		requestChannelCacheRefreshAsync()
		return fallbackChannel, nil
	}
	if cacheErr != nil {
		requestChannelCacheRefreshAsync()
		return nil, cacheErr
	}
	return nil, nil
}

// CacheGetChannel returns a channel from the in-memory cache when available.
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

// CacheGetChannelInfo returns cached channel info when available.
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

// CacheUpdateChannelStatus mutates a cached channel status in place.
func CacheUpdateChannelStatus(id int, status int) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()
	if channel, ok := channelsIDM[id]; ok {
		channel.Status = status
	}
	if status != common.ChannelStatusEnabled {
		// delete the channel from group2model2channels
		for group, model2channels := range group2model2channels {
			for model, channels := range model2channels {
				for i, channelId := range channels {
					if channelId == id {
						// remove the channel from the slice
						group2model2channels[group][model] = append(channels[:i], channels[i+1:]...)
						break
					}
				}
			}
		}
	}
}

// CacheUpdateChannel updates a cached channel entry in place.
func CacheUpdateChannel(channel *Channel) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()
	if channel == nil {
		return
	}
	channelsIDM[channel.Id] = channel
}
