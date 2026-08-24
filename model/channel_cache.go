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
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

var group2model2channels map[string]map[string][]int // enabled channel
var channelsIDM map[int]*Channel                     // all channels include disabled
var channelSyncLock sync.RWMutex
var channelCacheMissLogMu sync.Mutex
var channelCacheMissLastLogged = make(map[string]time.Time)

type ChannelFilter func(*Channel) bool

const (
	channelCacheMissLogInterval = time.Minute
	channelCacheMissLogMaxKeys  = 10000
	maxInt64ForWeight           = int64(^uint64(0) >> 1)
)

func InitChannelCache() {
	if !common.MemoryCacheEnabled {
		return
	}
	newChannelId2channel := make(map[int]*Channel)
	var channels []*Channel
	DB.Find(&channels)
	for _, channel := range channels {
		newChannelId2channel[channel.Id] = channel
	}
	newGroup2model2channels := make(map[string]map[string][]int)
	var abilities []*Ability
	DB.Find(&abilities)
	for _, ability := range abilities {
		if !ability.Enabled {
			continue
		}
		channel, ok := newChannelId2channel[ability.ChannelId]
		if !ok || channel.Status != common.ChannelStatusEnabled {
			continue
		}
		group := strings.TrimSpace(ability.Group)
		model := strings.TrimSpace(ability.Model)
		if group == "" || model == "" {
			continue
		}
		if _, ok := newGroup2model2channels[group]; !ok {
			newGroup2model2channels[group] = make(map[string][]int)
		}
		newGroup2model2channels[group][model] = append(newGroup2model2channels[group][model], ability.ChannelId)
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
}

func SyncChannelCache(frequency int) {
	for {
		time.Sleep(time.Duration(frequency) * time.Second)
		common.SysLog("syncing channels from database")
		InitChannelCache()
	}
}

func GetRandomSatisfiedChannel(group string, model string, retry int) (*Channel, error) {
	return GetRandomSatisfiedChannelWithFilter(group, model, retry, nil)
}

func GetRandomSatisfiedChannelWithFilter(group string, model string, retry int, filter ChannelFilter) (*Channel, error) {
	// if memory cache is disabled, get channel directly from database
	if !common.MemoryCacheEnabled {
		return GetChannelWithFilter(group, model, retry, filter)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	// First, try to find channels with the exact model name.
	channels := group2model2channels[group][model]

	// If no channels found, try to find channels with the normalized model name.
	if len(channels) == 0 {
		normalizedModel := ratio_setting.FormatMatchingModelName(model)
		channels = group2model2channels[group][normalizedModel]
	}

	if len(channels) == 0 {
		logChannelCacheMissLocked(group, model, retry)
		return nil, nil
	}

	candidateChannels := make([]*Channel, 0, len(channels))
	for _, channelId := range channels {
		channel, ok := channelsIDM[channelId]
		if !ok {
			return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channelId)
		}
		if filter == nil || filter(channel) {
			candidateChannels = append(candidateChannels, channel)
		}
	}

	if len(candidateChannels) == 0 {
		return nil, nil
	}

	if len(candidateChannels) == 1 {
		return candidateChannels[0], nil
	}

	uniquePriorities := make(map[int]bool)
	for _, channel := range candidateChannels {
		uniquePriorities[int(channel.GetPriority())] = true
	}
	var sortedUniquePriorities []int
	for priority := range uniquePriorities {
		sortedUniquePriorities = append(sortedUniquePriorities, priority)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(sortedUniquePriorities)))

	if retry >= len(uniquePriorities) {
		retry = len(uniquePriorities) - 1
	}
	if retry < 0 {
		retry = 0
	}
	targetPriority := int64(sortedUniquePriorities[retry])

	// get the priority for the given retry number
	var sumWeight int64
	var targetChannels []*Channel
	for _, channel := range candidateChannels {
		if channel.GetPriority() == targetPriority {
			weight, err := channelWeightForRandom(channel)
			if err != nil {
				return nil, err
			}
			if sumWeight > maxInt64ForWeight-weight {
				return nil, errors.New("channel weight overflow")
			}
			sumWeight += weight
			targetChannels = append(targetChannels, channel)
		}
	}

	if len(targetChannels) == 0 {
		return nil, errors.New(fmt.Sprintf("no channel found, group: %s, model: %s, priority: %d", group, model, targetPriority))
	}

	// smoothing factor and adjustment
	var smoothingFactor int64 = 1
	var smoothingAdjustment int64

	if sumWeight == 0 {
		// when all channels have weight 0, set sumWeight to the number of channels and set smoothing adjustment to 100
		// each channel's effective weight = 100
		sumWeight = int64(len(targetChannels)) * 100
		smoothingAdjustment = 100
	} else if sumWeight/int64(len(targetChannels)) < 10 {
		// when the average weight is less than 10, set smoothing factor to 100
		smoothingFactor = 100
	}
	if sumWeight > maxInt64ForWeight/smoothingFactor {
		return nil, errors.New("channel weight overflow")
	}

	// Calculate the total weight of all channels up to endIdx
	totalWeight := sumWeight * smoothingFactor

	// Generate a random value in the range [0, totalWeight)
	randomWeight := rand.Int63n(totalWeight)

	// Find a channel based on its weight
	for _, channel := range targetChannels {
		weight, err := channelWeightForRandom(channel)
		if err != nil {
			return nil, err
		}
		randomWeight -= weight*smoothingFactor + smoothingAdjustment
		if randomWeight < 0 {
			return channel, nil
		}
	}
	// return null if no channel is not found
	return nil, errors.New("channel not found")
}

func logChannelCacheMissLocked(group string, model string, retry int) {
	now := time.Now()
	cacheKey := group + "\x00" + model

	channelCacheMissLogMu.Lock()
	if last, ok := channelCacheMissLastLogged[cacheKey]; ok && now.Sub(last) < channelCacheMissLogInterval {
		channelCacheMissLogMu.Unlock()
		return
	}
	if len(channelCacheMissLastLogged) >= channelCacheMissLogMaxKeys {
		for key, last := range channelCacheMissLastLogged {
			if now.Sub(last) >= channelCacheMissLogInterval {
				delete(channelCacheMissLastLogged, key)
			}
		}
		if len(channelCacheMissLastLogged) >= channelCacheMissLogMaxKeys {
			channelCacheMissLogMu.Unlock()
			return
		}
	}
	channelCacheMissLastLogged[cacheKey] = now
	channelCacheMissLogMu.Unlock()

	groupModels, groupExists := group2model2channels[group]
	normalizedModel := ratio_setting.FormatMatchingModelName(model)
	exactCount := 0
	normalizedCount := 0
	groupModelCount := 0
	if groupExists {
		exactCount = len(groupModels[model])
		normalizedCount = len(groupModels[normalizedModel])
		groupModelCount = len(groupModels)
	}

	common.SysLog(fmt.Sprintf(
		"channel cache miss: group=%q model=%q retry=%d normalized_model=%q group_exists=%t exact_count=%d normalized_count=%d group_model_count=%d total_group_count=%d",
		group,
		model,
		retry,
		normalizedModel,
		groupExists,
		exactCount,
		normalizedCount,
		groupModelCount,
		len(group2model2channels),
	))
}

func GetSatisfiedChannelCandidates(group string, model string, retry int) ([]*Channel, error) {
	return GetSatisfiedChannelCandidatesWithFilter(group, model, retry, nil)
}

func GetSatisfiedChannelCandidatesWithFilter(group string, model string, retry int, filter ChannelFilter) ([]*Channel, error) {
	if !common.MemoryCacheEnabled {
		return GetChannelCandidatesWithFilter(group, model, retry, filter)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	model2channels := group2model2channels[group]
	if model2channels == nil {
		return nil, nil
	}

	channels := model2channels[model]
	if len(channels) == 0 {
		normalizedModel := ratio_setting.FormatMatchingModelName(model)
		channels = model2channels[normalizedModel]
	}
	if len(channels) == 0 {
		return nil, nil
	}

	candidateChannels := make([]*Channel, 0, len(channels))
	for _, channelId := range channels {
		channel, ok := channelsIDM[channelId]
		if !ok {
			return nil, fmt.Errorf("鏁版嵁搴撲竴鑷存€ч敊璇紝娓犻亾# %d 涓嶅瓨鍦紝璇疯仈绯荤鐞嗗憳淇", channelId)
		}
		if filter == nil || filter(channel) {
			candidateChannels = append(candidateChannels, channel)
		}
	}
	if len(candidateChannels) == 0 {
		return nil, nil
	}

	uniquePriorities := make(map[int]bool)
	for _, channel := range candidateChannels {
		uniquePriorities[int(channel.GetPriority())] = true
	}

	var sortedUniquePriorities []int
	for priority := range uniquePriorities {
		sortedUniquePriorities = append(sortedUniquePriorities, priority)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(sortedUniquePriorities)))
	if retry >= len(sortedUniquePriorities) {
		return nil, nil
	}
	if retry < 0 {
		retry = 0
	}

	targetPriority := int64(sortedUniquePriorities[retry])
	var targetChannels []*Channel
	for _, channel := range candidateChannels {
		if channel.GetPriority() == targetPriority {
			targetChannels = append(targetChannels, channel)
		}
	}
	if len(targetChannels) == 0 {
		return nil, errors.New(fmt.Sprintf("no channel found, group: %s, model: %s, priority: %d", group, model, targetPriority))
	}

	return targetChannels, nil
}

func SelectWeightedRandomChannel(targetChannels []*Channel) (*Channel, error) {
	if len(targetChannels) == 0 {
		return nil, nil
	}
	if len(targetChannels) == 1 {
		return targetChannels[0], nil
	}

	var sumWeight int64
	for _, channel := range targetChannels {
		weight, err := channelWeightForRandom(channel)
		if err != nil {
			return nil, err
		}
		if sumWeight > maxInt64ForWeight-weight {
			return nil, errors.New("channel weight overflow")
		}
		sumWeight += weight
	}

	var smoothingFactor int64 = 1
	var smoothingAdjustment int64

	if sumWeight == 0 {
		sumWeight = int64(len(targetChannels)) * 100
		smoothingAdjustment = 100
	} else if sumWeight/int64(len(targetChannels)) < 10 {
		smoothingFactor = 100
	}
	if sumWeight > maxInt64ForWeight/smoothingFactor {
		return nil, errors.New("channel weight overflow")
	}

	randomWeight := rand.Int63n(sumWeight * smoothingFactor)
	for _, channel := range targetChannels {
		weight, err := channelWeightForRandom(channel)
		if err != nil {
			return nil, err
		}
		randomWeight -= weight*smoothingFactor + smoothingAdjustment
		if randomWeight < 0 {
			return channel, nil
		}
	}
	return nil, errors.New("channel not found")
}

func channelWeightForRandom(channel *Channel) (int64, error) {
	weight := channel.GetWeight()
	if weight < 0 {
		return 0, fmt.Errorf("invalid negative channel weight: channel #%d", channel.Id)
	}
	return int64(weight), nil
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

func CacheUpdateChannel(channel *Channel) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()
	if channel == nil {
		return
	}

	if channelsIDM == nil {
		channelsIDM = make(map[int]*Channel)
	}
	if oldChannel, ok := channelsIDM[channel.Id]; ok {
		logger.LogDebug(nil, "CacheUpdateChannel before: id=%d, name=%s, status=%d, polling_index=%d", channel.Id, channel.Name, channel.Status, oldChannel.ChannelInfo.MultiKeyPollingIndex)
	}
	channelsIDM[channel.Id] = channel
	logger.LogDebug(nil, "CacheUpdateChannel after: id=%d, name=%s, status=%d, polling_index=%d", channel.Id, channel.Name, channel.Status, channel.ChannelInfo.MultiKeyPollingIndex)
}
