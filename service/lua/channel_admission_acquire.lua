local max_concurrency = tonumber(ARGV[1]) or 0
local rpm_limit = tonumber(ARGV[2]) or 0
local lease_id = ARGV[3]
local lease_ttl_ms = tonumber(ARGV[4])
local rpm_window_ms = tonumber(ARGV[5])

local redis_time = redis.call('TIME')
local now_ms = tonumber(redis_time[1]) * 1000 + math.floor(tonumber(redis_time[2]) / 1000)

local concurrency_used = 0
if max_concurrency > 0 then
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now_ms)
  concurrency_used = redis.call('ZCARD', KEYS[1])
end

local rpm_used = 0
if rpm_limit > 0 then
  redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now_ms - rpm_window_ms)
  rpm_used = redis.call('ZCARD', KEYS[2])
end

if max_concurrency > 0 and concurrency_used >= max_concurrency then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retry_after = 1
  if #oldest >= 2 then
    retry_after = math.max(1, math.floor((tonumber(oldest[2]) - now_ms + 999) / 1000))
  end
  return {0, 1, concurrency_used, rpm_used, retry_after}
end

if rpm_limit > 0 and rpm_used >= rpm_limit then
  local oldest = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
  local retry_after = 1
  if #oldest >= 2 then
    retry_after = math.max(1, math.floor((tonumber(oldest[2]) + rpm_window_ms - now_ms + 999) / 1000))
  end
  return {0, 2, concurrency_used, rpm_used, retry_after}
end

if max_concurrency > 0 then
  redis.call('ZADD', KEYS[1], now_ms + lease_ttl_ms, lease_id)
  redis.call('PEXPIRE', KEYS[1], lease_ttl_ms * 2)
  concurrency_used = concurrency_used + 1
end
if rpm_limit > 0 then
  redis.call('ZADD', KEYS[2], now_ms, lease_id)
  redis.call('PEXPIRE', KEYS[2], rpm_window_ms + 5000)
  rpm_used = rpm_used + 1
end

return {1, 0, concurrency_used, rpm_used, 0}
