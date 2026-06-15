package channelflowmetrics

import (
	"context"
	"encoding/base64"
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
)

const redisActiveBucketTTL = 2 * time.Hour

const redisActiveBucketScript = `
local metric_key = KEYS[1]
local index_key = KEYS[2]
local ttl = tonumber(ARGV[1])
local member = ARGV[2]
redis.call("SADD", index_key, member)
redis.call("EXPIRE", index_key, ttl)

local idx = 3
local inc_count = tonumber(ARGV[idx])
idx = idx + 1
for i = 1, inc_count do
  local field = ARGV[idx]
  local value = tonumber(ARGV[idx + 1]) or 0
  if value ~= 0 then
    redis.call("HINCRBY", metric_key, field, value)
  end
  idx = idx + 2
end

local max_count = tonumber(ARGV[idx])
idx = idx + 1
for i = 1, max_count do
  local field = ARGV[idx]
  local value = tonumber(ARGV[idx + 1]) or 0
  if value > 0 then
    local current = tonumber(redis.call("HGET", metric_key, field) or "0")
    if value > current then
      redis.call("HSET", metric_key, field, value)
    end
  end
  idx = idx + 2
end

redis.call("EXPIRE", metric_key, ttl)
return 1
`

var redisActiveBucketLua = redis.NewScript(redisActiveBucketScript)

func recordRedis(key bucketKey, sample Sample) {
	if !common.RedisEnabled || common.RDB == nil {
		return
	}
	c := countersFromSample(sample)
	if !c.hasData() {
		return
	}

	metricKey := redisMetricKey(key)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_ = redisActiveBucketLua.Run(
		ctx,
		common.RDB,
		[]string{metricKey, redisIndexKey(key.poolKey, key.bucketTs)},
		redisRecordArgs(metricKey, c)...,
	).Err()
}

func mergeRedisActiveBucket(merged map[int64]counters, poolKey string, bucketTs int64) bool {
	if !common.RedisEnabled || common.RDB == nil || poolKey == "" || bucketTs <= 0 {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	members, err := common.RDB.SMembers(ctx, redisIndexKey(poolKey, bucketTs)).Result()
	if err != nil || len(members) == 0 {
		return false
	}
	pipe := common.RDB.Pipeline()
	cmds := make([]*redis.StringStringMapCmd, 0, len(members))
	for _, member := range members {
		cmds = append(cmds, pipe.HGetAll(ctx, member))
	}
	if _, err = pipe.Exec(ctx); err != nil && err != redis.Nil {
		return false
	}

	mergedAny := false
	for _, cmd := range cmds {
		value := redisCounters(cmd.Val())
		if !value.hasData() {
			continue
		}
		mergeCounters(merged, bucketTs, value)
		mergedAny = true
	}
	return mergedAny
}

func redisRecordArgs(metricKey string, c counters) []interface{} {
	increments := []interface{}{
		"sample_count", c.sampleCount,
		"running_sum", c.runningSum,
		"queued_sum", c.queuedSum,
		"acquired_count", c.acquiredCount,
		"queued_count", c.queuedCount,
		"succeeded_count", c.succeededCount,
		"failed_count", c.failedCount,
		"released_count", c.releasedCount,
		"rejected_count", c.rejectedCount,
		"timeout_count", c.timeoutCount,
		"cancelled_count", c.cancelledCount,
		"billing_failed_count", c.billingFailedCount,
		"lease_renew_fail", c.leaseRenewFail,
		"lease_expired_count", c.leaseExpiredCount,
		"wait_ms_sum", c.waitMsSum,
		"wait_sample_count", c.waitSampleCount,
		"process_ms_sum", c.processMsSum,
		"process_sample_count", c.processSampleCount,
	}
	maxes := []interface{}{
		"running_max", c.runningMax,
		"queued_max", c.queuedMax,
		"wait_ms_max", c.waitMsMax,
		"process_ms_max", c.processMsMax,
	}
	args := []interface{}{
		int(redisActiveBucketTTL.Seconds()),
		metricKey,
		len(increments) / 2,
	}
	args = append(args, increments...)
	args = append(args, len(maxes)/2)
	args = append(args, maxes...)
	return args
}

func redisCounters(values map[string]string) counters {
	return counters{
		sampleCount:        parseRedisInt(values["sample_count"]),
		runningSum:         parseRedisInt(values["running_sum"]),
		runningMax:         parseRedisInt(values["running_max"]),
		queuedSum:          parseRedisInt(values["queued_sum"]),
		queuedMax:          parseRedisInt(values["queued_max"]),
		acquiredCount:      parseRedisInt(values["acquired_count"]),
		queuedCount:        parseRedisInt(values["queued_count"]),
		succeededCount:     parseRedisInt(values["succeeded_count"]),
		failedCount:        parseRedisInt(values["failed_count"]),
		releasedCount:      parseRedisInt(values["released_count"]),
		rejectedCount:      parseRedisInt(values["rejected_count"]),
		timeoutCount:       parseRedisInt(values["timeout_count"]),
		cancelledCount:     parseRedisInt(values["cancelled_count"]),
		billingFailedCount: parseRedisInt(values["billing_failed_count"]),
		leaseRenewFail:     parseRedisInt(values["lease_renew_fail"]),
		leaseExpiredCount:  parseRedisInt(values["lease_expired_count"]),
		waitMsSum:          parseRedisInt(values["wait_ms_sum"]),
		waitSampleCount:    parseRedisInt(values["wait_sample_count"]),
		waitMsMax:          parseRedisInt(values["wait_ms_max"]),
		processMsSum:       parseRedisInt(values["process_ms_sum"]),
		processSampleCount: parseRedisInt(values["process_sample_count"]),
		processMsMax:       parseRedisInt(values["process_ms_max"]),
	}
}

func parseRedisInt(value string) int64 {
	if value == "" {
		return 0
	}
	parsed, _ := strconv.ParseInt(value, 10, 64)
	return parsed
}

func redisIndexKey(poolKey string, bucketTs int64) string {
	return fmt.Sprintf("channel_flow:metrics:%s:%d:index", poolKey, bucketTs)
}

func redisMetricKey(key bucketKey) string {
	modelKey := base64.RawURLEncoding.EncodeToString([]byte(key.model))
	return fmt.Sprintf("channel_flow:metrics:%s:%d:%s:%d", key.poolKey, key.channelID, modelKey, key.bucketTs)
}
