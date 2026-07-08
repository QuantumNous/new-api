package service

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

var channelConcurrencyAcquireScriptSrc = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
local token = ARGV[3]

local redis_time = redis.call('TIME')
local now = tonumber(redis_time[1]) * 1000 + math.floor(tonumber(redis_time[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', key, '-inf', now)

if redis.call('ZSCORE', key, token) then
	redis.call('ZADD', key, now + ttl, token)
	redis.call('PEXPIRE', key, ttl)
	return 1
end

local count = redis.call('ZCARD', key)
if count >= max then
	redis.call('PEXPIRE', key, ttl)
	return 0
end

redis.call('ZADD', key, now + ttl, token)
redis.call('PEXPIRE', key, ttl)
return 1
`

var channelConcurrencyAcquireScript = redis.NewScript(channelConcurrencyAcquireScriptSrc)

type ChannelConcurrencyLease struct {
	ChannelID int

	token    string
	useRedis bool
	released atomic.Bool
}

type ChannelConcurrencyLoad struct {
	ChannelID      int
	MaxConcurrency int
	Active         int
	Waiting        int
	CoolingDown    bool
	LoadRate       float64
}

var (
	channelConcurrencyMemoryMu        sync.Mutex
	channelConcurrencyMemorySlots     = make(map[int]map[string]time.Time)
	channelConcurrencyMemoryWaits     = make(map[int]int)
	channelConcurrencyMemoryCooldowns = make(map[int]time.Time)
	channelConcurrencyRequestPrefix   = common.GetUUID()
)

func TryAcquireChannelConcurrency(ctx context.Context, channel *model.Channel) (*ChannelConcurrencyLease, bool, error) {
	return tryAcquireChannelConcurrencyWithToken(ctx, channel, newChannelConcurrencyToken())
}

func AcquireChannelConcurrencyWithWait(ctx context.Context, channel *model.Channel) (*ChannelConcurrencyLease, bool, error) {
	lease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	if err != nil || ok {
		return lease, ok, err
	}
	if channel == nil {
		return nil, false, fmt.Errorf("channel is nil")
	}
	maxConcurrency := channel.GetMaxConcurrency()
	if maxConcurrency <= 0 {
		return nil, true, nil
	}
	if !operation_setting.IsChannelConcurrencyWaitEnabled() {
		return nil, false, nil
	}
	if ctx == nil {
		ctx = context.Background()
	}

	waiting, err := incrementChannelConcurrencyWaiting(ctx, channel.Id, maxConcurrency)
	if err != nil {
		return nil, false, err
	}
	if waiting > operation_setting.GetChannelConcurrencyMaxWaiting(maxConcurrency) {
		_ = decrementChannelConcurrencyWaiting(ctx, channel.Id)
		return nil, false, ErrChannelConcurrencyLimit
	}
	defer func() {
		_ = decrementChannelConcurrencyWaiting(context.Background(), channel.Id)
	}()

	waitCtx, cancel := context.WithTimeout(ctx, operation_setting.GetChannelConcurrencyWaitTimeout())
	defer cancel()

	ticker := time.NewTicker(operation_setting.GetChannelConcurrencyWaitInterval())
	defer ticker.Stop()

	for {
		select {
		case <-waitCtx.Done():
			return nil, false, ErrChannelConcurrencyLimit
		case <-ticker.C:
			lease, ok, err = TryAcquireChannelConcurrency(waitCtx, channel)
			if err != nil || ok {
				return lease, ok, err
			}
		}
	}
}

func tryAcquireChannelConcurrencyWithToken(ctx context.Context, channel *model.Channel, token string) (*ChannelConcurrencyLease, bool, error) {
	if channel == nil {
		return nil, false, fmt.Errorf("channel is nil")
	}

	if ctx == nil {
		ctx = context.Background()
	}

	coolingDown, err := isChannelConcurrencyCoolingDown(ctx, channel.Id)
	if err != nil {
		return nil, false, err
	}
	if coolingDown {
		return nil, false, nil
	}

	maxConcurrency := channel.GetMaxConcurrency()
	if maxConcurrency <= 0 {
		return nil, true, nil
	}

	lease := &ChannelConcurrencyLease{
		ChannelID: channel.Id,
		token:     token,
		useRedis:  common.RedisEnabled && common.RDB != nil,
	}

	if lease.useRedis {
		ok, err := acquireRedisChannelConcurrency(ctx, channel.Id, maxConcurrency, token)
		if err != nil {
			common.SysError(fmt.Sprintf("acquire channel concurrency in redis failed, fallback to memory: channel_id=%d, error=%s", channel.Id, err.Error()))
			lease.useRedis = false
		} else if !ok {
			return nil, false, nil
		} else {
			return lease, true, nil
		}
	}

	if !acquireMemoryChannelConcurrency(channel.Id, maxConcurrency, token) {
		return nil, false, nil
	}
	return lease, true, nil
}

func GetChannelConcurrencyLoads(ctx context.Context, channels []*model.Channel) (map[int]ChannelConcurrencyLoad, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	loads := make(map[int]ChannelConcurrencyLoad, len(channels))
	if len(channels) == 0 {
		return loads, nil
	}
	for _, channel := range channels {
		if channel == nil {
			continue
		}
		loads[channel.Id] = ChannelConcurrencyLoad{
			ChannelID:      channel.Id,
			MaxConcurrency: channel.GetMaxConcurrency(),
		}
	}

	if common.RedisEnabled && common.RDB != nil {
		redisLoads, err := getRedisChannelConcurrencyLoads(ctx, loads)
		if err == nil {
			return redisLoads, nil
		}
		common.SysError(fmt.Sprintf("get channel concurrency loads from redis failed, fallback to memory: %s", err.Error()))
	}

	return getMemoryChannelConcurrencyLoads(loads), nil
}

func MarkChannelConcurrencyCooldown(ctx context.Context, channelID int, duration time.Duration, reason string) error {
	if !operation_setting.IsChannelConcurrencyCooldownEnabled() {
		return nil
	}
	if channelID <= 0 {
		return fmt.Errorf("channel id is invalid")
	}
	if duration <= 0 {
		duration = operation_setting.GetChannelConcurrencyCooldown()
	}
	if ctx == nil {
		ctx = context.Background()
	}

	if common.RedisEnabled && common.RDB != nil {
		if err := common.RDB.Set(ctx, channelConcurrencyCooldownRedisKey(channelID), reason, duration).Err(); err == nil {
			return nil
		} else {
			common.SysError(fmt.Sprintf("mark channel concurrency cooldown in redis failed, fallback to memory: channel_id=%d, error=%s", channelID, err.Error()))
		}
	}

	channelConcurrencyMemoryMu.Lock()
	defer channelConcurrencyMemoryMu.Unlock()
	channelConcurrencyMemoryCooldowns[channelID] = time.Now().Add(duration)
	return nil
}

func isChannelConcurrencyCoolingDown(ctx context.Context, channelID int) (bool, error) {
	if !operation_setting.IsChannelConcurrencyCooldownEnabled() || channelID <= 0 {
		return false, nil
	}
	if ctx == nil {
		ctx = context.Background()
	}

	if common.RedisEnabled && common.RDB != nil {
		coolingDown, err := common.RDB.Exists(ctx, channelConcurrencyCooldownRedisKey(channelID)).Result()
		if err == nil {
			return coolingDown > 0, nil
		}
		common.SysError(fmt.Sprintf("check channel concurrency cooldown in redis failed, fallback to memory: channel_id=%d, error=%s", channelID, err.Error()))
	}

	channelConcurrencyMemoryMu.Lock()
	defer channelConcurrencyMemoryMu.Unlock()
	cooldownUntil, ok := channelConcurrencyMemoryCooldowns[channelID]
	return ok && cooldownUntil.After(time.Now()), nil
}

func ReleaseChannelConcurrency(ctx context.Context, lease *ChannelConcurrencyLease) error {
	if lease == nil {
		return nil
	}
	if !lease.released.CompareAndSwap(false, true) {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}

	if lease.useRedis {
		if common.RDB == nil {
			return nil
		}
		return common.RDB.ZRem(ctx, channelConcurrencyRedisKey(lease.ChannelID), lease.token).Err()
	}

	releaseMemoryChannelConcurrency(lease.ChannelID, lease.token)
	return nil
}

func EnsureChannelConcurrencyForContext(c *gin.Context, channel *model.Channel) (bool, error) {
	if c == nil {
		return false, fmt.Errorf("gin context is nil")
	}
	if channel == nil {
		return false, fmt.Errorf("channel is nil")
	}
	if lease := getChannelConcurrencyLeaseForContext(c); lease != nil {
		if lease.ChannelID == channel.Id {
			return true, nil
		}
		if err := ReleaseChannelConcurrencyForContext(c); err != nil {
			return false, err
		}
	}
	return AcquireChannelConcurrencyForContext(c, channel)
}

func EnsureChannelConcurrencyWithWaitForContext(c *gin.Context, channel *model.Channel) (bool, error) {
	if c == nil {
		return false, fmt.Errorf("gin context is nil")
	}
	if channel == nil {
		return false, fmt.Errorf("channel is nil")
	}
	if lease := getChannelConcurrencyLeaseForContext(c); lease != nil {
		if lease.ChannelID == channel.Id {
			return true, nil
		}
		if err := ReleaseChannelConcurrencyForContext(c); err != nil {
			return false, err
		}
	}
	return AcquireChannelConcurrencyWithWaitForContext(c, channel)
}

func AcquireChannelConcurrencyForContext(c *gin.Context, channel *model.Channel) (bool, error) {
	if c == nil {
		return false, fmt.Errorf("gin context is nil")
	}
	ctx := context.Background()
	if c.Request != nil {
		ctx = c.Request.Context()
	}
	lease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	if err != nil || !ok {
		return ok, err
	}
	if lease != nil && c != nil {
		common.SetContextKey(c, constant.ContextKeyChannelConcurrencyLease, lease)
	}
	return true, nil
}

func AcquireChannelConcurrencyWithWaitForContext(c *gin.Context, channel *model.Channel) (bool, error) {
	if c == nil {
		return false, fmt.Errorf("gin context is nil")
	}
	ctx := context.Background()
	if c.Request != nil {
		ctx = c.Request.Context()
	}
	lease, ok, err := AcquireChannelConcurrencyWithWait(ctx, channel)
	if err != nil || !ok {
		return ok, err
	}
	if lease != nil {
		common.SetContextKey(c, constant.ContextKeyChannelConcurrencyLease, lease)
	}
	return true, nil
}

func ReleaseChannelConcurrencyForContext(c *gin.Context) error {
	if c == nil {
		return nil
	}
	lease := getChannelConcurrencyLeaseForContext(c)
	if lease == nil {
		return nil
	}
	c.Set(string(constant.ContextKeyChannelConcurrencyLease), nil)

	return ReleaseChannelConcurrency(context.Background(), lease)
}

func getChannelConcurrencyLeaseForContext(c *gin.Context) *ChannelConcurrencyLease {
	if c == nil {
		return nil
	}
	value, ok := common.GetContextKey(c, constant.ContextKeyChannelConcurrencyLease)
	if !ok || value == nil {
		return nil
	}
	lease, _ := value.(*ChannelConcurrencyLease)
	return lease
}

func acquireRedisChannelConcurrency(ctx context.Context, channelID int, maxConcurrency int, token string) (bool, error) {
	result, err := channelConcurrencyAcquireScript.Run(
		ctx,
		common.RDB,
		[]string{channelConcurrencyRedisKey(channelID)},
		operation_setting.GetChannelConcurrencySlotTTL().Milliseconds(),
		maxConcurrency,
		token,
	).Int()
	if err != nil {
		return false, fmt.Errorf("acquire channel concurrency in redis failed: %w", err)
	}
	return result == 1, nil
}

func channelConcurrencyRedisKey(channelID int) string {
	return fmt.Sprintf("new-api:channel_concurrency:%d", channelID)
}

func channelConcurrencyWaitingRedisKey(channelID int) string {
	return fmt.Sprintf("new-api:channel_concurrency_wait:%d", channelID)
}

func channelConcurrencyCooldownRedisKey(channelID int) string {
	return fmt.Sprintf("new-api:channel_concurrency_cooldown:%d", channelID)
}

func newChannelConcurrencyToken() string {
	return channelConcurrencyRequestPrefix + ":" + common.GetUUID()
}

func getRedisChannelConcurrencyLoads(ctx context.Context, initial map[int]ChannelConcurrencyLoad) (map[int]ChannelConcurrencyLoad, error) {
	now := time.Now()
	if redisNow, err := common.RDB.Time(ctx).Result(); err == nil {
		now = redisNow
	} else {
		return nil, err
	}

	type loadCommands struct {
		channelID   int
		activeCmd   *redis.IntCmd
		waitingCmd  *redis.StringCmd
		cooldownCmd *redis.IntCmd
	}

	pipe := common.RDB.Pipeline()
	commands := make([]loadCommands, 0, len(initial))
	for channelID := range initial {
		key := channelConcurrencyRedisKey(channelID)
		pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(now.UnixMilli(), 10))
		commands = append(commands, loadCommands{
			channelID:   channelID,
			activeCmd:   pipe.ZCard(ctx, key),
			waitingCmd:  pipe.Get(ctx, channelConcurrencyWaitingRedisKey(channelID)),
			cooldownCmd: pipe.Exists(ctx, channelConcurrencyCooldownRedisKey(channelID)),
		})
	}
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, err
	}

	loads := make(map[int]ChannelConcurrencyLoad, len(initial))
	for channelID, load := range initial {
		loads[channelID] = load
	}
	for _, command := range commands {
		load := loads[command.channelID]
		if active, err := command.activeCmd.Result(); err == nil {
			load.Active = int(active)
		}
		if waitingValue, err := command.waitingCmd.Result(); err == nil {
			if waiting, parseErr := strconv.Atoi(waitingValue); parseErr == nil && waiting > 0 {
				load.Waiting = waiting
			}
		}
		if coolingDown, err := command.cooldownCmd.Result(); err == nil {
			load.CoolingDown = coolingDown > 0
		}
		load.LoadRate = calculateChannelConcurrencyLoadRate(load.Active, load.Waiting, load.MaxConcurrency)
		loads[command.channelID] = load
	}
	return loads, nil
}

func acquireMemoryChannelConcurrency(channelID int, maxConcurrency int, token string) bool {
	channelConcurrencyMemoryMu.Lock()
	defer channelConcurrencyMemoryMu.Unlock()

	now := time.Now()
	cleanupMemoryChannelConcurrencyLocked(now)
	slots := channelConcurrencyMemorySlots[channelID]
	if slots == nil {
		slots = make(map[string]time.Time)
		channelConcurrencyMemorySlots[channelID] = slots
	}

	if _, exists := slots[token]; exists {
		slots[token] = now.Add(operation_setting.GetChannelConcurrencySlotTTL())
		return true
	}

	if len(slots) >= maxConcurrency {
		return false
	}
	slots[token] = now.Add(operation_setting.GetChannelConcurrencySlotTTL())
	return true
}

func releaseMemoryChannelConcurrency(channelID int, token string) {
	channelConcurrencyMemoryMu.Lock()
	defer channelConcurrencyMemoryMu.Unlock()

	slots := channelConcurrencyMemorySlots[channelID]
	if slots == nil {
		return
	}
	delete(slots, token)
	if len(slots) == 0 {
		delete(channelConcurrencyMemorySlots, channelID)
	}
}

func incrementChannelConcurrencyWaiting(ctx context.Context, channelID int, maxConcurrency int) (int, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if common.RedisEnabled && common.RDB != nil {
		value, err := common.RDB.Incr(ctx, channelConcurrencyWaitingRedisKey(channelID)).Result()
		if err == nil {
			_ = common.RDB.Expire(ctx, channelConcurrencyWaitingRedisKey(channelID), operation_setting.GetChannelConcurrencyWaitTimeout()+time.Minute).Err()
			return int(value), nil
		}
		common.SysError(fmt.Sprintf("increment channel concurrency waiting in redis failed, fallback to memory: channel_id=%d, error=%s", channelID, err.Error()))
	}

	channelConcurrencyMemoryMu.Lock()
	defer channelConcurrencyMemoryMu.Unlock()
	channelConcurrencyMemoryWaits[channelID]++
	return channelConcurrencyMemoryWaits[channelID], nil
}

func decrementChannelConcurrencyWaiting(ctx context.Context, channelID int) error {
	if ctx == nil {
		ctx = context.Background()
	}
	if common.RedisEnabled && common.RDB != nil {
		key := channelConcurrencyWaitingRedisKey(channelID)
		value, err := common.RDB.Decr(ctx, key).Result()
		if err == nil {
			if value <= 0 {
				_ = common.RDB.Del(ctx, key).Err()
			}
			return nil
		}
		common.SysError(fmt.Sprintf("decrement channel concurrency waiting in redis failed, fallback to memory: channel_id=%d, error=%s", channelID, err.Error()))
	}

	channelConcurrencyMemoryMu.Lock()
	defer channelConcurrencyMemoryMu.Unlock()
	if channelConcurrencyMemoryWaits[channelID] <= 1 {
		delete(channelConcurrencyMemoryWaits, channelID)
		return nil
	}
	channelConcurrencyMemoryWaits[channelID]--
	return nil
}

func getMemoryChannelConcurrencyLoads(initial map[int]ChannelConcurrencyLoad) map[int]ChannelConcurrencyLoad {
	channelConcurrencyMemoryMu.Lock()
	defer channelConcurrencyMemoryMu.Unlock()

	now := time.Now()
	cleanupMemoryChannelConcurrencyLocked(now)

	loads := make(map[int]ChannelConcurrencyLoad, len(initial))
	for channelID, load := range initial {
		load.Active = len(channelConcurrencyMemorySlots[channelID])
		load.Waiting = channelConcurrencyMemoryWaits[channelID]
		if cooldownUntil, ok := channelConcurrencyMemoryCooldowns[channelID]; ok {
			load.CoolingDown = cooldownUntil.After(now)
		}
		load.LoadRate = calculateChannelConcurrencyLoadRate(load.Active, load.Waiting, load.MaxConcurrency)
		loads[channelID] = load
	}
	return loads
}

func cleanupMemoryChannelConcurrencyLocked(now time.Time) {
	for channelID, slots := range channelConcurrencyMemorySlots {
		for token, expiresAt := range slots {
			if !expiresAt.After(now) {
				delete(slots, token)
			}
		}
		if len(slots) == 0 {
			delete(channelConcurrencyMemorySlots, channelID)
		}
	}
	for channelID, expiresAt := range channelConcurrencyMemoryCooldowns {
		if !expiresAt.After(now) {
			delete(channelConcurrencyMemoryCooldowns, channelID)
		}
	}
}

func calculateChannelConcurrencyLoadRate(active int, waiting int, maxConcurrency int) float64 {
	if maxConcurrency <= 0 {
		return 0
	}
	return float64(active+waiting) / float64(maxConcurrency)
}

func resetChannelConcurrencyForTest() {
	channelConcurrencyMemoryMu.Lock()
	defer channelConcurrencyMemoryMu.Unlock()
	channelConcurrencyMemorySlots = make(map[int]map[string]time.Time)
	channelConcurrencyMemoryWaits = make(map[int]int)
	channelConcurrencyMemoryCooldowns = make(map[int]time.Time)
}
