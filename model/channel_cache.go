package model

import (
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

var group2model2channels map[string]map[string][]int // enabled channel
var channelsIDM map[int]*Channel                     // all channels include disabled
// channel2advancedCustomConfig caches parsed Advanced Custom (type 58) configs so
// path-aware selection avoids re-parsing JSON per request. Refreshed on full sync.
var channel2advancedCustomConfig map[int]*dto.AdvancedCustomConfig
var channelSyncLock sync.RWMutex

func InitChannelCache() {
	if !common.MemoryCacheEnabled {
		InvalidatePricingCache()
		return
	}
	newChannelId2channel := make(map[int]*Channel)
	newChannel2advancedCustomConfig := make(map[int]*dto.AdvancedCustomConfig)
	var channels []*Channel
	DB.Find(&channels)
	for _, channel := range channels {
		newChannelId2channel[channel.Id] = channel
		if channel.Type == constant.ChannelTypeAdvancedCustom {
			if config := channel.GetOtherSettings().AdvancedCustom; config != nil {
				newChannel2advancedCustomConfig[channel.Id] = config
			}
		}
	}
	var abilities []*Ability
	DB.Find(&abilities)
	groups := make(map[string]bool)
	for _, ability := range abilities {
		groups[ability.Group] = true
	}
	newGroup2model2channels := make(map[string]map[string][]int)
	for group := range groups {
		newGroup2model2channels[group] = make(map[string][]int)
	}
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue // skip disabled channels
		}
		groups := strings.Split(channel.Group, ",")
		for _, group := range groups {
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
	channelSyncLock.Unlock()
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

type ChannelSelectionOptions struct {
	ExcludedChannelIDs map[int]struct{}
	// AvoidChannelHosts is a soft exclusion used after a transport failure.
	// The selected priority tier prefers a different host, while same-host
	// channels remain a fallback so operator priority and availability stay intact.
	AvoidChannelHosts map[string]struct{}
	// PreferDifferentHost is enabled only for request-local capacity recovery.
	// It prefers any healthy different-host candidate across priority tiers, but
	// still falls back to the avoided host when no alternative exists.
	PreferDifferentHost bool
	// DeferAvoidedHostFallback lets auto-group selection scan later groups for a
	// different upstream before falling back to an avoided host.
	DeferAvoidedHostFallback bool
	AllowCoolingFallback     bool
	// RequestPath is the RAW request path, used to match Advanced Custom
	// (type 58) channels against their configured routes.
	RequestPath string
	// Path is the NORMALIZED request path (see service.ChannelHealthPath), used
	// to key the adaptive channel-health circuit per (channel, model, path).
	// It must stay normalized: the health registry is bounded, so raw paths
	// would explode its key cardinality.
	Path string

	requireDifferentHost bool
}

func GetRandomSatisfiedChannel(group string, model string, retry int, requestPath string) (*Channel, error) {
	return GetRandomSatisfiedChannelWithOptions(group, model, retry, ChannelSelectionOptions{AllowCoolingFallback: true, RequestPath: requestPath, Path: requestPath})
}

func GetRandomSatisfiedChannelWithOptions(group string, model string, retry int, options ChannelSelectionOptions) (*Channel, error) {
	// if memory cache is disabled, get channel directly from database
	if !common.MemoryCacheEnabled {
		return GetChannelWithOptions(group, model, retry, options)
	}
	if options.PreferDifferentHost && len(options.AvoidChannelHosts) > 0 {
		differentHostOptions := options
		differentHostOptions.PreferDifferentHost = false
		differentHostOptions.DeferAvoidedHostFallback = false
		differentHostOptions.AllowCoolingFallback = false
		differentHostOptions.requireDifferentHost = true
		channel, err := getRandomSatisfiedChannelWithOptions(group, model, 0, differentHostOptions)
		if err != nil || channel != nil || options.DeferAvoidedHostFallback {
			return channel, err
		}
	}
	fallbackOptions := options
	fallbackOptions.PreferDifferentHost = false
	fallbackOptions.DeferAvoidedHostFallback = false
	fallbackOptions.requireDifferentHost = false
	return getRandomSatisfiedChannelWithOptions(group, model, retry, fallbackOptions)
}

func getRandomSatisfiedChannelWithOptions(group string, model string, retry int, options ChannelSelectionOptions) (*Channel, error) {
	requestPath := options.RequestPath

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
		channel, ok := channelsIDM[channels[0]]
		if !ok {
			return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channels[0])
		}
		if _, excluded := options.ExcludedChannelIDs[channel.Id]; excluded {
			return nil, nil
		}
		host := channelRetryHost(channel, channel2advancedCustomConfig[channel.Id], options.RequestPath, model)
		if options.requireDifferentHost {
			if _, avoided := options.AvoidChannelHosts[host]; avoided && host != "" {
				return nil, nil
			}
		}
		if IsChannelCoolingDown(channel.Id) && !options.AllowCoolingFallback {
			return nil, nil
		}
		if shouldEnforceChannelHostCircuit(host, model, options.Path) && !options.AllowCoolingFallback {
			return nil, nil
		}
		key := ChannelHealthKey{ChannelID: channel.Id, Model: model, Path: options.Path}
		if !AcquireChannelHealth(key) {
			return nil, nil
		}
		return channel, nil
	}

	availableChannels := make([]*Channel, 0, len(channels))
	coolingChannels := make([]*Channel, 0, len(channels))
	for _, channelId := range channels {
		channel, ok := channelsIDM[channelId]
		if !ok {
			return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channelId)
		}
		if _, excluded := options.ExcludedChannelIDs[channel.Id]; excluded {
			continue
		}
		if options.requireDifferentHost {
			host := channelRetryHost(channel, channel2advancedCustomConfig[channel.Id], options.RequestPath, model)
			if _, avoided := options.AvoidChannelHosts[host]; avoided && host != "" {
				continue
			}
		}
		if IsChannelCoolingDown(channel.Id) {
			coolingChannels = append(coolingChannels, channel)
			continue
		}
		key := ChannelHealthKey{ChannelID: channel.Id, Model: model, Path: options.Path}
		if !IsChannelHealthAvailable(key) {
			continue
		}
		availableChannels = append(availableChannels, channel)
	}
	if len(availableChannels) == 0 && options.AllowCoolingFallback {
		availableChannels = coolingChannels
	}
	uniquePriorities := make(map[int]bool)
	for _, channel := range availableChannels {
		uniquePriorities[int(channel.GetPriority())] = true
	}
	if len(uniquePriorities) == 0 {
		return nil, nil
	}

	var sortedUniquePriorities []int
	for priority := range uniquePriorities {
		sortedUniquePriorities = append(sortedUniquePriorities, priority)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(sortedUniquePriorities)))

	if retry >= len(sortedUniquePriorities) {
		retry = len(sortedUniquePriorities) - 1
	}

	var hostFallbackPreferred []*Channel
	var hostFallbackAvoided []*Channel
	for priorityIndex := retry; priorityIndex < len(sortedUniquePriorities); priorityIndex++ {
		targetPriority := int64(sortedUniquePriorities[priorityIndex])
		var preferredChannels []*Channel
		var avoidedChannels []*Channel
		var blockedPreferred []*Channel
		var blockedAvoided []*Channel
		for _, channel := range availableChannels {
			if channel.GetPriority() != targetPriority {
				continue
			}
			host := channelRetryHost(channel, channel2advancedCustomConfig[channel.Id], options.RequestPath, model)
			_, avoided := options.AvoidChannelHosts[host]
			if shouldEnforceChannelHostCircuit(host, model, options.Path) {
				if avoided && host != "" {
					blockedAvoided = append(blockedAvoided, channel)
				} else {
					blockedPreferred = append(blockedPreferred, channel)
				}
				continue
			}
			if avoided && host != "" {
				avoidedChannels = append(avoidedChannels, channel)
			} else {
				preferredChannels = append(preferredChannels, channel)
			}
		}
		if len(hostFallbackPreferred) == 0 && len(hostFallbackAvoided) == 0 &&
			(len(blockedPreferred) > 0 || len(blockedAvoided) > 0) {
			hostFallbackPreferred = blockedPreferred
			hostFallbackAvoided = blockedAvoided
		}
		if len(preferredChannels) == 0 && len(avoidedChannels) == 0 {
			continue
		}

		selected, err := selectAcquirableChannelWithFallback(
			preferredChannels,
			effectiveChannelSelectionWeights(preferredChannels, model, options.Path),
			avoidedChannels,
			effectiveChannelSelectionWeights(avoidedChannels, model, options.Path),
			model,
			options.Path,
		)
		if err != nil {
			return nil, err
		}
		if selected != nil {
			return selected, nil
		}
	}
	if options.AllowCoolingFallback && (len(hostFallbackPreferred) > 0 || len(hostFallbackAvoided) > 0) {
		return selectAcquirableChannelWithFallback(
			hostFallbackPreferred,
			effectiveChannelSelectionWeights(hostFallbackPreferred, model, options.Path),
			hostFallbackAvoided,
			effectiveChannelSelectionWeights(hostFallbackAvoided, model, options.Path),
			model,
			options.Path,
		)
	}
	return nil, nil
}

func effectiveChannelSelectionWeights(channels []*Channel, model string, path string) []int {
	if len(channels) == 0 {
		return nil
	}
	sumWeight := 0
	for _, channel := range channels {
		sumWeight += channel.GetWeight()
	}

	// smoothing factor and adjustment
	smoothingFactor := 1
	smoothingAdjustment := 0

	if sumWeight == 0 {
		// when all channels have weight 0, set sumWeight to the number of channels and set smoothing adjustment to 100
		// each channel's effective weight = 100
		sumWeight = len(channels) * 100
		smoothingAdjustment = 100
	} else if sumWeight/len(channels) < 10 {
		// when the average weight is less than 10, set smoothing factor to 100
		smoothingFactor = 100
	}

	// Calculate health-adjusted weights without mutating cached channel config.
	effectiveWeights := make([]int, len(channels))
	for i, channel := range channels {
		baseWeight := channel.GetWeight()*smoothingFactor + smoothingAdjustment
		if baseWeight == 0 {
			continue
		}
		effectiveWeights[i] = EffectiveSelectionWeight(baseWeight, ChannelHealthKey{ChannelID: channel.Id, Model: model, Path: path})
	}
	return effectiveWeights
}

func selectAcquirableChannelWithFallback(preferred []*Channel, preferredWeights []int, fallback []*Channel, fallbackWeights []int, model string, path string) (*Channel, error) {
	if len(preferred) > 0 {
		channel, err := selectAcquirableChannel(preferred, preferredWeights, model, path)
		if channel != nil || len(fallback) == 0 {
			return channel, err
		}
	}
	return selectAcquirableChannel(fallback, fallbackWeights, model, path)
}

// selectAcquirableChannel picks a weighted-random starting candidate, then
// tries every candidate exactly once, wrapping around from that start point,
// until one successfully acquires its health lease. This ensures a lost
// half-open probe race on the initial pick still falls back to other
// available candidates instead of failing outright.
func selectAcquirableChannel(candidates []*Channel, weights []int, model string, path string) (*Channel, error) {
	totalWeight := 0
	for _, w := range weights {
		totalWeight += w
	}
	if totalWeight <= 0 {
		return nil, nil
	}

	startIdx := 0
	cumulative := 0
	randomWeight := rand.Intn(totalWeight)
	for i, w := range weights {
		cumulative += w
		if randomWeight < cumulative {
			startIdx = i
			break
		}
	}

	for offset := 0; offset < len(candidates); offset++ {
		idx := (startIdx + offset) % len(candidates)
		if weights[idx] == 0 {
			continue
		}
		channel := candidates[idx]
		key := ChannelHealthKey{ChannelID: channel.Id, Model: model, Path: path}
		if AcquireChannelHealth(key) {
			return channel, nil
		}
	}
	return nil, nil
}

func SetChannelCacheForTest(channels map[int]*Channel, groupModelChannels map[string]map[string][]int) {
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()
	channelsIDM = channels
	group2model2channels = groupModelChannels
}

func ClearChannelCacheForTest() {
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()
	channelsIDM = nil
	group2model2channels = nil
	channel2advancedCustomConfig = nil
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
	if channel == nil {
		channelSyncLock.Unlock()
		return
	}

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
