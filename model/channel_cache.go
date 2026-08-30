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
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

var group2model2channels map[string]map[string][]int // enabled channel
var channelsIDM map[int]*Channel                     // all channels include disabled
// channel2advancedCustomConfig caches parsed Advanced Custom (type 58) configs so
// path-aware selection avoids re-parsing JSON per request. Refreshed on full sync.
var channel2advancedCustomConfig map[int]*kitdto.AdvancedCustomConfig
var channelSyncLock sync.RWMutex

func InitChannelCache() {
	if !common.MemoryCacheEnabled {
		InvalidatePricingCache()
		return
	}
	newChannelId2channel := make(map[int]*Channel)
	newChannel2advancedCustomConfig := make(map[int]*kitdto.AdvancedCustomConfig)
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
		if oldChannel, ok := channelsIDM[i]; ok {
			// 保留内存中的响应时间：DB 重建会把 response_time 覆盖为旧值/0，
			// 而智能路由 speed/success_rate 策略依赖实时采集值（见 flushChannelResponseTimes）。
			if oldChannel.ResponseTime > 0 {
				channel.ResponseTime = oldChannel.ResponseTime
			}
			// 同样保留内存中的请求/成功计数（可能含未落库的增量），避免周期同步回退。
			if oldChannel.RequestCount > channel.RequestCount {
				channel.RequestCount = oldChannel.RequestCount
			}
			if oldChannel.SuccessCount > channel.SuccessCount {
				channel.SuccessCount = oldChannel.SuccessCount
			}
		}
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

func GetRandomSatisfiedChannel(
	group string,
	model string,
	retry int,
	filters []dto.ChannelFilter,
) (*Channel, error) {
	// if memory cache is disabled, get channel directly from database
	if !common.MemoryCacheEnabled {
		return GetChannel(group, model, retry, filters)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	// First, try to find channels with the exact model name.
	channels, _ := filterCandidateIDs(group2model2channels[group][model], model, filters)

	// If no channels found, try to find channels with the normalized model name.
	if len(channels) == 0 {
		normalizedModel := ratio_setting.FormatMatchingModelName(model)
		channels, _ = filterCandidateIDs(group2model2channels[group][normalizedModel], model, filters)
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

// GroupChannelStat 某分组下指定模型候选渠道的统计信息，供智能路由按策略跨分组排序。
type GroupChannelStat struct {
	Group           string
	HasChannel      bool    // 该分组是否有该模型的可用渠道
	MaxPriority     int64   // 候选渠道中最高优先级
	MinResponseTime int     // 候选渠道中最短响应时间（毫秒），0 表示无记录
	SumWeight       int     // 候选渠道权重和
	TotalRequest    int64   // 候选渠道累计请求数（success_rate 数据源）
	TotalSuccess    int64   // 候选渠道累计成功数（success_rate 数据源）
	SuccessRate     float64 // 候选渠道综合成功率 = TotalSuccess/TotalRequest，无记录为 0
}

// GetGroupChannelStats 计算多个分组下指定模型的候选渠道统计。
// 智能路由（Token.RoutingPriority）用它来确定各分组的可用性与速度/成功率排序依据。
func GetGroupChannelStats(groups []string, model string, requestPath string) map[string]*GroupChannelStat {
	stats := make(map[string]*GroupChannelStat, len(groups))
	for _, group := range groups {
		stats[group] = &GroupChannelStat{Group: group}
	}
	if len(groups) == 0 {
		return stats
	}

	// 未启用内存缓存时退化为数据库查询
	if !common.MemoryCacheEnabled {
		filters := []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestPath: requestPath}}
		for _, group := range groups {
			ch, _ := GetRandomSatisfiedChannel(group, model, 0, filters)
			if ch == nil {
				continue
			}
			st := stats[group]
			st.HasChannel = true
			st.MaxPriority = ch.GetPriority()
			st.MinResponseTime = ch.ResponseTime
			st.SumWeight = ch.GetWeight()
			st.TotalRequest = ch.RequestCount
			st.TotalSuccess = ch.SuccessCount
			if st.TotalRequest > 0 {
				st.SuccessRate = float64(st.TotalSuccess) / float64(st.TotalRequest)
			}
		}
		return stats
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	normalized := ratio_setting.FormatMatchingModelName(model)
	requestPathFilter := []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestPath: requestPath}}
	for _, group := range groups {
		st := stats[group]
		ids, _ := filterCandidateIDs(group2model2channels[group][model], model, requestPathFilter)
		if len(ids) == 0 && normalized != "" && normalized != model {
			ids, _ = filterCandidateIDs(group2model2channels[group][normalized], model, requestPathFilter)
		}
		if len(ids) == 0 {
			continue
		}
		st.HasChannel = true
		for _, id := range ids {
			ch, ok := channelsIDM[id]
			if !ok {
				continue
			}
			if ch.GetPriority() > st.MaxPriority {
				st.MaxPriority = ch.GetPriority()
			}
			if ch.ResponseTime > 0 && (st.MinResponseTime == 0 || ch.ResponseTime < st.MinResponseTime) {
				st.MinResponseTime = ch.ResponseTime
			}
			st.SumWeight += ch.GetWeight()
			st.TotalRequest += ch.RequestCount
			st.TotalSuccess += ch.SuccessCount
		}
		if st.TotalRequest > 0 {
			st.SuccessRate = float64(st.TotalSuccess) / float64(st.TotalRequest)
		}
	}
	return stats
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
		channel2advancedCustomConfig = make(map[int]*kitdto.AdvancedCustomConfig)
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

// ---------------------------------------------------------------------------
// 渠道响应时间采集（智能路由 speed/success_rate 策略的数据源）
//
// relay 成功结算（service.PostTextConsumeQuota）时调用 CacheUpdateChannelResponseTime
// 更新内存缓存，并由后台协程定期 flush 到数据库。注意与 model/utils.go 的批量更新器
// 区分：那是 delta 累加（+=），而响应时间是 set 语义（覆盖），故单独维护 dirty map。
// ---------------------------------------------------------------------------

var channelResponseTimeDirty = make(map[int]int)
var channelResponseTimeLock sync.Mutex
var responseTimeFlusherOnce sync.Once

// CacheUpdateChannelResponseTime 记录渠道最近一次成功请求的响应时间（毫秒）。
// 先覆盖内存缓存（智能路由读它），再进 dirty map 等待落库。
func CacheUpdateChannelResponseTime(channelId int, ms int) {
	if channelId <= 0 || ms <= 0 {
		return
	}
	channelSyncLock.Lock()
	if channel, ok := channelsIDM[channelId]; ok {
		channel.ResponseTime = ms
	}
	channelSyncLock.Unlock()

	channelResponseTimeLock.Lock()
	channelResponseTimeDirty[channelId] = ms
	channelResponseTimeLock.Unlock()

	startResponseTimeFlusher()
}

// flushChannelResponseTimes 把 dirty map 中的响应时间按 set 语义写回数据库。
func flushChannelResponseTimes() {
	channelResponseTimeLock.Lock()
	if len(channelResponseTimeDirty) == 0 {
		channelResponseTimeLock.Unlock()
		return
	}
	dirty := channelResponseTimeDirty
	channelResponseTimeDirty = make(map[int]int)
	channelResponseTimeLock.Unlock()

	for channelId, ms := range dirty {
		if err := DB.Model(&Channel{}).Where("id = ?", channelId).UpdateColumn("response_time", ms).Error; err != nil {
			common.SysLog("failed to update channel response time: " + err.Error())
		}
	}
}

// startResponseTimeFlusher 懒启动后台刷新协程（首次采集时触发）。
func startResponseTimeFlusher() {
	responseTimeFlusherOnce.Do(func() {
		interval := common.BatchUpdateInterval
		if interval <= 0 {
			interval = 10
		}
		go func() {
			for {
				time.Sleep(time.Duration(interval) * time.Second)
				flushChannelResponseTimes()
			}
		}()
	})
}

// ---------------------------------------------------------------------------
// 渠道请求/成功计数（智能路由 success_rate 策略的数据源）
// 与 ResponseTime 相同的 dirty-map + flusher 模式，但这里是 delta 累加语义：
// 内存缓存存累计值（含未落库增量），dirty map 存 delta，后台协程定期累加写回 DB。
// ---------------------------------------------------------------------------

// ChannelCounter 一次未落库的计数增量。
type ChannelCounter struct {
	Request int64
	Success int64
}

var channelCountDirty = make(map[int]*ChannelCounter)
var channelCountLock sync.Mutex
var countFlusherOnce sync.Once

// CacheRecordChannelResult 记录一次渠道请求的成败（成功 = 结算前 HTTP 状态 < 400）。
// 先累加内存缓存（智能路由读它），再进 dirty map 等待落库。
func CacheRecordChannelResult(channelId int, success bool) {
	if channelId <= 0 {
		return
	}
	channelSyncLock.Lock()
	if channel, ok := channelsIDM[channelId]; ok {
		channel.RequestCount++
		if success {
			channel.SuccessCount++
		}
	}
	channelSyncLock.Unlock()

	channelCountLock.Lock()
	d := channelCountDirty[channelId]
	if d == nil {
		d = &ChannelCounter{}
		channelCountDirty[channelId] = d
	}
	d.Request++
	if success {
		d.Success++
	}
	channelCountLock.Unlock()

	startCountFlusher()
}

// flushChannelCounts 把 dirty map 中的计数增量累加写回数据库。
func flushChannelCounts() {
	channelCountLock.Lock()
	if len(channelCountDirty) == 0 {
		channelCountLock.Unlock()
		return
	}
	dirty := channelCountDirty
	channelCountDirty = make(map[int]*ChannelCounter)
	channelCountLock.Unlock()

	for channelId, d := range dirty {
		if err := DB.Exec("UPDATE channels SET request_count = request_count + ?, success_count = success_count + ? WHERE id = ?", d.Request, d.Success, channelId).Error; err != nil {
			common.SysLog("failed to update channel counts: " + err.Error())
		}
	}
}

// startCountFlusher 懒启动后台刷新协程（首次记录时触发）。
func startCountFlusher() {
	countFlusherOnce.Do(func() {
		interval := common.BatchUpdateInterval
		if interval <= 0 {
			interval = 10
		}
		go func() {
			for {
				time.Sleep(time.Duration(interval) * time.Second)
				flushChannelCounts()
			}
		}()
	})
}
