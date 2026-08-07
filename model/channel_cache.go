package model

import (
	"errors"
	"fmt"
	"math/rand"
	"slices"
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
// channelEnabledSince records, for every channel currently tracked as Enabled in
// the memory cache, the moment it was last observed transitioning into Enabled.
// An entry is deleted whenever the channel is observed disabled, so "tracked" is
// equivalent to "continuously enabled since this timestamp". Used by priority-aware
// channel affinity (service.IsChannelAffinityStale) to debounce a just-recovered
// channel before it is trusted to steal traffic away from an existing affinity
// binding, avoiding thundering herd / flapping right after recovery.
// Caller must hold channelSyncLock.
var channelEnabledSince map[int]time.Time
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
	isFirstLoad := channelsIDM == nil
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
	syncChannelEnabledSinceLocked(newChannelId2channel, isFirstLoad)
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
	defer channelSyncLock.Unlock()
	var oldStatus int
	if channel, ok := channelsIDM[id]; ok {
		oldStatus = channel.Status
	}
	cacheUpdateChannelStatusLocked(id, oldStatus, status)
}

// CacheUpdateChannelStatusFrom is CacheUpdateChannelStatus for callers that have
// already mutated the shared cached *Channel in place (the multi-key path:
// handlerMultiKeyUpdate writes channel.Status before this is called, so reading
// oldStatus back from the cache would always observe the new value and the
// channelEnabledSince stability clock would never re-arm on recovery).
func CacheUpdateChannelStatusFrom(id int, oldStatus int, status int) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()
	cacheUpdateChannelStatusLocked(id, oldStatus, status)
}

// CacheReplaceChannelAfterStatusUpdate publishes a database-committed channel
// state. The old status must come from the database, because direct SQL changes
// from the external breaker may have left the in-memory channel stale.
func CacheReplaceChannelAfterStatusUpdate(channel *Channel, oldStatus int) {
	if !common.MemoryCacheEnabled || channel == nil {
		return
	}

	pollingLock := GetChannelPollingLock(channel.Id)
	pollingLock.Lock()
	defer pollingLock.Unlock()

	channelSyncLock.Lock()
	func() {
		defer channelSyncLock.Unlock()

		if channelsIDM == nil {
			channelsIDM = make(map[int]*Channel)
		}
		cacheOldStatus := oldStatus
		if oldChannel, ok := channelsIDM[channel.Id]; ok &&
			channel.ChannelInfo.IsMultiKey &&
			channel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling &&
			oldChannel.ChannelInfo.IsMultiKey &&
			oldChannel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling {
			channel.ChannelInfo.MultiKeyPollingIndex = oldChannel.ChannelInfo.MultiKeyPollingIndex
		}
		if oldChannel, ok := channelsIDM[channel.Id]; ok && oldStatus == channel.Status {
			// The database may already be at the requested state while the cache is stale.
			cacheOldStatus = oldChannel.Status
		}
		if channel.ChannelInfo.IsMultiKey {
			channel.Keys = channel.GetKeys()
		}
		if group2model2channels == nil {
			group2model2channels = make(map[string]map[string][]int)
		}
		if channel2advancedCustomConfig == nil {
			channel2advancedCustomConfig = make(map[int]*dto.AdvancedCustomConfig)
		}
		delete(channel2advancedCustomConfig, channel.Id)
		if channel.Type == constant.ChannelTypeAdvancedCustom {
			if config := channel.GetOtherSettings().AdvancedCustom; config != nil {
				channel2advancedCustomConfig[channel.Id] = config
			}
		}
		channelsIDM[channel.Id] = channel
		cacheUpdateChannelStatusLocked(channel.Id, cacheOldStatus, channel.Status)
	}()
	InvalidatePricingCache()
}

func cacheUpdateChannelStatusLocked(id int, oldStatus int, status int) {
	channel, ok := channelsIDM[id]
	if ok {
		channel.Status = status
	}
	if status != common.ChannelStatusEnabled {
		delete(channelEnabledSince, id)
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
		return
	}
	// Re-enabling: put the channel back into the selection index. Without this the
	// removal above is one-way — a channel disabled by the auto-breaker stays
	// invisible to GetRandomSatisfiedChannel until the next full InitChannelCache
	// sweep (SYNC_FREQUENCY, often several minutes, and never at all when periodic
	// sync is off), so traffic keeps avoiding a channel that has already recovered.
	if !ok {
		return
	}
	if oldStatus != common.ChannelStatusEnabled {
		// Fresh transition into Enabled (as opposed to a redundant Enabled->Enabled
		// call): (re)start the stability clock consulted by priority-aware channel
		// affinity so it does not immediately trust a channel that just flapped.
		if channelEnabledSince == nil {
			channelEnabledSince = make(map[int]time.Time)
		}
		channelEnabledSince[id] = time.Now()
	}
	insertEnabledChannelLocked(channel)
}

// insertEnabledChannelLocked adds an enabled channel to group2model2channels for
// every group/model it serves, keeping each slice sorted by priority descending
// so GetRandomSatisfiedChannel's retry-by-priority walk stays correct. Idempotent.
//
// The group/model split below is intentionally the raw, untrimmed
// strings.Split(...,",") used by InitChannelCache and Channel.AddAbilities /
// UpdateAbilities (see model/ability.go). Trimming whitespace or skipping empty
// segments here would silently diverge from the full-rebuild index: a channel
// re-enabled through this path would land under a different map key than a
// periodic InitChannelCache sweep would place it under, making the channel
// flip visible/invisible depending on which sync path last ran.
//
// Caller must hold channelSyncLock (write lock).
func insertEnabledChannelLocked(channel *Channel) {
	priorityOf := func(channelId int) int64 {
		if c, ok := channelsIDM[channelId]; ok {
			return c.GetPriority()
		}
		return 0
	}
	for _, group := range strings.Split(channel.Group, ",") {
		if _, ok := group2model2channels[group]; !ok {
			group2model2channels[group] = make(map[string][]int)
		}
		for _, model := range strings.Split(channel.Models, ",") {
			existing := group2model2channels[group][model]
			if slices.Contains(existing, channel.Id) {
				continue
			}
			// Copy on write: the removal branch above splices slices in place, so a
			// shared backing array could otherwise leak this write into a stale alias.
			updated := make([]int, 0, len(existing)+1)
			updated = append(updated, existing...)
			updated = append(updated, channel.Id)
			sort.SliceStable(updated, func(i, j int) bool {
				return priorityOf(updated[i]) > priorityOf(updated[j])
			})
			group2model2channels[group][model] = updated
		}
	}
}

// syncChannelEnabledSinceLocked refreshes channelEnabledSince against a freshly
// loaded channel set. Channels observed Enabled that are already tracked keep
// their existing timestamp (continuity across periodic InitChannelCache sweeps);
// channels newly observed Enabled start their stability clock now, except on the
// very first load (isFirstLoad), where whatever the database says is already the
// steady state, not a just-recovered channel, so they are backdated far enough
// that any configured stability window is already satisfied immediately.
// Channels not Enabled have their entry removed. Caller must hold channelSyncLock.
func syncChannelEnabledSinceLocked(channels map[int]*Channel, isFirstLoad bool) {
	if channelEnabledSince == nil {
		channelEnabledSince = make(map[int]time.Time)
	}
	next := make(map[int]time.Time, len(channels))
	for id, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		if since, tracked := channelEnabledSince[id]; tracked {
			next[id] = since
			continue
		}
		if isFirstLoad {
			// Backdate to the epoch, not a fixed -24h: PriorityAwareStableSeconds has
			// no configured upper bound, so any finite backdate can leave long-stable
			// channels reported unstable for (configured - backdate) seconds after
			// every process restart. Epoch satisfies every possible window.
			next[id] = time.Unix(0, 0)
		} else {
			next[id] = time.Now()
		}
	}
	channelEnabledSince = next
}

// GetStablePriorityLeader returns the highest-priority channel currently usable
// for (group, model, requestPath) in the memory cache, and whether it has been
// continuously enabled for at least stableFor. Read-lock only; no DB access.
// Used by priority-aware channel affinity (service.IsChannelAffinityStale) to
// detect whether a higher-priority channel has recovered and stayed up long
// enough to be trusted, so a stale affinity binding can be dropped and traffic
// can fall back to normal (priority-ordered) channel selection.
func GetStablePriorityLeader(group string, model string, requestPath string, stableFor time.Duration) (channel *Channel, stable bool, found bool) {
	if !common.MemoryCacheEnabled {
		return nil, false, false
	}
	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	channels := filterChannelsByRequestPathAndModel(group2model2channels[group][model], requestPath, model)
	if len(channels) == 0 {
		normalizedModel := ratio_setting.FormatMatchingModelName(model)
		channels = filterChannelsByRequestPathAndModel(group2model2channels[group][normalizedModel], requestPath, model)
	}
	if len(channels) == 0 {
		return nil, false, false
	}
	ch, ok := channelsIDM[channels[0]]
	if !ok {
		return nil, false, false
	}
	since, tracked := channelEnabledSince[ch.Id]
	return ch, tracked && time.Since(since) >= stableFor, true
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
