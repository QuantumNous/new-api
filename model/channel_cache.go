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
	channels := filterChannelsByRequestPath(group2model2channels[group][model], requestPath)

	// If no channels found, try to find channels with the normalized model name.
	if len(channels) == 0 {
		normalizedModel := ratio_setting.FormatMatchingModelName(model)
		channels = filterChannelsByRequestPath(group2model2channels[group][normalizedModel], requestPath)
	}

	if len(channels) == 0 {
		return nil, nil
	}

	// Snapshot the cooldown set once so multiple checks below are consistent.
	// The map is small (at most one entry per enabled channel) and the read
	// is O(N) under its own RLock — the cost is negligible vs. the channel
	// cache lookup it gates.
	cooldown := InCooldownIDs(time.Now())

	if len(channels) == 1 {
		if channel, ok := channelsIDM[channels[0]]; ok {
			// Single-channel fast path: respect cooldown so we don't keep
			// hammering a temporarily broken channel. Returning (nil, nil)
			// signals the caller to retry / move groups / fail. The debug
			// log is the operator's confirmation that the filter is
			// actually firing — without it, the symptom is just "the
			// user got 400 anyway" and the cause is invisible.
			if _, skip := cooldown[channel.Id]; skip {
				logger.LogInfo(nil, fmt.Sprintf("selector skipped channel #%d: in cooldown", channel.Id))
				return nil, nil
			}
			// Per-key cooldown overlay: skip a single-channel group
			// whose only served key is in cooldown. Without this, the
			// fast path hands the channel to the distributor, the
			// distributor's GetNextEnabledKey returns NoAvailableKey,
			// and the controller's retry loop picks the same channel
			// again — an infinite no-channel loop that surfaces as
			// repeated upstream 400s.
			if !channelHasAnyAvailableKey(channel, time.Now()) {
				logger.LogInfo(nil, fmt.Sprintf("selector skipped channel #%d: every key in cooldown", channel.Id))
				return nil, nil
			}
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

	// Build the candidate list for the chosen priority bucket, skipping any
	// channel currently in cooldown. If the entire bucket is in cooldown we
	// still return (nil, nil) so the outer loop can advance to the next
	// priority or next group.
	var sumWeight = 0
	var targetChannels []*Channel
	now := time.Now()
	for _, channelId := range channels {
		if _, skip := cooldown[channelId]; skip {
			logger.LogInfo(nil, fmt.Sprintf("selector skipped channel #%d: in cooldown (priority bucket)", channelId))
			continue
		}
		if channel, ok := channelsIDM[channelId]; ok {
			if channel.GetPriority() == targetPriority {
				// Per-key cooldown overlay: skip a channel
				// whose only served key is in cooldown. For
				// single-key channels this is the only key,
				// so we check index 0 directly. For multi-key
				// channels we enumerate the key list; if
				// every key is cooldowned, the channel is
				// effectively unusable. This is the
				// selector-level counterpart to the
				// GetNextEnabledKey check on the distributor
				// side: it makes sure we don't *hand* a
				// channel to the distributor that we already
				// know is going to fail there.
				if !channelHasAnyAvailableKey(channel, now) {
					logger.LogInfo(nil, fmt.Sprintf("selector skipped channel #%d: every key in cooldown", channelId))
					continue
				}
				sumWeight += channel.GetWeight()
				targetChannels = append(targetChannels, channel)
			}
		} else {
			return nil, fmt.Errorf("数据库一致性错误，渠道# %d 不存在，请联系管理员修复", channelId)
		}
	}

	if len(targetChannels) == 0 {
		// Either no channel at this priority, or all of them are in cooldown.
		// Both cases are retryable; the outer loop will try the next priority
		// / group, or eventually surface a no-channel error to the user. Log
		// the case that *is* unusual (whole bucket cooldowned) so an
		// operator skimming logs can spot "all my channels are in cooldown"
		// even when the user-facing error is a generic 500.
		if len(channels) > 0 {
			logger.LogInfo(nil, fmt.Sprintf("selector: all %d channels in priority bucket are in cooldown, returning nil", len(channels)))
		}
		return nil, nil
	}
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

// filterChannelsByRequestPath restricts candidates by request path. Only Advanced
// Custom (type 58) channels are path-checked: they are kept only when one of their
// configured routes matches requestPath. All other channel types always pass.
// When requestPath is empty (non-relay callers) filtering is skipped.
// Caller must hold channelSyncLock (read lock). The cached slice is never mutated.
func filterChannelsByRequestPath(channels []int, requestPath string) []int {
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
		if config := channel2advancedCustomConfig[channelId]; config != nil && config.SupportsPath(requestPath) {
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

// channelHasAnyAvailableKey reports whether a channel has at
// least one key that is not in the per-key cooldown overlay.
// The selector uses this to avoid handing a channel to the
// distributor that we already know is going to fail there.
// For single-key channels the answer is just "is key 0 in
// cooldown". For multi-key channels we enumerate the key list
// to give an exact answer: a channel with 3 keys, 2 of which
// are cooldowned, is still usable (GetNextEnabledKey will
// pick the surviving one).
func channelHasAnyAvailableKey(channel *Channel, now time.Time) bool {
	if !channel.ChannelInfo.IsMultiKey {
		_, skip := InCooldownKeyIndices(channel.Id, now)[0]
		return !skip
	}
	keys := channel.GetKeys()
	if len(keys) == 0 {
		// No keys at all = nothing to serve. Returning true
		// here would let the selector hand an unusable
		// channel to the distributor; returning false is
		// the right answer even though it's the same
		// outcome as "all keys in cooldown".
		return false
	}
	cooldowns := InCooldownKeyIndices(channel.Id, now)
	for i := range keys {
		if _, skip := cooldowns[i]; !skip {
			return true
		}
	}
	return false
}

func CacheGetChannelInfo(id int) (*ChannelInfo, error) {
	if !common.MemoryCacheEnabled {
		channel, err := GetChannelById(id, true)
		if err != nil {
			return nil, err
		}
		return &channel.ChannelInfo, err
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
