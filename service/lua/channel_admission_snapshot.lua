local max_concurrency = tonumber(ARGV[1]) or 0
local rpm_limit = tonumber(ARGV[2]) or 0
local rpm_window_ms = tonumber(ARGV[3])

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

return {concurrency_used, rpm_used}
